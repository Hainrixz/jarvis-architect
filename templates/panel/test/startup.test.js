import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLoopbackHost, loadConfig, ConfigError } from '../src/config.js';
import { buildCodexArgs } from '../src/adapters/codex-cli.js';
import { createClaudeEventMapper } from '../src/adapters/claude-cli.js';
import { createAdapter } from '../src/adapters/index.js';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'server.js');

function run(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SERVER], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'test', PANEL_PORT: '0', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const t = setTimeout(() => child.kill('SIGKILL'), 10_000);
    child.on('close', (code) => {
      clearTimeout(t);
      resolve({ code, out });
    });
  });
}

test('refuses to start on a non-loopback host without PANEL_PASSWORD (Spanish error, exit 1)', async () => {
  const { code, out } = await run({ PANEL_HOST: '0.0.0.0', PANEL_PASSWORD: '' });
  assert.equal(code, 1);
  assert.match(out, /No arranco/);
  assert.match(out, /PANEL_PASSWORD/);
});

test('refuses to start without PANEL_ADAPTER outside tests', async () => {
  const { code, out } = await run({ NODE_ENV: 'production', PANEL_HOST: '127.0.0.1' });
  assert.equal(code, 1);
  assert.match(out, /PANEL_ADAPTER/);
});

test('refuses unsafe runtime permission settings', () => {
  const base = { NODE_ENV: 'test', PANEL_HOST: '127.0.0.1' };
  assert.throws(() => createAdapter(loadConfig({ ...base, PANEL_ADAPTER: 'claude-cli', CLAUDE_PERMISSION_MODE: 'bypassPermissions' })), /bypassPermissions/);
  assert.throws(() => createAdapter(loadConfig({ ...base, PANEL_ADAPTER: 'codex-cli', CODEX_SANDBOX: 'danger-full-access' })), /CODEX_SANDBOX/);
});

test('loopback detection', () => {
  for (const h of ['127.0.0.1', 'localhost', '::1', '[::1]', '127.1.2.3']) assert.equal(isLoopbackHost(h), true, h);
  for (const h of ['0.0.0.0', '::', '192.168.1.5', '', 'example.com']) assert.equal(isLoopbackHost(h), false, h);
  assert.throws(() => loadConfig({ NODE_ENV: 'test', PANEL_HOST: '0.0.0.0' }), ConfigError);
  assert.throws(() => loadConfig({ NODE_ENV: 'test', PANEL_HOST: '0.0.0.0', PANEL_PASSWORD: 'short' }), ConfigError);
  const c = loadConfig({ NODE_ENV: 'test', PANEL_HOST: '0.0.0.0', PANEL_PASSWORD: 'a-long-enough-password' });
  assert.equal(c.authRequired, true);
  assert.equal(c.cookieSecure, true);
});

test('claude stream-json mapper: partial deltas, no duplicate text, done with session id', () => {
  const m = createClaudeEventMapper();
  const evs = [
    { type: 'system', subtype: 'init', session_id: 's-1' },
    { type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_start' } },
    { type: 'stream_event', parent_tool_use_id: null, event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Ho' } } },
    { type: 'stream_event', parent_tool_use_id: null, event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'la' } } },
    { type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'text', text: 'Hola' }] } },
    { type: 'stream_event', parent_tool_use_id: 'tool-1', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'subagent' } } },
    { type: 'result', subtype: 'success', is_error: false, result: 'Hola', session_id: 's-1' },
  ].flatMap((e) => m.map(e));
  assert.deepEqual(evs, [
    { type: 'delta', text: 'Ho' },
    { type: 'delta', text: 'la' },
    { type: 'done', sessionId: 's-1' },
  ]);
  const m2 = createClaudeEventMapper(); // without --include-partial-messages
  const evs2 = [{ type: 'assistant', parent_tool_use_id: null, message: { content: [{ type: 'text', text: 'Entero' }] } }].flatMap((e) => m2.map(e));
  assert.deepEqual(evs2, [{ type: 'delta', text: 'Entero' }]);
  assert.throws(() => createClaudeEventMapper().map({ type: 'result', subtype: 'error_during_execution', is_error: true }), /error/);
});

test('codex args: prompt via stdin on new runs, after -- on resume, never dangerous flags', () => {
  const a = buildCodexArgs({ message: '--help me', sessionId: undefined, sandbox: 'workspace-write' });
  assert.deepEqual(a.args, ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-']);
  assert.equal(a.input, '--help me');
  const b = buildCodexArgs({ message: '--hola', sessionId: 'abc-123', sandbox: 'read-only' });
  assert.deepEqual(b.args, ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only', 'resume', 'abc-123', '--', '--hola']);
  assert.ok(!a.args.join(' ').includes('danger') && !b.args.join(' ').includes('danger'));
});

test('codex sandbox defaults to read-only', () => {
  const cfg = loadConfig({ NODE_ENV: 'test', PANEL_ADAPTER: 'codex-cli' });
  assert.equal(cfg.adapterEnv.CODEX_SANDBOX, 'read-only');
});
