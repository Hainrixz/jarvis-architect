# Capability: Web UI (Jarvis Panel)

> The "face" of a Jarvis: when the Architect installs the Jarvis Panel (`templates/panel/`, a small local web app to chat, read and edit memory, run jobs, approve irreversible actions and read the audit log), which adapter it uses per runtime, when the runtime's own UI is the better answer, and how to keep any of them off the public internet.

Last verified: 2026-10-06

No versions live here. The panel's own dependencies are pinned exactly in
`templates/panel/package.json` and locked by its `package-lock.json`. Runtime versions and
security floors are in `knowledge/runtimes/<id>.md`.

## Decision rule

| Person / situation | What the Architect does |
|---|---|
| Non-technical person (most profiles in `decision-tree.md`) on any runtime that has a panel adapter | **Offer the Jarvis Panel, default "sí".** It is where they see what their Jarvis remembers and approve risky actions without a terminal |
| "Me defiendo con la terminal" (`terminal-ok`) | Ask Q8 once. Recommend the panel when there is **no** chat channel (local-only, terminal Jarvis), since it's then the only place to see memory and jobs; otherwise default "no" |
| Developer (`dev` profile) | Optional. Ask once: "¿quieres un panel web local o te basta con la terminal y el chat?" Default "no" |
| Local-only / "nada sale de mi compu" (`ollama-local` under a harness) | The panel **through the harness API** (Hermes → `:8642`) is the one local UI. Not Open WebUI (it talks to Ollama directly, without the harness's memory, skills or cron), not a terminal-only default for non-technical people |
| Runtime is `openclaw` | **No panel.** Link OpenClaw's own Control UI on loopback (see table below) |
| Runtime is `cowork` | **No panel.** Claude Desktop already is the UI |
| Runtime is `hermes` and the person only wants to look at settings, sessions and logs | Hermes' own dashboard on loopback is enough; add the panel only if they also want approvals / memory editing in one place |
| Host is Railway | Panel only with `PANEL_PASSWORD` set, ideally reachable only over Tailscale. On Tier B it is the `jarvis-web` service, the only one with a public domain (`capabilities/deploy-railway.md` § Tier B) |
| `hermes` **on Railway** | **No panel in v1** (default, say it in one line at Gate A): the Hermes API server must stay on the core's loopback (SEC-05), the memory files live on the core's volume (one volume per service, CMP-33), and a separate `jarvis-web` would see neither. Approvals and memory review happen in Telegram. A panel inside the Hermes container (thin image + Tailscale) is a `/jarvis-add` v2 item, quoted then |
| `claude-agent-sdk` (any host) | The panel runs **inside the core process** (`runtimes/claude-agent-sdk.md` § Jarvis Panel inside the core), never as a separate `agent-sdk`-adapter process |
| Person wants to use it from the phone | Local: `tailscale serve` (tailnet only). Never port-forward the router, never `tailscale funnel` for the panel |
| Claude Code runtimes and the person has a claude.ai login | Also mention **Remote Control** in the Claude app as the official phone UI (it drives the local session; it is not a replacement for approvals in the panel) |

One UI per Jarvis in v1. Don't stack the panel, Open WebUI and a runtime dashboard unless the
table above says so (`decision-tree.md` rule "fewer moving parts").

## Options per runtime

| Runtime | Primary UI | Panel adapter (`PANEL_ADAPTER`) | Notes |
|---|---|---|---|
| `claude-code-local` | Jarvis Panel | `claude-cli` | Spawns the unmodified `claude` binary in `JARVIS_HOME` with the owner's own login (`auth-matrix.md`) and `--settings .claude/headless-settings.json` (picked up automatically when the file exists): same sandbox as the channel session, Telegram plugin off so a panel chat never steals the bot (`runtimes/claude-code-local.md` § Known issues). **Approvals stay in Telegram** (the `ask` relay); the Aprobaciones screen stays empty on this runtime, and panel chat runs in `dontAsk`, so an `ask`-gated tool is refused there: the panel says "eso pídelo por Telegram, ahí te pido permiso". Phone: Remote Control in the Claude app ([remote-control](https://code.claude.com/docs/en/remote-control); needs a claude.ai `/login`, not an API key or setup-token) |
| `claude-p-cron` | Jarvis Panel | `claude-cli` | Same as above. The panel's "Ejecutar ahora" button runs the same job prompts the launchd/systemd timer runs |
| `claude-code-server` | Jarvis Panel | `claude-cli` | Server/Railway: credential per `auth-matrix.md` (API key by default). Panel **must** have `PANEL_PASSWORD` and should sit behind Tailscale |
| `claude-agent-sdk` | Jarvis Panel | `core` (injected by the runtime) | Mounted inside the core process (`runtimes/claude-agent-sdk.md` § Jarvis Panel inside the core): reuses `run()` (guards, `minimalEnv`, budgets, persona), `JARVIS_MEMORY_DIR=workspace`, and `askOwner` mirrors every approval to `approvals/pending/`. The standalone `agent-sdk` adapter is for local experiments only: it bypasses all of that |
| `hermes` (local host) | Jarvis Panel and/or Hermes dashboard | `openai-compatible` → Hermes API server | Chat goes through Hermes (memory, skills). Memoria shows the workspace md in `JARVIS_HOME`; to show what Hermes itself learned, set `JARVIS_MEMORY_DIR` to the Hermes memories folder (`~/.hermes/memories` natively; the mounted data dir in Docker), which holds `MEMORY.md`/`USER.md`. Tareas reads the `jobs.json` mirror the Architect writes from `hermes cron list` (Hermes keeps the real jobs in `~/.hermes/cron/jobs.json`); "Ejecutar ahora" sends the job prompt as a chat turn. Aprobaciones is empty: Hermes approves in its own channel/CLI flow, and the smoke-test row becomes "N/A (approvals in Telegram/terminal)". Enable the API server with `API_SERVER_ENABLED=true`, keep `API_SERVER_HOST=127.0.0.1` (default), port `8642` (`API_SERVER_PORT`), set `API_SERVER_KEY` (required, sent as `Authorization: Bearer`). Panel: `OPENAI_COMPAT_BASE_URL=http://127.0.0.1:8642/v1`, `OPENAI_COMPAT_API_KEY=<API_SERVER_KEY>` ([api-server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)). Hermes' own dashboard: `hermes dashboard` → `http://127.0.0.1:9119`, loopback only — it reads and writes Hermes' `.env` ([web-dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)) |
| `openclaw` | OpenClaw Control UI | — (none) | `http://127.0.0.1:18789/` after `openclaw gateway`; auth is the gateway token/password even on loopback ([control-ui](https://docs.openclaw.ai/web/control-ui)). **Never public.** CVE-2026-25253 was link-based token theft through the Control UI (`gatewayUrl` query param → WebSocket sends the token) ([GHSA-g8p2-7wf7-98mq](https://github.com/advisories/GHSA-g8p2-7wf7-98mq), [OSV](https://osv.dev/vulnerability/CVE-2026-25253)). Remote: `tailscale serve` only; version above the floor in `runtimes/openclaw.md` (SEC-25) |
| `codex-openai` | Jarvis Panel | `codex-cli` | Spawns `codex exec --json --skip-git-repo-check --sandbox read-only -` with the message on stdin (`CODEX_SANDBOX=read-only` by default); resume with `codex exec … resume <id> -- <message>` ([non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)). At install, run `codex exec --help` and `codex exec resume --help` and match the flag order and stdin `-` to what they print; send one message and one follow-up through the panel to confirm resume. The adapter ignores unknown events inside `item.completed`, so new event types don't break it |
| `ollama-local` | Jarvis Panel | `openai-compatible` → **the harness** (Hermes: `http://127.0.0.1:8642/v1`, as the `hermes` row) | `ollama-local` is always under a harness, so the panel follows the harness; pointing it straight at Ollama (`http://127.0.0.1:11434/v1`, any non-empty key) skips memory, skills and jobs and is only for a model smoke test. Open WebUI is not used in v1 (one UI per Jarvis) |
| `cowork` | Claude Desktop | — (none) | No self-hosted surface. SEC-05/06 not applicable (`security-checklist.md` last section) |

`mock` adapter: demo and tests only (`NODE_ENV=test`). The panel refuses to start without
`PANEL_ADAPTER` outside tests and says which value to set.

## What the panel does (contract)

Every runtime gets the same screens because the panel talks to the runtime only through an
adapter (`templates/panel/src/adapters/*.js`, interface `{name, health(), *chat({message,
sessionId, signal})}`):

| Screen | API | Behaviour |
|---|---|---|
| Estado | `GET /api/health` | `{ok, runtime, adapter, version, uptime_s, jarvis_name}`; no auth, no secrets |
| Chat | `POST /api/chat` → SSE | `delta` events, then `done` with `session_id` (or `error`). Session ID is reused for follow-ups |
| Memoria | `GET/PUT /api/memory[/:name]` | Lists the workspace files present in `JARVIS_HOME`. Editable: `MEMORY.md`, `USER.md`, `SOUL.md`, `HEARTBEAT.md`. Read-only (403): `AGENTS.md`, `TOOLS.md` — they hold tool and permission rules, which must change through `/jarvis-add`, not a text box. Writes are atomic (tmp + rename) and keep a `.bak` |
| Tareas | `GET /api/jobs`, `POST /api/jobs/:id/run` | Reads `jobs.json`; "run now" requires `{confirm:true}` |
| Aprobaciones | `GET /api/approvals`, `POST /api/approvals/:id` | Approve / reject pending irreversible actions (protocol below) |
| Registro | `GET /api/log?limit=100` | Last lines of `logs/audit.jsonl`, newest first |
| Login | `POST /api/login`, `GET /api/session` | Only when `PANEL_PASSWORD` is set |

Spanish UI by default with an ES/EN toggle. No CDN, no external fonts — it works offline.

### Adapter notes the Architect needs

- **`claude-cli`** runs, in `JARVIS_HOME`:
  `claude -p --output-format stream-json --verbose --include-partial-messages --permission-mode <mode> [--resume <session_id>] [--allowedTools "$CLAUDE_ALLOWED_TOOLS"]`,
  with the message on **stdin** (non-interactive mode reads stdin, capped at 10 MB), so it can't be
  parsed as a flag and doesn't show in `ps`. Spawned with an args array, never a shell.
  Token deltas are lines with `type == "stream_event"` and `event.delta.type == "text_delta"`;
  the last line is a `result` message with `session_id`; subagent messages carry a non-null
  `parent_tool_use_id` and are skipped ([headless](https://code.claude.com/docs/en/headless),
  re-checked 2026-10-06: matches `src/adapters/claude-cli.js`). Without `--include-partial-messages` the
  stream still works, but text arrives per message instead of per token.
  - Never `--dangerously-skip-permissions` and never `--permission-mode bypassPermissions`
    (SEC-10). Nobody can answer a terminal permission prompt from the panel, so pass an explicit
    mode: the docs warn that a run with no mode set takes the built-in starting mode, which can be
    `auto` ([headless § Auto-approve tools](https://code.claude.com/docs/en/headless)). Use
    `--permission-mode dontAsk` plus the `CLAUDE_ALLOWED_TOOLS` list, the same profile the
    runtime's jobs use (`runtimes/claude-p-cron.md`). Irreversible tools stay out of that list;
    they go through the approvals protocol below.
  - Don't add `--bare`: bare mode ignores the subscription login and the project's
    `.claude/settings.json` hooks (audit hook, SEC-29) ([headless § bare mode](https://code.claude.com/docs/en/headless)).
  - Credential: the owner's own login on their own machine with the unmodified binary is allowed
    for `claude-code-local` / `claude-p-cron`; on a server follow the `claude-code-server` row of
    `knowledge/auth-matrix.md` (SEC-30).
- **`agent-sdk`**: `query()` with `cwd: JARVIS_HOME`, `allowedTools` from env, a permission mode
  that never bypasses (`manual` is a CLI-only alias, so the adapter sends the config value
  `default`), `ANTHROPIC_API_KEY` from env and never logged. Option names follow the pinned SDK's
  types: after `npm ci`, `npm test` in the panel and one chat through it confirm them.
- **`openai-compatible`**: `POST {base}/chat/completions` with `stream: true`, keeps a bounded
  per-session history in memory (the panel restarts → history is lost; the runtime's own memory is
  unaffected). Works for the Hermes API server, Ollama and LM Studio.
- **`codex-cli`**: `codex exec --json --skip-git-repo-check --sandbox <read-only|workspace-write> -`
  with the message on stdin; default sandbox `read-only`. Never `--sandbox danger-full-access`
  from the panel (SEC-07/SEC-10).

## How the Architect installs it (BUILD task 10 in `questions/4-construir.md`)

1. Copy `templates/panel/` → `<jarvis_dir>/panel/` (no `node_modules`).
2. `cd <jarvis_dir>/panel && npm ci` (lockfile-pinned, SEC-25). Requires Node ≥ 22 (`node -v`).
3. `cp .env.example .env && chmod 600 .env`. The Architect fills the non-secret values
   (`JARVIS_HOME=..`, `JARVIS_NAME`, `PANEL_ADAPTER`, `PANEL_PORT=7878`, `PANEL_HOST=127.0.0.1`,
   `OPENAI_COMPAT_BASE_URL`, `CLAUDE_ALLOWED_TOOLS`); the person pastes any secret
   (`PANEL_PASSWORD`, `OPENAI_COMPAT_API_KEY`, `ANTHROPIC_API_KEY`) themselves (SEC-17/18).
   `panel/.env` goes in the Jarvis `.gitignore`.
4. Supervise it with **the same supervisor as the runtime**, as a second unit:
   launchd `com.jarvis.<slug>.panel` (from `templates/local/com.jarvis.agent.plist.tmpl`, `mode: service`, program `node src/server.js`, working directory `<jarvis_dir>/panel`), systemd user
   unit `jarvis-panel.service` (from `templates/local/jarvis.service.tmpl`), or a second app in
   pm2's `ecosystem.config.cjs`. Command: `node src/server.js` (or `npm start`), working directory
   `<jarvis_dir>/panel`. See `capabilities/deploy-local.md`.
5. Railway: the panel plays the Tier B `jarvis-web` role — the only service with a public domain
   (`capabilities/deploy-railway.md` § Tier B). `PANEL_HOST=::` (needed for private networking in
   environments created before 2025-10-16, and for Railway's proxy) **and** `PANEL_PASSWORD` as a
   sealed variable; the panel refuses to start otherwise. Healthcheck path `/api/health`. Prefer no
   public domain at all and reach it through the Tailscale template.
   - Chat: point the adapter at the core over private networking (Hermes:
     `OPENAI_COMPAT_BASE_URL=http://jarvis-core.railway.internal:8642/v1`), so the web service
     holds no model key.
   - Memory, jobs, approvals and log read `JARVIS_HOME` on disk, and a Railway volume attaches to
     one service only ([volumes](https://docs.railway.com/volumes/reference)). Either run the panel
     as a second supervised process **inside** the core service (then that service is the one with
     the domain, password mandatory), or accept that those screens are empty on `jarvis-web`.
     Never give the panel a second copy of the workspace.
6. Verify (below), then the HANDOFF smoke test: the person opens the panel, sends a message, sees
   `MEMORY.md`, and approves the pending test action **where the runtime writes approvals files**
   (`claude-agent-sdk` in-core, custom skills using the protocol below). On `claude-code-local`,
   `claude-p-cron` and `hermes` approvals live in the chat channel: that row checks the Telegram
   relay instead and the panel row says "N/A, aprobaciones por Telegram".

## File protocols

All paths are relative to `JARVIS_HOME`. Every file is plain JSON / JSONL, so any runtime's
skills can write them with their normal file tools.

### `jobs.json`

Written by the Architect at BUILD from the spec's scheduled jobs (the timer itself still lives in
launchd/systemd/the runtime's cron — `capabilities/scheduling.md`). The panel updates only
`last_run` / `last_status`.

```json
[
  {
    "id": "briefing",
    "name": "Resumen de la mañana",
    "schedule": "3 7 * * 1-5",
    "timezone": "America/Mexico_City",
    "description": "Agenda de hoy, correos importantes y pendientes",
    "prompt_file": "jobs/briefing.md",
    "last_run": "2026-10-06T07:03:04-06:00",
    "last_status": "ok"
  }
]
```

Each job has `prompt` (inline text) **or** `prompt_file` (a path inside `JARVIS_HOME`, e.g. the
same `jobs/briefing.md` that `run-job.sh` uses; the panel refuses paths that leave the folder).
`schedule` follows the off-minute rule (`capabilities/scheduling.md`).

`last_status`: `ok` · `error` · `running`. "Run now" from the panel is an attended run but still
uses the job's read/draft tool profile (SEC-15, SEC-23): a job never gains send/pay/delete
because a human clicked the button.

### Approvals (`approvals/pending/` → `approvals/decided/`)

The human leg of SEC-14 for runtimes without a built-in approval prompt on the owner's screen.

1. Before an irreversible action (IRR list in `security-checklist.md`), the Jarvis skill writes
   `approvals/pending/<id>.json` and stops:
   ```json
   {
     "id": "01J9Z3Q7S8K2",
     "action": "gmail.send",
     "preview": "Para: ana@ejemplo.com\nAsunto: Cotización\n\n<texto completo del correo>",
     "args_sha256": "<hash of the exact tool args>",
     "created_at": "2026-10-06T16:02:11Z",
     "expires_at": "2026-10-06T16:07:11Z"
   }
   ```
   `preview` is the exact recipient / full text / amount / path, not a summary (SEC-14).
   `id` is random (ULID/UUID), filename-safe.
2. The panel lists pending files and the owner clicks Aprobar / Rechazar. The panel moves the
   file to `approvals/decided/<id>.json`, adding `"decision": "approve"|"reject"` and
   `"decided_at"`. After `expires_at` (5 min) approval returns **409** and only reject is possible
   (SEC-16).
3. The skill polls `approvals/decided/<id>.json`; it executes only if `decision == "approve"`,
   `decided_at <= expires_at`, and the hash of the args it is about to send equals
   `args_sha256` (bound to the exact action). One approval = one execution; the skill then renames
   the file to `<id>.used.json`.
4. Unattended runs (cron, heartbeat) never write a pending approval and wait — they deny and
   produce a draft instead (SEC-15).

The panel only decides; it never executes the action itself.

### `logs/audit.jsonl`

One JSON object per line, append-only, shared by the runtime's audit hook (SEC-29) and the panel:

```json
{"ts":"2026-10-06T16:03:40Z","source":"panel","actor":"owner","ip":"127.0.0.1","action":"approval.decide","target":"01J9Z3Q7S8K2","decision":"approve","ok":true}
{"ts":"2026-10-06T16:03:41Z","source":"claude-code","session":"c0ffee…","tool":"mcp__gmail__send","input_sha256":"9f2c…","decision":"allow"}
```

The panel logs every mutating call (`login.ok`, `login.fail`, `logout`, `memory.write`,
`job.run`, `job.finished`, `approval.decide`, `chat`) with `target`, `decision`, `method`, `path`,
`status` and `ip` only — never message bodies, passwords, cookies, keys or file contents
(SEC-18, SEC-20).

## Security

Controls the panel implements and the SEC ID each one satisfies:

| Area | Control in the panel | SEC |
|---|---|---|
| Exposure | Binds `127.0.0.1` by default (`PANEL_HOST`). **Refuses to start** if `PANEL_HOST` is not loopback and `PANEL_PASSWORD` is unset (Spanish error). Remote only via `tailscale serve`; never router port-forward, never Funnel | SEC-05 |
| Exposure (Railway) | Only `jarvis-web` (the panel) gets a domain on Tier B; password mandatory; Tailscale preferred | SEC-06 |
| Auth | With `PANEL_PASSWORD` (at least 12 characters, or the panel refuses to start), every `/api/*` except `health`, `session`, `login` needs the session cookie (`HttpOnly`, `SameSite=Strict`, `Secure` when served over HTTPS). Constant-time password compare. Login rate limit 5/min/IP; with `PANEL_TRUST_PROXY=1` the IP is the **rightmost** `X-Forwarded-For` entry (the one the proxy added), so a spoofed header can't reset the limit | SEC-05, SEC-28 |
| CSRF | Mutating requests require header `X-Jarvis-Panel: 1` (a cross-site form or `<img>` can't set it) plus `SameSite=Strict` | SEC-05 |
| Browser hardening | CSP `default-src 'self'`, no inline scripts, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` | SEC-05 |
| Allowlist / file access | Memory names checked against a fixed allowlist (no path traversal); static files only from `public/`; `AGENTS.md`/`TOOLS.md` read-only; request body size limit | SEC-08, SEC-12 |
| Secrets | Never returns env vars or `.env`; `panel/.env` mode 600, gitignored; adapter keys only in env | SEC-17, SEC-18, SEC-19 |
| Irreversible actions | Approvals expire in 5 min, bound to an args hash, one use. The 5 min is a hard ceiling from `created_at` (itself capped at the file's mtime), so a pending file can't extend its own life with a far `expires_at` | SEC-14, SEC-16 |
| Permission bypass | No adapter passes `--dangerously-skip-permissions`, `bypassPermissions` or `danger-full-access` | SEC-10 |
| Audit | Every mutating call → `logs/audit.jsonl`, redacted | SEC-29 |
| Dependencies | Two server deps, exact versions + `npm ci` | SEC-25, SEC-26 |
| Credential | `claude-cli` uses whatever `auth-matrix.md` allows for runtime × host | SEC-30 |

Validator checks the Architect can run on a built Jarvis:

```bash
# SEC-05: no non-loopback bind without a password
grep -Eq '^PANEL_HOST=(127\.0\.0\.1|localhost|::1)?$' panel/.env || grep -Eq '^PANEL_PASSWORD=.{12,}' panel/.env
# SEC-10: no bypass flags anywhere in the panel
! grep -RInE 'dangerously-skip-permissions|bypassPermissions|danger-full-access' panel/src
# SEC-07/09 + poller (claude-cli on claude-code-local): panel runs get the headless settings
[ "$(grep -E '^PANEL_ADAPTER=' panel/.env | cut -d= -f2)" != "claude-cli" ] || test -f .claude/headless-settings.json || grep -Eq '^CLAUDE_SETTINGS_FILE=.+' panel/.env
# SEC-17: .env not world-readable and ignored
[ "$(stat -f %Lp panel/.env 2>/dev/null || stat -c %a panel/.env)" = "600" ] && git check-ignore -q panel/.env
```

## Verify

> Windows PowerShell: `curl` is an alias of `Invoke-WebRequest` in PowerShell 5.1. Use `curl.exe -fsS …` or `Invoke-RestMethod http://127.0.0.1:7878/api/health` for every command below.

```bash
curl -fsS http://127.0.0.1:7878/api/health                         # {"ok":true,...}
curl -fsS http://127.0.0.1:7878/api/session                        # auth_required true/false as configured
curl -sI http://127.0.0.1:7878/ | grep -i 'content-security-policy' # headers present
# CSRF: a mutating call without the header must fail (expect 403)
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:7878/api/jobs/briefing/run \
  -H 'content-type: application/json' -d '{"confirm":true}')" = "403"
# Not reachable from the LAN (run from another device, or with the machine's LAN IP): must fail
! curl -fsS --max-time 3 "http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}'):7878/api/health"
```

When `PANEL_PASSWORD` is set, the CSRF check may answer 401 first; both mean "blocked".

## Remote access (phone, another laptop)

1. Install Tailscale on the Jarvis machine and the phone, same tailnet.
2. On the Jarvis machine: `tailscale serve --bg 7878` — shares `http://127.0.0.1:7878` over HTTPS
   inside the tailnet only. Check with `tailscale serve status`; stop with `tailscale serve reset`
   (or the same command with `off`) ([tailscale serve CLI](https://tailscale.com/kb/1242/tailscale-serve),
   [serve overview](https://tailscale.com/kb/1312/serve)).
3. The panel stays on `127.0.0.1`; `tailscale serve` proxies to it. Set `PANEL_PASSWORD` anyway
   (defence in depth: anyone on the tailnet could otherwise open it). Add the machine's tailnet
   name to `PANEL_ALLOWED_HOSTS` (e.g. `mi-mac.tailnet-xyz.ts.net`): the panel's DNS-rebinding
   guard answers 421 "Host no permitido" to any other `Host` header. (Assumes `tailscale serve`
   forwards the original `Host`; if the panel still answers 421, check the `Host` it receives.)
4. Never `tailscale funnel` the panel: Funnel is public internet and is only for webhook paths
   (SEC-05; [funnel](https://tailscale.com/kb/1223/funnel)).
5. Claude Code runtimes: Remote Control in the Claude app is the official alternative for chatting
   from the phone; it needs the claude.ai login and doesn't show approvals or memory.

## Sources

- Claude Code headless / `stream-json` / `--resume` / permission modes / bare mode: https://code.claude.com/docs/en/headless (checked 2026-10-06)
- Claude Code CLI flags: https://code.claude.com/docs/en/cli-reference
- Claude Code Remote Control (claude.ai login only): https://code.claude.com/docs/en/remote-control
- Hermes API server (`API_SERVER_ENABLED`, `API_SERVER_HOST` default `127.0.0.1`, `API_SERVER_PORT` default `8642`, `API_SERVER_KEY` required, Bearer auth, SSE): https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server (checked 2026-10-06)
- Hermes web dashboard (`hermes dashboard`, `127.0.0.1:9119`, reads/writes `.env`, password auth not for public internet): https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard (checked 2026-10-06)
- Hermes Docker ports 8642/9119: https://hermes-agent.nousresearch.com/docs/user-guide/docker
- OpenClaw Control UI (`127.0.0.1:18789`, gateway auth, Tailscale Serve recommended): https://docs.openclaw.ai/web/control-ui (checked 2026-10-06)
- OpenClaw CVE-2026-25253: https://github.com/advisories/GHSA-g8p2-7wf7-98mq · https://osv.dev/vulnerability/CVE-2026-25253
- Codex non-interactive mode (`codex exec --json`, sandbox, resume): https://learn.chatgpt.com/docs/non-interactive-mode (checked 2026-10-06)
- Ollama OpenAI compatibility (`/v1` on port 11434): https://docs.ollama.com/api/openai-compatibility
- Open WebUI: https://docs.openwebui.com
- Tailscale Serve CLI (`--bg`, `status`, `reset`): https://tailscale.com/kb/1242/tailscale-serve · https://tailscale.com/kb/1312/serve · Funnel: https://tailscale.com/kb/1223/funnel (checked 2026-10-06)
- Railway private networking / Tier B: https://docs.railway.com/networking/private-networking/how-it-works · `capabilities/deploy-railway.md`
- Hono / @hono/node-server (panel server): https://hono.dev · https://www.npmjs.com/package/@hono/node-server
