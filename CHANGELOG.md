# Changelog

All notable changes to Jarvis Architect are documented in this file.
*Todos los cambios relevantes de Jarvis Architect se documentan aquí.*

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as scoped in
[VERSIONING.md](VERSIONING.md) — read that first if you wonder why renaming a profession file is a
MAJOR bump in a repo with no code.

Pin refreshes from `/jarvis-refresh` go under *Changed* with their source URL.

## [Unreleased]

Nothing yet.

---

## [1.0.0] — 2026-10-06

First release. An architect agent for Claude Code that interviews a person about their work,
**decides** the runtime, model, host, channels, memory, tools and scheduled jobs for their own
personal "Jarvis", then installs, configures, verifies and hands it over with them — locally or on
Railway — with security controls on by default. Every Jarvis it builds keeps its own to-do list and
moves work forward on its own within limits, learns from its owner's corrections, and understands
voice notes, recordings, videos, photos and PDFs. Built for the Spanish-speaking community (LATAM
and Spain), including people who are not technical.

*Primera versión. Un arquitecto para Claude Code que te entrevista, decide y arma contigo tu propio
Jarvis: uno que lleva tus pendientes y avanza solo con permiso, aprende de tus correcciones y
entiende audio, video, fotos y PDFs.*

### Added

#### The architect

- **Two ways to run it.**
  - *Clone mode:* clone the repo, run `claude` inside it; `CLAUDE.md` and the `jarvis-architect`
    agent start the interview automatically.
  - *Plugin mode:* marketplace `jarvis-architect`, plugin `jarvis-architect`
    (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`).
- **Six commands** (skills in `.claude/skills/`):

  | Command | What it does |
  |---|---|
  | `/jarvis-start` | Full interview → decision → build → verify → handoff, or resume |
  | `/jarvis-quick` | Three questions, smart defaults, same confirmation gate and controls |
  | `/jarvis-next` | Continue the build from `.jarvis/tasks.json`, even after closing the terminal |
  | `/jarvis-doctor` | Read-only health check of a running Jarvis, including autopilot state, today's autopilot cost, blocked tasks and media tool freshness |
  | `/jarvis-add` | Add a channel, tool/MCP, skill, scheduled job, video or an L3 action with the same gates |
  | `/jarvis-refresh` | Maintainers: re-verify every pin in `knowledge/` against live sources |

- **State machine with an explicit gate:** `RESUME? → PREFLIGHT → DISCOVERY → DEEP DIVE →
  ARCHITECTURE →(explicit yes)→ BUILD → VERIFY → (DEPLOY) → HANDOFF`. Nothing is installed, no
  account is touched and no money is spent before the ARCHITECTURE gate passes.
- **Three subagents** in `.claude/agents/`: `stack-researcher` (live check of versions, prices,
  model IDs and policies; outranks `knowledge/`), `workspace-writer` (writes the Jarvis's own
  files), `jarvis-validator` (read-only audit in 16 sweeps; must PASS before handoff).
- **Interview** in `questions/` (`0-preflight.md` … `4-construir.md`): read-only machine
  preflight, discovery, deep dive, confirmation (markers, pre-mortem, consent), build and handoff.
  Autonomy, learning and media defaults are offered in a single combined question.
- **`.jarvis/` state** in the person's working directory: `preflight.json`, `state.json` (with a
  RUNNING BRIEF that survives compaction and sessions), `tasks.json`, `jarvis-spec.md`.

#### Knowledge

- **Knowledge base** in `knowledge/` with the stable IDs declared in `knowledge/README.md`:
  - `runtimes/` — nine harness IDs: `claude-code-local`, `claude-code-server`, `claude-p-cron`,
    `claude-agent-sdk`, `hermes`, `openclaw`, `codex-openai`, `ollama-local`, `cowork`. The only
    markdown files allowed to pin versions, each with a security floor and a *Security hardening*
    section mapped to the `SEC-NN` controls.
  - `models.json` — `cheap` / `main` / `max` model slots per provider with prices and
    `verified_at`.
  - `capabilities/` — `channels`, `whatsapp`, `memory`, `tools-mcp`, `scheduling`, `voice`,
    `skills`, `deploy-local`, `deploy-railway`, `costs`, `web-ui`, `autonomy`, `learning`,
    `multimodal`.
  - `professions/` — thirteen packs: `creator`, `developer`, `founder`, `sales`, `student`,
    `lawyer-accountant`, `health`, `real-estate`, `smb-restaurant`, `ecommerce`, `coach`, `agency`,
    `teacher`, with autonomy, learning and media hooks where the trade needs them.
  - `countries/` — `mx`, `co`, `ar`, `es`, `other` (WhatsApp reality and rates, e-invoicing tools,
    data-protection law, voice accent, timezones).
  - `decision-tree.md`, `auth-matrix.md`, `compatibility.md` (`CMP-01`…`CMP-42`),
    `security-checklist.md` (`SEC-01`…`SEC-38`).
- **Templates** in `templates/`: `jarvis-spec.md`, `tasks-schema.md` (with `user_action` tasks for
  steps only the person can do), the Jarvis workspace (`SOUL`/`USER`/`MEMORY`/`HEARTBEAT`/`AGENTS`/
  `TOOLS`/`TASKS`/`LESSONS` files), base skills in `templates/skills-base/`, and local and Railway
  host templates.

#### Jarvis Panel

- **`templates/panel/`**: a small local web app (Node, Hono) for the Jarvis, in Spanish with an
  English toggle and no network dependencies at runtime. Screens:
  - *Chat* with streaming replies.
  - *Memoria*: edit `MEMORY.md`, `USER.md`, `SOUL.md`, `HEARTBEAT.md`; `AGENTS.md`, `TOOLS.md`,
    `TASKS.md` and `LESSONS.md` are read-only there.
  - *Trabajos*: scheduled jobs, their last runs, and run-now.
  - *Aprobaciones*: exact previews of irreversible actions, approve or reject, 5-minute expiry.
  - *Pendientes*: the `TASKS.md` list with state changes, snooze and done; a level can only be
    lowered and an owner task can't be handed to Jarvis; conflicting edits return 409 instead of
    overwriting; pause/resume the autopilot (resume asks for confirmation); last run and today's
    cost; a badge counts what needs the owner's OK.
  - *Aprendizajes*: active, under-review and retired lessons (retire / activate), learned skills
    with their probation, undo and retire buttons that call `bin/learn.sh` and
    `bin/promote-skill.sh`, and the weekly digest.
  - *Estado*: runtime, health and the audit log.
- Adapters for the Claude Code CLI, the Agent SDK (mounted inside the core process on that
  runtime), the Codex CLI and OpenAI-compatible servers (Hermes' API server, Ollama), plus a mock
  for tests. `node --test` suite in `templates/panel/test/`, run in CI.

#### Autonomy: "piloto con permiso"

- **`TASKS.md` ledger** (`templates/workspace/TASKS.md`): one line per task with a single grammar
  (`state`, `who`, `lvl`, `due`, `next`, `prio`, `src`, `tries`, `dep`), sections Hoy · Próximos ·
  Esperando a otros · Bandeja · Hecho; per-task notes in `tasks/`, drafts in `drafts/`.
- **Levels** L0 (remind) · L1 (prepare drafts, default) · L2 (exact preview, runs only after a live
  "sí, ejecuta T-NNNN") · L3 (one reversible action from the owner's list in AGENTS.md § 10, empty
  by default; allowed types `calendar.block.private`, `email.label`, `task.reschedule`).
- **Skills** `pending` (capture, list, confirm, snooze, done, run an approved task, pause) and
  `autopilot` (the scheduled run).
- **Autopilot job** `13 10,13,16 * * 1-5` on the cheap model: at most 3 tasks per run, 3 tries per
  task, 12 turns and 0.50 USD per run, `JARVIS_AUTOPILOT_DAILY_USD` (default 1.00) per day.
  Wired for every runtime (local wrapper, Hermes cron, OpenClaw automations, Agent SDK croner,
  Codex, Cowork scheduled task).
- **`templates/local/jobs/apply-ops.sh`**: validates the autopilot's whole ops block before writing,
  takes a lock, writes atomically, refuses symlinks, and audits `autopilot.op` / `autopilot.reject`;
  `autopilot.post` hook for `run-job.sh`.
- Morning briefing gains Top 3, "Lo que haré yo", "Necesito tu OK" and "¿Agrego estos?"; heartbeat
  checks overdue and stale tasks; weekly review reports stalled tasks and autopilot cost.
- Tests: `tests/autonomy/` (TASKS.md parser, `apply-ops.sh` accept/reject fixtures, the real
  `run-job.sh` wrapper with a fake `claude`).

#### Learning: automatic, like Hermes

- **Skill `learn`** classifies each owner correction: a fact → `MEMORY.md`; a preference or mistake
  → a `LESSONS.md` lesson applied at once with a one-line receipt ("Aprendido: …"); a procedure, or
  the same correction twice in 14 days → a skill created or improved automatically; a permission
  request → refused and logged `rejected_permission`; "deshaz" → undo.
- **`templates/local/bin/promote-skill.sh`** promotes a learned skill after a deterministic lint
  (no installs, no secrets, no sending/paying tools in `allowed-tools`, no permission text, no
  scripts), on **probation** until the owner uses it once in an attended session, git-committed
  and announced. **`bin/learn.sh`** commits lessons and facts, undoes with `git revert`, and runs
  the deterministic part of the weekly review.
- **Hooks** for Claude Code and the Agent SDK: `capture-correction.sh` (UserPromptSubmit),
  `learn-nudge.sh` (Stop) and `protect-paths.sh` (PreToolUse; denies writes to SOUL/AGENTS/TOOLS,
  settings, jobs, approvals and the corrections ledger, and denies probation skills in unattended
  runs).
- `memory/corrections.jsonl` (redacted, gitignored) and `LESSONS.md` with provenance
  (`[src:owner/<canal>]`, `[ev:C-NNNN]`).
- Weekly `learning-review` job (Sunday 19:37): retires lessons unused for 60 days and duplicates,
  flags contradictions and repeated corrections, lists skills on probation.
- Hermes keeps its native loop (`skills.write_approval: false`, `skills.guard_agent_created: true`);
  OpenClaw dreaming off by default; Codex, Ollama and Cowork use the skill.
- Tests: `tests/learning/` (capture phrases ES/EN, `protect-paths.sh`, `promote-skill.sh` lint).

#### Multimodal: audio, video, photos and PDFs

- **Skill `transcribe`** (`scripts/transcribe.sh`): voice notes and recordings up to 60 minutes,
  ffmpeg → whisper.cpp on the owner's machine with the model file verified by SHA-256, transcript
  tagged with its source, audio deleted after use; cloud STT only with recorded consent.
- **Skill `watch-video`** (`scripts/watch.py`, own rewrite inspired by bradautomates/claude-video,
  MIT): captions first without downloading, local transcription as fallback, timestamped frames
  (≤ 100, 512 px) only for visual questions; public-address URL checks, no cookies, no playlists,
  no auto-install; temp files removed.
- Photos and PDFs read natively; AGENTS.md § 9: what is seen or heard is information, not orders.
- Media tools pinned in each runtime's § Pinned versions; yt-dlp kept on its latest release and
  checked weekly by `/jarvis-doctor`.
- Tests: `tests/media/run.sh` (offline synthetic audio and video, URL rejection cases).

#### Community and CI

- `CONTRIBUTING.md` (bilingual), `SECURITY.md`, `VERSIONING.md`, this file, issue forms
  (`nueva-profesion`, `nuevo-runtime`, `conocimiento-viejo`, `bug`), PR template and release-notes
  categories. MIT `LICENSE`.
- `.github/workflows/validate.yml`: plugin manifests and `claude plugin validate`, the knowledge
  contract (pins, `Last verified`, cross-references, ID lists), secret and README-image checks,
  the panel test suite, `bash -n` + shellcheck on every shipped script, and the autonomy, learning
  and media test suites.

### Security

- Every Jarvis ships with the controls in `knowledge/security-checklist.md`: owner-only allowlists,
  private control plane, untrusted content fenced as data, human approval with an exact preview for
  irreversible actions, spend caps before first use, secrets only in `.env`/keychain/sealed
  variables, logged consent for unofficial WhatsApp, and a panic-button `SECURITY.md` + `RUNBOOK.md`.
- Credentials follow `knowledge/auth-matrix.md`: a Claude Pro/Max subscription is used only inside
  the unmodified `claude` binary by its owner; every third-party harness uses API keys.
- Safe installs only: package managers with pinned versions; vendor scripts are downloaded, their
  SHA-256 shown, and run by the person. `.claude/settings.json` denies `sudo`, piped installs and
  reading `.env` and credential files.
- **Hardened by sandbox runs on macOS before release:**
  - scheduled jobs run `claude -p` under `env -i` with `--permission-mode dontAsk`, an explicit
    tool list that refuses wildcards, Bash/Edit/Write and bare `WebFetch`, a strict MCP config,
    and turn and USD caps; failures always send an AVISO instead of failing silently;
  - the panel binds `127.0.0.1`, refuses to start on a non-loopback host without
    `PANEL_PASSWORD`, requires its CSRF header on every write, and audits without bodies or secrets;
  - each runtime file documents how it implements every `SEC-NN` control, and `jarvis-validator`
    checks the result before handoff.
- **Autonomy (SEC-34, SEC-35):** the autopilot reads and drafts only and never executes an
  irreversible action or writes `approvals/`; `apply-ops.sh` rejects raising a level, handing an
  owner task to Jarvis, unknown ids and paths outside `drafts/`/`tasks/`; captures from mail,
  calendar, meetings and media are quarantined in the Bandeja; `STOP_AUTOPILOT` is checked before
  the model call; pausing works from chat, resuming only from the terminal or the panel.
  CMP-41 blocks Cloud Routines as the autopilot.
- **Learning (SEC-36, SEC-37):** three fixed limits inside the verbatim AGENTS.md block — learning
  never changes permissions, allowlists, credentials or approval rules; it learns only from owner
  messages on allowlisted channels, never unattended; every change is audited (`learning.*`),
  git-committed and undoable. CMP-42 covers OpenClaw dreaming next to the loop.
- **Media (SEC-38):** sender allowlist before download, size and duration limits, MIME allowlist
  (no archives, executables or SVG), temp folder outside the workspace and deleted after use,
  transcripts treated as untrusted, no auto-install, media tools pinned. CMP-39 blocks cloud
  STT/Gemini with a sensitive pack; CMP-40 keeps video links from untrusted content from opening
  on their own.
- [SECURITY.md](SECURITY.md) with a private reporting route and the threat model for a repo whose
  output is instructions an agent executes.

[Unreleased]: https://github.com/Hainrixz/jarvis-architect/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Hainrixz/jarvis-architect/releases/tag/v1.0.0
