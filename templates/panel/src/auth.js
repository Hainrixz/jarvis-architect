// Jarvis Panel — password login, session cookies, rate limiting and CSRF.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export const COOKIE_NAME = 'jarvis_panel_session';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC_API = new Set(['/api/health', '/api/session', '/api/login']);

/** Constant-time compare: hash both sides so length differences don't leak through timing. */
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a), 'utf8').digest();
  const hb = createHash('sha256').update(String(b), 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

export class SessionStore {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.sessions = new Map(); // token -> expiresAt
  }
  create() {
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, Date.now() + this.ttlMs);
    this.sweep();
    return token;
  }
  valid(token) {
    if (!token || typeof token !== 'string') return false;
    const exp = this.sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }
  revoke(token) {
    if (token) this.sessions.delete(token);
  }
  sweep() {
    const now = Date.now();
    for (const [t, exp] of this.sessions) if (exp < now) this.sessions.delete(t);
  }
}

/** Fixed-window limiter: `max` attempts per `windowMs` per key (IP). */
export class RateLimiter {
  constructor(max = 5, windowMs = 60_000) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map(); // key -> {count, resetAt}
  }
  take(key) {
    const now = Date.now();
    let e = this.hits.get(key);
    if (!e || e.resetAt <= now) {
      e = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, e);
    }
    e.count += 1;
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    return { allowed: e.count <= this.max, retryAfterS: Math.ceil((e.resetAt - now) / 1000) };
  }
}

export function isAuthenticated(c, config, sessions) {
  if (!config.authRequired) return true;
  return sessions.valid(getCookie(c, COOKIE_NAME));
}

/** Middleware: every /api route except health/session/login needs a valid session when a password is set. */
export function requireAuth(config, sessions) {
  return async (c, next) => {
    if (PUBLIC_API.has(c.req.path) || isAuthenticated(c, config, sessions)) return next();
    return c.json({ error: 'auth_required', message: 'Inicia sesión primero.' }, 401);
  };
}

/**
 * Middleware: mutating requests must carry `X-Jarvis-Panel: 1`. A cross-site form or
 * fetch cannot set a custom header without a CORS preflight, which this server never grants.
 */
export function requireCsrfHeader() {
  return async (c, next) => {
    if (MUTATING.has(c.req.method) && c.req.header('x-jarvis-panel') !== '1') {
      return c.json({ error: 'csrf', message: 'Falta el encabezado X-Jarvis-Panel: 1.' }, 403);
    }
    return next();
  };
}

export function setSessionCookie(c, config, token) {
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: config.cookieSecure,
    path: '/',
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  });
}

export function clearSessionCookie(c, config, sessions) {
  sessions.revoke(getCookie(c, COOKIE_NAME));
  deleteCookie(c, COOKIE_NAME, { path: '/', secure: config.cookieSecure });
}
