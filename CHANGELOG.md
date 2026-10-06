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

First public release. An architect agent for Claude Code that interviews a person about their work,
**decides** the runtime, model, host, channels, memory, tools and scheduled jobs for their own
personal "Jarvis", then installs, configures, verifies and hands it over with them — locally or on
Railway — with security controls on by default. Built for the Spanish-speaking community (LATAM and
Spain), including people who are not technical.

### Added

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
  | `/jarvis-doctor` | Read-only health check of a running Jarvis |
  | `/jarvis-add` | Add a channel, tool/MCP, skill or scheduled job with the same gates |
  | `/jarvis-refresh` | Maintainers: re-verify every pin in `knowledge/` against live sources |

- **State machine with an explicit gate:** `RESUME? → PREFLIGHT → DISCOVERY → DEEP DIVE →
  ARCHITECTURE →(explicit yes)→ BUILD → VERIFY → (DEPLOY) → HANDOFF`. Nothing is installed, no
  account is touched and no money is spent before the ARCHITECTURE gate passes.
- **Three subagents** in `.claude/agents/`: `stack-researcher` (live check of versions, prices,
  model IDs and policies; outranks `knowledge/`), `workspace-writer` (writes the Jarvis's own
  files), `jarvis-validator` (read-only audit; must PASS before handoff).
- **Interview** in `questions/` (`0-preflight.md` … `4-construir.md`): read-only machine
  preflight, discovery, deep dive, confirmation (markers, pre-mortem, consent), build and handoff.
- **Knowledge base** in `knowledge/` with the stable IDs declared in `knowledge/README.md`:
  - `runtimes/` — nine harness IDs: `claude-code-local`, `claude-code-server`, `claude-p-cron`,
    `claude-agent-sdk`, `hermes`, `openclaw`, `codex-openai`, `ollama-local`, `cowork`. The only
    markdown files allowed to pin versions, each with a security floor.
  - `models.json` — `cheap` / `main` / `max` model slots per provider with prices and
    `verified_at`.
  - `capabilities/` — `channels`, `whatsapp`, `memory`, `tools-mcp`, `scheduling`, `voice`,
    `skills`, `deploy-local`, `deploy-railway`, `costs`, `web-ui`.
  - `professions/` — thirteen packs: `creator`, `developer`, `founder`, `sales`, `student`,
    `lawyer-accountant`, `health`, `real-estate`, `smb-restaurant`, `ecommerce`, `coach`, `agency`,
    `teacher`.
  - `countries/` — `mx`, `co`, `ar`, `es`, `other` (WhatsApp reality and rates, e-invoicing tools,
    data-protection law, voice accent, timezones).
  - `decision-tree.md`, `auth-matrix.md`, `compatibility.md` (`CMP-NN`),
    `security-checklist.md` (`SEC-NN`).
- **Templates** in `templates/`: `jarvis-spec.md`, `tasks-schema.md` (with `user_action` tasks for
  steps only the person can do), the Jarvis workspace (`SOUL`/`USER`/`MEMORY`/`HEARTBEAT`/`AGENTS`
  files), base skills, and local and Railway host templates.
- **`.jarvis/` state** in the person's working directory: `preflight.json`, `state.json` (with a
  RUNNING BRIEF that survives compaction and sessions), `tasks.json`, `jarvis-spec.md`.
- **Community docs:** `CONTRIBUTING.md` (bilingual), `SECURITY.md`, `VERSIONING.md`, this file,
  issue forms (`nueva-profesion`, `nuevo-runtime`, `conocimiento-viejo`, `bug`), PR template and
  release-notes categories. MIT `LICENSE`.

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
- [SECURITY.md](SECURITY.md) with a private reporting route and the threat model for a repo whose
  output is instructions an agent executes.

[Unreleased]: https://github.com/Hainrixz/jarvis-architect/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Hainrixz/jarvis-architect/releases/tag/v1.0.0
