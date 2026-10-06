// Adapter factory. Every adapter implements:
//   { name, async health() -> {ok, detail},
//     async *chat({message, sessionId, signal}) yields {type:'delta', text} ... then {type:'done', sessionId} }
// Errors are thrown; the server turns them into {"type":"error"} SSE events.
import { createMockAdapter } from './mock.js';
import { createClaudeCliAdapter } from './claude-cli.js';
import { createAgentSdkAdapter } from './agent-sdk.js';
import { createOpenAICompatibleAdapter } from './openai-compatible.js';
import { createCodexCliAdapter } from './codex-cli.js';

export function createAdapter(config) {
  const e = config.adapterEnv;
  const home = config.jarvisHome;
  switch (config.adapter) {
    case 'mock':
      return createMockAdapter({ delayMs: e.MOCK_DELAY_MS });
    case 'claude-cli':
      return createClaudeCliAdapter({
        bin: e.CLAUDE_BIN,
        cwd: home,
        allowedTools: e.CLAUDE_ALLOWED_TOOLS,
        permissionMode: e.CLAUDE_PERMISSION_MODE,
        settingsFile: e.CLAUDE_SETTINGS_FILE,
        timeoutMs: e.CLAUDE_TIMEOUT_MS,
      });
    case 'agent-sdk':
      return createAgentSdkAdapter({
        cwd: home,
        model: e.AGENT_SDK_MODEL,
        allowedTools: e.CLAUDE_ALLOWED_TOOLS,
        permissionMode: e.CLAUDE_PERMISSION_MODE,
      });
    case 'openai-compatible':
      return createOpenAICompatibleAdapter({
        baseUrl: e.OPENAI_COMPAT_BASE_URL,
        apiKey: e.OPENAI_COMPAT_API_KEY,
        model: e.OPENAI_COMPAT_MODEL,
        injectMemory: e.OPENAI_COMPAT_INJECT_MEMORY,
        jarvisHome: home,
      });
    case 'codex-cli':
      return createCodexCliAdapter({ bin: e.CODEX_BIN, cwd: home, sandbox: e.CODEX_SANDBOX });
    case 'core':
      throw new Error('PANEL_ADAPTER=core solo funciona dentro del proceso del runtime, que pasa su propio adaptador a createApp() (ver knowledge/runtimes/claude-agent-sdk.md § Jarvis Panel inside the core).');
    default:
      throw new Error(`Adaptador desconocido: ${config.adapter}`);
  }
}

/**
 * Permission modes the panel will pass to Claude. The bypass mode is never allowed.
 * (Wording avoids the literal flag names on purpose: the SEC-10 validator in
 * knowledge/capabilities/web-ui.md greps panel/src for them and must find nothing.)
 */
export const SAFE_PERMISSION_MODES = ['dontAsk', 'manual', 'default', 'acceptEdits', 'plan', 'auto'];

export function safePermissionMode(mode) {
  if (!SAFE_PERMISSION_MODES.includes(mode)) {
    throw new Error(
      `CLAUDE_PERMISSION_MODE="${mode}" no está permitido en el panel. Usa: ${SAFE_PERMISSION_MODES.join(', ')} (el modo que se salta los permisos está prohibido).`
    );
  }
  return mode;
}

/** Session ids we accept from the browser before handing them to a CLI flag. */
export function safeSessionId(id) {
  if (id === undefined || id === null || id === '') return undefined;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) return undefined;
  return id;
}
