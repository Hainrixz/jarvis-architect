// Jarvis Panel — file operations inside JARVIS_HOME: memory, jobs, approvals, audit log.
// Every path is built from a fixed allowlist or a validated id; nothing from the request
// is ever joined into a path unchecked.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const MEMORY_FILES = ['SOUL.md', 'USER.md', 'MEMORY.md', 'HEARTBEAT.md', 'AGENTS.md', 'TOOLS.md'];
export const EDITABLE_FILES = new Set(['MEMORY.md', 'USER.md', 'SOUL.md', 'HEARTBEAT.md']);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const MAX_MEMORY_BYTES = 256 * 1024;
const LOG_TAIL_BYTES = 1024 * 1024;

export class StoreError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isValidId(id) {
  return typeof id === 'string' && ID_RE.test(id) && !id.includes('..');
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Write atomically: tmp file in the same dir, fsync, rename over the target. */
export async function atomicWrite(file, data, mode) {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${randomBytes(6).toString('hex')}.tmp`);
  const fh = await fs.open(tmp, 'wx', mode ?? 0o600);
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fs.rename(tmp, file);
}

const MAX_PROMPT_BYTES = 64 * 1024;

export function createStore({ jarvisHome, memoryDir, approvalTtlMs = 5 * 60 * 1000 }) {
  const home = path.resolve(jarvisHome);
  // Workspace files may live in a subfolder (claude-agent-sdk: <home>/workspace) or in the
  // harness's own folder (Hermes: ~/.hermes/memories). Logs, jobs and approvals stay in home.
  const memDir = memoryDir ? path.resolve(home, memoryDir) : home;
  const logsDir = path.join(home, 'logs');
  const auditFile = path.join(logsDir, 'audit.jsonl');
  const jobsFile = path.join(home, 'jobs.json');
  const pendingDir = path.join(home, 'approvals', 'pending');
  const decidedDir = path.join(home, 'approvals', 'decided');
  let jobsLock = Promise.resolve();

  function memoryPath(name) {
    if (typeof name !== 'string' || !MEMORY_FILES.includes(name)) {
      throw new StoreError(400, 'invalid_name', `Archivo no permitido. Solo: ${MEMORY_FILES.join(', ')}.`);
    }
    return path.join(memDir, name);
  }

  // ---------- memory ----------
  async function listMemory() {
    const out = [];
    for (const name of MEMORY_FILES) {
      try {
        const st = await fs.lstat(path.join(memDir, name)); // symlinks are not listed (readMemory refuses them too)
        if (!st.isFile()) continue;
        out.push({ name, editable: EDITABLE_FILES.has(name), updated_at: st.mtime.toISOString(), bytes: st.size });
      } catch {
        /* not present */
      }
    }
    return out;
  }

  async function readMemory(name) {
    const file = memoryPath(name);
    let st;
    try {
      st = await fs.lstat(file);
    } catch {
      throw new StoreError(404, 'not_found', `${name} no existe todavía.`);
    }
    if (!st.isFile()) throw new StoreError(403, 'not_a_file', `${name} no es un archivo normal.`);
    const content = await fs.readFile(file, 'utf8');
    return { name, content, editable: EDITABLE_FILES.has(name) };
  }

  async function writeMemory(name, content) {
    const file = memoryPath(name);
    if (!EDITABLE_FILES.has(name)) {
      throw new StoreError(403, 'read_only', `${name} es de solo lectura desde el panel (se cambia desde la terminal).`);
    }
    if (typeof content !== 'string') throw new StoreError(400, 'invalid_content', 'content debe ser texto.');
    if (Buffer.byteLength(content, 'utf8') > MAX_MEMORY_BYTES) {
      throw new StoreError(413, 'too_large', `El archivo no puede pasar de ${MAX_MEMORY_BYTES / 1024} KB.`);
    }
    try {
      const st = await fs.lstat(file);
      if (!st.isFile()) throw new StoreError(403, 'not_a_file', `${name} no es un archivo normal.`);
      // Previous version, one level of undo. Written with atomicWrite (tmp + rename) instead of
      // copyFile so a planted `MEMORY.md.bak` symlink can't redirect the write outside JARVIS_HOME.
      await atomicWrite(`${file}.bak`, await fs.readFile(file), 0o600);
    } catch (e) {
      if (e instanceof StoreError) throw e;
      if (e.code !== 'ENOENT') throw e;
    }
    await atomicWrite(file, content, 0o600);
    const st = await fs.stat(file);
    return { name, editable: true, updated_at: st.mtime.toISOString(), bytes: st.size };
  }

  // ---------- jobs ----------
  async function readJobsRaw() {
    let raw;
    try {
      raw = await fs.readFile(jobsFile, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return { shape: 'array', jobs: [] };
      throw e;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new StoreError(500, 'bad_jobs_file', 'jobs.json no es JSON válido.');
    }
    if (Array.isArray(data)) return { shape: 'array', jobs: data, data };
    if (data && Array.isArray(data.jobs)) return { shape: 'object', jobs: data.jobs, data };
    throw new StoreError(500, 'bad_jobs_file', 'jobs.json debe ser una lista de tareas.');
  }

  function publicJob(j) {
    return {
      id: String(j.id ?? ''),
      name: String(j.name ?? j.id ?? ''),
      schedule: j.schedule ?? null,
      description: j.description ?? '',
      last_run: j.last_run ?? null,
      last_status: j.last_status ?? null,
    };
  }

  async function listJobs() {
    const { jobs } = await readJobsRaw();
    return jobs.filter((j) => j && typeof j === 'object').map(publicJob);
  }

  async function getJob(id) {
    if (!isValidId(id)) throw new StoreError(400, 'invalid_id', 'id de tarea inválido.');
    const { jobs } = await readJobsRaw();
    const job = jobs.find((j) => j && String(j.id) === id);
    if (!job) throw new StoreError(404, 'not_found', 'Esa tarea no existe.');
    return job;
  }

  /**
   * The prompt a job runs: inline `prompt`, or `prompt_file` (a path relative to JARVIS_HOME,
   * e.g. "jobs/briefing.md"). The file must resolve inside JARVIS_HOME, be a regular file (no
   * symlink) and stay under 64 KB. Returns '' when the job has neither.
   */
  async function getJobPrompt(job) {
    if (typeof job.prompt === 'string' && job.prompt.trim()) return job.prompt.trim();
    if (typeof job.prompt_file !== 'string' || !job.prompt_file.trim()) return '';
    const rel = job.prompt_file.trim();
    const file = path.resolve(home, rel);
    if (path.isAbsolute(rel) || rel.includes('..') || !file.startsWith(home + path.sep)) {
      throw new StoreError(400, 'bad_prompt_file', 'prompt_file debe ser una ruta dentro de la carpeta de Jarvis.');
    }
    let st;
    try {
      st = await fs.lstat(file);
    } catch {
      throw new StoreError(404, 'prompt_file_missing', `No encontré ${rel}.`);
    }
    if (!st.isFile()) throw new StoreError(403, 'not_a_file', `${rel} no es un archivo normal.`);
    // A symlinked parent folder must not lead outside JARVIS_HOME either.
    const [realFile, realHome] = await Promise.all([fs.realpath(file), fs.realpath(home)]);
    if (!realFile.startsWith(realHome + path.sep)) {
      throw new StoreError(400, 'bad_prompt_file', 'prompt_file debe ser una ruta dentro de la carpeta de Jarvis.');
    }
    if (st.size > MAX_PROMPT_BYTES) throw new StoreError(413, 'too_large', `${rel} pasa de 64 KB.`);
    return (await fs.readFile(file, 'utf8')).trim();
  }

  /** Update last_run/last_status (and anything in `patch`) for one job, serialized + atomic. */
  function updateJob(id, patch) {
    const run = jobsLock.then(async () => {
      const r = await readJobsRaw();
      const job = r.jobs.find((j) => j && String(j.id) === id);
      if (!job) return;
      Object.assign(job, patch);
      const out = r.shape === 'object' ? r.data : r.jobs;
      await atomicWrite(jobsFile, JSON.stringify(out, null, 2) + '\n', 0o600);
    });
    jobsLock = run.catch(() => {});
    return run;
  }

  async function writeJobOutput(id, text) {
    const dir = path.join(logsDir, 'jobs');
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await atomicWrite(path.join(dir, `${id}-${stamp}.md`), text, 0o600);
  }

  // ---------- approvals ----------
  function approvalView(id, data, st) {
    // created_at comes from the file; never trust it to be later than the file itself, or a
    // future timestamp would keep an approval alive forever.
    const mtime = st?.mtime ? st.mtime.getTime() : Date.now();
    let createdMs = Date.parse(data.created_at);
    if (Number.isNaN(createdMs) || createdMs > mtime + 60_000) createdMs = mtime;
    // Hard ceiling: 5 minutes after creation, whatever expires_at says (SEC-14).
    let expiresMs = createdMs + approvalTtlMs;
    const fileExpires = Date.parse(data.expires_at);
    if (!Number.isNaN(fileExpires)) expiresMs = Math.min(expiresMs, fileExpires);
    const created = new Date(createdMs).toISOString();
    const expires = new Date(expiresMs).toISOString();
    return {
      id,
      action: String(data.action ?? ''),
      preview: typeof data.preview === 'string' ? data.preview : JSON.stringify(data.preview ?? '', null, 2),
      created_at: created,
      expires_at: expires,
    };
  }

  function isExpired(view) {
    const t = Date.parse(view.expires_at);
    return Number.isNaN(t) || t <= Date.now();
  }

  async function listApprovals() {
    let names;
    try {
      names = await fs.readdir(pendingDir);
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    const out = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      const id = n.slice(0, -5);
      if (!isValidId(id)) continue;
      const file = path.join(pendingDir, n);
      try {
        const st = await fs.lstat(file);
        if (!st.isFile()) continue;
        const data = JSON.parse(await fs.readFile(file, 'utf8'));
        out.push({ ...approvalView(id, data, st), expired: isExpired(approvalView(id, data, st)) });
      } catch {
        /* skip unreadable */
      }
    }
    out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return out;
  }

  async function decideApproval(id, decision) {
    if (!isValidId(id)) throw new StoreError(400, 'invalid_id', 'id de aprobación inválido.');
    if (decision !== 'approve' && decision !== 'reject') {
      throw new StoreError(400, 'invalid_decision', 'decision debe ser "approve" o "reject".');
    }
    const file = path.join(pendingDir, `${id}.json`);
    let data, st;
    try {
      st = await fs.lstat(file);
      if (!st.isFile()) throw new Error('not file');
      data = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      throw new StoreError(404, 'not_found', 'Esa aprobación ya no está pendiente.');
    }
    const view = approvalView(id, data, st);
    if (decision === 'approve' && isExpired(view)) {
      throw new StoreError(409, 'expired', 'Esta aprobación ya expiró (5 min). Pídele a tu Jarvis que la vuelva a generar.');
    }
    // Claim the file atomically so two clicks can't decide it twice.
    const claimed = path.join(pendingDir, `.${id}.${randomBytes(4).toString('hex')}.deciding`);
    try {
      await fs.rename(file, claimed);
    } catch {
      throw new StoreError(409, 'already_decided', 'Esa aprobación ya se decidió.');
    }
    const decided = {
      ...data,
      id,
      decision,
      decided_at: new Date().toISOString(),
      decided_by: 'panel',
      expired_at_decision: isExpired(view),
    };
    await atomicWrite(path.join(decidedDir, `${id}.json`), JSON.stringify(decided, null, 2) + '\n', 0o600);
    await fs.unlink(claimed).catch(() => {});
    return { id, decision, decided_at: decided.decided_at };
  }

  // ---------- audit log ----------
  async function audit(entry) {
    try {
      await fs.mkdir(logsDir, { recursive: true });
      const line = JSON.stringify({ ts: new Date().toISOString(), source: 'panel', ...entry }) + '\n';
      await fs.appendFile(auditFile, line, { mode: 0o600 });
    } catch {
      /* the audit log must never take the panel down */
    }
  }

  async function readLog(limit = 100) {
    const n = Math.max(1, Math.min(1000, Number.isFinite(limit) ? Math.floor(limit) : 100));
    let fh;
    try {
      fh = await fs.open(auditFile, 'r');
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    try {
      const { size } = await fh.stat();
      const start = Math.max(0, size - LOG_TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      await fh.read(buf, 0, buf.length, start);
      let lines = buf.toString('utf8').split('\n');
      if (start > 0) lines = lines.slice(1); // first line may be cut
      const out = [];
      for (let i = lines.length - 1; i >= 0 && out.length < n; i--) {
        const l = lines[i].trim();
        if (!l) continue;
        try {
          out.push(JSON.parse(l));
        } catch {
          /* skip malformed */
        }
      }
      return out;
    } finally {
      await fh.close();
    }
  }

  return {
    home,
    memDir,
    listMemory,
    readMemory,
    writeMemory,
    listJobs,
    getJob,
    getJobPrompt,
    updateJob,
    writeJobOutput,
    listApprovals,
    decideApproval,
    audit,
    readLog,
    exists,
  };
}
