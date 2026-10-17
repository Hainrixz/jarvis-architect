// Jarvis Panel — HTTP server (Hono on Node). Run: npm start (reads panel/.env if present).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { loadConfig, ConfigError, PANEL_DIR, PUBLIC_DIR } from './config.js';
import {
  SessionStore,
  RateLimiter,
  safeEqual,
  isAuthenticated,
  requireAuth,
  requireCsrfHeader,
  setSessionCookie,
  clearSessionCookie,
} from './auth.js';
import { createStore, StoreError, isValidId } from './store.js';
import { createAdapter, safeSessionId } from './adapters/index.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_MESSAGE_CHARS = 20_000;

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function clientIp(c, config) {
  if (config.trustProxy) {
    // Use the RIGHTMOST entry: it is the one our trusted proxy appended. The leftmost ones are
    // whatever the client sent, so trusting them would let anyone dodge the login rate limit.
    const xff = c.req.header('x-forwarded-for');
    if (xff) {
      const last = xff.split(',').map((s) => s.trim()).filter(Boolean).pop();
      if (last) return last.slice(0, 64);
    }
  }
  try {
    return getConnInfo(c).remote.address || 'unknown';
  } catch {
    return 'unknown';
  }
}

function hostnameOf(hostHeader) {
  if (!hostHeader) return '';
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']'));
  return h.split(':')[0];
}

async function readJson(c) {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not object');
    return body;
  } catch {
    throw new StoreError(400, 'invalid_json', 'El cuerpo debe ser un objeto JSON.');
  }
}

/** Resolve a URL path to a file strictly inside public/. Returns null if outside or missing. */
async function resolvePublic(urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (rel.includes('\0')) return null;
  if (rel === '/' || rel === '') rel = '/index.html';
  const root = path.resolve(PUBLIC_DIR);
  const target = path.resolve(root, '.' + path.posix.normalize(rel));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  if (path.basename(target).startsWith('.')) return null; // no dotfiles
  try {
    const real = await fsp.realpath(target);
    const realRoot = await fsp.realpath(root);
    if (!real.startsWith(realRoot + path.sep)) return null; // symlink escape
    const st = await fsp.stat(real);
    return st.isFile() ? real : null;
  } catch {
    return null;
  }
}

export function createApp({ config, adapter, store = createStore(config) }) {
  const app = new Hono();
  const sessions = new SessionStore(config.sessionTtlMs);
  const loginLimiter = new RateLimiter(5, 60_000);
  const runningJobs = new Set();
  const startedAt = Date.now();

  // --- errors ---
  app.onError((err, c) => {
    if (err instanceof StoreError) return c.json({ error: err.code, message: err.message }, err.status);
    console.error('[panel] error:', err?.message || err);
    return c.json({ error: 'internal', message: 'Error interno del panel.' }, 500);
  });

  // --- Host check (DNS-rebinding guard) + security headers ---
  app.use('*', async (c, next) => {
    if (config.loopback || config.allowedHosts.length) {
      const h = hostnameOf(c.req.header('host'));
      const ok =
        config.allowedHosts.includes(h) ||
        (config.loopback && (h === 'localhost' || h === '::1' || /^127\.\d+\.\d+\.\d+$/.test(h)));
      if (!ok) {
        return c.text(
          'Host no permitido. Si entras por Tailscale u otro nombre, agrégalo a PANEL_ALLOWED_HOSTS en panel/.env.',
          421
        );
      }
    }
    await next();
    c.header('Content-Security-Policy', CSP);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (c.req.path.startsWith('/api/')) c.header('Cache-Control', 'no-store');
  });

  // --- API middleware: body limit, CSRF header, auth, audit of mutating calls ---
  app.use('/api/*', async (c, next) => {
    await next();
    if (MUTATING.has(c.req.method)) {
      // Never log bodies: they can hold passwords, messages or memory contents.
      // Handlers may set a semantic action/target (see auditInfo); otherwise METHOD + path.
      const info = c.get('audit') || {};
      await store.audit({
        actor: 'owner',
        action: info.action || `${c.req.method} ${c.req.path}`,
        ...(info.target ? { target: info.target } : {}),
        ...(info.decision ? { decision: info.decision } : {}),
        ...(info.detail ? { detail: info.detail } : {}),
        method: c.req.method,
        path: c.req.path.slice(0, 200),
        status: c.res.status,
        ok: c.res.status < 400,
        ip: clientIp(c, config),
      });
    }
  });
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: config.maxBodyBytes,
      onError: (c) => c.json({ error: 'too_large', message: 'La petición es demasiado grande.' }, 413),
    })
  );
  app.use('/api/*', requireCsrfHeader());
  app.use('/api/*', requireAuth(config, sessions));

  // --- health / session / login ---
  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      runtime: config.runtime,
      adapter: adapter.name,
      version: config.version,
      uptime_s: Math.floor((Date.now() - startedAt) / 1000),
      jarvis_name: config.jarvisName,
    })
  );

  app.get('/api/health/adapter', async (c) => c.json(await adapter.health()));

  app.get('/api/session', (c) =>
    c.json({ authenticated: isAuthenticated(c, config, sessions), auth_required: config.authRequired })
  );

  app.post('/api/login', async (c) => {
    c.set('audit', { action: 'login.fail' });
    if (!config.authRequired) return c.json({ ok: true, auth_required: false });
    const limit = loginLimiter.take(clientIp(c, config));
    if (!limit.allowed) {
      c.header('Retry-After', String(limit.retryAfterS));
      return c.json({ error: 'rate_limited', message: 'Demasiados intentos. Espera un minuto.' }, 429);
    }
    const body = await readJson(c);
    const pw = typeof body.password === 'string' ? body.password : '';
    if (!pw || !safeEqual(pw, config.password)) {
      return c.json({ error: 'bad_password', message: 'Contraseña incorrecta.' }, 401);
    }
    c.set('audit', { action: 'login.ok' });
    setSessionCookie(c, config, sessions.create());
    return c.json({ ok: true });
  });

  app.post('/api/logout', (c) => {
    c.set('audit', { action: 'logout' });
    clearSessionCookie(c, config, sessions);
    return c.json({ ok: true });
  });

  // --- chat (SSE) ---
  app.post('/api/chat', async (c) => {
    c.set('audit', { action: 'chat' }); // never the message text
    const body = await readJson(c);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return c.json({ error: 'invalid_message', message: 'Escribe un mensaje.' }, 400);
    if (message.length > MAX_MESSAGE_CHARS) {
      return c.json({ error: 'too_large', message: `El mensaje no puede pasar de ${MAX_MESSAGE_CHARS} caracteres.` }, 413);
    }
    if (body.session_id != null && body.session_id !== '' && !safeSessionId(body.session_id)) {
      return c.json({ error: 'invalid_session_id', message: 'session_id inválido.' }, 400);
    }
    const sessionId = safeSessionId(body.session_id);
    return streamSSE(c, async (stream) => {
      const ac = new AbortController();
      stream.onAbort(() => ac.abort());
      const send = (obj) => stream.writeSSE({ data: JSON.stringify(obj) });
      try {
        let doneSent = false;
        for await (const ev of adapter.chat({ message, sessionId, signal: ac.signal })) {
          if (ac.signal.aborted) break;
          if (ev.type === 'delta' && ev.text) await send({ type: 'delta', text: String(ev.text) });
          else if (ev.type === 'done') {
            await send({ type: 'done', session_id: ev.sessionId || sessionId || null });
            doneSent = true;
            break;
          }
        }
        if (!doneSent && !ac.signal.aborted) await send({ type: 'done', session_id: sessionId || null });
      } catch (e) {
        if (!ac.signal.aborted) await send({ type: 'error', message: String(e?.message || e).slice(0, 1000) });
      }
    });
  });

  // --- memory ---
  app.get('/api/memory', async (c) => c.json(await store.listMemory()));
  app.get('/api/memory/:name', async (c) => c.json(await store.readMemory(c.req.param('name'))));
  app.put('/api/memory/:name', async (c) => {
    const name = c.req.param('name');
    c.set('audit', { action: 'memory.write', target: String(name).slice(0, 64) });
    const body = await readJson(c);
    return c.json(await store.writeMemory(name, body.content));
  });

  // --- jobs ---
  app.get('/api/jobs', async (c) => c.json(await store.listJobs()));
  app.post('/api/jobs/:id/run', async (c) => {
    const id = c.req.param('id');
    if (!isValidId(id)) return c.json({ error: 'invalid_id', message: 'id de tarea inválido.' }, 400);
    c.set('audit', { action: 'job.run', target: id });
    const body = await readJson(c);
    if (body.confirm !== true) {
      return c.json({ error: 'confirm_required', message: 'Confirma que quieres correr esta tarea ahora ({"confirm":true}).' }, 400);
    }
    const job = await store.getJob(id);
    const prompt = await store.getJobPrompt(job);
    if (!prompt) return c.json({ error: 'no_prompt', message: 'Esta tarea no tiene "prompt" ni "prompt_file" en jobs.json.' }, 400);
    if (runningJobs.has(id)) return c.json({ error: 'already_running', message: 'Esa tarea ya está corriendo.' }, 409);
    runningJobs.add(id);
    await store.updateJob(id, { last_run: new Date().toISOString(), last_status: 'running' });
    (async () => {
      let out = '';
      let status = 'ok';
      try {
        for await (const ev of adapter.chat({ message: prompt })) {
          if (ev.type === 'delta') out += ev.text;
          if (ev.type === 'done') break;
        }
      } catch (e) {
        status = 'error';
        out += `\n\n[error] ${String(e?.message || e).slice(0, 1000)}`;
      }
      try {
        await store.writeJobOutput(id, out);
        await store.updateJob(id, { last_run: new Date().toISOString(), last_status: status });
        await store.audit({ actor: 'panel', action: 'job.finished', target: id, status, ok: status === 'ok' });
      } catch (e) {
        console.error('[panel] no pude guardar el resultado de la tarea:', e?.message);
      } finally {
        runningJobs.delete(id);
      }
    })();
    return c.json({ started: true });
  });

  // --- approvals ---
  app.get('/api/approvals', async (c) => c.json(await store.listApprovals()));
  app.post('/api/approvals/:id', async (c) => {
    const id = c.req.param('id');
    const body = await readJson(c);
    const decision = body.decision === 'approve' || body.decision === 'reject' ? body.decision : undefined;
    c.set('audit', { action: 'approval.decide', target: String(id).slice(0, 128), decision });
    return c.json(await store.decideApproval(id, body.decision));
  });

  // --- pending list (Pendientes) ---
  app.get('/api/tasks', async (c) => c.json({ ...(await store.listTasks()), autopilot: await store.autopilotState() }));
  app.post('/api/tasks/:id', async (c) => {
    const id = c.req.param('id');
    c.set('audit', { action: 'task.update', target: String(id).slice(0, 16) });
    const body = await readJson(c);
    const r = await store.updateTask(id, body.patch, body.base_mtime, body.base_sha);
    // Only the fields that changed, never the task title.
    const detail = {};
    for (const k of Object.keys(r.after)) if (r.before[k] !== r.after[k]) detail[k] = [r.before[k], r.after[k]];
    c.set('audit', { action: 'task.update', target: id, detail });
    return c.json(r);
  });

  // --- autopilot pause / resume ---
  app.get('/api/autopilot', async (c) => c.json(await store.autopilotState()));
  app.post('/api/autopilot', async (c) => {
    const body = await readJson(c);
    const action = body.action === 'pause' || body.action === 'resume' ? body.action : null;
    c.set('audit', { action: `autopilot.${action || 'invalid'}` });
    if (!action) return c.json({ error: 'invalid_action', message: 'action debe ser "pause" o "resume".' }, 400);
    if (action === 'pause') return c.json(await store.setAutopilotPaused(true));
    // Resuming gives power back: only from an authenticated panel session, with an explicit confirm.
    // (Never from chat: the chat adapter has no route to this endpoint.)
    if (!isAuthenticated(c, config, sessions)) return c.json({ error: 'auth_required', message: 'Inicia sesión primero.' }, 401);
    if (body.confirm !== true) {
      return c.json({ error: 'confirm_required', message: 'Confirma que quieres reanudar el piloto ({"confirm":true}).' }, 400);
    }
    return c.json(await store.setAutopilotPaused(false));
  });

  // --- learning (Aprendizajes) ---
  app.get('/api/learning', async (c) => c.json(await store.learningState()));
  app.post('/api/learning/lessons/:id/:op', async (c) => {
    const id = c.req.param('id');
    const op = c.req.param('op');
    const to = op === 'retire' ? 'retired' : op === 'activate' ? 'active' : null;
    c.set('audit', { action: `learning.lesson.${to ? op : 'invalid'}`, target: String(id).slice(0, 16) });
    if (!to) return c.json({ error: 'not_found', message: 'Ruta no encontrada.' }, 404);
    const body = await readJson(c);
    const r = await store.moveLesson(id, to, body.base_mtime, body.base_sha);
    c.set('audit', { action: `learning.lesson.${op}`, target: id, detail: { from: r.from, to: r.to, committed: r.committed } });
    return c.json(r);
  });
  app.post('/api/learning/skills/:name/revert', async (c) => {
    const name = c.req.param('name');
    c.set('audit', { action: 'learning.revert_request', target: String(name).slice(0, 64) });
    const body = await readJson(c);
    if (body.confirm !== true) {
      return c.json({ error: 'confirm_required', message: 'Confirma que quieres deshacer esta skill ({"confirm":true}).' }, 400);
    }
    return c.json(await store.revertSkill(name));
  });

  // --- audit log ---
  app.get('/api/log', async (c) => {
    const limit = Number.parseInt(c.req.query('limit') || '100', 10);
    return c.json(await store.readLog(Number.isFinite(limit) ? limit : 100));
  });

  app.all('/api/*', (c) => c.json({ error: 'not_found', message: 'Ruta no encontrada.' }, 404));

  // --- static frontend (only files inside public/) ---
  app.on(['GET', 'HEAD'], '*', async (c) => {
    const file = await resolvePublic(c.req.path);
    if (!file) return c.text('No encontrado', 404);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const data = await fsp.readFile(file);
    return c.body(c.req.method === 'HEAD' ? null : data, 200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  });

  return app;
}

export function start(env = process.env) {
  const config = loadConfig(env);
  const adapter = createAdapter(config);
  const store = createStore(config);
  const app = createApp({ config, adapter, store });
  const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
    const shown = config.host.includes(':') ? `[${config.host}]` : config.host;
    console.log(`[panel] ${config.jarvisName} listo en http://${shown}:${info.port}  (adaptador: ${adapter.name}, JARVIS_HOME: ${config.jarvisHome})`);
    if (!config.loopback) console.log('[panel] Aviso: el panel está expuesto fuera de esta computadora. Usa HTTPS (Tailscale/Railway) y una contraseña larga.');
  });
  return { server, config, app };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const envFile = path.join(PANEL_DIR, '.env');
  if (fs.existsSync(envFile)) {
    try {
      process.loadEnvFile(envFile); // does not override variables already set
    } catch (e) {
      console.error(`[panel] No pude leer panel/.env: ${e.message}`);
      process.exit(1);
    }
  }
  try {
    const { server } = start();
    server.on('error', (e) => {
      console.error(
        e?.code === 'EADDRINUSE'
          ? `\n[panel] El puerto ya está en uso. Cambia PANEL_PORT en panel/.env o cierra el otro proceso.\n`
          : `[panel] Error del servidor: ${e?.message || e}`
      );
      process.exit(1);
    });
    const stop = () => server.close(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  } catch (e) {
    if (e instanceof ConfigError || /PERMISSION_MODE|CODEX_SANDBOX/.test(e?.message)) {
      console.error(`\n[panel] ${e.message}\n`);
    } else {
      console.error('[panel] Error al arrancar:', e?.message || e);
    }
    process.exit(1);
  }
}
