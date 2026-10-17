---
name: jarvis-add
description: >-
  Add something to an existing Jarvis — a channel (Telegram, WhatsApp, Discord, voice), a tool or
  MCP server (Gmail, Calendar, Notion, HubSpot, Facturapi…), a skill, a scheduled job, the
  autopilot or an L3 action, a taught skill, or audio/video understanding — with the same gates and
  security controls as the original build. EN — "add WhatsApp to my Jarvis", "connect my
  calendar", "turn on the autopilot", "teach it a skill", "add video". ES — "agrégale WhatsApp",
  "conecta mi calendario", "que también haga…", "que avance solo", "activa el piloto", "agrega
  una acción L3", "enséñale una skill", "agrega video", "que entienda audios".
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
   For the three built-in capabilities:
   - **"Que avance solo" / "activa el piloto"** (`knowledge/capabilities/autonomy.md`): from `L0`
     to `L1`, add the autopilot job and its files (`questions/4-construir.md` step 11). Never above
     L1 by default.
   - **"Agrega una acción L3"**: only a type from the reversible list in `autonomy.md` § Levels,
     never for sensitive packs. Show the exact line; **the owner** writes it into AGENTS.md § 10 in
     their own terminal (IRR-07: Jarvis and you never edit that list), add the
     `autonomy-l3-<type>` consent to spec §7, and give the autopilot job only the narrow tool that
     type needs.
   - **"Enséñale una skill"** (`knowledge/capabilities/learning.md` § 3): write the draft in
     `<jarvis>/proposals/skills/<name>/`, then `bin/promote-skill.sh promote <name>` (lint,
     probation, commit). A skill that sends anything gets `disable-model-invocation: true`.
   - **"Agrega video" / "que entienda audios"** (`knowledge/capabilities/multimodal.md`):
     `questions/4-construir.md` step 13 for the missing part; video from links needs the
     `video-urls-terms` consent; cloud STT needs its own consent and is refused with a sensitive
     pack (CMP-39). Not available on `cowork`.
4. Show a ≤10-line card: what changes, cost, new risks, consent if needed. Wait for yes.
5. Append tasks to `tasks.json` (new ids after the last), run them via the `/jarvis-next` loop,
   update `jarvis-spec.md` §3–§7, re-run `jarvis-validator` on the whole Jarvis.
