# Railway templates (`.railway/railway.ts`)

> Two Infrastructure-as-Code templates the Architect renders into the person's Jarvis repo when the host is Railway: Tier A (one worker + one volume) and Tier B (private core, optional public web, pgvector, backup cron).

Last verified: 2026-10-06

Background, prices and every setting outside this file: `knowledge/capabilities/deploy-railway.md`.
Runtime-specific image, start command, data path and variable names: `knowledge/runtimes/<id>.md`.
This folder holds no versions, prices or secrets.

## Why `.railway/railway.ts` and not `railway.json`

Config as Code (`railway.json` / `railway.toml`) is deprecated. New services cannot use it, and
existing files **stop being read on 2026-12-01**. Infrastructure as Code in `.railway/railway.ts` is
the replacement, evaluated by the Railway CLI with `railway config plan` / `railway config apply`
([IaC](https://docs.railway.com/infrastructure-as-code)).

What was checked live on 2026-10-06 in the [IaC reference](https://docs.railway.com/infrastructure-as-code/reference):

| Used in the templates | Status |
|---|---|
| Package `railway` (`npm install railway`), import from `"railway/iac"` | Verified |
| `defineRailway`, `project(name, { resources })`, `export const partial` | Verified |
| `service(name, { source, build, start, healthcheck, healthcheckTimeout, preDeploy, replicas, env, volumeMounts, domains })` | Verified |
| `github("owner/repo", { branch, rootDirectory })`, `image("ref", { autoUpdates: { type: "disabled" } })` | Verified (`autoUpdates` only for Docker Hub and GHCR images) |
| `volume(name, { sizeMB, region })`, mounted with `volumeMounts: { "/path": vol }` | Verified |
| `preserve()` for values that already live in Railway | Verified |
| `<service>.env.RAILWAY_PRIVATE_DOMAIN`, `<db>.env.DATABASE_URL` | Verified |
| `bucket(name, { region })`, `group(name, [...])` | Verified |
| `postgres()`, `redis()` | Verified, but **not used**: Railway's standard Postgres has no pgvector |
| Cron schedule, restart policy, serverless toggle, memory limit, volume backups, sealed flag | **Not in the reference.** Set in the dashboard or with the Railway MCP `update-service` tool (`cronSchedule`, `restartPolicyType`, `sleepApplication`, `limits`) and record it in `RUNBOOK.md` |
| A template (e.g. pgvector) declared inside the file | **Not supported.** Deploy it separately (below) |
| Bucket credential accessors (`bucket.env.*`) | **Not in the reference.** Templates use `preserve()` plus the bucket's Credentials-tab presets. `/jarvis-refresh` re-checks the IaC reference ([docs.railway.com](https://docs.railway.com)) and switches to an accessor once one is documented |
| `service().tracing` | Documented as dropped by the SDKs today. Not used |

## Tier A or Tier B

| Signal from the interview | Template |
|---|---|
| One person, chat channels with long polling (Telegram, Discord), memory in files/SQLite | **Tier A** (default) |
| A webhook channel (WhatsApp Cloud API) and nothing else | **Tier A** with flag `webhook` (one generated domain on `{{webhook_port}}`) |
| Only a web UI / panel, no vector memory | **Tier B-lite**: `web` on (or the panel inside the core, `capabilities/web-ui.md`), `pgvector` and `backups` off |
| Hermes, OpenClaw, Agent SDK worker, `claude-code-server` with no webhooks | **Tier A** |
| Needs a webhook (WhatsApp Cloud API, Twilio voice, Telegram webhook mode) or a web dashboard | **Tier B** with `web` on |
| Semantic memory over documents (past ~200 lines of memory, or RAG over files) | **Tier B** |
| Ollama / local models, `cowork`, `claude-code-local`, `claude-p-cron` with the owner's login | **Not Railway** (`deploy-railway.md` §6) |

Tier B costs more (extra services, Postgres RAM). Quote it from `knowledge/capabilities/costs.md`
before the ARCHITECTURE gate.

## Why both templates export a partial

Without a partial, one file describes the whole environment and **a resource missing from the file
is deleted on apply**. Tier B needs pgvector, which comes from a template that the IaC file cannot
declare, so a whole-project file would try to delete it. With `export const partial = "jarvis"`, the
file only manages and deletes resources it declares, and the first apply claims ownership of them.
Tier A uses the same partial so that a later dashboard or MCP change is not wiped out by accident
([multi-repo projects](https://docs.railway.com/infrastructure-as-code#multi-repo-projects)).

Rule: once any partial exists in an environment, every IaC file targeting that environment must
export one. One Jarvis = one Railway project, so this never conflicts.

## How the Architect renders a template

1. Copy the template to `<jarvis_dir>/.railway/railway.ts`.
2. **Conditional blocks.** Lines between `// @if:<flag>` and `// @end:<flag>` are kept only when the
   flag is true. Either way, the two marker lines are removed.
3. **Placeholders.** Replace every `{{name}}` with the value from the table below. Values come from
   `.jarvis/jarvis-spec.md` and `knowledge/`, never from memory.
4. **Leftover check.** The verify for this task must exit 0:
   `! grep -nE '\{\{|@if:|@end:' .railway/railway.ts`
5. `npm install --save-dev railway@<version>`. The version comes from `stack-researcher` on the day.
   This SDK version is a build dependency of the person's repo, so it is not pinned in `knowledge/`.
6. `railway link` (user_action), then `railway config plan --out .jarvis/cache/railway-plan.json`.
   Show a one-line summary of the diff. **Stop on any destructive line.**
7. With an explicit yes: `railway config apply --plan .jarvis/cache/railway-plan.json --yes`, so
   exactly the approved plan runs (an agent session is non-interactive, hence `--yes`). Never pass
   `--confirm-destructive` without a yes that names the resource being destroyed.
8. Drift check for `/jarvis-doctor`: `railway config plan --detailed-exit-code` exits 0 when nothing
   would change and 2 when changes are pending.

### Placeholders, both tiers

| Placeholder | Value | Source |
|---|---|---|
| `{{railway_project}}` | `jarvis-<name>`, the linked project's name | spec |
| `{{volume_name}}` | `jarvis-data` | default |
| `{{volume_size_mb}}` | `1024`. Volumes can grow later without data loss; shrinking is destructive | default |
| `{{data_mount}}` | `/data` by default. **Hermes: `/opt/data`** (its image sets `HERMES_HOME` there). OpenClaw: `/data` plus `OPENCLAW_STATE_DIR` / `OPENCLAW_WORKSPACE_DIR` in `plain_env` | `runtimes/<id>.md` § Run & supervise |
| `{{source}}` / `{{core_source}}` | Either `image("<ref>:<tag>@sha256:<digest>", { autoUpdates: { type: "disabled" } })` or `github("<owner>/<repo>", { branch: "main" })` (Tier B core: add `rootDirectory: "core"` when the repo has several services) | tag + digest from `runtimes/<id>.md` § Pinned versions, never `:latest` |
| `{{start_cmd}}` + flag `start` | The runtime's start command (e.g. Hermes `gateway run`). Flag off when the image's own CMD/ENTRYPOINT is correct | `runtimes/<id>.md` |
| flag `http` (Tier A) / `core_http` (Tier B) | On only when the process serves HTTP in the container | `runtimes/<id>.md` |
| `{{healthcheck_path}}`, `{{healthcheck_timeout}}` | e.g. `/health`, `120` (seconds) | runtime file |
| `{{timezone}}` | IANA zone, e.g. `America/Mexico_City` | `knowledge/countries/<cc>.md` |
| `{{plain_env}}` | Zero or more lines `KEY: "value",` holding **non-secret** settings: model slot IDs from `models.json`, runtime paths, `OPENCLAW_DISABLE_BONJOUR: "1"`, `RAILWAY_RUN_UID: "0"` only if the image runs as non-root and hits volume permission errors. Empty → remove the line | runtime file + spec |
| `{{secret_env}}` | One line `KEY: preserve(),` per secret: model API key, channel token, gateway token, owner allowlist. Names come from the runtime file's *Configure* section | runtime file + `auth-matrix.md` |

### Extra placeholders, Tier B

| Placeholder | Value |
|---|---|
| flag `web` | On when a webhook or dashboard is needed |
| flag `pgvector` | On only when `capabilities/memory.md` picked vector memory (RAG over documents, past ~200 lines). Off → no `DATABASE_URL`, skip step 1–2 below |
| flag `backups` | On only with `pgvector` (it dumps that database). Renders `templates/railway/backup/` into `<jarvis_dir>/backup/`. Volume backups (step 4) cover the core either way |
| `{{core_port}}` | Private port the core listens on, bound to `::` |
| `{{web_source}}`, `{{web_start_cmd}}` + flag `web_start` | Same rules as the core source |
| `{{web_healthcheck_path}}` | e.g. `/health` |
| flag `custom_domain`, `{{web_domain}}` | Only when the person owns a domain. Otherwise flag off and generate a Railway domain with MCP `generate-domain` (one service only: `jarvis-web`) |
| `{{web_plain_env}}`, `{{web_secret_env}}` | Same format. The web service gets webhook secrets and a dashboard token, **never** a model key |
| `{{bucket_region}}` | Region code from the Railway dashboard when the bucket is created. Immutable afterwards |
| `{{github_repo}}` | `<owner>/<private-jarvis-repo>`, which holds `backup/Dockerfile` and `backup/backup.sh` |
| `{{backup_retention_days}}` | `14` by default |
| `{{pg_dump_image}}` | `postgres:<major>-alpine@sha256:<digest>` for `backup/Dockerfile`; major ≥ the pgvector server's major. Pinned by `stack-researcher` on the day, never `:latest` |
| flag `webhook` (Tier A), `{{webhook_port}}` | On for a webhook channel. Port from the runtime file (Hermes WhatsApp Cloud: `8090`) |

## Tier B steps outside the file (each needs a yes, in this order)

Steps 1–3 apply only with flags `pgvector` / `backups`.

1. **pgvector.** Deploy Railway's pgvector template, code `3jJFCA`
   ([guide](https://docs.railway.com/guides/rag-pipeline-pgvector), deploy page
   `https://railway.com/deploy/3jJFCA`). Use MCP `describe-template` first, then `deploy-template`.
   Checked 2026-10-06 with `describe-template`: one service named `pgvector`, community image, not
   verified by Railway. The template **turns on a public TCP proxy**, and in it `DATABASE_URL` is the
   **public** URL while `DATABASE_URL_PRIVATE` is the private one.
   - Remove the TCP proxy (MCP `list-tcp-proxies` → `delete-tcp-proxy`, destructive → ask first).
   - Reference `DATABASE_URL_PRIVATE` only.
2. **References.** On `jarvis-core` and `backup-cron`, set `DATABASE_URL` as a reference to
   `pgvector` → `DATABASE_URL_PRIVATE` (dashboard: Variables → New → Reference, or MCP
   `set-variables` with the reference expression). On `backup-cron`, add the bucket's credential
   presets from its Credentials tab. The file keeps all of these with `preserve()`.
   **First apply order (always):** apply once, add the references and sealed secrets, then plan
   again. The second plan must show no variable deletions; if it lists any, stop, re-add them in the
   dashboard and plan again before applying.
3. **Cron.** `backup-cron` → MCP `update-service` `cronSchedule`, e.g. `0 8 * * *`. The schedule is
   **UTC**, so say the person's local time too. Runs are at least 5 minutes apart, overlapping runs
   are skipped, and the process must exit ([cron jobs](https://docs.railway.com/cron-jobs)).
4. **Core and web.** Restart policy `ALWAYS`, `sleepApplication: false`, memory limit per
   `deploy-railway.md` §3.7, volume backups on (Daily + Weekly).
5. **Usage limit** in Cost Control, before the first deploy (`deploy-railway.md` §3.9).

Tier A uses steps 4–5 only.

## Security notes (map to `knowledge/security-checklist.md`)

- Secrets: `preserve()` only. No secret value is ever written in the file. Plan output redacts
  values (`«hidden»`); never run `plan --show-values` in a session the agent can read.
- Exposure: Tier A has no domain. In Tier B, only `jarvis-web` is public and it carries no model key.
  The core, pgvector and the cron service talk over `*.railway.internal`.
- Images: pinned tag + digest, `autoUpdates: disabled`. Updates go through a reviewed plan, never
  silently.
- One volume, one replica: two gateways on one data directory corrupt state (CMP-11, CMP-33).
- Webhooks answer 200 immediately and process in the background (Railway cuts HTTP after 5 min idle,
  15 min max).

## Sources

- https://docs.railway.com/infrastructure-as-code (checked 2026-10-06)
- https://docs.railway.com/infrastructure-as-code/reference (checked 2026-10-06)
- https://docs.railway.com/config-as-code
- https://docs.railway.com/cron-jobs
- https://docs.railway.com/guides/rag-pipeline-pgvector
- https://docs.railway.com/guides/postgres-backups-restores
- https://docs.railway.com/volumes/reference
- https://docs.railway.com/networking/private-networking/how-it-works
- Railway MCP `describe-template` for code `3jJFCA` (2026-10-06)
