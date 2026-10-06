# Capability: Deploy on Railway

> How to put a Jarvis on Railway so it runs 24/7 without the person's computer: the plan, login, project, service and volume, sealed variables, `.railway/railway.ts`, restart policy, backups, spend limit and liveness. Written so a non-technical person can follow every click.

Last verified: 2026-10-06

No versions live here. Runtime image tags, CLI minimums and security floors are in
`knowledge/runtimes/<id>.md`. Hosting prices and per-runtime monthly estimates are in
`knowledge/capabilities/costs.md`; the plan prices below are only what the person needs to see
before they pay. The local alternative is `knowledge/capabilities/deploy-local.md`.

## Decision rule

Apply top to bottom. The first BLOCK row wins.

| If… | Then… | Why (one line for the person) |
|---|---|---|
| Runtime is `ollama-local` or any local model | **Not Railway** → `deploy-local.md` (CMP-01) | Railway has no GPUs; a local model there is slow and expensive |
| Runtime is `cowork` or `claude-code-local` | **Not Railway** | They run on the person's own computer by design |
| The person only has the Free or Trial plan | **Upgrade to Hobby first**, or stay local (CMP-10) | Free/Trial can't use the `Always` restart and get a 0.5 GB volume: fine for a demo, not for 24/7 |
| One owner, chat only (Telegram polling, Discord, Slack Socket Mode, Hermes/OpenClaw gateway, `claude-agent-sdk` worker, `claude-code-server`) | **Tier A**: one service + one volume, **no public domain** | Nothing is exposed to the internet, cheapest, fewest moving parts |
| Needs an inbound webhook (WhatsApp Cloud API, Twilio voice, Telegram webhook) | Tier A **plus a generated domain** on that one service, with secret/signature validation on the webhook route | Meta/Twilio must be able to reach Jarvis; the secret proves the call is genuine |
| Needs a web dashboard, semantic search over documents (pgvector), or several services sharing memory | **Tier B**: `jarvis-core` worker + `jarvis-web` + pgvector template + backup cron (+ optional Tailscale) | Splits what faces the internet from what holds the memory and the keys |
| Dashboard or API must be reachable but not public | Tier B + **Tailscale** (subnet router or Tailscale-in-container template), no public domain on the dashboard | Only the person's own devices can open it |

Defaults to say out loud in `/jarvis-quick`: *"Tu Jarvis vive en Railway (plan Hobby), en un solo
servicio con un disco para su memoria, sin dirección pública. Se reinicia solo si se cae, guarda
copia diaria de su memoria y le pongo un tope de gasto antes de encenderlo."*

Region: LATAM → **US East Metal** (Virginia, identifier `us-east4-eqdc4a`, the closest to MX/CO/AR);
Spain → **EU West Metal** (Amsterdam, `europe-west4-drams3a`), which also keeps data in the EU for
GDPR. Railway has no South-America region today; the region is picked per service in **Settings**
and the default comes from the account's preferred region
([regions](https://docs.railway.com/deployments/regions)). Changing region later on a service with a
volume migrates the volume and causes downtime, so choose it before the first deploy. The data-law warning per country is in
`knowledge/countries/<cc>.md`.

---

## 1. What Railway is, in two lines for the person

*"Railway es una computadora en la nube que alquilas por uso. Tu Jarvis corre ahí día y noche;
tú pagas una cuota base de Hobby que ya incluye algo de uso, y lo que pase de eso."*

Platform terms to explain the first time, half a line each:

| Term | Half-line explanation (translate to the person's language) |
|---|---|
| Project | The folder in Railway that holds everything of this Jarvis |
| Service | One running program (Jarvis itself, a database, a backup job) |
| Volume | Jarvis's hard disk: what is written there survives restarts and redeploys |
| Variable | A setting the program reads at start (keys, IDs). **Sealed** = nobody can read it back, not even you |
| Deploy | Railway builds and starts the new version |
| Domain | A public web address. Tier A has none on purpose |

## 2. Plans (what the person pays Railway)

Source: [docs.railway.com/pricing/plans](https://docs.railway.com/pricing/plans),
[restart policy](https://docs.railway.com/deployments/restart-policy),
[volumes reference](https://docs.railway.com/volumes/reference), checked 2026-10-06.

| Plan | Subscription | Included usage | RAM / service | Default volume | `Always` restart | Use for a Jarvis |
|---|---|---|---|---|---|---|
| Trial | $0, one-time $5 credit | — | 1 GB | 0.5 GB | No (On Failure, max 10) | Demo only |
| Free | $0 | $1 / month | 0.5 GB | 0.5 GB | No (On Failure, max 10) | Demo only (CMP-10) |
| **Hobby** | **$5 / month** | **$5 of usage** | up to 48 GB | **5 GB** (resizable up) | **Yes** | **Default** |
| Pro | $20 / month | $20 of usage | up to 1 TB | 50 GB | Yes | Only if a team/workspace is needed |

What to tell the person, plainly:

- Hobby is **not free**: the $5 is charged even if unused, and it counts toward usage. The bill is
  `max($5, usage)` ([plans FAQ](https://docs.railway.com/pricing/plans)).
- Railway needs a **post-paid card**; prepaid credit is no longer accepted (same page).
- The Jarvis's main cost is usually the **model provider**, not Railway → `capabilities/costs.md`.
- If they stop paying, volume data is deleted after 60 days on Hobby (same page).

**RAM sizing** (feeds CMP-21; dollar estimates per runtime are in `capabilities/costs.md`):

| Runtime on Railway | Plan RAM to allow | Note |
|---|---|---|
| Lean custom worker / `claude-p-cron` style job | ~0.25 GB | Fits easily |
| `claude-agent-sdk` worker | ~0.5 GB | Spawns a CLI subprocess per query |
| `hermes` gateway | ~1 GB | One gateway per data volume, 1 replica (CMP-11) |
| `openclaw` gateway | **≥ 1 GB running, ≥ 2 GB during build** | Below that it is OOM-killed (CMP-21) |
| `claude-code-server` (Claude Code kept alive) | ≥ 1 GB **plus a memory cap and `Always` restart** | Known idle memory leaks; cap with *Replica Limits* (CMP-22) |

Memory cap = service **Settings → Deploy → Replica Limits** ([cost control](https://docs.railway.com/pricing/cost-control)).
Set it a bit above the expected figure; too low makes the service crash-loop.

## 3. Step by step

Every step that touches the person's account or money is a `"kind": "user_action"` task in
`.jarvis/tasks.json` and needs a **yes in the same turn** (architect rule 8). The Architect prefers
the **Railway MCP** for creating resources, the **CLI** for `railway up` and `railway config apply`,
and the **dashboard** as the always-available fallback.

### 3.0 Install the CLI (if preflight showed no `railway`)

Package manager only, version per `stack-researcher` at install time
([CLI docs](https://docs.railway.com/cli)):

| OS | Command (person approves the prompt) |
|---|---|
| macOS / Linux with Homebrew | `brew install railway` |
| Any OS with Node | `npm install -g @railway/cli@<version>` |
| Windows | npm, after Node LTS is installed as a `user_action`: `winget install --id OpenJS.NodeJS.LTS -e` (UAC prompt, then reopen the terminal). Node is needed anyway for the IaC SDK in § 3.6. `scoop install railway` only if Scoop already exists: its installer is `irm … \| iex`, which rule 9 forbids, so if they want Scoop, download `get.scoop.sh` to `.jarvis/cache/`, show `Get-FileHash` and the first lines, and the person runs it. The docs list no winget method for Railway (UNVERIFIED) |
| No CLI at all (non-technical, Windows) | The **Railway MCP** (§ 3.3, needs only the browser login) or the dashboard for every step, with the IaC file applied later by `/jarvis-add` or skipped: record each dashboard setting in `RUNBOOK.md` |

Never `bash <(curl … install.sh)` and never `curl -fsSL agents.railway.com | sh` from the agent.
If the person insists on the vendor script: download to `.jarvis/cache/`, show `shasum -a 256` and
the first 20 lines, and they run it themselves (architect rule 9).

Verify: `railway --version` exits 0.

### 3.1 Account and plan (user_action)

1. Open https://railway.com and sign in with GitHub or email.
2. Go to **Workspace → Plans** (or the upgrade banner) and choose **Hobby**. Add the card.
3. In **Account Settings**, set the preferred region (see the decision rule).

Postcondition: the person confirms the plan says Hobby. The Architect cannot see billing.

### 3.2 Log in the CLI (user_action)

The person runs, in the Claude Code prompt: `! railway login` — a browser opens, they approve.
On a machine without a browser: `! railway login --browserless` (shows a code to type at a URL).

Verify: `railway whoami` exits 0 (prints the account e-mail; do not repeat it in chat).

Never ask for, store or use a `RAILWAY_TOKEN` / `RAILWAY_API_TOKEN` for the guided deploy; those are
for CI only ([CLI auth](https://docs.railway.com/cli)).

### 3.3 Connect the Railway MCP (optional, recommended)

`railway setup agent` (or `railway mcp install --agent claude-code`) writes the MCP entry and
reuses the `railway login` session; no long-lived credential lands in the editor config. Connecting
through the CLI needs a recent CLI (minimum in the docs)
([MCP server](https://docs.railway.com/ai/mcp-server)). If the MCP is not connected, every step
below has a CLI or dashboard equivalent — never block on it (architect rule 13).

Destructive MCP tools (`accept-deploy`, `redeploy`, `railway-agent`, any delete/remove) are flagged
at protocol level: show what they will do and wait for a yes. Never pass a secret value to
`set-variables` — the value would travel through the conversation.

### 3.4 Project, service and volume

| Action | MCP tool | CLI | Dashboard |
|---|---|---|---|
| Create project `jarvis-<name>` | `create-project` | `railway init` | **New Project → Empty project** |
| Create service `jarvis` (Tier A) / `jarvis-core` (Tier B) | `create-service` | via `railway config apply` (§3.6) or `railway add` | **+ Create → Empty service** |
| Point it at code | `connect-service-source` (GitHub repo) or image | `railway up --detach` from the Jarvis folder | Service → **Settings → Source** |
| Volume `jarvis-data` mounted at the runtime's data path | `create-volume` | `railway volume add` | Right-click service → **Attach volume** |

Changes made in the dashboard are **staged**: the person clicks **Deploy** on the banner to apply
them ([staged changes](https://docs.railway.com/deployments/staged-changes)).

Mount path per runtime (exact values in each runtime file):

| Runtime | Volume mount | Source |
|---|---|---|
| `hermes` | `/opt/data` (one gateway per volume, CMP-11) | [Hermes Docker docs](https://hermes-agent.nousresearch.com/docs/user-guide/docker) |
| `openclaw` | `/data`, with state and workspace dirs under it | [OpenClaw on Railway](https://docs.openclaw.ai/install/railway) |
| `claude-agent-sdk`, `claude-code-server`, custom | `/data`, with `JARVIS_HOME=/data` and the workspace files under it | `runtimes/claude-agent-sdk.md`, `runtimes/claude-code-server.md` |

### 3.5 Variables: sealed, typed by the person

Rule: **the Architect never sees a secret** (architect rule 7). The person enters each value; the
Architect only checks that the variable *exists*.

1. The Architect lists the variable **names** from `.env.example` (e.g. `ANTHROPIC_API_KEY`,
   `TELEGRAM_BOT_TOKEN`, the owner allowlist ID) and says which are secrets.
2. The person opens the service → **Variables → New Variable** (or **Raw Editor**), pastes each
   value, and saves.
3. For every secret: **⋮ menu on the variable → Seal**. Sealed values are never shown in the UI,
   are not returned by `railway variable list` or `railway run`, and are not copied to PR
   environments or duplicated services. **Sealing cannot be undone**; to change a sealed value, use
   **⋮ → Edit** on that variable (sealed variables cannot be edited from the Raw Editor)
   ([variables](https://docs.railway.com/variables#sealed-variables)).
   Never commit a filled `.env` to the repo: Railway scans `.env*` files in a connected repo and
   suggests them as variables ([variables](https://docs.railway.com/variables#suggested-variables)).
4. Click **Deploy** on the staged-changes banner.

CLI alternative (person, in **their own separate terminal**, not through `!` and not through the
agent, so the value never enters the conversation or shell history):
`railway variable set ANTHROPIC_API_KEY --stdin` → paste → Enter → Ctrl-D (Windows PowerShell: Ctrl-Z, then Enter)
([railway variable](https://docs.railway.com/cli/variable)). Then seal it in the dashboard (whether
the CLI or IaC can seal is UNVERIFIED — assume dashboard only).

Do **not** use `railway variable set KEY=value` for secrets: the value ends up in shell history.

Verify (presence only, never values): `railway variable list --json | jq -e 'has("TELEGRAM_BOT_TOKEN")'`
— sealed variables are omitted from CLI output, so for sealed ones the postcondition is the person
confirming they see the lock icon. UNVERIFIED: whether sealed keys appear with a blank value or not
at all in `--json`; prefer the person's confirmation.

Non-secret settings (`TZ`, `JARVIS_HOME`, model slot IDs from `models.json`) may be literal values
in `.railway/railway.ts`. Railway also injects `PORT`, `RAILWAY_PUBLIC_DOMAIN`,
`RAILWAY_PRIVATE_DOMAIN`, `RAILWAY_VOLUME_MOUNT_PATH`.

### 3.6 Infrastructure as Code: `.railway/railway.ts`

`railway.json` / `railway.toml` (Config as Code) are **deprecated**: new services cannot use them
and existing files **stop being read on 2026-12-01** (hard cutoff). Generate `.railway/railway.ts`
instead (CMP-13) ([config-as-code](https://docs.railway.com/config-as-code),
[IaC](https://docs.railway.com/infrastructure-as-code)).

```bash
npm install --save-dev railway@<version>   # the IaC SDK; version via stack-researcher
railway link                                # pick the project + environment
railway config plan --out .jarvis/cache/railway-plan.json   # read-only diff, values shown as «hidden»
railway config apply --plan .jarvis/cache/railway-plan.json --yes   # applies exactly that plan
```

How the Architect runs it:

1. Generate the file from `templates/railway/` (Tier A or B) into the Jarvis repo.
2. Run `railway config plan --out …` and show the person a **one-line summary** of the diff
   ("Crea 1 servicio y 1 disco, sin borrar nada").
3. **Stop on any destructive line** (delete service/variable/volume, shrink/detach volume, change
   volume placement). Without a partial, one file describes the whole environment and **a resource
   missing from the file gets deleted**. Both templates therefore export
   `export const partial = "jarvis"`: the file then only deletes resources it owns, and a dashboard
   or MCP addition is left alone ([multi-repo projects](https://docs.railway.com/infrastructure-as-code#multi-repo-projects)).
   Once any partial exists in an environment, every IaC file for it must export one.
4. With a yes, apply **the saved plan** (`--plan … --yes`), so what runs is exactly what the person
   approved; if the environment changed in between, apply refuses and you re-plan. From an agent
   session `apply` is non-interactive, and destructive changes additionally need
   `--confirm-destructive`: never pass it without a yes that names the resource being destroyed.
5. Railway does **not** read `.railway/` during deploys; every config change needs a new
   `plan → apply`.

Tier A sketch (the template in `templates/railway/` is the source of truth):

```ts
// .railway/railway.ts
import { defineRailway, project, service, volume, image, preserve } from "railway/iac";

export const partial = "jarvis";           // only resources declared here can be deleted by apply

export default defineRailway(() => {
  const data = volume("jarvis-data", { sizeMB: 1024 });
  const jarvis = service("jarvis", {
    // image tag + digest come ONLY from knowledge/runtimes/<id>.md § Pinned versions
    source: image("<registry>/<runtime-image>:<pinned-tag>@sha256:<digest>",
                  { autoUpdates: { type: "disabled" } }),
    start: "<start command from the runtime file>",
    volumeMounts: { "/data": data },        // Hermes: "/opt/data"
    env: {
      TZ: "America/Mexico_City",            // from the country pack
      JARVIS_HOME: "/data",
      ANTHROPIC_API_KEY: preserve(),        // keep the sealed value already in Railway
      TELEGRAM_BOT_TOKEN: preserve(),
      OWNER_ALLOWLIST: preserve(),          // name per runtime file
    },
  });
  return project("jarvis-<name>", { resources: [jarvis, data] });
});
```

`preserve()` = "keep the value already set in Railway"; secrets never enter the repo. Healthcheck
(`healthcheck: "/health"`, `healthcheckTimeout`) is supported in IaC; add it only when the runtime
serves HTTP ([IaC reference](https://docs.railway.com/infrastructure-as-code/reference)).

**Not in the IaC reference** (set in the dashboard or with the MCP `update-service` tool, then
record it in `RUNBOOK.md`): restart policy, serverless toggle, replica limits (memory cap), volume
backup schedule. UNVERIFIED whether IaC gains these later; `/jarvis-refresh` re-checks.

### 3.7 Restart policy, serverless, replicas

| Setting | Value | Where |
|---|---|---|
| Restart policy | **Always** (Hobby+; default is On Failure, max 10) | Service → Settings → Deploy → Restart Policy |
| Serverless (app sleeping) | **Off** (CMP-23) | Service → Settings → Deploy → Serverless |
| Replicas | **1** — volumes forbid replicas (CMP-33) | default |
| Replica Limits (memory cap) | Per §2 RAM table; mandatory for `claude-code-server` (CMP-22) | Service → Settings → Deploy → Replica Limits |

### 3.8 Backups (user_action, 1 minute)

Service → **Backups** tab → enable **Daily** (kept 6 days) and **Weekly** (kept 27 days); add
**Monthly** (kept 89 days) for packs with business records
([backups](https://docs.railway.com/volumes/backups)). Billed incrementally at volume rates.

Caveats to say: wiping a volume deletes its backups; restores only into the same project and
environment; manual backups limited to 50% of volume size. Therefore also keep an **off-Railway
copy**: the workspace markdown in a private git repo (weekly push by a scheduled job) and, in
Tier B, the `pg_dump` cron to a bucket. Restore path goes in `RUNBOOK.md`.

### 3.9 Spend limit: Cost Control (user_action, before the first deploy)

Workspace → **Usage → Set Usage Limits**
([cost control](https://docs.railway.com/pricing/cost-control)), or
`railway usage limit set --target workspace --soft <alert> --hard <limit>`:

- **Custom email alert** (soft): around the expected monthly bill from `costs.md`.
- **Hard limit**: minimum allowed is **$10**. Suggest roughly 2× the expected bill. Warn plainly:
  when it is reached Railway **shuts the Jarvis down** until the limit is raised (Railway then
  redeploys the stopped services; if that fails, redeploy from the deployment's ⋮ menu). Railway
  emails at 75%, 90% and 100% of the hard limit.
- **Agent usage** (Railway's own AI agent) is a separate limit, default $5 on Hobby; leave it.

The **model-provider** spend cap (Anthropic Console, OpenAI, OpenRouter) is a separate user_action
and also comes before the first model call (SEC-27).

### 3.10 Deploy and liveness

1. Deploy: `railway up --detach` (code from the folder) or the apply/redeploy from the image source.
   Needs a yes (it costs money).
2. Watch: `railway logs` (or MCP `get-logs`, `get-deployment-diagnosis` on failure). Summarise in
   one line; never paste raw logs.
3. **Healthcheck runs only at deploy time.** Railway queries the path until 2xx, then stops
   watching ([healthchecks](https://docs.railway.com/deployments/healthchecks)). It is not
   monitoring (CMP-12). Default wait 300 s; requests come from `healthcheck.railway.app` — allow
   that host if the app filters by hostname. Pure workers (polling bots, outbound gateways) skip it.
4. **Ongoing liveness = heartbeat to the owner.** A scheduled job inside the runtime sends the owner
   a short daily message on the main channel ("☀️ Sigo vivo · memoria 12 MB · gasto del mes $4.10")
   → `capabilities/scheduling.md`. No message by the expected time = something is wrong → run
   `/jarvis-doctor`.
5. Optional external monitor for Tier B web services: an uptime monitor outside the project
   (Railway docs point to an Uptime Kuma template — community-maintained, vet it first, §5).
6. Re-run the smoke test from `questions/4-construir.md` against the deployed service, including
   the allowlist rejection test.

Volumes are attached only **one deployment at a time**, so every redeploy has a short downtime even
with a healthcheck. Tell the person: *"Cuando lo actualizo, tu Jarvis se desconecta unos segundos."*

## 4. Tier A vs Tier B

### Tier A — default (one service + volume, no domain)

```
[ jarvis ] ── volume /data (workspace, SQLite, sessions)
   │ outbound only: Telegram long polling / Discord / Slack Socket Mode / model API
```

- Gateway, scheduler and memory in one process. Proactive jobs use the runtime's own scheduler
  inside the always-on service (not Railway cron) → `capabilities/scheduling.md`.
- Telegram: **long polling**, no domain needed
  ([Railway bot guide](https://docs.railway.com/guides/ai-discord-telegram-bot)).
- Webhook variant: **Settings → Networking → Generate Domain** (MCP `generate-domain`) on this one
  service only, and the webhook route must check the provider's secret/signature (Telegram
  `X-Telegram-Bot-Api-Secret-Token`, Meta `X-Hub-Signature-256`) → `capabilities/channels.md`,
  `capabilities/whatsapp.md`.

### Tier B — "pro Jarvis"

```
[ jarvis-web ] ──public domain (webhooks / dashboard behind auth or Tailscale)
      │ private network: jarvis-core.railway.internal
[ jarvis-core ] ── volume (workspace)        keys + agent loop + scheduler
      │ ${{pgvector.DATABASE_URL_PRIVATE}} (private)
[ pgvector ] (Railway pgvector template)    semantic memory → capabilities/memory.md
[ backup-cron ] 0 8 * * * UTC → pg_dump → bucket, then exits
[ tailscale ] (optional) dashboard/API only on the owner's tailnet
```

| Service | Notes |
|---|---|
| `jarvis-core` | Worker with the volume and the sealed model/channel keys. No public domain |
| `jarvis-web` | Only public service. Holds no model keys; forwards to core over `*.railway.internal`. Environments created before 2025-10-16 are IPv6-only on the private network — bind to `::` ([private networking](https://docs.railway.com/networking/private-networking/how-it-works)) |
| pgvector | **Railway's standard Postgres has no pgvector**; deploy the pgvector template ([guide](https://docs.railway.com/guides/rag-pipeline-pgvector)). In that template `DATABASE_URL` is the **public** TCP-proxy URL and `DATABASE_URL_PRIVATE` the private one: reference `DATABASE_URL_PRIVATE` only and remove the template's TCP proxy (no egress cost, not exposed; checked with Railway's template description 2026-10-06, see `templates/railway/README.md`) |
| `backup-cron` | Railway cron: 5-field crontab in **UTC**, runs ≥ 5 min apart, overlapping runs are skipped, the process must exit ([cron jobs](https://docs.railway.com/cron-jobs)). Convert the person's local time to UTC and say both |
| Tailscale (optional) | Userspace templates (`tailscale-subnet-router`, `hermes-gateway-via-tailscale`) need no NET_ADMIN. Community-maintained — §5 |

Tier B costs more (extra services, Postgres RAM) → quote it from `capabilities/costs.md` before the
gate.

### HTTP timeouts (any service with a domain)

Railway closes an HTTP request after **5 minutes with no data** and after **15 minutes maximum**
even while data flows; WebSockets are exempt
([streaming guide](https://docs.railway.com/guides/ai-chatbot-streaming#streaming-and-railways-request-timeouts)).
Agent turns can be long, so webhook handlers **answer 200 immediately** and process in the
background, then reply through the channel API. Never hold a webhook open while the model works.

## 5. Community templates: optional, vetted, never the default

Railway's marketplace has one-click templates for OpenClaw, Hermes, the Agent SDK, n8n, WAHA and
Tailscale. **None are verified by Railway**; they can change underneath the person. The Architect
deploys from its own `.railway/railway.ts` with an image pinned to the tag + digest in
`runtimes/<id>.md`.

Offer a template only as a "one-click alternative" when the person asks, and only after:

| Check | How |
|---|---|
| Maintainer and activity | MCP `describe-template`: publisher, deploy count, last update |
| Image | Pinned tag/digest at or above the runtime's security floor (CMP-03 for OpenClaw); never `latest` |
| Exposure | No public port for gateways/control UIs (CMP-04); dashboards behind a token or Tailscale |
| Credentials | Uses API keys. Reject templates that advertise "no API keys" for a Claude harness — that means subscription login in a hosted harness (CMP-02, `auth-matrix.md`) |
| WhatsApp | Unofficial bridges (WAHA, Baileys) only with logged consent + secondary number (CMP-05) |
| After deploy | Re-apply every control here: sealed vars, `Always`, backups, usage limit, allowlist test |

## 6. Setup notes per runtime

| Runtime | Railway notes (details and pins in the runtime file) |
|---|---|
| `hermes` | Official image, `gateway run`, volume at `/opt/data`, exactly **1 replica** and one gateway per volume (CMP-11). Outbound-only → Tier A without a domain, unless WhatsApp Cloud API needs a webhook → `runtimes/hermes.md` |
| `openclaw` | Gateway token required, Control UI never public (CMP-04), ≥ 1 GB RAM / 2 GB build (CMP-21), version ≥ floor (CMP-03) → `runtimes/openclaw.md` |
| `claude-agent-sdk` | `ANTHROPIC_API_KEY` only (CMP-02). Scope `allowedTools`; never bypass permissions on a service with a domain → `runtimes/claude-agent-sdk.md` |
| `claude-code-server` | Default credential `ANTHROPIC_API_KEY`; the owner's own subscription (`/login` on the volume or `CLAUDE_CODE_OAUTH_TOKEN`) is a flagged alternative, only with the owner's explicit consent, per `auth-matrix.md` (CMP-28, CMP-29). Memory cap + `Always` (CMP-22) → `runtimes/claude-code-server.md` |
| `claude-p-cron` | Usually local. On Railway: a cron service that exits; long runs on a tight schedule silently skip ticks → `runtimes/claude-p-cron.md` |
| `codex-openai` | `OPENAI_API_KEY`, Responses API (CMP-16) → `runtimes/codex-openai.md` |
| `ollama-local`, `cowork`, `claude-code-local` | Not on Railway |

## 7. Volume caveats (say them before the gate)

- Mounted **when the container starts**, not during the build or the pre-deploy command: anything
  written to the mount path then is lost. Seed workspace files on first start, not in the
  Dockerfile ([volume availability](https://docs.railway.com/volumes#volume-availability)).
- Images that run as a non-root user get permission errors on the volume → set
  `RAILWAY_RUN_UID=0` ([volumes reference](https://docs.railway.com/volumes/reference)). This runs
  the process as root inside its container, so the runtime's own sandbox (SEC-07) matters more.
- One volume per service; **no replicas** with a volume (CMP-33); short downtime on each redeploy.
- Volumes grow live but **cannot shrink**. Hobby default 5 GB. 3,000 read / 3,000 write IOPS.
- A deleted volume can be restored for **48 hours** via the e-mailed link; after that it is gone.
- Files: `railway volume browse` / `railway volume files`, or sftp/scp through `railway ssh`.
- SQLite in WAL mode must never be shared by two processes on different machines — one writer.

## Security

| Control | On Railway |
|---|---|
| SEC-01 Owner-only allowlist | Owner's stable ID in a variable; rejection test re-run after deploy |
| SEC-03 Webhooks verify origin | Webhook route checks the provider's secret/signature; Tier A without webhooks uses long polling |
| SEC-05 Control plane not public | Gateway/control UIs and dashboards never get a public domain; Tailscale or auth only |
| SEC-06 Railway exposure | Tier A has no domain. Only the webhook/web service gets one; DB and core use `*.railway.internal`; the pgvector reference is `DATABASE_URL_PRIVATE`, never a public DB URL (`DATABASE_PUBLIC_URL`, or the pgvector template's own `DATABASE_URL`), and the template's TCP proxy is removed ([lock down production](https://docs.railway.com/guides/lock-down-production-project)) |
| SEC-07 Sandbox / isolation | Container per service; the runtime's permission profile from its runtime file still applies |
| SEC-14 Approval for irreversible actions | The Architect asks before `railway up`, `config apply`, `accept-deploy`, `redeploy`, any delete; destructive IaC lines stop the flow |
| SEC-17 / SEC-18 Secrets | Sealed variables typed by the person; `preserve()` in IaC; never in the repo, `railway.ts`, prompts, memory, logs or chat; no shared variables unless every service needs them |
| SEC-20 No credentials in images/repos | Secrets only as Railway variables, never baked into the image or committed `.env` |
| SEC-24 / SEC-25 Supply chain | Images pinned by tag + digest at or above the floor in `runtimes/<id>.md`, `autoUpdates` disabled; community templates only after §5 |
| SEC-26 Safe install | CLI via package manager; never `curl … \| sh` from the agent |
| SEC-27 Cost | Railway usage limit + provider spend cap set **before** going live |
| SEC-29 Audit | App audit log on the volume; `railway logs` and deployment history as the change trail |
| SEC-30 Credential per auth matrix | Credentials per `auth-matrix.md`; one owner per Jarvis, never hosting for others (CMP-30) |
| SEC-31 Unofficial WhatsApp | WAHA/Baileys only with logged consent + secondary number (CMP-05) |
| SEC-33 Panic button | In `SECURITY.md`: `railway down` in the linked project (removes the latest deployment, asks to confirm), rotate keys at each provider, re-seal new values |

## Sources

All checked 2026-10-06 (Railway pages read through the Railway MCP `fetch-docs` tool).

- https://docs.railway.com/pricing/plans
- https://docs.railway.com/pricing/cost-control
- https://docs.railway.com/deployments/restart-policy
- https://docs.railway.com/deployments/healthchecks
- https://docs.railway.com/deployments/regions
- https://docs.railway.com/deployments/serverless
- https://docs.railway.com/deployments/staged-changes
- https://docs.railway.com/volumes/reference
- https://docs.railway.com/volumes/backups
- https://docs.railway.com/variables#sealed-variables · https://docs.railway.com/volumes#volume-availability
- https://docs.railway.com/cli/mcp · https://docs.railway.com/cli/down
- https://docs.railway.com/cli · https://docs.railway.com/cli/variable
- https://docs.railway.com/config-as-code
- https://docs.railway.com/infrastructure-as-code · https://docs.railway.com/infrastructure-as-code/reference
- https://docs.railway.com/ai/mcp-server
- https://docs.railway.com/cron-jobs
- https://docs.railway.com/networking/private-networking/how-it-works
- https://docs.railway.com/guides/rag-pipeline-pgvector
- https://docs.railway.com/guides/ai-discord-telegram-bot
- https://docs.railway.com/guides/ai-chatbot-streaming
- https://docs.railway.com/guides/lock-down-production-project
- https://hermes-agent.nousresearch.com/docs/user-guide/docker
- https://docs.openclaw.ai/install/railway
