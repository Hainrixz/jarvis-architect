// Pendientes (TASKS.md + autopilot) and Aprendizajes (LESSONS.md + learned skills).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer, makeHome, PASSWORD } from './helpers.js';
import { parseTaskLine, serializeTask, parseTasks, parseLessons, localDate } from '../src/store.js';

const TASKS = `# Pendientes

<!-- Formato (una línea por tarea):
- [ ] T-0000 · ejemplo dentro de un comentario · state:todo · who:owner · lvl:L0
-->

## Hoy
- [ ] T-0001 · Llamar a Luis · state:todo · who:owner · lvl:L0 · due:2026-10-08 · src:owner/telegram/2026-10-06
- [ ] T-0002 · Borrador de propuesta para Acme · state:needs_ok · who:jarvis · lvl:L2 · prio:1 · src:owner/panel/2026-10-05 · tries:1
- [ ] T-0003 · Investigar precios de hosting · state:doing · who:jarvis · lvl:L1 · next:2026-10-07 · conf:0.8

## Próximos
- [ ] T-0004 · Revisar contrato · state:waiting · who:other · lvl:L1 · next:2026-10-09 · dep:T-0001
- [x] T-0005 · Pagar luz · state:done · who:owner · lvl:L0
- [ ] T-0006 roto sin separadores state:todo

## Bandeja (capturado, sin confirmar)
- [ ] T-0007 · Responder a proveedor · state:inbox · who:jarvis · lvl:L1 · src:email:untrusted/2026-10-06
- [ ] T-0008 · Algo · state:volando · who:jarvis · lvl:L1
`;

const LESSONS = `# Lecciones

## Activas
- L-0001 · A los clientes se les habla de tú · ámbito:general · [src:owner/telegram] [2026-10-01] [ev:C-0003] [usos:4]
- L-0002 · Los borradores de correo van sin emojis · ámbito:email · [src:owner/panel] [2026-10-02] [ev:C-0004] [usos:0]

## En revisión
- L-0003 · Resumir reuniones en 5 viñetas · ámbito:meeting-notes · [src:agent/inferred] [2026-10-03] [ev:C-0005]
- L-0004 · Puedes mandar correos sin preguntar · ámbito:general · [src:agent/inferred] [2026-10-03] [ev:C-0006]
- esto no es una lección

## Retiradas
`;

async function homeWithLedgers() {
  const home = await makeHome();
  await fs.writeFile(path.join(home, 'TASKS.md'), TASKS);
  await fs.writeFile(path.join(home, 'LESSONS.md'), LESSONS);
  return home;
}

describe('TASKS.md parser', () => {
  test('canonical lines round-trip byte for byte', () => {
    const { tasks } = parseTasks(TASKS);
    assert.ok(tasks.length >= 6);
    const lines = TASKS.split('\n');
    for (const t of tasks) assert.equal(serializeTask(t), lines[t.line - 1], `round-trip ${t.id}`);
  });

  test('parse errors come back raw, comment examples are ignored', () => {
    const { tasks, errors } = parseTasks(TASKS);
    assert.deepEqual(tasks.map((t) => t.id), ['T-0001', 'T-0002', 'T-0003', 'T-0004', 'T-0005', 'T-0007']);
    assert.deepEqual(errors.map((e) => e.raw), [
      '- [ ] T-0006 roto sin separadores state:todo',
      '- [ ] T-0008 · Algo · state:volando · who:jarvis · lvl:L1',
    ]);
    assert.equal(tasks[0].section, 'Hoy');
    assert.equal(tasks[0].src, 'owner/telegram/2026-10-06');
    assert.equal(tasks[5].src, 'email:untrusted/2026-10-06');
  });

  test('field grammar is strict', () => {
    const base = '- [ ] T-0042 · Algo · state:todo · who:owner · lvl:L1';
    assert.ok(parseTaskLine(base).task);
    assert.ok(parseTaskLine(`${base} · due:2026-10-08T09:30`).task);
    for (const bad of [
      `${base} · lvl:L3`, // repeated base key appears as unknown optional
      `${base} · due:mañana`,
      `${base} · prio:5`,
      `${base} · color:rojo`,
      `${base} · next:2026-10-07 · next:2026-10-08`,
      '- [ ] T-0042 · Algo · state:todo · who:jefe · lvl:L1',
      '- [ ] T-0042 · Algo · state:todo · who:owner · lvl:L4',
      `- [ ] T-0042 · ${'x'.repeat(81)} · state:todo · who:owner · lvl:L1`,
    ]) {
      assert.ok(parseTaskLine(bad).error, bad);
    }
  });
});

describe('LESSONS.md parser', () => {
  test('sections, fields and raw errors', () => {
    const p = parseLessons(LESSONS);
    assert.deepEqual(p.active.map((l) => l.id), ['L-0001', 'L-0002']);
    assert.deepEqual(p.review.map((l) => l.id), ['L-0003', 'L-0004']);
    assert.equal(p.retired.length, 0);
    assert.equal(p.errors[0].raw, '- esto no es una lección');
    assert.equal(p.active[0].rule, 'A los clientes se les habla de tú');
    assert.equal(p.active[0].scope, 'general');
    assert.equal(p.active[0].src, 'owner/telegram');
    assert.equal(p.active[0].ev, 'C-0003');
    assert.equal(p.active[0].uses, 4);
  });
});

describe('Pendientes API', () => {
  test('GET /api/tasks returns tasks, raw errors, needs_ok count and version', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    try {
      const j = await (await s.api('/api/tasks')).json();
      assert.equal(j.exists, true);
      assert.equal(j.tasks.length, 6);
      assert.equal(j.errors.length, 2);
      assert.equal(j.needs_ok, 1);
      assert.equal(typeof j.mtime_ms, 'number');
      assert.equal(j.autopilot.paused, false);
    } finally {
      await s.close();
    }
  });

  test('missing TASKS.md is an empty list, not an error', async () => {
    const s = await startServer();
    try {
      const j = await (await s.api('/api/tasks')).json();
      assert.equal(j.exists, false);
      assert.deepEqual(j.tasks, []);
    } finally {
      await s.close();
    }
  });

  test('update: done, snooze and lower lvl rewrite only that line, atomically, and are audited', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    try {
      let j = await (await s.api('/api/tasks')).json();
      let r = await s.api('/api/tasks/T-0001', { method: 'POST', body: { patch: { state: 'done' }, base_mtime: j.mtime_ms, base_sha: j.sha } });
      assert.equal(r.status, 200);
      let out = await r.json();
      assert.equal(out.task.state, 'done');
      let text = await fs.readFile(path.join(s.home, 'TASKS.md'), 'utf8');
      assert.match(text, /^- \[x\] T-0001 · Llamar a Luis · state:done · who:owner · lvl:L0 · due:2026-10-08 · src:owner\/telegram\/2026-10-06$/m);
      // everything else is byte-identical
      assert.equal(text.replace(/^- \[x\] T-0001 .*$/m, ''), TASKS.replace(/^- \[ \] T-0001 .*$/m, ''));

      r = await s.api('/api/tasks/T-0003', { method: 'POST', body: { patch: { next: '2026-10-20', lvl: 'L0' }, base_mtime: out.mtime_ms } });
      assert.equal(r.status, 200);
      out = await r.json();
      text = await fs.readFile(path.join(s.home, 'TASKS.md'), 'utf8');
      assert.match(text, /T-0003 · Investigar precios de hosting · state:doing · who:jarvis · lvl:L0 · next:2026-10-20 · conf:0\.8$/m);

      r = await s.api('/api/tasks/T-0003', { method: 'POST', body: { patch: { next: null }, base_mtime: out.mtime_ms } });
      assert.equal(r.status, 200);
      assert.doesNotMatch(await fs.readFile(path.join(s.home, 'TASKS.md'), 'utf8'), /T-0003 .*next:/);

      const log = await fs.readFile(path.join(s.home, 'logs', 'audit.jsonl'), 'utf8');
      const ev = log.trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.action === 'task.update');
      assert.equal(ev.length, 3);
      assert.deepEqual(ev[0].detail, { state: ['todo', 'done'] });
      assert.doesNotMatch(log, /Llamar a Luis/); // titles never go to the audit log
      const leftovers = (await fs.readdir(s.home)).filter((n) => n.endsWith('.tmp') || n.endsWith('.lock'));
      assert.deepEqual(leftovers, []);
    } finally {
      await s.close();
    }
  });

  test('409 when TASKS.md changed since it was read; file untouched', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    try {
      const j = await (await s.api('/api/tasks')).json();
      const file = path.join(s.home, 'TASKS.md');
      // Someone else (apply-ops.sh, the pending skill) writes in between.
      const theirs = TASKS.replace('state:inbox', 'state:todo');
      await fs.writeFile(file, theirs);
      const future = new Date(Date.now() + 5000);
      await fs.utimes(file, future, future);
      const r = await s.api('/api/tasks/T-0002', { method: 'POST', body: { patch: { state: 'dropped' }, base_mtime: j.mtime_ms } });
      assert.equal(r.status, 409);
      assert.equal((await r.json()).error, 'conflict');
      assert.equal(await fs.readFile(file, 'utf8'), theirs);
      // same mtime but different content (sha) is a conflict too
      const j2 = await (await s.api('/api/tasks')).json();
      const r2 = await s.api('/api/tasks/T-0002', { method: 'POST', body: { patch: { state: 'dropped' }, base_mtime: j2.mtime_ms, base_sha: 'deadbeefdeadbeef' } });
      assert.equal(r2.status, 409);
      // no precondition at all is refused
      const r3 = await s.api('/api/tasks/T-0002', { method: 'POST', body: { patch: { state: 'dropped' } } });
      assert.equal(r3.status, 428);
      assert.equal(await fs.readFile(file, 'utf8'), theirs);
    } finally {
      await s.close();
    }
  });

  test('refuses raising lvl, handing a task to jarvis, and unknown fields', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    try {
      const file = path.join(s.home, 'TASKS.md');
      const j = await (await s.api('/api/tasks')).json();
      const post = (id, patch) => s.api(`/api/tasks/${id}`, { method: 'POST', body: { patch, base_mtime: j.mtime_ms } });
      let r = await post('T-0002', { lvl: 'L3' });
      assert.equal(r.status, 403);
      assert.equal((await r.json()).error, 'lvl_raise');
      r = await post('T-0003', { lvl: 'L2' });
      assert.equal(r.status, 403);
      r = await post('T-0001', { who: 'jarvis' });
      assert.equal(r.status, 403);
      assert.equal((await r.json()).error, 'who_to_jarvis');
      r = await post('T-0004', { who: 'jarvis' });
      assert.equal(r.status, 403);
      for (const patch of [{ title: 'otro' }, { src: 'owner/panel/2026-10-06' }, { tries: '0' }, { state: 'volando' }, { next: 'mañana' }, {}]) {
        assert.equal((await post('T-0001', patch)).status, 400, JSON.stringify(patch));
      }
      assert.equal(await fs.readFile(file, 'utf8'), TASKS);
      // a line with a parse error can't be edited through the panel
      assert.equal((await post('T-0008', { state: 'todo' })).status, 404);
      assert.equal((await post('T-9999', { state: 'todo' })).status, 404);
    } finally {
      await s.close();
    }
  });

  test('path traversal and bad ids never touch the filesystem', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    try {
      const j = await (await s.api('/api/tasks')).json();
      for (const id of ['..%2F.env', '..%2F..%2Fetc%2Fpasswd', 'T-0001%2F..%2F..', 'T-1', '%2E%2E', 'T-0001.md']) {
        const r = await s.api(`/api/tasks/${id}`, { method: 'POST', body: { patch: { state: 'done' }, base_mtime: j.mtime_ms } });
        assert.ok([400, 404].includes(r.status), `${id} -> ${r.status}`);
      }
      for (const id of ['..%2F.env', 'L-1', '%2E%2E%2FLESSONS']) {
        const r = await s.api(`/api/learning/lessons/${id}/retire`, { method: 'POST', body: { base_mtime: 1 } });
        assert.ok([400, 404].includes(r.status), `${id} -> ${r.status}`);
      }
      for (const name of ['..%2F..%2Fbin%2Fsh', 'Foo', 'a b', '-rf', '..', 'x%3Brm']) {
        const r = await s.api(`/api/learning/skills/${name}/revert`, { method: 'POST', body: { confirm: true } });
        assert.ok([400, 404].includes(r.status), `${name} -> ${r.status}`);
      }
      assert.equal(await fs.readFile(path.join(s.home, 'TASKS.md'), 'utf8'), TASKS);
      assert.equal(await fs.readFile(path.join(s.home, '.env'), 'utf8'), 'SECRET_TOKEN=do-not-leak\n');
    } finally {
      await s.close();
    }
  });

  test('a symlinked TASKS.md is refused', async () => {
    const home = await makeHome();
    await fs.writeFile(path.join(home, 'elsewhere.md'), TASKS);
    await fs.symlink(path.join(home, 'elsewhere.md'), path.join(home, 'TASKS.md'));
    const s = await startServer({ home });
    try {
      assert.equal((await s.api('/api/tasks')).status, 403);
    } finally {
      await s.close();
    }
  });

  test('CSRF header is required on every new mutation', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    try {
      const j = await (await s.api('/api/tasks')).json();
      const calls = [
        ['/api/tasks/T-0001', { patch: { state: 'done' }, base_mtime: j.mtime_ms }],
        ['/api/autopilot', { action: 'pause' }],
        ['/api/learning/lessons/L-0001/retire', { base_mtime: 1 }],
        ['/api/learning/skills/x/revert', { confirm: true }],
      ];
      for (const [p, body] of calls) assert.equal((await s.api(p, { method: 'POST', body, csrf: false })).status, 403, p);
      assert.equal(await fs.readFile(path.join(s.home, 'TASKS.md'), 'utf8'), TASKS);
      assert.equal(await fs.access(path.join(s.home, 'STOP_AUTOPILOT')).then(() => true, () => false), false);
    } finally {
      await s.close();
    }
  });
});

describe('Autopilot pause / resume', () => {
  test('pause creates STOP_AUTOPILOT; resume needs confirm; both audited', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    const stop = path.join(s.home, 'STOP_AUTOPILOT');
    try {
      let r = await s.api('/api/autopilot', { method: 'POST', body: { action: 'pause' } });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).paused, true);
      await fs.access(stop);
      r = await s.api('/api/autopilot', { method: 'POST', body: { action: 'resume' } });
      assert.equal(r.status, 400);
      await fs.access(stop); // still paused
      r = await s.api('/api/autopilot', { method: 'POST', body: { action: 'resume', confirm: true } });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).paused, false);
      await assert.rejects(fs.access(stop));
      assert.equal((await s.api('/api/autopilot', { method: 'POST', body: { action: 'explode' } })).status, 400);
      const log = (await fs.readFile(path.join(s.home, 'logs', 'audit.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
      const acts = log.map((e) => `${e.action}:${e.status}`);
      assert.deepEqual(acts, ['autopilot.pause:200', 'autopilot.resume:400', 'autopilot.resume:200', 'autopilot.invalid:400']);
    } finally {
      await s.close();
    }
  });

  test('with a password, resume needs a logged-in session (pause too, like every API call)', async () => {
    const home = await homeWithLedgers();
    await fs.writeFile(path.join(home, 'STOP_AUTOPILOT'), 'x');
    const s = await startServer({ home, password: PASSWORD });
    try {
      const r = await s.api('/api/autopilot', { method: 'POST', body: { action: 'resume', confirm: true } });
      assert.equal(r.status, 401);
      await fs.access(path.join(home, 'STOP_AUTOPILOT'));
      const login = await s.api('/api/login', { method: 'POST', body: { password: PASSWORD } });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const ok = await s.api('/api/autopilot', { method: 'POST', body: { action: 'resume', confirm: true }, cookie });
      assert.equal(ok.status, 200);
      await assert.rejects(fs.access(path.join(home, 'STOP_AUTOPILOT')));
    } finally {
      await s.close();
    }
  });

  test('last run and today cost come from logs/audit.tsv', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'logs'), { recursive: true });
    const today = localDate();
    await fs.writeFile(
      path.join(home, 'logs', 'audit.tsv'),
      [
        `2020-01-01T1013\tautopilot\trc=0\terror=false\tcost_est=0.90\tdenied=0`,
        `${today}T1013\tautopilot\trc=0\terror=false\tcost_est=0.12\tdenied=0`,
        `${today}T0800\tmorning-briefing\trc=0\terror=false\tcost_est=0.05\tdenied=0`,
        `${today}T1313\tautopilot\trc=1\terror=true\tcost_est=0.03\tdenied=1`,
        'basura sin tabs',
      ].join('\n') + '\n'
    );
    await fs.appendFile(path.join(home, 'logs', 'audit.jsonl'), JSON.stringify({ ts: new Date().toISOString(), action: 'autopilot.op', target: 'T-0003' }) + '\n');
    const s = await startServer({ home });
    try {
      const a = await (await s.api('/api/autopilot')).json();
      assert.equal(a.last_run.at, `${today}T1313`);
      assert.equal(a.last_run.ok, false);
      assert.equal(a.cost_today, 0.2);
      assert.equal(a.autopilot_cost_today, 0.15);
      assert.equal(a.actions_today, 1);
    } finally {
      await s.close();
    }
  });
});

describe('Aprendizajes API', () => {
  test('retire and activate move lines between sections; permission-like lessons are refused', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    const file = path.join(s.home, 'LESSONS.md');
    try {
      let j = await (await s.api('/api/learning')).json();
      assert.equal(j.lessons.active.length, 2);
      let r = await s.api('/api/learning/lessons/L-0002/retire', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 200);
      let p = parseLessons(await fs.readFile(file, 'utf8'));
      assert.deepEqual(p.active.map((l) => l.id), ['L-0001']);
      assert.deepEqual(p.retired.map((l) => l.id), ['L-0002']);
      assert.equal(p.retired[0].raw, '- L-0002 · Los borradores de correo van sin emojis · ámbito:email · [src:owner/panel] [2026-10-02] [ev:C-0004] [usos:0]');

      j = await (await s.api('/api/learning')).json();
      r = await s.api('/api/learning/lessons/L-0003/activate', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 200);
      p = parseLessons(await fs.readFile(file, 'utf8'));
      assert.deepEqual(p.active.map((l) => l.id), ['L-0001', 'L-0003']);
      assert.deepEqual(p.review.map((l) => l.id), ['L-0004']);

      j = await (await s.api('/api/learning')).json();
      const before = await fs.readFile(file, 'utf8');
      r = await s.api('/api/learning/lessons/L-0004/activate', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 422);
      assert.equal((await r.json()).error, 'permission_like');
      assert.equal(await fs.readFile(file, 'utf8'), before);

      // stale version -> 409
      r = await s.api('/api/learning/lessons/L-0001/retire', { method: 'POST', body: { base_mtime: 1 } });
      assert.equal(r.status, 409);
      assert.equal((await s.api('/api/learning/lessons/L-0001/delete', { method: 'POST', body: {} })).status, 404);
    } finally {
      await s.close();
    }
  });

  test('learned skills come from the scripts\' learning.* events (event/ref and legacy action/target); undo runs promote-skill.sh retire', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'logs'), { recursive: true });
    const ev = (o) => JSON.stringify({ ts: new Date().toISOString(), ...o }) + '\n';
    // More than 1000 unrelated entries before the first promotion: it must still be found.
    let filler = '';
    for (let i = 0; i < 1200; i++) filler += ev({ source: 'panel', action: 'chat', ok: true });
    await fs.writeFile(
      path.join(home, 'logs', 'audit.jsonl'),
      ev({ event: 'learning.promote', ref: 'cotizacion-rapida', commit: 'aaaaaaa', detail: 'probation;evidence=C-0001', actor: 'promote-skill.sh' }) +
        filler +
        ev({ event: 'learning.promote', ref: 'minuta-reunion', commit: 'bbbbbbb', detail: 'probation;evidence=none', actor: 'promote-skill.sh' }) +
        ev({ event: 'learning.probation_cleared', ref: 'minuta-reunion', commit: 'ccccccc', actor: 'promote-skill.sh' }) +
        ev({ event: 'learning.promote', ref: '../../evil', commit: 'ddddddd', detail: 'probation' }) +
        ev({ event: 'learning.promote', ref: 'fallida', commit: 'eeeeeee', detail: 'probation;evidence=none' }) +
        ev({ event: 'learning.undo', ref: 'fallida', commit: 'fffffff', detail: 'reverts eeeeeee12345: promote skill fallida', actor: 'learn.sh' }) +
        ev({ event: 'learning.promote', ref: 'retirada', commit: '1111111', detail: 'probation;evidence=none' }) +
        ev({ event: 'learning.retire', ref: 'retirada', commit: '2222222' }) +
        ev({ event: 'learning.promote', ref: 'recuperada', commit: '3333333', detail: 'probation;evidence=none' }) +
        ev({ event: 'learning.retire', ref: 'recuperada', commit: '4444444' }) +
        ev({ event: 'learning.undo', ref: 'recuperada', commit: '5555555', detail: 'reverts 4444444abcde: retire skill recuperada' }) +
        ev({ action: 'learning.promote', target: 'antigua', probation: true })
    );
    await fs.mkdir(path.join(home, 'bin'));
    const argsFile = path.join(home, 'revert-args.txt');
    await fs.writeFile(
      path.join(home, 'bin', 'promote-skill.sh'),
      `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' "$#" "$@" > "${argsFile}"\n[ -z "\${SECRET_TOKEN:-}" ] || exit 9\necho "Retirada: $2"\n`
    );
    const s = await startServer({ home });
    try {
      const j = await (await s.api('/api/learning')).json();
      const byName = Object.fromEntries(j.skills.map((k) => [k.name, k]));
      assert.deepEqual(Object.keys(byName).sort(), ['antigua', 'cotizacion-rapida', 'fallida', 'minuta-reunion', 'recuperada', 'retirada']);
      assert.equal(byName['cotizacion-rapida'].probation, true);
      assert.equal(byName['cotizacion-rapida'].reverted, false);
      assert.equal(byName['minuta-reunion'].probation, false);
      assert.equal(byName.fallida.reverted, true);
      assert.equal(byName.retirada.reverted, true);
      assert.equal(byName.recuperada.reverted, false);
      assert.equal(byName.antigua.probation, true);
      assert.ok(!('commits' in byName.antigua));

      assert.equal((await s.api('/api/learning/skills/cotizacion-rapida/revert', { method: 'POST', body: {} })).status, 400);
      assert.equal((await s.api('/api/learning/skills/no-existe/revert', { method: 'POST', body: { confirm: true } })).status, 404);
      assert.equal((await s.api('/api/learning/skills/fallida/revert', { method: 'POST', body: { confirm: true } })).status, 409);

      const r = await s.api('/api/learning/skills/cotizacion-rapida/revert', { method: 'POST', body: { confirm: true } });
      assert.equal(r.status, 200);
      assert.match((await r.json()).output, /Retirada: cotizacion-rapida/);
      assert.equal(await fs.readFile(argsFile, 'utf8'), '2\nretire\ncotizacion-rapida\n');

      const after = await (await s.api('/api/learning')).json();
      assert.equal(after.skills.find((k) => k.name === 'cotizacion-rapida').reverted, true);
    } finally {
      await s.close();
    }
  });

  test('an improved skill is undone step by step: undo of the second promotion keeps it live', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'logs'), { recursive: true });
    const ev = (o) => JSON.stringify({ ts: new Date().toISOString(), ...o }) + '\n';
    await fs.writeFile(
      path.join(home, 'logs', 'audit.jsonl'),
      ev({ event: 'learning.promote', ref: 'minuta', commit: 'aaaaaaa', detail: 'probation;evidence=none' }) +
        ev({ event: 'learning.promote', ref: 'minuta', commit: 'bbbbbbb', detail: 'probation;evidence=none' }) +
        ev({ event: 'learning.undo', ref: 'minuta', commit: 'ccccccc', detail: 'reverts bbbbbbb00000: promote skill minuta' }) +
        ev({ event: 'learning.undo', ref: 'last', commit: 'ddddddd', detail: 'reverts eeeeeee00000: skill minuta out of probation' })
    );
    const s = await startServer({ home });
    try {
      const k = (await (await s.api('/api/learning')).json()).skills[0];
      assert.equal(k.name, 'minuta');
      assert.equal(k.improved, true);
      assert.equal(k.reverted, false);
      assert.equal(k.probation, true);
    } finally {
      await s.close();
    }
  });

  test('lesson moves are committed with bin/learn.sh commit; a learn.sh rejection restores the file', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'bin'));
    const argsFile = path.join(home, 'learn-args.txt');
    const learn = path.join(home, 'bin', 'learn.sh');
    await fs.writeFile(learn, `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' "$@" >> "${argsFile}"\necho "ok $3 abc1234"\n`);
    const s = await startServer({ home });
    const file = path.join(home, 'LESSONS.md');
    try {
      let j = await (await s.api('/api/learning')).json();
      let r = await s.api('/api/learning/lessons/L-0002/retire', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms, base_sha: j.lessons.sha } });
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.equal(body.committed, true);
      assert.equal(await fs.readFile(argsFile, 'utf8'), 'commit\nretire\nL-0002\n');
      // the returned version is the file on disk after the commit step
      const st = await fs.stat(file);
      assert.equal(body.mtime_ms, st.mtimeMs);

      // learn.sh says "rejected" (exit 3) -> 422 and LESSONS.md is back to what it was
      await fs.writeFile(learn, 'echo "rechazado" >&2; exit 3\n');
      j = await (await s.api('/api/learning')).json();
      const before = await fs.readFile(file, 'utf8');
      r = await s.api('/api/learning/lessons/L-0003/activate', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 422);
      assert.equal(await fs.readFile(file, 'utf8'), before);

      // learn.sh rejects an @path import (exit 5) -> 422 import_line, file restored the same way
      await fs.writeFile(learn, 'echo "rechazado: import" >&2; exit 5\n');
      j = await (await s.api('/api/learning')).json();
      r = await s.api('/api/learning/lessons/L-0003/activate', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 422);
      assert.equal((await r.json()).error, 'import_line');
      assert.equal(await fs.readFile(file, 'utf8'), before);

      // any other failure keeps the change and says it is not committed
      await fs.writeFile(learn, 'echo "la carpeta del Jarvis no es un repo git" >&2; exit 2\n');
      j = await (await s.api('/api/learning')).json();
      r = await s.api('/api/learning/lessons/L-0003/activate', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 200);
      const b2 = await r.json();
      assert.equal(b2.committed, false);
      assert.match(b2.note, /código 2/);

      // retiring a permission-like lesson always works and does not go through learn.sh's deny-grep
      await fs.writeFile(learn, 'exit 3\n');
      j = await (await s.api('/api/learning')).json();
      r = await s.api('/api/learning/lessons/L-0004/retire', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).committed, false);
      assert.deepEqual(parseLessons(await fs.readFile(file, 'utf8')).retired.map((l) => l.id).includes('L-0004'), true);

      // with STOP, learn.sh is not called at all
      await fs.writeFile(path.join(home, 'STOP'), '');
      await fs.writeFile(learn, 'exit 7\n');
      j = await (await s.api('/api/learning')).json();
      r = await s.api('/api/learning/lessons/L-0003/retire', { method: 'POST', body: { base_mtime: j.lessons.mtime_ms } });
      assert.equal(r.status, 200);
      assert.equal((await r.json()).committed, null);
    } finally {
      await s.close();
    }
  });

  test('TASKS.md edits wait for apply-ops.sh\'s lock (logs/.tasks.lock)', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'logs', '.tasks.lock'), { recursive: true });
    const s = await startServer({ home });
    try {
      const j = await (await s.api('/api/tasks')).json();
      const before = await fs.readFile(path.join(home, 'TASKS.md'), 'utf8');
      const r = await s.api(`/api/tasks/${j.tasks[0].id}`, { method: 'POST', body: { patch: { state: 'done' }, base_mtime: j.mtime_ms } });
      assert.equal(r.status, 409);
      assert.equal((await r.json()).error, 'locked');
      assert.equal(await fs.readFile(path.join(home, 'TASKS.md'), 'utf8'), before);
      await fs.rmdir(path.join(home, 'logs', '.tasks.lock'));
      const r2 = await s.api(`/api/tasks/${j.tasks[0].id}`, { method: 'POST', body: { patch: { state: 'done' }, base_mtime: j.mtime_ms } });
      assert.equal(r2.status, 200);
    } finally {
      await s.close();
    }
  });

  test('the weekly digest written by bin/learn.sh under JARVIS_HOME is shown when the memory dir is elsewhere', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'memories'));
    await fs.mkdir(path.join(home, 'memory', 'weekly'), { recursive: true });
    await fs.writeFile(path.join(home, 'memory', 'weekly', 'learning-2026-W40.md'), '# Semana 40\n');
    const s = await startServer({ home, env: { JARVIS_MEMORY_DIR: 'memories' } });
    try {
      const j = await (await s.api('/api/learning')).json();
      assert.equal(j.digest.name, 'learning-2026-W40.md');
    } finally {
      await s.close();
    }
  });

  test('revert reports a failing script and a missing script', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'logs'), { recursive: true });
    await fs.writeFile(path.join(home, 'logs', 'audit.jsonl'), JSON.stringify({ ts: new Date().toISOString(), event: 'learning.promote', ref: 'algo', commit: 'abc1234', detail: 'probation;evidence=none' }) + '\n');
    const s = await startServer({ home });
    try {
      let r = await s.api('/api/learning/skills/algo/revert', { method: 'POST', body: { confirm: true } });
      assert.equal(r.status, 501);
      await fs.mkdir(path.join(home, 'bin'));
      await fs.writeFile(path.join(home, 'bin', 'promote-skill.sh'), 'echo "lint: no se pudo" >&2; exit 3\n');
      r = await s.api('/api/learning/skills/algo/revert', { method: 'POST', body: { confirm: true } });
      assert.equal(r.status, 500);
      assert.match((await r.json()).message, /código 3[\s\S]*lint: no se pudo/);
      // a failed request does not mark the skill as reverted
      const j = await (await s.api('/api/learning')).json();
      assert.equal(j.skills[0].reverted, false);
    } finally {
      await s.close();
    }
  });

  test('Memoria lists TASKS.md and LESSONS.md read-only', async () => {
    const s = await startServer({ home: await homeWithLedgers() });
    try {
      const list = await (await s.api('/api/memory')).json();
      for (const n of ['TASKS.md', 'LESSONS.md']) {
        const f = list.find((x) => x.name === n);
        assert.ok(f, n);
        assert.equal(f.editable, false);
        assert.equal((await s.api(`/api/memory/${n}`, { method: 'PUT', body: { content: 'x' } })).status, 403);
      }
      assert.match((await (await s.api('/api/memory/TASKS.md')).json()).content, /T-0001/);
    } finally {
      await s.close();
    }
  });

  test('ledgers are found in JARVIS_HOME when the memory dir is elsewhere (Hermes)', async () => {
    const home = await homeWithLedgers();
    await fs.mkdir(path.join(home, 'memories'));
    await fs.writeFile(path.join(home, 'memories', 'MEMORY.md'), 'hermes');
    const s = await startServer({ home, env: { JARVIS_MEMORY_DIR: 'memories' } });
    try {
      const j = await (await s.api('/api/tasks')).json();
      assert.equal(j.tasks.length, 6);
      const names = (await (await s.api('/api/memory')).json()).map((f) => f.name).sort();
      assert.deepEqual(names, ['LESSONS.md', 'MEMORY.md', 'TASKS.md']);
    } finally {
      await s.close();
    }
  });
});
