// codex-cli adapter: runs the owner's own `codex` CLI (OpenAI Codex) inside JARVIS_HOME.
//
// Verified from learn.chatgpt.com/docs/non-interactive-mode (2026-10-06):
//   codex exec --json "<task>"            -> JSONL on stdout
//   cat prompt.txt | codex exec -         -> prompt read from stdin with the `-` sentinel
//   codex exec resume <SESSION_ID> ["follow-up"]  -> continue a previous run
//   --sandbox read-only|workspace-write, --skip-git-repo-check
//   events: thread.started {thread_id}, turn.started, turn.completed, turn.failed, error,
//           item.completed {item:{type:"agent_message", text}}
// New runs send the prompt through stdin (`-`), so it never shows in `ps` and can't be read as
// a flag. Resumed turns pass the message as an argument after `--` (still safe: spawn() with an
// args array, no shell), and exec-level flags (--json, --sandbox, --skip-git-repo-check) go BEFORE
// the `resume` subcommand.
// LIVE CHECK when wiring this adapter: run `codex exec resume --help` with the installed codex.
//   * If it accepts `-` for stdin, switch resumed turns to stdin too.
//   * If it wants exec-level flags after `resume`, move them in buildCodexArgs().
//   Then send one new turn and one resumed turn from the panel and confirm both stream text.
// The panel never passes the full-access sandbox or the flag that skips approvals and sandbox
// (SEC-07/SEC-10); see SAFE_SANDBOXES.
import { spawnLines } from './claude-cli.js';
import { safeSessionId } from './index.js';

const SAFE_SANDBOXES = ['read-only', 'workspace-write'];

/** Returns {args, input}: input is sent through stdin (undefined = nothing on stdin). */
export function buildCodexArgs({ message, sessionId, sandbox }) {
  const sid = safeSessionId(sessionId);
  const flags = ['--json', '--skip-git-repo-check', '--sandbox', sandbox];
  if (sid) return { args: ['exec', ...flags, 'resume', sid, '--', message], input: undefined };
  return { args: ['exec', ...flags, '-'], input: message };
}

export function createCodexCliAdapter({ bin = 'codex', cwd, sandbox = 'read-only' }) {
  if (!SAFE_SANDBOXES.includes(sandbox)) {
    throw new Error(`CODEX_SANDBOX="${sandbox}" no está permitido en el panel. Usa: ${SAFE_SANDBOXES.join(' o ')}.`);
  }
  return {
    name: 'codex-cli',
    async health() {
      try {
        let v = '';
        for await (const line of spawnLines(bin, ['--version'], { cwd, timeoutMs: 10_000, label: 'codex --version' })) v += line;
        return { ok: true, detail: v.trim().slice(0, 100) };
      } catch (e) {
        return { ok: false, detail: e.message };
      }
    },
    async *chat({ message, sessionId, signal }) {
      let threadId = safeSessionId(sessionId);
      let finished = false;
      const { args, input } = buildCodexArgs({ message, sessionId: threadId, sandbox });
      for await (const line of spawnLines(bin, args, { cwd, input, signal, timeoutMs: 15 * 60 * 1000, label: 'codex' })) {
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.type === 'thread.started' && ev.thread_id) threadId = ev.thread_id;
        else if (ev.type === 'item.completed' && ev.item?.type === 'agent_message' && ev.item.text) {
          yield { type: 'delta', text: ev.item.text + '\n' };
        } else if (ev.type === 'turn.failed' || ev.type === 'error') {
          const why = ev.error?.message || ev.message || 'error';
          throw new Error(`Codex falló: ${String(why).slice(0, 500)}`);
        } else if (ev.type === 'turn.completed') finished = true;
      }
      if (!finished && !signal?.aborted) throw new Error('Codex terminó sin completar el turno.');
      yield { type: 'done', sessionId: threadId };
    },
  };
}
