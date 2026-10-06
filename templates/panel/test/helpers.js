// Shared test helpers: temp JARVIS_HOME + in-process server on a random loopback port.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/server.js';
import { createAdapter } from '../src/adapters/index.js';
import { createStore } from '../src/store.js';

export const PASSWORD = 'correct horse battery staple';

export async function makeHome() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-panel-test-'));
  for (const f of ['SOUL.md', 'USER.md', 'MEMORY.md', 'HEARTBEAT.md', 'AGENTS.md', 'TOOLS.md']) {
    await fs.writeFile(path.join(home, f), `# ${f}\noriginal\n`);
  }
  await fs.writeFile(path.join(home, '.env'), 'SECRET_TOKEN=do-not-leak\n');
  await fs.writeFile(
    path.join(home, 'jobs.json'),
    JSON.stringify([
      { id: 'resumen-diario', name: 'Resumen diario', schedule: '0 8 * * 1-5', description: 'Resumen de la mañana', prompt: 'Hazme el resumen' },
      { id: 'sin-prompt', name: 'Sin prompt', schedule: '0 9 * * *', description: 'x' },
    ])
  );
  await fs.mkdir(path.join(home, 'approvals', 'pending'), { recursive: true });
  return home;
}

export async function startServer({ home, password = '', env = {} } = {}) {
  home = home || (await makeHome());
  const config = loadConfig({
    NODE_ENV: 'test',
    JARVIS_HOME: home,
    JARVIS_NAME: 'Jarvis de Prueba',
    PANEL_HOST: '127.0.0.1',
    PANEL_PORT: '0',
    PANEL_PASSWORD: password,
    MOCK_DELAY_MS: '1',
    ...env,
  });
  const adapter = createAdapter(config);
  const store = createStore(config);
  const app = createApp({ config, adapter, store });
  const server = await new Promise((resolve) => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = (p, { method = 'GET', body, headers = {}, csrf = true, cookie } = {}) => {
    const h = { ...headers };
    if (body !== undefined) h['content-type'] = 'application/json';
    if (csrf && method !== 'GET') h['x-jarvis-panel'] = '1';
    if (cookie) h.cookie = cookie;
    return fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  };
  const close = () =>
    new Promise((r) => {
      server.closeAllConnections?.();
      server.close(() => r());
    });
  return { base, api, close, home, config };
}

export async function writePending(home, id, data) {
  await fs.writeFile(path.join(home, 'approvals', 'pending', `${id}.json`), JSON.stringify(data));
}

/** Parse an SSE body into the JSON objects of its data: lines. */
export function parseSse(text) {
  return text
    .split('\n\n')
    .map((block) => block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n'))
    .filter(Boolean)
    .map((d) => JSON.parse(d));
}
