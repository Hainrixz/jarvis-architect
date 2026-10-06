// Mock adapter: echoes the message with fake streaming. For demos and tests only.
import { randomUUID } from 'node:crypto';

export function createMockAdapter({ delayMs = 15 } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  return {
    name: 'mock',
    async health() {
      return { ok: true, detail: 'mock adapter (demo, no model)' };
    },
    async *chat({ message, sessionId, signal }) {
      const sid = sessionId || `mock-${randomUUID()}`;
      if (message === '__error__') throw new Error('Error simulado del adaptador mock.');
      const reply = `Recibí: ${message}`;
      const words = reply.split(/(\s+)/).filter(Boolean);
      for (const w of words) {
        if (signal?.aborted) return;
        if (delayMs) await sleep(delayMs);
        yield { type: 'delta', text: w };
      }
      yield { type: 'done', sessionId: sid };
    },
  };
}
