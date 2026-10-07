// claude-cli adapter: runs the owner's own, unmodified `claude` binary inside JARVIS_HOME.
//
// Auth: this uses whatever login the owner already has on THIS machine (Claude subscription
// or API key). That is allowed because it is the unmodified Claude Code binary, run by its
// owner, on their own computer — see knowledge/auth-matrix.md before changing this. Never
// proxy someone else's subscription through this panel.
//
// Command (verified against code.claude.com/docs/en/headless on 2026-10-06 — stream-json needs
// --verbose; --include-partial-messages gives stream_event/text_delta lines; -p reads the prompt
// from stdin; the last line is a `result` message with session_id; subagent messages carry a
// non-null parent_tool_use_id and are skipped; `manual` is a CLI alias of `default`):
//   claude -p --output-format stream-json --verbose --include-partial-messages
//          --permission-mode <mode> [--settings <file>] [--resume <id>] [--allowedTools "A,B"]
// --settings: CLAUDE_SETTINGS_FILE, or <cwd>/.claude/headless-settings.json when it exists. On
// claude-code-local that file applies the same sandbox as the channel session (SEC-07/09) and
// sets the Telegram plugin to false, so a panel run never starts a second bot poller.
// The prompt goes in through stdin (not argv) so it can't be parsed as a flag and doesn't
// show in `ps`. We NEVER pass the skip-permissions flag or the bypass permission mode (SEC-10).
//
// stream-json lines we use:
//   {"type":"system","subtype":"init","session_id":"..."}
//   {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}},"parent_tool_use_id":null}
//   {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]},"parent_tool_use_id":null}
//   {"type":"result","subtype":"success","is_error":false,"result":"...","session_id":"..."}
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { childEnv } from '../config.js';
import { safePermissionMode, safeSessionId } from './index.js';

/**
 * Turns Claude stream-json / Agent SDK messages into panel events.
 * Shared with the agent-sdk adapter (same message shapes).
 */
export function createClaudeEventMapper() {
  let sessionId;
  let sawDelta = false;
  let done = false;
  // Text from separate assistant turns (e.g. before and after a tool call) would otherwise run
  // together ("Voy a leer.Listo"): a blank line goes before the first text of each later turn.
  let wroteText = false;
  let turnHasText = false;
  const text = (t) => {
    const sep = wroteText && !turnHasText ? '\n\n' : '';
    wroteText = turnHasText = true;
    return { type: 'delta', text: sep + t };
  };
  return {
    get sessionId() {
      return sessionId;
    },
    get done() {
      return done;
    },
    /** Returns an array of panel events for one Claude message (may be empty). */
    map(msg) {
      const out = [];
      if (!msg || typeof msg !== 'object') return out;
      if (msg.session_id) sessionId = msg.session_id;
      const isMain = msg.parent_tool_use_id == null;
      if (msg.type === 'stream_event' && isMain) {
        const ev = msg.event;
        if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
          sawDelta = true;
          out.push(text(ev.delta.text));
        }
        if (ev?.type === 'message_start') sawDelta = turnHasText = false;
      } else if (msg.type === 'assistant' && isMain) {
        // Without partial messages we only get whole assistant messages: emit their text.
        if (!sawDelta) {
          for (const b of msg.message?.content || []) {
            if (b?.type === 'text' && b.text) out.push(text(b.text));
          }
        }
        sawDelta = turnHasText = false;
      } else if (msg.type === 'result') {
        done = true;
        if (msg.is_error || (msg.subtype && msg.subtype !== 'success')) {
          const why = typeof msg.result === 'string' && msg.result ? msg.result : msg.subtype || 'error';
          throw new Error(`Claude terminó con error: ${String(why).slice(0, 500)}`);
        }
        out.push({ type: 'done', sessionId: msg.session_id || sessionId });
      }
      return out;
    },
  };
}

/** Spawn a process and yield stdout lines as they arrive. Kills the child on abort/timeout. */
export async function* spawnLines(bin, args, { cwd, input, signal, timeoutMs, label }) {
  const child = spawn(bin, args, { cwd, env: childEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  let spawnError;
  const exited = new Promise((resolve) => {
    child.on('error', (e) => {
      spawnError = e;
      resolve(-1);
    });
    child.on('close', (code) => resolve(code));
  });
  child.stderr.on('data', (d) => {
    if (stderr.length < 4000) stderr += d.toString();
  });
  const kill = () => {
    if (child.exitCode === null) child.kill('SIGINT');
    setTimeout(() => child.exitCode === null && child.kill('SIGKILL'), 3000).unref();
  };
  signal?.addEventListener('abort', kill, { once: true });
  const timer = timeoutMs ? setTimeout(kill, timeoutMs) : null;
  timer?.unref?.();
  child.stdin.on('error', () => {});
  if (input !== undefined) child.stdin.end(input);
  else child.stdin.end();

  try {
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.trim()) yield line;
    }
    const code = await exited;
    if (spawnError) {
      if (spawnError.code === 'ENOENT') {
        throw new Error(`No encontré "${bin}". ¿Está instalado y en el PATH? (${label})`);
      }
      throw new Error(`No pude ejecutar ${label}: ${spawnError.message}`);
    }
    if (code !== 0 && !signal?.aborted) {
      const tail = stderr.trim().split('\n').slice(-3).join(' ').slice(0, 500);
      throw new Error(`${label} salió con código ${code}${tail ? `: ${tail}` : ''}`);
    }
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', kill);
    kill();
  }
}

/** Resolve the --settings file: explicit (relative to cwd) or the conventional headless file. */
export function resolveSettingsFile(cwd, settingsFile = '') {
  if (settingsFile) return path.resolve(cwd || '.', settingsFile);
  const conventional = path.join(cwd || '.', '.claude', 'headless-settings.json');
  return existsSync(conventional) ? conventional : '';
}

export function createClaudeCliAdapter({ bin = 'claude', cwd, allowedTools = '', permissionMode = 'dontAsk', settingsFile = '', timeoutMs }) {
  const mode = safePermissionMode(permissionMode);
  const settings = resolveSettingsFile(cwd, settingsFile);
  return {
    name: 'claude-cli',
    async health() {
      try {
        let version = '';
        for await (const line of spawnLines(bin, ['--version'], { cwd, timeoutMs: 10_000, label: 'claude --version' })) {
          version += line;
        }
        return { ok: true, detail: version.trim().slice(0, 100) };
      } catch (e) {
        return { ok: false, detail: e.message };
      }
    },
    async *chat({ message, sessionId, signal }) {
      const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', mode];
      if (settings) args.push('--settings', settings);
      const sid = safeSessionId(sessionId);
      if (sid) args.push('--resume', sid);
      if (allowedTools.trim()) args.push('--allowedTools', allowedTools.trim());
      const mapper = createClaudeEventMapper();
      for await (const line of spawnLines(bin, args, { cwd, input: message, signal, timeoutMs, label: 'claude' })) {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // not JSON (e.g. a warning) — ignore
        }
        for (const ev of mapper.map(msg)) yield ev;
      }
      if (!mapper.done && !signal?.aborted) {
        throw new Error('Claude terminó sin respuesta final (revisa que hayas iniciado sesión con `claude`).');
      }
    },
  };
}
