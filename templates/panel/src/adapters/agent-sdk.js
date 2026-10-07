// agent-sdk adapter: Claude Agent SDK (@anthropic-ai/claude-agent-sdk), for servers.
// The SDK is an OPTIONAL dependency: the architect runs `npm install @anthropic-ai/claude-agent-sdk`
// inside panel/ only when this adapter is chosen. It authenticates with ANTHROPIC_API_KEY from
// the environment (never logged, never returned by the API) — see knowledge/auth-matrix.md:
// a server-side product must use an API key, not a consumer subscription.
// Option names below follow the Agent SDK TypeScript reference.
// LIVE CHECK after `npm install @anthropic-ai/claude-agent-sdk`: open the package's .d.ts and confirm
// each option listed next exists with this name; rename here if the installed version differs, then
// send one prompt from the panel and confirm text streams and a session id comes back.
// Options used: query({prompt, options:{cwd, allowedTools, permissionMode, resume, model,
// includePartialMessages, abortController, settingSources}}). Messages have the same shape as
// `claude -p --output-format stream-json`, so we reuse the claude-cli event mapper.
import { createClaudeEventMapper } from './claude-cli.js';
import { safePermissionMode, safeSessionId } from './index.js';

async function loadSdk() {
  try {
    return await import('@anthropic-ai/claude-agent-sdk');
  } catch (e) {
    if (e?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find (package|module)/.test(String(e?.message))) {
      throw new Error(
        'El adaptador agent-sdk necesita el paquete @anthropic-ai/claude-agent-sdk. Instálalo dentro de panel/: npm install @anthropic-ai/claude-agent-sdk'
      );
    }
    throw e;
  }
}

export function createAgentSdkAdapter({ cwd, model = '', allowedTools = '', permissionMode = 'dontAsk' }) {
  const mode = safePermissionMode(permissionMode);
  const tools = allowedTools.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    name: 'agent-sdk',
    async health() {
      try {
        await loadSdk();
      } catch (e) {
        return { ok: false, detail: e.message };
      }
      if (!process.env.ANTHROPIC_API_KEY) return { ok: false, detail: 'Falta ANTHROPIC_API_KEY en el entorno.' };
      return { ok: true, detail: 'claude-agent-sdk cargado' };
    },
    async *chat({ message, sessionId, signal }) {
      const { query } = await loadSdk();
      const abortController = new AbortController();
      const onAbort = () => abortController.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const options = {
        cwd,
        // Never the bypass mode. The SDK uses the config value `default` for Manual mode; `manual`
        // is only a CLI alias (code.claude.com/docs/en/permission-modes), so translate it.
        permissionMode: mode === 'manual' ? 'default' : mode,
        includePartialMessages: true,
        abortController,
        settingSources: ['project'],
      };
      if (tools.length) options.allowedTools = tools;
      if (model) options.model = model;
      const sid = safeSessionId(sessionId);
      if (sid) options.resume = sid;
      const mapper = createClaudeEventMapper();
      try {
        for await (const msg of query({ prompt: message, options })) {
          for (const ev of mapper.map(msg)) yield ev;
          if (mapper.done) break;
        }
      } finally {
        signal?.removeEventListener('abort', onAbort);
      }
      if (!mapper.done && !signal?.aborted) throw new Error('El Agent SDK terminó sin respuesta final.');
    },
  };
}
