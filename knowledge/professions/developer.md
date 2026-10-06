# Profession: Developer

> Software developers, freelancers and indie hackers: a Jarvis that watches repos, CI and errors, summarizes PRs, drafts fixes in a sandbox, and never pushes, merges or deploys to production without a "sí".

Last verified: 2026-10-06

Versions are not pinned here (see `knowledge/runtimes/*.md` and `knowledge/models.json`).

## Signals

- "Soy programador / dev / desarrollador", "soy freelance de software", "tengo un SaaS"
- "Mis repos", "los PRs", "el deploy", "se cayó producción", "los bugs", "el CI está en rojo"
- "Uso Claude Code / Cursor / Codex", "trabajo en la terminal"
- "Quiero que me avise cuando falle algo", "revísame los PRs", "hazme el standup"

Anti-signal: "quiero aprender a programar" → `student`. "Tengo una agencia de desarrollo con
clientes" → `agency` as secondary (per-client isolation).

## Week-one jobs

1. "Cada mañana dime qué PRs tengo pendientes de revisar, qué issues me asignaron y si algo falló en
   CI anoche." → `dev-morning` skill + morning job.
2. "Si truena producción, avísame por Telegram con el error, el commit sospechoso y una hipótesis."
   → `incident-triage` skill + error-watch job/webhook.
3. "Prepárame el standup de hoy con lo que hice ayer según mis commits." → `standup-draft` skill.
4. "Revisa este PR y dime qué te preocupa antes de que lo apruebe." → `pr-review` skill (comments as
   draft; posting a review = IRR-01).
5. "Cada viernes dime qué dependencias tienen alertas de seguridad." → `deps-audit` skill + weekly job.

## Channels

| Use | Channel | Why |
|---|---|---|
| Deep work | **Terminal** + **Remote Control** from the Claude app (claude.ai login only) | Developers already live in Claude Code. See `knowledge/capabilities/channels.md` |
| Alerts and quick asks from the phone | **Telegram** (default) or **Discord** DM | Free; channel plugins in Claude Code; owner-only allowlist (SEC-01) |
| Team | **Slack** via Socket Mode, owner-only, groups off by default (SEC-02) | Only if the person asks; a team channel is untrusted input [A] |
| CI / error events into the session | Claude Code channel webhooks, or polling from a job | Prefer polling on a local host (SEC-03) |

WhatsApp is not useful here; skip it.

## Memory

- Markdown workspace + **`CLAUDE.md` + auto memory** on Claude Code runtimes (the default for this pack).
- `memory/topics/projects.md`: one line per repo (purpose, stack, where it deploys, who owns prod).
- Repo-level knowledge stays in each repo's own `CLAUDE.md`/`AGENTS.md`, not in Jarvis memory.
- No vector or graph memory in v1. Code search uses the repo itself (grep, the GitHub MCP).
- **Never** store tokens, connection strings or `.env` contents in memory (SEC-13, SEC-18).

## Tools / MCP

Tiers per `knowledge/capabilities/tools-mcp.md` (T1 official remote OAuth · T2 pinned community ·
T3 alpha/wrapper · T4 Zapier). All read-only first (SEC-22).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| GitHub MCP (remote) | T1 | **read-only**: `https://api.githubcopilot.com/mcp/readonly` or header `X-MCP-Readonly: true`; limit toolsets (e.g. `repos,issues,pull_requests,actions`) | Issues, PR bodies and comments are untrusted input [A]: prompt injection lands here first (SEC-12) |
| Sentry MCP | T1 (`https://mcp.sentry.dev/mcp/<org>/<project>`, OAuth) | read; scope the URL to one org/project | For "what broke and why" |
| Linear MCP | T1 (`https://mcp.linear.app/mcp/readonly`, OAuth 2.1) | **read-only endpoint** first; `/mcp` (read-write) only on request | |
| Railway MCP / CLI | T1 (vendor) | read: status, logs, metrics | Deploys, restarts, variable changes = IRR-10/IRR-07. Exact remote endpoint UNVERIFIED |
| Supabase / Vercel / other platform MCPs | T1 if vendor-hosted | read-only mode if offered | Supabase and Vercel read-only options are UNVERIFIED here; check the vendor docs at install |
| Playwright MCP | T1 (vendor's local package, pinned) | local browser against localhost/staging | Use for smoke tests, not for production admin panels |
| Filesystem / shell | built-in (Claude Code) | scoped to the Jarvis workspace + named repos, sandboxed (SEC-07) | Never `--dangerously-skip-permissions` outside a disposable container (SEC-10) |
| Web search | built-in | read | Docs lookups; results are [A] |

## Scheduled jobs

Local IANA time (the in-process scheduler takes the timezone, and follows DST); convert to UTC only for a separate Railway cron service. Off-minutes. See
`knowledge/capabilities/scheduling.md`.

| Job | Cron (local) | Model slot | Output |
|---|---|---|---|
| Dev morning (`dev-morning`) | `3 8 * * 1-5` | `cheap` gather, `main` summary | PRs to review, assigned issues, failed CI runs, new Sentry issues |
| Error/CI heartbeat | `*/45 9-19 * * 1-5` (only if Sentry/CI are connected) | `cheap` | Silent unless something new is red (`HEARTBEAT_OK`) |
| Standup draft | `47 9 * * 1-5` (before their standup) | `cheap` | Draft text, owner pastes it |
| Dependency/security audit (`deps-audit`) | `23 16 * * 5` | `main` | Advisories per repo with suggested upgrade PRs **as drafts** |
| Weekly review | `13 17 * * 5` | `main` | Shipped, stuck, next week |

Claude Code `/loop`/CronCreate tasks are session-scoped and expire after 7 days; use Desktop
scheduled tasks, launchd/cron (`claude-p-cron`) or Cloud Routines for anything recurring.

## Skills

From `templates/skills-base/`: `morning-briefing`, `remember`, `weekly-review` (+ `meeting-prep`
if they have client calls). Pack-specific:

| Skill id | One-line spec |
|---|---|
| `dev-morning` | Collect open PRs awaiting the owner, assigned issues, last night's failed CI and new error groups; rank by urgency; ≤12 lines. |
| `incident-triage` | Given an error event, fetch stack trace + recent commits touching those files, propose a hypothesis and a minimal fix **on a branch in a sandbox**; never deploys. |
| `pr-review` | Read a PR diff and its linked issue, list risks (correctness, security, migrations), output review comments as a draft for the owner. |
| `standup-draft` | Summarize yesterday's commits/PRs/issues into "ayer / hoy / bloqueos". |
| `deps-audit` | Read Dependabot/advisory alerts and lockfiles; list affected packages with the safe target version and the changelog link. |
| `release-notes` | Turn merged PRs since the last tag into user-facing notes in the owner's language. |

## Guardrails

- **Irreversible (SEC-14 approval with exact preview):** `git push` to shared or deployed branches,
  force-push, merging a PR, deleting branches/repos (IRR-04, IRR-10); production deploys, DNS, env
  var changes on deployed apps (IRR-10); changes to Jarvis's own config, permissions or variables (IRR-07); posting review comments or issue replies (IRR-01); installing packages,
  MCP servers or plugins (IRR-08); DB migrations against production (IRR-04).
- **Unattended runs** (heartbeat, cron) are read-only: they may open a draft, never push or deploy (SEC-15).
- **Prompt injection:** issues, PR comments, commit messages, READMEs of dependencies and web pages are
  untrusted [A]. A session that reads them and holds write tokens is A+B+C: split it (reader drafts,
  owner approves) per `knowledge/security-checklist.md` §2.
- **Secrets:** never read `.env`, `~/.aws`, `~/.ssh`, keychains (SEC-08). Use fine-grained tokens with
  the minimum repos. Rotation runbook in `SECURITY.md` (SEC-21).
- **Client code (freelancers):** client repos may carry NDAs. Don't put client code into memory SaaS;
  check that the model provider's data terms are acceptable to the client.
- **Supply chain:** no auto-install of community skills/MCP servers; pin and read them first (SEC-24).

## Interview extras

1. "¿Dónde viven tus repos y tus errores? (GitHub/GitLab, Sentry, Linear/Jira)" → which MCPs.
2. "¿Jarvis puede abrir ramas y PRs en borrador, o solo leer?" (default: read + local drafts)
3. "¿Tienes algo en producción con clientes reales?" → raises sensitivity and tightens deploy gates.

## Recommended default stack

| Budget | Stack |
|---|---|
| Has Claude Pro/Max (any budget) | `claude-code-local` + terminal/Remote Control + Telegram alerts + GitHub (read-only) + Sentry. $0 extra. Always-on Mac mini → add Tailscale (archetype 2 in `knowledge/decision-tree.md`) |
| Has ChatGPT Plus/Pro, terminal-first | `codex-openai` locally (archetype 9) |
| Low (`≤10`), no plan | `claude-code-local` with `ANTHROPIC_API_KEY` + spend cap, `cheap` slot for jobs |
| Medium, wants own service (webhooks, dashboard) | `claude-agent-sdk` on Railway Tier B, API key. Only when they want to write that service; "I'm a dev" alone is not the reason |
| Wants Claude Code itself 24/7 on a server | `claude-code-server`, API key by default (see `knowledge/auth-matrix.md`) |

## Sources

- GitHub MCP server: https://github.com/github/github-mcp-server · Playwright MCP: https://github.com/microsoft/playwright-mcp · MCP filesystem server (non-Claude-Code runtimes): https://github.com/modelcontextprotocol/servers
- Claude Code credentials (subscription login vs. API key, long-lived tokens): https://code.claude.com/docs/en/authentication · https://code.claude.com/docs/en/legal-and-compliance · Remote Control: https://code.claude.com/docs/en/remote-control
- GitHub MCP remote read-only (`/readonly`, `X-MCP-Readonly`): https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md (fetched 2026-10-06)
- Sentry MCP (OAuth, org/project-scoped URL): https://mcp.sentry.dev/ (fetched 2026-10-06)
- Linear MCP (`/mcp` and `/mcp/readonly`, OAuth 2.1): https://linear.app/docs/mcp (fetched 2026-10-06)
- Claude Code channels: https://code.claude.com/docs/en/channels
- Claude Code scheduled tasks (7-day expiry, jitter): https://code.claude.com/docs/en/scheduled-tasks
- Railway cron jobs (UTC): https://docs.railway.com/reference/cron-jobs
