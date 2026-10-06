// Jarvis Panel — configuration from environment variables.
// Every variable is documented in ../.env.example.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export const PANEL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = path.join(PANEL_DIR, 'public');

// 'core': the runtime embeds the panel in its own process and injects the adapter (createApp({adapter})).
export const ADAPTERS = ['claude-cli', 'agent-sdk', 'openai-compatible', 'codex-cli', 'core', 'mock'];

// Adapter -> runtime name shown in /api/health when JARVIS_RUNTIME is not set.
const DEFAULT_RUNTIME = {
  'claude-cli': 'claude-code-local',
  'agent-sdk': 'claude-agent-sdk',
  'openai-compatible': 'openai-compatible',
  'codex-cli': 'codex-openai',
  core: 'claude-agent-sdk',
  mock: 'mock',
};

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function readVersion() {
  try {
    return JSON.parse(readFileSync(path.join(PANEL_DIR, 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** True for 127.0.0.0/8, ::1 and "localhost". 0.0.0.0 / :: are NOT loopback. */
export function isLoopbackHost(host) {
  if (!host) return false;
  const h = String(host).trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1') return true;
  if (h.startsWith('::ffff:')) return isLoopbackHost(h.slice(7));
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

function intEnv(env, name, def, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ConfigError(`${name} debe ser un número entero entre ${min} y ${max} (recibí "${raw}").`);
  }
  return n;
}

function boolEnv(env, name, def) {
  const raw = env[name];
  if (raw === undefined || raw === '' || raw === 'auto') return def;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(raw).toLowerCase());
}

function listEnv(env, name) {
  return String(env[name] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build the panel config. Throws ConfigError (Spanish, human-readable) on anything unsafe.
 */
export function loadConfig(env = process.env) {
  const host = (env.PANEL_HOST || '127.0.0.1').trim();
  const loopback = isLoopbackHost(host);
  const password = env.PANEL_PASSWORD || '';

  if (!loopback && !password) {
    throw new ConfigError(
      `No arranco: PANEL_HOST=${host} expone el panel fuera de esta computadora y PANEL_PASSWORD está vacío.\n` +
        'Cualquiera en la red podría hablar con tu Jarvis y leer su memoria.\n' +
        'Arreglo: deja PANEL_HOST=127.0.0.1 (recomendado) o define una contraseña larga en PANEL_PASSWORD dentro de panel/.env.'
    );
  }
  if (password && password.length < 12) {
    throw new ConfigError('PANEL_PASSWORD es muy corta: usa al menos 12 caracteres (mejor una frase de 4-5 palabras).');
  }

  let adapter = (env.PANEL_ADAPTER || '').trim();
  if (!adapter) {
    if (env.NODE_ENV === 'test') adapter = 'mock';
    else {
      throw new ConfigError(
        `Falta PANEL_ADAPTER en panel/.env. Elige uno: ${ADAPTERS.join(' | ')}.\n` +
          'Claude Code en tu compu → claude-cli · Hermes u Ollama → openai-compatible · Codex → codex-cli.'
      );
    }
  }
  if (!ADAPTERS.includes(adapter)) {
    throw new ConfigError(`PANEL_ADAPTER="${adapter}" no existe. Opciones: ${ADAPTERS.join(' | ')}.`);
  }

  const jarvisHome = path.resolve(PANEL_DIR, env.JARVIS_HOME || '..');
  const port = intEnv(env, 'PANEL_PORT', intEnv(env, 'PORT', 7878, 0, 65535), 0, 65535);

  // Extra Host headers accepted besides 127.0.0.1/localhost/[::1] (e.g. a Tailscale name).
  const allowedHosts = listEnv(env, 'PANEL_ALLOWED_HOSTS').map((h) => h.toLowerCase());

  return {
    host,
    port,
    loopback,
    password,
    authRequired: Boolean(password),
    // Secure cookies need HTTPS. Default: on when the panel is exposed (behind TLS), off on loopback.
    cookieSecure: boolEnv(env, 'PANEL_COOKIE_SECURE', !loopback),
    sessionTtlMs: intEnv(env, 'PANEL_SESSION_HOURS', 12, 1, 24 * 30) * 3600 * 1000,
    trustProxy: boolEnv(env, 'PANEL_TRUST_PROXY', false),
    allowedHosts,
    maxBodyBytes: intEnv(env, 'PANEL_MAX_BODY_KB', 512, 16, 10240) * 1024,
    jarvisHome,
    // Where SOUL/USER/MEMORY.md live, if not in JARVIS_HOME itself (relative to JARVIS_HOME or absolute).
    memoryDir: (env.JARVIS_MEMORY_DIR || '').trim() || undefined,
    jarvisName: (env.JARVIS_NAME || 'Jarvis').slice(0, 80),
    runtime: env.JARVIS_RUNTIME || DEFAULT_RUNTIME[adapter],
    adapter,
    version: readVersion(),
    approvalTtlMs: 5 * 60 * 1000,
    adapterEnv: {
      OPENAI_COMPAT_BASE_URL: env.OPENAI_COMPAT_BASE_URL || '',
      OPENAI_COMPAT_API_KEY: env.OPENAI_COMPAT_API_KEY || '',
      OPENAI_COMPAT_MODEL: env.OPENAI_COMPAT_MODEL || '',
      OPENAI_COMPAT_INJECT_MEMORY: boolEnv(env, 'OPENAI_COMPAT_INJECT_MEMORY', false),
      CLAUDE_BIN: env.CLAUDE_BIN || 'claude',
      CLAUDE_ALLOWED_TOOLS: env.CLAUDE_ALLOWED_TOOLS || '',
      CLAUDE_PERMISSION_MODE: env.CLAUDE_PERMISSION_MODE || 'dontAsk',
      // Extra settings file passed with --settings (default: <JARVIS_HOME>/.claude/headless-settings.json
      // when it exists). Carries the sandbox and turns the channel plugin off for panel runs.
      CLAUDE_SETTINGS_FILE: (env.CLAUDE_SETTINGS_FILE || '').trim(),
      CLAUDE_TIMEOUT_MS: intEnv(env, 'CLAUDE_TIMEOUT_MS', 10 * 60 * 1000, 10_000, 60 * 60 * 1000),
      CODEX_BIN: env.CODEX_BIN || 'codex',
      CODEX_SANDBOX: env.CODEX_SANDBOX || 'read-only',
      AGENT_SDK_MODEL: env.AGENT_SDK_MODEL || '',
      MOCK_DELAY_MS: intEnv(env, 'MOCK_DELAY_MS', 15, 0, 1000),
    },
  };
}

/**
 * Environment for child processes (claude, codex): the parent env minus the panel's own secrets.
 * The runtime keeps its own credentials (login / API key) — the panel's password never leaks.
 */
export function childEnv(env = process.env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith('PANEL_') || k === 'OPENAI_COMPAT_API_KEY') continue;
    out[k] = v;
  }
  return out;
}
