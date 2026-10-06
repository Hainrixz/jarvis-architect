import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, PASSWORD } from './helpers.js';

describe('Jarvis Panel auth (PANEL_PASSWORD set)', () => {
  let s;
  before(async () => {
    s = await startServer({ password: PASSWORD });
  });
  after(async () => {
    await s.close();
  });

  test('public routes work without a session', async () => {
    assert.equal((await s.api('/api/health')).status, 200);
    assert.deepEqual(await (await s.api('/api/session')).json(), { authenticated: false, auth_required: true });
  });

  test('every other /api route requires the session cookie', async () => {
    for (const p of ['/api/memory', '/api/memory/MEMORY.md', '/api/jobs', '/api/approvals', '/api/log']) {
      assert.equal((await s.api(p)).status, 401, p);
    }
    assert.equal((await s.api('/api/chat', { method: 'POST', body: { message: 'hola' } })).status, 401);
    assert.equal((await s.api('/api/memory/MEMORY.md', { method: 'PUT', body: { content: 'x' } })).status, 401);
    assert.equal((await s.api('/api/memory', { cookie: 'jarvis_panel_session=forged' })).status, 401);
  });

  test('bad password -> 401; good password -> httpOnly SameSite=Strict cookie that works', async () => {
    assert.equal((await s.api('/api/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
    const r = await s.api('/api/login', { method: 'POST', body: { password: PASSWORD } });
    assert.equal(r.status, 200);
    const set = r.headers.get('set-cookie');
    assert.match(set, /jarvis_panel_session=/);
    assert.match(set, /HttpOnly/i);
    assert.match(set, /SameSite=Strict/i);
    const cookie = set.split(';')[0];
    assert.deepEqual(await (await s.api('/api/session', { cookie })).json(), { authenticated: true, auth_required: true });
    assert.equal((await s.api('/api/memory', { cookie })).status, 200);
    // CSRF header still required with a valid cookie
    assert.equal((await s.api('/api/memory/MEMORY.md', { method: 'PUT', body: { content: 'x' }, cookie, csrf: false })).status, 403);
    // logout revokes
    assert.equal((await s.api('/api/logout', { method: 'POST', cookie })).status, 200);
    assert.equal((await s.api('/api/memory', { cookie })).status, 401);
  });

  test('login requires the CSRF header too', async () => {
    assert.equal((await s.api('/api/login', { method: 'POST', body: { password: PASSWORD }, csrf: false })).status, 403);
  });

  test('login is rate limited to 5 attempts per minute per IP', async () => {
    const t = await startServer({ password: PASSWORD });
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await t.api('/api/login', { method: 'POST', body: { password: 'wrong' } })).status);
    assert.deepEqual(codes, [401, 401, 401, 401, 401, 429, 429]);
    // even the right password is blocked while limited
    assert.equal((await t.api('/api/login', { method: 'POST', body: { password: PASSWORD } })).status, 429);
    await t.close();
  });

  test('behind a trusted proxy, a spoofed leftmost X-Forwarded-For does not reset the rate limit', async () => {
    const t = await startServer({ password: PASSWORD, env: { PANEL_TRUST_PROXY: '1' } });
    const codes = [];
    for (let i = 0; i < 7; i++) {
      const headers = { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.9` };
      codes.push((await t.api('/api/login', { method: 'POST', body: { password: 'wrong' }, headers })).status);
    }
    assert.deepEqual(codes, [401, 401, 401, 401, 401, 429, 429]);
    await t.close();
  });
});
