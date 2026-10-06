# Phase 2 — Deep dive: filling every slot

> Turn the profile into decisions. You decide; you ask only where the answer genuinely changes the
> design. 3–5 targeted questions across ≥2 messages, max.

Last verified: 2026-10-06

## Read, in this order

1. `knowledge/decision-tree.md` — profile → runtime + host + credential (the spine).
2. `knowledge/professions/<pack>.md` — default channels, tools, skills, jobs, guardrails.
3. `knowledge/countries/<cc>.md` — fiscal/CRM tools, WhatsApp reality and rates, data law, voice accent.
4. The candidate `knowledge/runtimes/<id>.md` (one, maybe two to compare).
5. `knowledge/auth-matrix.md` — the credential for runtime × host. Not negotiable.
6. Only the capability files this Jarvis needs: `knowledge/capabilities/{channels,whatsapp,memory,tools-mcp,scheduling,voice,skills,deploy-local,deploy-railway,costs}.md`.
7. `knowledge/models.json` — fill `cheap` / `main` / `max` for the chosen provider.
8. `knowledge/compatibility.md` — reject known-bad combinations before you present anything.

Then dispatch `stack-researcher` with the exact list of things you're about to pin or quote:
runtime version, install method for their OS, model IDs, prices, any policy you rely on (Claude
subscription use, WhatsApp, OpenAI sign-in). Its answer wins over `knowledge/`.

## Slot-by-slot rules (summaries — the files are authoritative)

### Runtime
Follow `decision-tree.md`. The short version you must be able to say out loud:

| Profile | Default runtime |
|---|---|
| Pays Claude Pro/Max, computer on while they work, Telegram/Discord/iMessage or terminal | **Claude Code local** (`claude-code-local`) — channels + scheduled tasks + skills, no extra cost |
| Pays Claude Pro/Max, wants simple scheduled jobs (briefings, reports), no chat | **`claude -p` + cron/launchd** (`claude-p-cron`) on their own machine |
| Non-technical, Pro/Max, no messaging needs, wants zero install | **Claude Cowork / Desktop** (`cowork`) — recommend and stop; nothing to build |
| Wants 24/7 in the cloud, any budget, model-agnostic, learning memory | **Hermes Agent on Railway** (`hermes`) with an API key / OpenRouter |
| WhatsApp-first or wants many channels + phone apps, ChatGPT subscriber | **OpenClaw** (`openclaw`) — only at/above the version floor, gateway never public |
| Developer wants a custom service (webhooks, web UI, own code) on Claude | **Claude Agent SDK** (`claude-agent-sdk`) on Railway, API key |
| Wants Claude Code 24/7 on a server | **`claude-code-server`** — API key default; subscription token only as the personal, flagged alternative |
| Pays ChatGPT, terminal/dev, OpenAI models | **Codex / OpenAI** (`codex-openai`) |
| "Nothing leaves my computer" | **Ollama local** (`ollama-local`) as the model provider under Hermes or OpenClaw, if hardware allows |

### Credential — read `auth-matrix.md`, then say it plainly
- Claude subscription (Pro/Max) → only inside the official `claude` program, used by its owner.
- Every other harness with Claude models → Anthropic API key with a spend cap.
- ChatGPT plan inside Codex → `codex login` (device auth on servers); inside third-party agents only via "Sign in with ChatGPT".
- Ask (don't detect) which plan they have; preflight only shows the login type.

### Model slots
Fill from `models.json` for the chosen provider. Default routing: `cheap` for heartbeats, triage,
classification; `main` for conversation and most work; `max` only for explicitly hard tasks. Show
the monthly estimate from `capabilities/costs.md` for their usage tier.

### Host
| Need | Host |
|---|---|
| Computer on while working | Local, supervised by launchd (mac) / systemd (linux) / WSL2 systemd (windows; native Task Scheduler only where the runtime file names a native Windows service, `capabilities/deploy-local.md`) |
| Always-on computer at home | Local + supervisor + Tailscale for remote access |
| 24/7 without their computer | Railway Hobby, Tier A (one service + volume). Tier B only for web UI, semantic memory over docs or multiple services |
| Local models | Never Railway (no GPUs) |

### Channels
- Telegram: zero cost, zero policy risk → default for personal use.
- WhatsApp: read `capabilities/whatsapp.md` and the country file. Official Cloud API is the default
  path; unofficial bridges (Baileys) only with consent + secondary number. Explain the Meta policy
  in two lines. A business bot answering its own customers is allowed; a general "ask me anything"
  assistant is a grey zone.
- Terminal / Claude app (Remote Control) for developers and Claude Code users.
- Voice: voice notes in Telegram/WhatsApp first; realtime calls are an advanced add-on.

### Memory
Markdown workspace files always (SOUL/USER/MEMORY/HEARTBEAT/AGENTS/TOOLS.md — portable across
runtimes). Add sqlite-vec locally or pgvector on Railway only past ~200 lines of memory or multiple
channels. Graph memory only for relationship-heavy packs (sales, real estate, legal).

### Tools / MCP
Start from the pack's list. For each tool: official remote MCP (OAuth) > maintained community MCP
pinned to a version > generated thin wrapper > Zapier MCP fallback. Every integration starts
**read-only**; write/send scopes only on explicit request and always behind human approval.

### Proactive jobs
At least one: a morning briefing at an off-minute (e.g. 07:03 local), plus the pack's jobs. When
the profession pack gives a cron for a job (e.g. `creator.md`: briefing `7 8 * * 1-6`), **the
pack's time and days win** over these defaults and over any runtime example; the spec's job list is
the one source the build generates schedulers from. Heartbeat every 30–60 min only during working
hours and only if it has something to check (none in v1 by default). For a `while-on` laptop, say
once: "si a esa hora tu compu está dormida, llega al abrirla; si está apagada, ese día no llega".

### Face / UI
Read `capabilities/web-ui.md`. Default **yes** to the Jarvis Panel for non-technical people (it's
where they see memory, jobs and pending approvals), except where that file says otherwise: `hermes`
on Railway (no panel in v1), `openclaw`, `cowork`. Local-only profiles get the panel through the
harness API, never straight at Ollama. Panel adapter follows the runtime
(claude-cli · agent-sdk · openai-compatible · codex-cli). OpenClaw uses its own Control UI and
Cowork uses Claude Desktop — no panel. Local: `127.0.0.1` only. Server: password required, and
Tailscale recommended over a public domain.

## Questions worth asking here (pick 1–3, only if undecided)

- "¿Tu Jarvis puede *mandar* correos/mensajes por ti, o solo prepararlos para que tú los mandes?"
  (default: only drafts — human approval)
- "¿Lo quieres en tu número de WhatsApp personal o en uno nuevo?" (only if WhatsApp chosen;
  default: a new number via the official API)
- "¿Quieres que te hable con voz o te basta con texto y notas de voz?"

## Gate

Every slot filled or marked `[NEEDS CLARIFICATION: … — blocks …]`. Write the draft to
`.jarvis/state.json → decision` with a one-line reason per slot. Transition to ARCHITECTURE.
