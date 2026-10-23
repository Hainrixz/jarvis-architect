// Jarvis Panel — file operations inside JARVIS_HOME: memory, jobs, approvals, audit log.
// Every path is built from a fixed allowlist or a validated id; nothing from the request
// is ever joined into a path unchecked.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

// TASKS.md and LESSONS.md are listed read-only here; they change only through their own screens
// (Pendientes / Aprendizajes), which validate every edit line by line.
export const MEMORY_FILES = ['SOUL.md', 'USER.md', 'MEMORY.md', 'HEARTBEAT.md', 'AGENTS.md', 'TOOLS.md', 'TASKS.md', 'LESSONS.md'];
export const EDITABLE_FILES = new Set(['MEMORY.md', 'USER.md', 'SOUL.md', 'HEARTBEAT.md']);
// Files that may live in the workspace (memDir) or, for runtimes whose memDir is the harness's own
// memory folder (Hermes), in JARVIS_HOME itself.
const LEDGER_FILES = new Set(['TASKS.md', 'LESSONS.md']);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const MAX_MEMORY_BYTES = 256 * 1024;
const LOG_TAIL_BYTES = 1024 * 1024;
const AUDIT_SCAN_BYTES = 32 * 1024 * 1024;

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

// ---------------------------------------------------------------------------------------------
// TASKS.md — the Jarvis's pending list. One task per line, one grammar everywhere
// (knowledge/capabilities/autonomy.md; apply-ops.sh and the validator use the same rules):
//   - [ ] T-0042 · <title ≤80> · state:<…> · who:<…> · lvl:<L0-L3> [· due:…] [· next:…] [· prio:…]
//         [· src:…] [· tries:…] [· dep:…] [· conf:…]
// Every line that starts with "- [" outside an HTML comment is a task line; one that does not
// match the grammar is reported back raw as a parse error and never rewritten.
// ---------------------------------------------------------------------------------------------
export const TASK_STATES = ['inbox', 'todo', 'doing', 'waiting', 'needs_ok', 'blocked', 'done', 'dropped'];
export const TASK_WHO = ['jarvis', 'owner', 'other'];
export const TASK_LEVELS = ['L0', 'L1', 'L2', 'L3'];
export const TASK_OPTIONAL = ['due', 'next', 'prio', 'src', 'tries', 'dep', 'conf'];
const DATE = '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])';
const OPT_RE = {
  due: new RegExp(`^${DATE}(?:T(?:[01]\\d|2[0-3]):[0-5]\\d)?$`),
  next: new RegExp(`^${DATE}$`),
  prio: /^[1-3]$/,
  src: new RegExp(`^(?:owner\\/[a-z0-9_.-]{1,32}|email:sent|email:untrusted|calendar|meeting|media|agent)\\/${DATE}$`),
  tries: /^\d{1,2}$/,
  dep: /^T-\d{4,6}(?:,T-\d{4,6})*$/,
  conf: /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/,
};
export const TASK_ID_RE = /^T-\d{4,6}$/;
export const TASK_LINE_RE =
  /^- \[( |x)\] (T-\d{4,6}) · ([^·\n]{1,80}?) · state:([a-z_]+) · who:([a-z]+) · lvl:(L[0-3])((?: · [a-z]+:[^·\n]+?)*)$/;
const DATE_ONLY_RE = new RegExp(`^${DATE}$`);

/** Parse one task line. Returns {task} or {error}. Never throws. */
export function parseTaskLine(raw) {
  const line = String(raw).replace(/\s+$/, '');
  const m = TASK_LINE_RE.exec(line);
  if (!m) return { error: 'No sigue el formato «- [ ] T-NNNN · título · state:… · who:… · lvl:…».' };
  const [, box, id, title, st, who, lvl, rest] = m;
  if (title !== title.trim() || !title.trim()) return { error: 'El título está vacío o tiene espacios de más.' };
  if (!TASK_STATES.includes(st)) return { error: `state:${st} no existe.` };
  if (!TASK_WHO.includes(who)) return { error: `who:${who} no existe.` };
  const task = { id, title, state: st, who, lvl, done: box === 'x' };
  if (rest) {
    for (const part of rest.split(' · ').slice(1)) {
      const k = part.slice(0, part.indexOf(':'));
      const v = part.slice(part.indexOf(':') + 1);
      if (!TASK_OPTIONAL.includes(k)) return { error: `Campo desconocido: ${k}.` };
      if (k in task) return { error: `Campo repetido: ${k}.` };
      if (!OPT_RE[k].test(v)) return { error: `Valor inválido en ${k}:${v}.` };
      task[k] = v;
    }
  }
  return { task };
}

/** Canonical form of a task: fixed field order, [x] for done/dropped. */
export function serializeTask(t) {
  const box = t.state === 'done' || t.state === 'dropped' ? 'x' : ' ';
  let s = `- [${box}] ${t.id} · ${t.title} · state:${t.state} · who:${t.who} · lvl:${t.lvl}`;
  for (const k of TASK_OPTIONAL) if (t[k] !== undefined && t[k] !== null && t[k] !== '') s += ` · ${k}:${t[k]}`;
  return s;
}

/** Parse a whole TASKS.md. Tasks keep their 0-based line index and section heading. */
export function parseTasks(text) {
  const lines = String(text).split('\n');
  const tasks = [];
  const errors = [];
  const seen = new Set();
  let section = '';
  let inComment = false;
  lines.forEach((rawLine, i) => {
    const line = rawLine.replace(/\r$/, '');
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      return;
    }
    if (/^\s*<!--/.test(line)) {
      if (!line.includes('-->')) inComment = true;
      return;
    }
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      section = h[1];
      return;
    }
    if (!/^\s*- \[/.test(line)) return;
    const r = parseTaskLine(line);
    if (r.error) errors.push({ line: i + 1, raw: line.slice(0, 500), reason: r.error, section });
    else if (seen.has(r.task.id)) errors.push({ line: i + 1, raw: line.slice(0, 500), reason: `${r.task.id} está repetida.`, section });
    else {
      seen.add(r.task.id);
      tasks.push({ ...r.task, line: i + 1, section });
    }
  });
  return { tasks, errors };
}

// ---------------------------------------------------------------------------------------------
// LESSONS.md — what Jarvis learned from the owner's corrections (knowledge/capabilities/learning.md):
//   ## Activas / ## En revisión / ## Retiradas
//   - L-0007 · <regla> · ámbito:<skill|general> · [src:owner/<canal>] [YYYY-MM-DD] [ev:C-0031] [usos:N]
// ---------------------------------------------------------------------------------------------
export const LESSON_ID_RE = /^L-\d{4,6}$/;
const LESSON_LINE_RE = /^- (L-\d{4,6}) · (.+)$/;
const LESSON_SECTIONS = [
  { key: 'active', re: /^(activas|active)\b/i, heading: '## Activas' },
  { key: 'review', re: /^(en revisi[oó]n|review|in review)\b/i, heading: '## En revisión' },
  { key: 'retired', re: /^(retiradas|retired)\b/i, heading: '## Retiradas' },
];
export const MAX_ACTIVE_LESSONS = 60;
// Same deny-grep as the validator's learning sweep: a lesson that talks about permissions,
// allowlists, keys or "without asking" is never activated from the panel.
export const LESSON_DENY_RE = /allowlist|sin preguntar|without asking|api[ _-]?key|token|permis|aprobaci[oó]n autom/i;

export function parseLessonLine(raw) {
  const line = String(raw).replace(/\s+$/, '');
  const m = LESSON_LINE_RE.exec(line);
  if (!m) return null;
  const segs = m[2].split(' · ');
  const lesson = { id: m[1], rule: segs[0].trim(), raw: line };
  const scope = /ámbito:([^\s·\]]+)/.exec(line) || /scope:([^\s·\]]+)/.exec(line);
  if (scope) lesson.scope = scope[1];
  const src = /\[src:([^\]]+)\]/.exec(line);
  if (src) lesson.src = src[1];
  const date = /\[(\d{4}-\d{2}-\d{2})\]/.exec(line);
  if (date) lesson.date = date[1];
  const ev = /\[ev:([^\]]+)\]/.exec(line);
  if (ev) lesson.ev = ev[1];
  const uses = /\[usos:(\d+)\]/.exec(line);
  if (uses) lesson.uses = Number(uses[1]);
  return lesson;
}

export function parseLessons(text) {
  const lines = String(text).split('\n');
  const out = { active: [], review: [], retired: [], errors: [] };
  let section = null;
  let inComment = false;
  lines.forEach((rawLine, i) => {
    const line = rawLine.replace(/\r$/, '');
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      return;
    }
    if (/^\s*<!--/.test(line)) {
      if (!line.includes('-->')) inComment = true;
      return;
    }
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      section = LESSON_SECTIONS.find((s) => s.re.test(h[1]))?.key ?? null;
      return;
    }
    if (!section || !/^\s*- /.test(line)) return;
    const l = parseLessonLine(line);
    if (!l) out.errors.push({ line: i + 1, raw: line.slice(0, 500), reason: 'No sigue el formato «- L-NNNN · regla · …».' });
    else out[section].push({ ...l, line: i + 1, section });
  });
  return out;
}

/** Local calendar date YYYY-MM-DD (run-job.sh stamps audit.tsv in local time). */
export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const SKILL_NAME_RE = /^[a-z0-9-]{1,64}$/;


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

  async function memoryFile(name) {
    memoryPath(name); // validates the name
    return LEDGER_FILES.has(name) ? ledgerPath(name) : path.join(memDir, name);
  }

  // ---------- memory ----------
  async function listMemory() {
    const out = [];
    for (const name of MEMORY_FILES) {
      try {
        const st = await fs.lstat(await memoryFile(name)); // symlinks are not listed (readMemory refuses them too)
        if (!st.isFile()) continue;
        out.push({ name, editable: EDITABLE_FILES.has(name), updated_at: st.mtime.toISOString(), bytes: st.size });
      } catch {
        /* not present */
      }
    }
    return out;
  }

  async function readMemory(name) {
    const file = await memoryFile(name);
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


  /**
   * Audit events whose line contains `needle`, oldest first, from the last `maxBytes` of
   * logs/audit.jsonl. Used for learning.* events, which must survive months of other entries
   * (readLog only keeps the newest 1000).
   */
  async function scanAudit(needle, maxBytes = AUDIT_SCAN_BYTES) {
    let fh;
    try {
      fh = await fs.open(auditFile, 'r');
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
    try {
      const { size } = await fh.stat();
      const start = Math.max(0, size - maxBytes);
      const buf = Buffer.alloc(size - start);
      await fh.read(buf, 0, buf.length, start);
      let lines = buf.toString('utf8').split('\n');
      if (start > 0) lines = lines.slice(1);
      const out = [];
      for (const l of lines) {
        if (!l.includes(needle)) continue;
        try {
          const e = JSON.parse(l);
          if (e && typeof e === 'object') out.push(e);
        } catch {
          /* skip malformed */
        }
      }
      return out;
    } finally {
      await fh.close();
    }
  }

  // ---------- shared helpers for TASKS.md / LESSONS.md ----------
  /** Where a ledger file lives: the workspace (memDir) if it is there, else JARVIS_HOME. */
  async function ledgerPath(name) {
    const inMem = path.join(memDir, name);
    if (memDir === home || (await exists(inMem))) return inMem;
    const inHome = path.join(home, name);
    return (await exists(inHome)) ? inHome : inMem;
  }

  /** Read a ledger file: {file, text, mtime_ms, sha} or {file, missing:true}. Refuses symlinks. */
  async function readLedger(name) {
    const file = await ledgerPath(name);
    let st;
    try {
      st = await fs.lstat(file);
    } catch {
      return { file, missing: true };
    }
    if (!st.isFile()) throw new StoreError(403, 'not_a_file', `${name} no es un archivo normal.`);
    if (st.size > MAX_MEMORY_BYTES) throw new StoreError(413, 'too_large', `${name} pasa de ${MAX_MEMORY_BYTES / 1024} KB.`);
    const text = await fs.readFile(file, 'utf8');
    return { file, text, mode: st.mode & 0o777, mtime_ms: st.mtimeMs, sha: createHash('sha256').update(text).digest('hex').slice(0, 16) };
  }

  // One writer at a time: an in-process queue plus a mkdir lock in JARVIS_HOME/logs. TASKS.md uses
  // the same lock jobs/apply-ops.sh takes (logs/.tasks.lock); LESSONS.md uses logs/.lessons.lock.
  // A lock older than 30 s is treated as stale (a writer that was killed).
  const LEDGER_LOCKS = { 'TASKS.md': '.tasks.lock', 'LESSONS.md': '.lessons.lock' };
  const ledgerQueues = new Map();
  async function withLedgerLock(name, fn) {
    const prev = ledgerQueues.get(name) || Promise.resolve();
    const run = prev.then(async () => {
      await fs.mkdir(logsDir, { recursive: true });
      const lock = path.join(logsDir, LEDGER_LOCKS[name]);
      let got = false;
      for (let i = 0; i < 20 && !got; i++) {
        try {
          await fs.mkdir(lock);
          got = true;
        } catch (e) {
          if (e.code !== 'EEXIST') throw e;
          try {
            const st = await fs.stat(lock);
            if (Date.now() - st.mtimeMs > 30_000) await fs.rmdir(lock).catch(() => {});
          } catch {
            /* gone already */
          }
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      if (!got) throw new StoreError(409, 'locked', `${name} lo está escribiendo otro proceso. Intenta en unos segundos.`);
      try {
        return await fn();
      } finally {
        await fs.rmdir(lock).catch(() => {});
      }
    });
    ledgerQueues.set(name, run.catch(() => {}));
    return run;
  }

  function checkPrecondition(cur, baseMtime, baseSha, name) {
    if (typeof baseMtime !== 'number' || !Number.isFinite(baseMtime)) {
      throw new StoreError(428, 'precondition_required', 'Falta base_mtime: vuelve a cargar la lista antes de cambiarla.');
    }
    if (cur.mtime_ms !== baseMtime || (typeof baseSha === 'string' && baseSha && baseSha !== cur.sha)) {
      throw new StoreError(409, 'conflict', `${name} cambió mientras lo veías. Recarga y vuelve a intentarlo.`);
    }
  }

  /** Replace whole lines (0-based index -> new text or null to delete) keeping the file's line endings. */
  function rewriteLines(text, edits, inserts = []) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    for (const [i, v] of edits) lines[i] = v;
    for (const { at, text: t } of [...inserts].sort((a, b) => b.at - a.at)) lines.splice(at, 0, ...t);
    return lines.filter((l) => l !== null).join(eol);
  }

  async function writeLedger(cur, content) {
    await atomicWrite(cur.file, content, cur.mode || 0o600);
    const st = await fs.stat(cur.file);
    return { mtime_ms: st.mtimeMs, sha: createHash('sha256').update(content).digest('hex').slice(0, 16) };
  }

  // ---------- tasks (Pendientes) ----------
  async function listTasks() {
    const cur = await readLedger('TASKS.md');
    if (cur.missing) return { exists: false, tasks: [], errors: [], needs_ok: 0, mtime_ms: null, sha: null };
    const { tasks, errors } = parseTasks(cur.text);
    return {
      exists: true,
      tasks,
      errors,
      needs_ok: tasks.filter((t) => t.state === 'needs_ok').length,
      mtime_ms: cur.mtime_ms,
      sha: cur.sha,
    };
  }

  /**
   * Change one task from the panel. Allowed: state, next (snooze; null clears it), lvl (only
   * down), who (never to jarvis). Atomic, under the ledger lock, with an mtime precondition.
   */
  function updateTask(id, patch, baseMtime, baseSha) {
    if (typeof id !== 'string' || !TASK_ID_RE.test(id)) throw new StoreError(400, 'invalid_id', 'id de pendiente inválido.');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new StoreError(400, 'invalid_patch', 'Nada que cambiar.');
    const keys = Object.keys(patch);
    if (!keys.length) throw new StoreError(400, 'invalid_patch', 'Nada que cambiar.');
    for (const k of keys) {
      if (!['state', 'next', 'lvl', 'who'].includes(k)) {
        throw new StoreError(400, 'field_not_allowed', `Desde el panel solo se cambia state, next, lvl (hacia abajo) o who. No ${String(k).slice(0, 32)}.`);
      }
    }
    if ('state' in patch && !TASK_STATES.includes(patch.state)) throw new StoreError(400, 'invalid_state', 'Estado inválido.');
    if ('next' in patch && patch.next !== null && !(typeof patch.next === 'string' && DATE_ONLY_RE.test(patch.next))) {
      throw new StoreError(400, 'invalid_date', 'next debe ser una fecha AAAA-MM-DD.');
    }
    if ('lvl' in patch && !TASK_LEVELS.includes(patch.lvl)) throw new StoreError(400, 'invalid_level', 'Nivel inválido.');
    if ('who' in patch && !TASK_WHO.includes(patch.who)) throw new StoreError(400, 'invalid_who', 'who inválido.');
    return withLedgerLock('TASKS.md', async () => {
      const cur = await readLedger('TASKS.md');
      if (cur.missing) throw new StoreError(404, 'not_found', 'TASKS.md no existe todavía.');
      checkPrecondition(cur, baseMtime, baseSha, 'TASKS.md');
      const { tasks } = parseTasks(cur.text);
      const task = tasks.find((t) => t.id === id);
      if (!task) throw new StoreError(404, 'not_found', `${id} no está en TASKS.md (o su línea tiene un error de formato).`);
      if ('lvl' in patch && TASK_LEVELS.indexOf(patch.lvl) > TASK_LEVELS.indexOf(task.lvl)) {
        throw new StoreError(403, 'lvl_raise', 'Subir el nivel de autonomía de una tarea no se hace desde el panel: díselo a Jarvis en vivo o cámbialo en la terminal.');
      }
      if ('who' in patch && patch.who === 'jarvis' && task.who !== 'jarvis') {
        throw new StoreError(403, 'who_to_jarvis', 'Pasarle a Jarvis una tarea tuya o de otra persona no se hace desde el panel: pídeselo en vivo.');
      }
      const before = { state: task.state, next: task.next ?? null, lvl: task.lvl, who: task.who };
      const updated = { ...task };
      for (const k of keys) {
        if (patch[k] === null) delete updated[k];
        else updated[k] = patch[k];
      }
      const line = serializeTask(updated);
      const reparsed = parseTaskLine(line);
      if (reparsed.error) throw new StoreError(500, 'serialize_failed', 'No pude escribir la tarea con el formato correcto.');
      const out = rewriteLines(cur.text, [[task.line - 1, line]]);
      const meta = await writeLedger(cur, out);
      const after = { state: updated.state, next: updated.next ?? null, lvl: updated.lvl, who: updated.who };
      return { task: { ...reparsed.task, line: task.line, section: task.section }, before, after, ...meta };
    });
  }

  // ---------- autopilot ----------
  const STOP_AUTOPILOT = path.join(home, 'STOP_AUTOPILOT');

  /** Read logs/audit.tsv (run-job.sh): "<YYYY-MM-DDTHHMMSS>\t<job>\trc=\terror=\tcost_est=\tdenied=". */
  async function readRunLog() {
    let raw = '';
    try {
      const fh = await fs.open(path.join(logsDir, 'audit.tsv'), 'r');
      try {
        const { size } = await fh.stat();
        const start = Math.max(0, size - LOG_TAIL_BYTES);
        const buf = Buffer.alloc(size - start);
        await fh.read(buf, 0, buf.length, start);
        raw = buf.toString('utf8');
        if (start > 0) raw = raw.slice(raw.indexOf('\n') + 1);
      } finally {
        await fh.close();
      }
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
    const runs = [];
    for (const line of raw.split('\n')) {
      const cols = line.split('\t');
      if (cols.length < 3 || !/^\d{4}-\d{2}-\d{2}/.test(cols[0])) continue;
      const kv = {};
      for (const c of cols.slice(2)) {
        const i = c.indexOf('=');
        if (i > 0) kv[c.slice(0, i)] = c.slice(i + 1);
      }
      const cost = Number.parseFloat(kv.cost_est);
      runs.push({ stamp: cols[0].slice(0, 32), job: cols[1].slice(0, 64), rc: kv.rc ?? null, error: kv.error ?? null, cost: Number.isFinite(cost) ? cost : 0 });
    }
    return runs;
  }

  async function autopilotState() {
    const paused = await exists(STOP_AUTOPILOT);
    const stopped = await exists(path.join(home, 'STOP'));
    const runs = await readRunLog();
    const today = localDate();
    let lastRun = null;
    let costToday = null;
    let autopilotCostToday = null;
    if (runs) {
      costToday = 0;
      autopilotCostToday = 0;
      for (const r of runs) {
        if (r.stamp.startsWith(today)) {
          costToday += r.cost;
          if (r.job === 'autopilot') autopilotCostToday += r.cost;
        }
        if (r.job === 'autopilot') lastRun = r;
      }
      costToday = Math.round(costToday * 10000) / 10000;
      autopilotCostToday = Math.round(autopilotCostToday * 10000) / 10000;
    }
    let actionsToday = 0;
    for (const e of await readLog(1000)) {
      if (e && e.action === 'autopilot.op' && typeof e.ts === 'string' && localDate(new Date(e.ts)) === today) actionsToday++;
    }
    return {
      paused,
      stopped,
      last_run: lastRun ? { at: lastRun.stamp, rc: lastRun.rc, error: lastRun.error, cost: lastRun.cost, ok: lastRun.rc === '0' } : null,
      cost_today: costToday,
      autopilot_cost_today: autopilotCostToday,
      actions_today: actionsToday,
      has_run_log: runs !== null,
    };
  }

  /** Pause = create STOP_AUTOPILOT (always allowed: it reduces power). Resume = remove it. */
  async function setAutopilotPaused(paused) {
    if (paused) {
      if (!(await exists(STOP_AUTOPILOT))) {
        await atomicWrite(STOP_AUTOPILOT, `Pausado desde el panel el ${new Date().toISOString()}.\n`, 0o600);
      }
    } else {
      let st;
      try {
        st = await fs.lstat(STOP_AUTOPILOT);
      } catch {
        return autopilotState();
      }
      if (st.isDirectory()) throw new StoreError(409, 'not_a_file', 'STOP_AUTOPILOT es una carpeta; bórrala desde la terminal.');
      await fs.unlink(STOP_AUTOPILOT);
    }
    return autopilotState();
  }

  // ---------- learning (Aprendizajes) ----------
  async function listLessons() {
    const cur = await readLedger('LESSONS.md');
    if (cur.missing) return { exists: false, active: [], review: [], retired: [], errors: [], mtime_ms: null, sha: null };
    return { exists: true, ...parseLessons(cur.text), mtime_ms: cur.mtime_ms, sha: cur.sha };
  }

  /** Move a lesson to Activas ('active') or Retiradas ('retired'). */
  function moveLesson(id, to, baseMtime, baseSha) {
    if (typeof id !== 'string' || !LESSON_ID_RE.test(id)) throw new StoreError(400, 'invalid_id', 'id de lección inválido.');
    if (to !== 'active' && to !== 'retired') throw new StoreError(400, 'invalid_target', 'Solo se puede activar o retirar.');
    return withLedgerLock('LESSONS.md', async () => {
      const cur = await readLedger('LESSONS.md');
      if (cur.missing) throw new StoreError(404, 'not_found', 'LESSONS.md no existe todavía.');
      checkPrecondition(cur, baseMtime, baseSha, 'LESSONS.md');
      const parsed = parseLessons(cur.text);
      const all = [...parsed.active, ...parsed.review, ...parsed.retired];
      const lesson = all.find((l) => l.id === id);
      if (!lesson) throw new StoreError(404, 'not_found', `${id} no está en LESSONS.md.`);
      if (lesson.section === to) return { lesson, from: to, to, unchanged: true, mtime_ms: cur.mtime_ms, sha: cur.sha };
      if (to === 'active') {
        if (LESSON_DENY_RE.test(lesson.raw)) {
          throw new StoreError(422, 'permission_like', 'Esta lección habla de permisos, llaves o de actuar sin preguntar. Eso nunca se aprende: cámbialo tú en AGENTS.md o TOOLS.md con /jarvis-add.');
        }
        if (parsed.active.length >= MAX_ACTIVE_LESSONS) {
          throw new StoreError(422, 'too_many', `Ya hay ${MAX_ACTIVE_LESSONS} lecciones activas. Retira una antes de activar otra.`);
        }
      }
      // Insert after the last lesson of the target section, or right under its heading.
      const lines = cur.text.split(/\r?\n/);
      const target = LESSON_SECTIONS.find((s) => s.key === to);
      let headingIdx = lines.findIndex((l) => {
        const h = /^##\s+(.+?)\s*$/.exec(l);
        return h && target.re.test(h[1]);
      });
      const inserts = [];
      let at;
      if (headingIdx === -1) {
        at = lines.length;
        while (at > 0 && lines[at - 1] === '') at--;
        inserts.push({ at, text: ['', target.heading, '', lesson.raw] });
      } else {
        const siblings = parsed[to].map((l) => l.line - 1);
        at = siblings.length ? Math.max(...siblings) + 1 : headingIdx + 1;
        if (!siblings.length && lines[at] === '') at++;
        inserts.push({ at, text: [lesson.raw] });
      }
      const out = rewriteLines(cur.text, [[lesson.line - 1, null]], inserts);
      let meta = await writeLedger(cur, out);
      // Commit it the way the learning loop does (bin/learn.sh commit retire|activate <L-id>: deny-grep,
      // format check, git commit, learning.<kind> audit) so "deshaz" can undo it. learn.sh works on
      // JARVIS_HOME/LESSONS.md and refuses everything while STOP exists, so it is skipped then.
      let committed = null;
      let note = null;
      // learn.sh deny-greps the moved line and would undo the retirement of a permission-like lesson;
      // retiring always reduces power, so that one stays on disk uncommitted and says so.
      if (to === 'retired' && LESSON_DENY_RE.test(lesson.raw)) {
        committed = false;
        note = 'Retirada sin commit: bin/learn.sh no acepta líneas que hablan de permisos. Haz commit de LESSONS.md desde la terminal.';
      } else if (cur.file === path.join(home, 'LESSONS.md') && !(await exists(path.join(home, 'STOP')))) {
        const r = await runJarvisScript('bin/learn.sh', ['commit', to === 'active' ? 'activate' : 'retire', id]);
        if (!r.missing) {
          if (r.code === 3 || r.code === 5) {
            // learn.sh rejected it (3: permission-like, 5: an @path import) and restored the committed
            // file; make sure the panel's own write is gone too.
            const now = await readLedger('LESSONS.md');
            if (!now.missing && now.text === out) await writeLedger(cur, cur.text);
            if (r.code === 5) throw new StoreError(422, 'import_line', 'bin/learn.sh rechazó el cambio: LESSONS.md no lleva imports @ruta. LESSONS.md quedó como estaba.');
            throw new StoreError(422, 'permission_like', 'bin/learn.sh rechazó el cambio: esa lección habla de permisos, llaves o de actuar sin preguntar. LESSONS.md quedó como estaba.');
          }
          committed = r.code === 0;
          if (!committed) note = `bin/learn.sh commit terminó con ${r.signal || `código ${r.code}`}; el cambio quedó en LESSONS.md sin commit.${r.tail ? `\n${r.tail}` : ''}`;
          const st = await fs.stat(cur.file);
          meta = { mtime_ms: st.mtimeMs, sha: createHash('sha256').update(await fs.readFile(cur.file, 'utf8')).digest('hex').slice(0, 16) };
        }
      }
      return { lesson: { ...lesson, section: to }, from: lesson.section, to, committed, ...(note ? { note } : {}), ...meta };
    });
  }

  /**
   * Skills the learning loop created, from `learning.*` lines in logs/audit.jsonl. bin/promote-skill.sh
   * and bin/learn.sh write {event, ref, commit?, detail?}; older or hand-written lines may use
   * {action, target}. Both are read.
   *   learning.promote <name>                 -> live, on probation (a second one = improved)
   *   learning.probation_cleared <name>       -> probation over (also probation_end / attended_use)
   *   learning.retire <name>                  -> removed (the panel's undo button runs this)
   *   learning.undo, detail "reverts <sha>: promote skill <name> | retire skill <name> |
   *                 skill <name> out of probation" -> the matching step is undone
   * The panel's own learning.revert_request with ok:true also counts as removed.
   */
  async function listLearnedSkills() {
    const events = await scanAudit('"learning.');
    const skills = new Map();
    const nameOf = (v) => (typeof v === 'string' && SKILL_NAME_RE.test(v) ? v : null);
    for (const e of events) {
      const kind = typeof e.event === 'string' ? e.event : typeof e.action === 'string' ? e.action : '';
      if (!kind.startsWith('learning.') || e.ok === false) continue;
      const ts = typeof e.ts === 'string' ? e.ts : null;
      if (kind === 'learning.undo') {
        const m = /^reverts ([0-9a-f]{7,40}): (?:promote skill ([a-z0-9-]{1,64})|retire skill ([a-z0-9-]{1,64})|skill ([a-z0-9-]{1,64}) out of probation)$/.exec(
          typeof e.detail === 'string' ? e.detail : ''
        );
        if (!m) continue;
        const s = skills.get(m[2] || m[3] || m[4]);
        if (!s) continue;
        if (m[2]) {
          const i = s.commits.findIndex((c) => c && (c.startsWith(m[1]) || m[1].startsWith(c)));
          s.commits.splice(i === -1 ? s.commits.length - 1 : i, 1);
          if (!s.commits.length) {
            s.reverted = true;
            s.reverted_at = ts;
          }
        } else if (m[3]) {
          s.reverted = false;
          s.reverted_at = null;
        } else s.probation = true;
        continue;
      }
      const name = nameOf(e.ref) || nameOf(e.target) || nameOf(e.skill) || nameOf(e.name);
      if (!name) continue;
      if (kind === 'learning.promote') {
        const prev = skills.get(name);
        const live = prev && !prev.reverted;
        const detail = typeof e.detail === 'string' ? e.detail : '';
        skills.set(name, {
          name,
          promoted_at: ts,
          probation: e.probation === false ? false : e.probation === true || /(^|;)probation(;|$)/.test(detail) || !detail,
          reverted: false,
          reverted_at: null,
          improved: !!live,
          commit: typeof e.commit === 'string' ? e.commit.slice(0, 40) : null,
          commits: [...(live ? prev.commits : []), typeof e.commit === 'string' ? e.commit.slice(0, 40) : ''],
          summary: typeof e.summary === 'string' ? e.summary.slice(0, 300) : null,
        });
        continue;
      }
      const s = skills.get(name);
      if (!s) continue;
      if (kind === 'learning.probation_cleared' || kind === 'learning.probation_end' || kind === 'learning.attended_use') s.probation = false;
      if (kind === 'learning.retire' || kind === 'learning.revert' || kind === 'learning.revert_request') {
        s.reverted = true;
        s.reverted_at = ts;
      }
    }
    return [...skills.values()]
      .map(({ commits, ...pub }) => pub)
      .sort((a, b) => String(b.promoted_at).localeCompare(String(a.promoted_at)));
  }

  /**
   * The newest weekly learning digest (memory/weekly/learning-YYYY-Www.md), read-only. bin/learn.sh
   * writes it under JARVIS_HOME; a workspace (memDir) copy is read too.
   */
  async function latestDigest() {
    let best = null;
    for (const base of memDir === home ? [home] : [memDir, home]) {
      const dir = path.join(base, 'memory', 'weekly');
      let names;
      try {
        names = await fs.readdir(dir);
      } catch {
        continue;
      }
      const pick = names.filter((n) => /^learning-\d{4}-W\d{2}\.md$/.test(n)).sort().pop();
      if (pick && (!best || pick > best.name)) best = { name: pick, file: path.join(dir, pick) };
    }
    if (!best) return null;
    const st = await fs.lstat(best.file);
    if (!st.isFile()) return null;
    const content = (await fs.readFile(best.file, 'utf8')).slice(0, 16 * 1024);
    return { name: best.name, updated_at: st.mtime.toISOString(), content };
  }

  async function learningState() {
    const [lessons, skills, digest] = await Promise.all([listLessons(), listLearnedSkills(), latestDigest()]);
    return { lessons, skills, digest };
  }

  /**
   * Run one of the Jarvis's own scripts (bin/promote-skill.sh, bin/learn.sh) with an args array
   * (no shell), cwd JARVIS_HOME, a minimal env and a 60 s timeout. Resolves {missing:true} when
   * the script is not installed, else {code, signal, tail} with the last lines of its output
   * (the scripts never print secrets or file contents).
   */
  async function runJarvisScript(rel, args) {
    const script = path.join(home, rel);
    let st;
    try {
      st = await fs.lstat(script);
    } catch {
      return { missing: true };
    }
    if (!st.isFile()) throw new StoreError(403, 'not_a_file', `${rel} no es un archivo normal.`);
    return new Promise((resolve, reject) => {
      const child = spawn('/bin/bash', [script, ...args], {
        cwd: home,
        env: {
          PATH: process.env.PATH || '/usr/bin:/bin',
          HOME: process.env.HOME || home,
          LANG: process.env.LANG || 'en_US.UTF-8',
          JARVIS_HOME: home,
          JARVIS_ACTOR: 'panel',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
      let out = '';
      const take = (b) => {
        out = (out + b.toString('utf8')).slice(-4000);
      };
      child.stdout.on('data', take);
      child.stderr.on('data', take);
      child.on('error', (e) => reject(new StoreError(500, 'script_failed', `No pude correr ${rel}: ${e.message}`)));
      child.on('close', (code, signal) => {
        resolve({ code, signal, tail: out.trim().split('\n').slice(-6).join('\n').slice(-800) });
      });
    });
  }

  let reverting = false;
  /**
   * Undo a skill the learning loop created: bin/promote-skill.sh retire <name>. The script removes
   * it from every live folder, commits to git and audits learning.retire; it refuses skills the
   * owner or the Architect wrote (created-by is not agent). Bringing it back: bin/learn.sh undo <name>.
   */
  async function revertSkill(name) {
    if (typeof name !== 'string' || !SKILL_NAME_RE.test(name)) throw new StoreError(400, 'invalid_name', 'Nombre de skill inválido.');
    const skill = (await listLearnedSkills()).find((s) => s.name === name);
    if (!skill) throw new StoreError(404, 'not_found', 'Esa skill no la creó el aprendizaje automático.');
    if (skill.reverted) throw new StoreError(409, 'already_reverted', 'Esa skill ya se deshizo.');
    if (reverting) throw new StoreError(409, 'busy', 'Ya estoy deshaciendo otra skill. Espera unos segundos.');
    reverting = true;
    try {
      const r = await runJarvisScript('bin/promote-skill.sh', ['retire', name]);
      if (r.missing) {
        throw new StoreError(501, 'no_promote_script', 'Falta bin/promote-skill.sh en la carpeta de Jarvis. Deshazlo desde el chat diciendo «deshaz».');
      }
      if (r.code === 0) return { name, reverted: true, output: r.tail };
      const how = r.signal || `código ${r.code}`;
      if (r.code === 4) throw new StoreError(409, 'not_learned', `promote-skill.sh retire no la quitó (${how}).${r.tail ? `\n${r.tail}` : ''}`);
      throw new StoreError(500, 'revert_failed', `promote-skill.sh retire terminó con ${how}.${r.tail ? `\n${r.tail}` : ''}`);
    } finally {
      reverting = false;
    }
  }

  return {
    home,
    memDir,
    listTasks,
    updateTask,
    autopilotState,
    setAutopilotPaused,
    listLessons,
    moveLesson,
    listLearnedSkills,
    learningState,
    revertSkill,
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
