import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { startServer, writePending, parseSse, makeHome } from './helpers.js';

describe('Jarvis Panel API (no password, loopback, mock adapter)', () => {
  let s;
  before(async () => {
    s = await startServer();
  });
  after(async () => {
    await s.close();
  });

  test('GET /api/health returns the contract fields', async () => {
    const r = await s.api('/api/health');
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.adapter, 'mock');
    assert.equal(j.runtime, 'mock');
    assert.equal(j.jarvis_name, 'Jarvis de Prueba');
    assert.equal(typeof j.version, 'string');
    assert.equal(typeof j.uptime_s, 'number');
  });

  test('security headers are present', async () => {
    const r = await s.api('/api/health');
    const csp = r.headers.get('content-security-policy');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.doesNotMatch(csp, /unsafe-inline/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });

  test('GET /api/session reports no auth required', async () => {
    const j = await (await s.api('/api/session')).json();
    assert.deepEqual(j, { authenticated: true, auth_required: false });
  });

  test('foreign Host header is rejected (DNS rebinding guard)', async () => {
    const port = new URL(s.base).port;
    const status = (host) =>
      new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: '/api/health', headers: { host } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        }).on('error', reject);
      });
    assert.equal(await status('evil.example.com'), 421);
    assert.equal(await status(`evil.example.com:${port}`), 421);
    assert.equal(await status(`localhost:${port}`), 200);
  });

  test('CSRF: mutating request without X-Jarvis-Panel header is 403', async () => {
    const r = await s.api('/api/memory/MEMORY.md', { method: 'PUT', body: { content: 'x' }, csrf: false });
    assert.equal(r.status, 403);
    const r2 = await s.api('/api/chat', { method: 'POST', body: { message: 'hola' }, csrf: false });
    assert.equal(r2.status, 403);
    const still = await (await s.api('/api/memory/MEMORY.md')).json();
    assert.match(still.content, /original/);
  });

  test('POST /api/chat streams delta events then done', async () => {
    const r = await s.api('/api/chat', { method: 'POST', body: { message: 'hola mundo' } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/event-stream/);
    const events = parseSse(await r.text());
    assert.ok(events.length >= 2);
    const deltas = events.filter((e) => e.type === 'delta');
    assert.ok(deltas.length >= 2, 'streams more than one delta');
    assert.equal(deltas.map((d) => d.text).join(''), 'Recibí: hola mundo');
    const last = events.at(-1);
    assert.equal(last.type, 'done');
    assert.equal(typeof last.session_id, 'string');
    // the session id is reused when sent back
    const r2 = await s.api('/api/chat', { method: 'POST', body: { message: 'otra', session_id: last.session_id } });
    assert.equal(parseSse(await r2.text()).at(-1).session_id, last.session_id);
  });

  test('POST /api/chat adapter failure becomes an error event', async () => {
    const r = await s.api('/api/chat', { method: 'POST', body: { message: '__error__' } });
    const events = parseSse(await r.text());
    assert.equal(events.at(-1).type, 'error');
    assert.equal(typeof events.at(-1).message, 'string');
  });

  test('POST /api/chat validates input', async () => {
    assert.equal((await s.api('/api/chat', { method: 'POST', body: { message: '' } })).status, 400);
    assert.equal((await s.api('/api/chat', { method: 'POST', body: { message: 'x', session_id: '../../etc' } })).status, 400);
  });

  test('GET /api/memory lists the allowlisted files only', async () => {
    const list = await (await s.api('/api/memory')).json();
    const names = list.map((f) => f.name).sort();
    assert.deepEqual(names, ['AGENTS.md', 'HEARTBEAT.md', 'MEMORY.md', 'SOUL.md', 'TOOLS.md', 'USER.md']);
    const agents = list.find((f) => f.name === 'AGENTS.md');
    assert.equal(agents.editable, false);
    assert.equal(list.find((f) => f.name === 'MEMORY.md').editable, true);
    assert.equal(typeof agents.bytes, 'number');
    assert.ok(!Number.isNaN(Date.parse(agents.updated_at)));
  });

  test('PUT /api/memory/MEMORY.md writes atomically and keeps a .bak', async () => {
    const r = await s.api('/api/memory/MEMORY.md', { method: 'PUT', body: { content: '# MEMORY\nnuevo\n' } });
    assert.equal(r.status, 200);
    const j = await (await s.api('/api/memory/MEMORY.md')).json();
    assert.deepEqual(j, { name: 'MEMORY.md', content: '# MEMORY\nnuevo\n', editable: true });
    const bak = await fs.readFile(path.join(s.home, 'MEMORY.md.bak'), 'utf8');
    assert.match(bak, /original/);
    const leftovers = (await fs.readdir(s.home)).filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(leftovers, []);
  });

  test('PUT on read-only AGENTS.md / TOOLS.md is 403', async () => {
    for (const name of ['AGENTS.md', 'TOOLS.md']) {
      const r = await s.api(`/api/memory/${name}`, { method: 'PUT', body: { content: 'pwned' } });
      assert.equal(r.status, 403, name);
    }
    assert.match(await fs.readFile(path.join(s.home, 'AGENTS.md'), 'utf8'), /original/);
  });

  test('path traversal and non-allowlisted names are refused', async () => {
    const attempts = ['..%2F.env', '.env', '..%2F..%2Fetc%2Fpasswd', 'MEMORY.md.bak', 'memory.md', '%2E%2E%2FSOUL.md'];
    for (const a of attempts) {
      const r = await s.api(`/api/memory/${a}`);
      assert.ok([400, 403, 404].includes(r.status), `${a} -> ${r.status}`);
      const text = await r.text();
      assert.doesNotMatch(text, /do-not-leak/);
      const w = await s.api(`/api/memory/${a}`, { method: 'PUT', body: { content: 'x' } });
      assert.ok([400, 403, 404].includes(w.status), `PUT ${a} -> ${w.status}`);
    }
    assert.equal((await s.api('/api/memory/.env')).status, 400);
    assert.equal(await fs.readFile(path.join(s.home, '.env'), 'utf8'), 'SECRET_TOKEN=do-not-leak\n');
  });

  test('static files never escape public/', async () => {
    for (const p of ['/..%2Fpackage.json', '/%2e%2e/src/config.js', '/../.env', '/.env']) {
      const r = await fetch(s.base + p);
      assert.notEqual(r.status, 200, p);
    }
  });

  test('approvals: list, approve, reject', async () => {
    const now = Date.now();
    await writePending(s.home, 'a1', { action: 'send_email', preview: 'Para: ana@x.com', created_at: new Date(now).toISOString(), expires_at: new Date(now + 300_000).toISOString() });
    await writePending(s.home, 'a2', { action: 'post', preview: 'Tweet', created_at: new Date(now).toISOString() });
    const list = await (await s.api('/api/approvals')).json();
    assert.deepEqual(list.map((a) => a.id).sort(), ['a1', 'a2']);
    for (const k of ['id', 'action', 'preview', 'created_at', 'expires_at']) assert.ok(k in list[0], k);

    const r1 = await s.api('/api/approvals/a1', { method: 'POST', body: { decision: 'approve' } });
    assert.equal(r1.status, 200);
    const d1 = JSON.parse(await fs.readFile(path.join(s.home, 'approvals', 'decided', 'a1.json'), 'utf8'));
    assert.equal(d1.decision, 'approve');
    assert.ok(d1.decided_at);
    await assert.rejects(fs.access(path.join(s.home, 'approvals', 'pending', 'a1.json')));

    const r2 = await s.api('/api/approvals/a2', { method: 'POST', body: { decision: 'reject' } });
    assert.equal(r2.status, 200);
    const d2 = JSON.parse(await fs.readFile(path.join(s.home, 'approvals', 'decided', 'a2.json'), 'utf8'));
    assert.equal(d2.decision, 'reject');

    // deciding again -> gone
    assert.equal((await s.api('/api/approvals/a1', { method: 'POST', body: { decision: 'approve' } })).status, 404);
    assert.equal((await s.api('/api/approvals/a3', { method: 'POST', body: { decision: 'maybe' } })).status, 400);
    assert.equal((await s.api('/api/approvals/..%2Fx', { method: 'POST', body: { decision: 'approve' } })).status, 400);
  });

  test('approvals: expired (5 min) cannot be approved -> 409, can still be rejected', async () => {
    const old = Date.now() - 6 * 60_000;
    await writePending(s.home, 'old1', { action: 'pay', preview: '$500', created_at: new Date(old).toISOString() });
    const r = await s.api('/api/approvals/old1', { method: 'POST', body: { decision: 'approve' } });
    assert.equal(r.status, 409);
    await fs.access(path.join(s.home, 'approvals', 'pending', 'old1.json')); // still pending
    const r2 = await s.api('/api/approvals/old1', { method: 'POST', body: { decision: 'reject' } });
    assert.equal(r2.status, 200);
  });

  test('approvals: a file cannot extend its own life (future created_at / far expires_at)', async () => {
    const far = Date.now() + 365 * 24 * 3600_000;
    await writePending(s.home, 'liar1', { action: 'pay', preview: '$1', created_at: new Date(far).toISOString(), expires_at: new Date(far).toISOString() });
    const old = new Date(Date.now() - 10 * 60_000);
    await fs.utimes(path.join(s.home, 'approvals', 'pending', 'liar1.json'), old, old);
    const r = await s.api('/api/approvals/liar1', { method: 'POST', body: { decision: 'approve' } });
    assert.equal(r.status, 409);
  });

  test('memory .bak is not written through a planted symlink', async () => {
    const outside = path.join(path.dirname(s.home), `outside-${Date.now()}.txt`);
    await fs.writeFile(outside, 'untouched');
    await fs.symlink(outside, path.join(s.home, 'USER.md.bak'));
    const r = await s.api('/api/memory/USER.md', { method: 'PUT', body: { content: 'nuevo user' } });
    assert.equal(r.status, 200);
    assert.equal(await fs.readFile(outside, 'utf8'), 'untouched');
    assert.ok(!(await fs.lstat(path.join(s.home, 'USER.md.bak'))).isSymbolicLink());
    await fs.rm(outside, { force: true });
  });

  test('jobs: list, run requires confirm, run records status', async () => {
    const jobs = await (await s.api('/api/jobs')).json();
    assert.equal(jobs.length, 2);
    assert.deepEqual(Object.keys(jobs[0]).sort(), ['description', 'id', 'last_run', 'last_status', 'name', 'schedule']);
    assert.equal('prompt' in jobs[0], false);

    assert.equal((await s.api('/api/jobs/resumen-diario/run', { method: 'POST', body: {} })).status, 400);
    assert.equal((await s.api('/api/jobs/resumen-diario/run', { method: 'POST', body: { confirm: 'yes' } })).status, 400);
    assert.equal((await s.api('/api/jobs/no-existe/run', { method: 'POST', body: { confirm: true } })).status, 404);
    assert.equal((await s.api('/api/jobs/sin-prompt/run', { method: 'POST', body: { confirm: true } })).status, 400);

    const r = await s.api('/api/jobs/resumen-diario/run', { method: 'POST', body: { confirm: true } });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { started: true });
    let job;
    for (let i = 0; i < 50; i++) {
      job = (await (await s.api('/api/jobs')).json()).find((j) => j.id === 'resumen-diario');
      if (job.last_status === 'ok') break;
      await new Promise((res) => setTimeout(res, 50));
    }
    assert.equal(job.last_status, 'ok');
    assert.ok(job.last_run);
    // prompt and other fields kept in jobs.json
    const raw = JSON.parse(await fs.readFile(path.join(s.home, 'jobs.json'), 'utf8'));
    assert.equal(raw[0].prompt, 'Hazme el resumen');
  });

  test('jobs: prompt_file is read from inside JARVIS_HOME; escapes are refused', async () => {
    const t = await startServer();
    await fs.mkdir(path.join(t.home, 'jobs'), { recursive: true });
    await fs.writeFile(path.join(t.home, 'jobs', 'briefing.md'), 'Haz el briefing');
    await fs.writeFile(
      path.join(t.home, 'jobs.json'),
      JSON.stringify([
        { id: 'briefing', name: 'Briefing', schedule: '3 7 * * 1-5', prompt_file: 'jobs/briefing.md' },
        { id: 'fuga', name: 'Fuga', schedule: '7 8 * * *', prompt_file: '../fuera.md' },
        { id: 'falta', name: 'Falta', schedule: '7 9 * * *', prompt_file: 'jobs/no-existe.md' },
      ])
    );
    const r = await t.api('/api/jobs/briefing/run', { method: 'POST', body: { confirm: true } });
    assert.equal(r.status, 200);
    let job;
    for (let i = 0; i < 50; i++) {
      job = (await (await t.api('/api/jobs')).json()).find((j) => j.id === 'briefing');
      if (job.last_status === 'ok') break;
      await new Promise((res) => setTimeout(res, 50));
    }
    assert.equal(job.last_status, 'ok');
    assert.equal((await t.api('/api/jobs/fuga/run', { method: 'POST', body: { confirm: true } })).status, 400);
    assert.equal((await t.api('/api/jobs/falta/run', { method: 'POST', body: { confirm: true } })).status, 404);
    await t.close();
  });

  test('memory: JARVIS_MEMORY_DIR points the Memoria screen at a subfolder', async () => {
    const home = await makeHome();
    await fs.mkdir(path.join(home, 'workspace'));
    await fs.writeFile(path.join(home, 'workspace', 'MEMORY.md'), 'desde workspace');
    const t = await startServer({ home, env: { JARVIS_MEMORY_DIR: 'workspace' } });
    const list = await (await t.api('/api/memory')).json();
    assert.deepEqual(list.map((f) => f.name), ['MEMORY.md']);
    assert.equal((await (await t.api('/api/memory/MEMORY.md')).json()).content, 'desde workspace');
    await t.close();
  });

  test('claude-cli: --settings resolves explicit file or the conventional headless file', async () => {
    const { resolveSettingsFile } = await import('../src/adapters/claude-cli.js');
    const home = await makeHome();
    assert.equal(resolveSettingsFile(home, ''), '');
    await fs.mkdir(path.join(home, '.claude'));
    await fs.writeFile(path.join(home, '.claude', 'headless-settings.json'), '{}');
    assert.equal(resolveSettingsFile(home, ''), path.join(home, '.claude', 'headless-settings.json'));
    assert.equal(resolveSettingsFile(home, 'otro.json'), path.join(home, 'otro.json'));
  });

  test('jobs: missing jobs.json -> []', async () => {
    const t = await startServer();
    await fs.rm(path.join(t.home, 'jobs.json'));
    assert.deepEqual(await (await t.api('/api/jobs')).json(), []);
    await t.close();
  });

  test('log: mutating calls are audited, newest first, no secrets', async () => {
    const log = await (await s.api('/api/log?limit=500')).json();
    assert.ok(Array.isArray(log) && log.length > 0);
    assert.ok(log.some((e) => e.action === 'memory.write' && e.target === 'MEMORY.md' && e.path === '/api/memory/MEMORY.md'));
    assert.ok(Date.parse(log[0].ts) >= Date.parse(log.at(-1).ts));
    const raw = await fs.readFile(path.join(s.home, 'logs', 'audit.jsonl'), 'utf8');
    assert.doesNotMatch(raw, /nuevo|hola mundo|do-not-leak/);
    const two = await (await s.api('/api/log?limit=2')).json();
    assert.equal(two.length, 2);
  });

  test('body size limit -> 413', async () => {
    const big = 'x'.repeat(600 * 1024);
    const r = await s.api('/api/memory/MEMORY.md', { method: 'PUT', body: { content: big } });
    assert.equal(r.status, 413);
  });

  test('unknown /api route -> 404 JSON, never env', async () => {
    const r = await s.api('/api/env');
    assert.equal(r.status, 404);
    assert.doesNotMatch(await r.text(), /do-not-leak|PANEL_/);
  });
});
