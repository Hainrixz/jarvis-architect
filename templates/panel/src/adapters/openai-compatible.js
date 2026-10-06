// openai-compatible adapter: POST {base}/chat/completions with stream:true.
// Works with the Hermes API server (http://127.0.0.1:8642/v1, key = API_SERVER_KEY),
// Ollama (http://127.0.0.1:11434/v1, no key) and LM Studio. Conversation history lives in
// memory per session (bounded) — Hermes keeps its own long-term memory on its side.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_SESSIONS = 50;
const MAX_MESSAGES = 40;
const MAX_MEMORY_CHARS = 24_000;
const MAX_STORED_REPLY_CHARS = 32_000; // keeps per-session history memory bounded
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000; // jobs call chat() without a signal

export function createOpenAICompatibleAdapter({ baseUrl, apiKey = '', model = '', injectMemory = false, jarvisHome }) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const sessions = new Map(); // sessionId -> messages[] (Map keeps insertion order = LRU)

  function headers() {
    const h = { 'content-type': 'application/json', accept: 'text/event-stream' };
    if (apiKey) h.authorization = `Bearer ${apiKey}`;
    return h;
  }
  function requireBase() {
    if (!base) throw new Error('Falta OPENAI_COMPAT_BASE_URL (Hermes: http://127.0.0.1:8642/v1 · Ollama: http://127.0.0.1:11434/v1).');
    if (!/^https?:\/\//.test(base)) throw new Error('OPENAI_COMPAT_BASE_URL debe empezar con http:// o https://');
  }
  async function systemPrompt() {
    if (!injectMemory) return null;
    let text = '';
    for (const f of ['SOUL.md', 'USER.md', 'MEMORY.md']) {
      try {
        text += `\n\n# ${f}\n` + (await readFile(path.join(jarvisHome, f), 'utf8'));
      } catch {
        /* missing */
      }
    }
    return text.trim() ? text.slice(0, MAX_MEMORY_CHARS) : null;
  }
  function touch(id, msgs) {
    sessions.delete(id);
    sessions.set(id, msgs.slice(-MAX_MESSAGES));
    while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  }

  return {
    name: 'openai-compatible',
    async health() {
      try {
        requireBase();
        const r = await fetch(`${base}/models`, { headers: headers(), signal: AbortSignal.timeout(4000) });
        return { ok: r.ok, detail: r.ok ? `servidor OK (${new URL(base).host})` : `HTTP ${r.status} en /models` };
      } catch (e) {
        return { ok: false, detail: `No respondió ${base || '(sin URL)'}: ${e.message}` };
      }
    },
    async *chat({ message, sessionId, signal }) {
      requireBase();
      const sid = sessionId && sessions.has(sessionId) ? sessionId : sessionId || randomUUID();
      const history = sessions.get(sid) || [];
      const sys = await systemPrompt();
      const messages = [...(sys ? [{ role: 'system', content: sys }] : []), ...history, { role: 'user', content: message }];
      const body = { messages, stream: true };
      if (model) body.model = model;
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!res.ok || !res.body) {
        const t = (await res.text().catch(() => '')).slice(0, 300);
        throw new Error(`El servidor del modelo respondió HTTP ${res.status}${t ? `: ${t}` : ''}`);
      }
      let full = '';
      let buf = '';
      const decoder = new TextDecoder();
      outer: for await (const chunk of res.body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).replace(/\r$/, '');
          buf = buf.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') break outer;
          let j;
          try {
            j = JSON.parse(data);
          } catch {
            continue;
          }
          if (j.error) throw new Error(`Error del modelo: ${String(j.error.message || j.error).slice(0, 300)}`);
          const text = j.choices?.[0]?.delta?.content;
          if (text) {
            full += text;
            yield { type: 'delta', text };
          }
        }
      }
      touch(sid, [...history, { role: 'user', content: message }, { role: 'assistant', content: full.slice(0, MAX_STORED_REPLY_CHARS) }]);
      yield { type: 'done', sessionId: sid };
    },
  };
}
