---
name: jarvis-add
description: >-
  Add something to an existing Jarvis — a channel (Telegram, WhatsApp, Discord, voice), a tool or
  MCP server (Gmail, Calendar, Notion, HubSpot, Facturapi…), a skill, or a scheduled job — with the
  same gates and security controls as the original build. EN — "add WhatsApp to my Jarvis",
  "connect my calendar". ES — "agrégale WhatsApp", "conecta mi calendario", "que también haga…".
argument-hint: "[what to add]"
---

# /jarvis-add

Load the `jarvis-start` skill's rules. This is a mini DEEP DIVE → ARCHITECTURE → BUILD loop for one
addition:

1. Locate the Jarvis (`.jarvis/tasks.json → jarvis_dir` or ask) and read its `jarvis-spec.md`.
2. Read the relevant capability file and the runtime file's section for it. Check
   `knowledge/compatibility.md` (e.g. WhatsApp unofficial bridge → consent gate; local Ollama →
   never on Railway).
3. For a tool/MCP: official remote MCP (OAuth) > pinned maintained community MCP (read its source
   first; reject anything that asks to "download a helper" or pipe a script) > generated wrapper >
   Zapier MCP. Start read-only. Write scopes only on explicit request, behind the approval gate.
4. Show a ≤10-line card: what changes, cost, new risks, consent if needed. Wait for yes.
5. Append tasks to `tasks.json` (new ids after the last), run them via the `/jarvis-next` loop,
   update `jarvis-spec.md` §3–§7, re-run `jarvis-validator` on the whole Jarvis.
