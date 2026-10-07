# Decision tree: profile → stack

> The spine of DEEP DIVE: how the Architect turns a locked profile (plus preflight) into one runtime, host, credential, model provider, memory and default channel, with a reason for each.

Last verified: 2026-10-06

**How to use this file.** Run § 2 top to bottom, once, and stop at the first rule that settles a slot.
Every later step can only *narrow* or *override with a stated reason*. Write each result to
`.jarvis/state.json → decision` with a one-line reason. Afterwards:

- the credential is read from `auth-matrix.md`
- model IDs come from `models.json`, never from here
- the result is checked against `compatibility.md`

This file holds **no versions and no unit prices**. Version floors live in `runtimes/<id>.md`,
prices in `models.json`, and total cost ranges in `capabilities/costs.md`. The cost ranges below
are rounded rough guides for light use. Re-quote from `capabilities/costs.md` before the
ARCHITECTURE gate.

---

## 1. Inputs

| Input | Where it comes from | Values used below |
|---|---|---|
| Profession pack | `questions/1-descubrimiento.md` signals | `creator` · `developer` · `founder` · `sales` · `student` · `lawyer-accountant` · `health` · `real-estate` · `smb-restaurant` · `ecommerce` · `coach` · `agency` · `teacher` |
| Channels (Q2) | discovery | Telegram · WhatsApp · Terminal / Claude app · Discord/Slack · Voice |
| 24/7 (Q3) | discovery | `cloud` · `while-on` (computer on only while working) · `always-on-box` (Mac mini or old PC that never sleeps) |
| Subscriptions (Q4) | discovery (**ask, don't detect**) | `claude-pro-max` · `chatgpt` · `has-api-key` (they say they have an Anthropic/OpenAI key) · `none-payg` · `none-min` |
| Budget (Q5) | discovery | `0` · `≤10` · `10–30` · `30–100` · `any` (USD/month **extra**, on top of plans they already pay; an existing Pro/Max or ChatGPT plan never counts against it) |
| Sensitivity (Q6) | discovery + pack | `normal` · `client-data` · `very-sensitive` · `local-only` |
| Technical level (Q7) | discovery | `none` · `terminal-ok` · `dev` |
| Country | conversation | `mx` · `co` · `ar` · `es` · `other` → `countries/<cc>.md` |
| Hardware and installed agents | `.jarvis/preflight.json` | `ram_gb`, `gpu.vram_gb`, `arch`, `os`, `agents.claude_auth`, `keys_present` |

**Derived hardware class** (the one table lives in `models.json` → `providers.local.hardware_classes`;
`questions/0-preflight.md` and `runtimes/ollama-local.md` use the same bands):

| Class | Rule | Meaning for local models |
|---|---|---|
| `HW-strong` | NVIDIA ≥24 GB VRAM, or Apple Silicon ≥32 GB unified memory | Medium-tier local models are workable |
| `HW-small` | NVIDIA 12–23 GB VRAM, or Apple Silicon 16–31 GB | Small-tier models only (e.g. a 9–12B model at 64K context): slower, shakier tool use, ≤5 tools. Say so and offer a hybrid |
| `HW-weak` | NVIDIA <12 GB VRAM (or none), or Apple Silicon <16 GB | Say plainly that local-only will be weak; offer a hybrid or cloud |

System RAM on a PC does not raise the class: a model that spills from VRAM to CPU is too slow for
an agent. Lots of RAM only keeps the rest of the machine usable.

---

## 2. Ordered decision procedure

### Step 0: hard filters (apply before anything else)

| If | Then |
|---|---|
| `os = windows` and the host will be local | Anything always-on or sandboxed runs under **WSL2**. See `capabilities/deploy-local.md`. |
| `os = macos`, `arch = x86_64`, and the candidate is `hermes` | Hermes has no native install on Intel Macs (vendor installation docs, see `runtimes/hermes.md`). Use its Docker image on that Mac (`terminal-ok`/`dev` only), `hermes` on Railway, or a different local runtime. |
| The person wants Jarvis to serve **other people** as a paid product | Out of scope for a personal Jarvis. Each end user needs their own credential (`auth-matrix.md`, column P). Stop and say so. |
| `agents.claude_auth = claude.ai` | They have *some* Claude paid plan. Still ask which one: preflight shows the login type, not the plan. |

### Step 1: privacy and local-first

| Profile | Decision |
|---|---|
| `local-only` + `HW-strong` | **runtime `ollama-local`** with harness **`hermes`** (record both, and read both runtime files). Host: local + supervisor. Credential: none. Channel: **terminal / local only**. Telegram and WhatsApp carry messages through third-party servers, so say that a "nothing leaves my computer" Jarvis can't use them. If they accept that tradeoff, Telegram becomes an add-on with consent logged. Then **skip to Step 6**. |
| `local-only` + `HW-small` / `HW-weak` | Say it in one line: "Con tu equipo, un Jarvis 100 % local va a ser lento y limitado." Offer the **hybrid**: `ollama-local` + `hermes`, where the local model handles anything sensitive and an API model (`cheap`/`main`) handles the rest, with no sensitive data in prompts. If they refuse the hybrid, build the local version with the class's model and list the limits as Non-Goals (Gate C logs "local-only tradeoffs accepted"). Channel: same as the row above (terminal / local only; Telegram only as a consented add-on). Host: local only, never Railway (no GPUs, `capabilities/deploy-railway.md`). Then **skip to Step 6**, like the row above. |
| `very-sensitive` (health, legal, third parties' finances), not local-only | Cloud models are allowed, but **memory stays local** (markdown + sqlite-vec on their machine). No patient, client or minor identifiers in long-term memory. The country data-law warning from `countries/<cc>.md` is required. Treat Pro/Max plans as **not** HIPAA/BAA-ready (`stack-researcher` re-checks Anthropic's BAA scope live before you quote it; guardrails in `professions/health.md`), so health data goes only through the API path the pack allows, or through the local model. Prefer a local host. **Override in Step 5:** if they need 24/7 and have no always-on box, Railway is allowed only after the Gate C consent "datos sensibles de terceros en la nube" (verbatim text and log format in `questions/3-confirmacion.md` § Gate C), in the region `countries/<cc>.md` § Data-protection law names; without that yes, the host stays local (`while-on`) and 24/7 becomes a Non-Goal. Continue to Step 2. |
| `client-data` | Continue. You will need a privacy notice and processor list later (`countries/<cc>.md`). Continue to Step 2. |
| `normal` | Continue to Step 2. |

### Step 2: existing subscriptions (use what they already pay for)

The credential is **not** chosen here. It is read from `auth-matrix.md` in Step 6. This step only
picks the runtime family that makes their subscription useful *legally*.

| Subscription | Candidate runtime | Why |
|---|---|---|
| `claude-pro-max` + host local (`while-on` or `always-on-box`) | **`claude-code-local`** | Costs nothing extra. The subscription is allowed only inside the unmodified `claude` binary used by its owner. |
| `claude-pro-max` + only scheduled outputs (briefings, reports), no chat | **`claude-p-cron`** on their machine | Simplest proactive Jarvis: one scheduled command, no session to keep alive. |
| `claude-pro-max` + `cloud` | Candidate **`hermes`** with an API key, or **`claude-code-server`** (API key by default). Decide in Steps 3–5. | The subscription cannot go into Hermes, OpenClaw or the Agent SDK as a product. On a server it is only the flagged, personal, best-effort alternative for `claude-code-server` (Gate C consent). |
| `chatgpt` + `dev` / `terminal-ok`, terminal use | **`codex-openai`** | ChatGPT sign-in inside Codex is the documented path. |
| `chatgpt` + `cloud` + Telegram (no Baileys, no phone apps) | No plan-based candidate: say in one line "tu ChatGPT Plus no sirve para un Jarvis en la nube por Telegram, salvo OpenClaw con Sign in with ChatGPT". Continue as `none-payg` (API key) | `auth-matrix.md`: a ChatGPT plan works only inside Codex, or SIWC inside OpenClaw. |
| `has-api-key` | No runtime yet; the provider slot prefers their provider (Step 6). A **new** dedicated, capped key is still created for the Jarvis (`capabilities/costs.md` §7): the existing one is never reused | Rule 7: never use credentials that happen to exist. |
| `chatgpt` + wants many channels / phone apps | Candidate **`openclaw`** | OpenClaw documents Codex login and Sign in with ChatGPT (preview) as well as an API key. On servers: SIWC with a VM host ID, or an API key (`auth-matrix.md`). |
| `none-payg` / `none-min` | No candidate yet | Continue. Pay-per-use API keys with a spend cap. `none-min` biases Step 5 toward local + cheapest slot. |

### Step 3: technical level, and when to recommend Cowork and stop

**Cowork stop rule.** Recommend **`cowork`** and **stop**, with nothing to install, when **all** of these hold:

1. They pay for a Claude plan (`claude-pro-max`).
2. Technical level is `none`.
3. Channels are only Terminal / Claude app. No Telegram, WhatsApp or Discord is required.
4. Sensitivity is not `local-only`, and they don't need local models.
5. The week-one jobs fit connectors plus scheduled tasks: email, calendar or Drive summaries, briefings, research, drafting. No custom webhooks, no WhatsApp customers, no own server.

What "stop" means:
- Say why in two lines.
- Give a ≤10-step setup checklist in their language: connectors read-only first, one scheduled task (the morning briefing), phone access through the Claude app.
- Offer to write their SOUL/USER text as project instructions to paste in.
- Set state `done` with `runtime: cowork`.
- Tell them `/jarvis-start` brings them back if they later want Telegram, WhatsApp or 24/7 on their own host.

Before you promise Cowork's scheduling-without-a-device or phone dispatch, `stack-researcher` confirms both live against `runtimes/cowork.md` and the Claude release notes. If either is missing on the person's plan, say so and offer `claude-code-local` + Channels instead.

If the stop rule fails, use this table:

| Level | Effect on the candidate |
|---|---|
| `none` | Prefer, in order: `claude-code-local` (if Pro/Max and local) > `hermes` on Railway Tier A > `openclaw`. Never `claude-agent-sdk`: it means writing code. Fewer moving parts beats features. With `claude-code-local`, the build follows its *Non-technical runbook* (`runtimes/claude-code-local.md` § Run & supervise) and states the ~6 one-time steps that need them at the gate. |
| `terminal-ok` | Any runtime except `claude-agent-sdk` as a first build. |
| `dev` | All runtimes. `claude-agent-sdk` only when they want their **own service**: webhooks, web UI, DB, custom adapters. "I'm a dev" alone is not enough reason. |

### Step 4: channels (the WhatsApp-first LATAM reality)

Most of this audience lives in WhatsApp: about 90 %+ of internet users in MX, CO and AR (Infobip,
see `capabilities/whatsapp.md`). Telegram stays the **default for the owner's personal chat**
because it is free and has no policy risk. Name the tradeoff in one line; don't impose Telegram
silently.

**Native channel support** (details and setup are in each `runtimes/<id>.md` and `capabilities/channels.md`):

| Runtime | Telegram | WhatsApp | Other |
|---|---|---|---|
| `claude-code-local` / `claude-code-server` | yes (channel plugin) | **no official channel** | Discord, iMessage (macOS), Remote Control from the Claude app (claude.ai login only) |
| `claude-p-cron` | outbound messages only (Bot API send) | no | email or a file as the output |
| `hermes` | yes | **Cloud API (official)** or Baileys (Hermes' own default, so it must be switched) | Discord, Slack, Signal, Email, CLI |
| `openclaw` | yes | **Baileys only** | many more + phone apps |
| `codex-openai` | no | no | terminal |
| `claude-agent-sdk` | you write the adapter | you write the Cloud API adapter | any |
| `cowork` | no | no | Claude apps |

**WhatsApp rules, in order:**

1. **Business answering its own customers** (bookings, orders, FAQs, lead qualification; packs `smb-restaurant`, `real-estate`, `health`, `ecommerce`, `sales`): **WhatsApp Cloud API** (official) is allowed. Runtime: `hermes` (`claude-agent-sdk` if `dev`). The owner still talks to Jarvis on Telegram unless they decline. The customer side is a **separate, restricted profile** with its own allowlist, per `capabilities/whatsapp.md` § Customer-facing bot (the documented SEC-01 exception): never the owner's Jarvis with a widened allowlist.
   - **`lawyer-accountant`, and `health` beyond appointment reminders:** the customer bot is **v2 only** (`/jarvis-add`). In v1 Jarvis drafts client messages and the owner sends them. The pack's Guardrails outrank this rule (§ 3).
2. **Personal "ask me anything" Jarvis on WhatsApp**: a **grey zone** under Meta's AI-provider terms (no official ruling covers a single-owner assistant; the reading and risk are in `capabilities/whatsapp.md`). Default: Telegram for the owner. Use WhatsApp Cloud API only after a Gate C disclosure, logged. For `es`, add the EU note from `countries/es.md`. No regulator exception exists for MX, CO or AR.
3. **Cloud API needs a public HTTPS webhook.** The host becomes **Railway Tier A plus a generated domain** on that one service, with the verify token and signature checked on the webhook route (`capabilities/deploy-railway.md`, `capabilities/whatsapp.md`). A local host needs a tunnel (see `capabilities/deploy-local.md`), and is only for `terminal-ok`/`dev`.
4. **Unofficial bridges (Baileys)** come only with explicit, logged consent **and a secondary number**, never the person's main number. Without that consent, **never pick `openclaw`** when WhatsApp is required. Use `hermes` with Cloud API instead.
5. A Claude Code runtime **cannot** be WhatsApp-first. If WhatsApp is a must, move to `hermes` and say why in one line. ("Claude Code no tiene WhatsApp oficial; Hermes sí.")
6. Cost: replies inside the 24-hour window are ~$0 at personal volume. Template messages (proactive, outside the window) are billed per message at the country rate in `countries/<cc>.md`. Sources disagree on whether Meta bills service messages, so `stack-researcher` reads the live rate card (https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) at install time and quotes that figure; if it can't be read, budget service messages at the country template rate.

**Other channels:**
- Terminal / Claude app → `claude-code-local` (Remote Control needs a claude.ai login, not an API key) or `codex-openai`.
- Discord/Slack → `hermes` or `claude-code-*` (Discord).
- Voice → voice notes over Telegram/WhatsApp first (`capabilities/voice.md`). Real-time calls are a later add-on, never v1 in quick mode.

### Step 5: 24/7 and host

| Need | Host | Runtime consequence |
|---|---|---|
| `while-on` | Local + supervisor (launchd / systemd / WSL2 systemd) | Keep the candidate. Jobs that fire while the machine sleeps are skipped; say so. |
| `always-on-box` | Local + supervisor + Tailscale for remote access | Keep the candidate. Best home for `claude-code-local` and for `ollama-local`. |
| `cloud`, chat only, one person | **Railway Hobby, Tier A** (one service + volume) | Default **`hermes`**: outbound-only gateway, no public port, lowest hosting cost (`capabilities/costs.md`). WhatsApp Cloud API is the one exception: it adds a generated domain (Step 4 rule 3). `claude-code-server` only if they explicitly want Claude Code itself 24/7 (it needs a memory cap and auto-restart, see `runtimes/claude-code-server.md`). |
| `cloud` + web UI, semantic memory over documents, several services, or multi-client isolation (`agency`) | **Railway Tier B** | `claude-agent-sdk` (`dev`) or `hermes` + Postgres/pgvector. |
| `cloud` + local models | **Impossible on Railway** | Go back to Step 1: an always-on box at home, or the hybrid. |
| `cloud`, scheduled outputs only | Railway cron service, or `cowork` if the Step 3 stop rule holds | `claude-p-cron` with an API key on Railway, or a scheduled `hermes` job. |

Railway is **always Hobby, never Free**, for anything 24/7. The spend limit is set before the
first deploy (`capabilities/deploy-railway.md`).

### Step 6: fill the remaining slots

| Slot | Rule |
|---|---|
| **Credential** | Read the row for runtime × host in `auth-matrix.md`. Summary: a Claude subscription goes only in `claude-code-local` / `claude-p-cron` / `claude-code-server` (flagged) used by the owner. `hermes`, `openclaw` and `claude-agent-sdk` with Claude models use an `ANTHROPIC_API_KEY` with a spend cap. Hermes' "Claude OAuth" mode is **forbidden**. OpenAI inside `hermes` uses `OPENAI_API_KEY` (OpenAI has not documented Codex OAuth reuse by third parties, so don't use it). |
| **Model provider** | (0) **`local-only` → `ollama-local` per Step 1, first and always:** it overrides budget and any existing plan or key (a hybrid slot only with the consent Step 1 describes). (1) The subscription they already have, or the provider of the key they say they have (a new capped key is created). (2) Otherwise **Anthropic** by default: strong Spanish writing (subjective) and the same family as the Architect. (3) `0`/`≤10` budget with no Claude plan: **OpenAI routed** (`cheap` for most traffic, `main` for hard turns), the cheapest compliant cloud option per `capabilities/costs.md`. (4) OpenRouter only when they want one key for many models: add its fee (see `capabilities/costs.md`). Slots always come from `models.json`: `cheap` for heartbeats, triage and jobs; `main` for conversation; `max` only for explicitly hard tasks. |
| **Memory** | Always the markdown workspace (SOUL / USER / MEMORY / HEARTBEAT / AGENTS / TOOLS.md), which stays portable across runtimes. Plus the runtime's native memory. Add sqlite-vec (local) or pgvector (Railway Tier B) only past ~200 lines of memory or with several channels. Use graph memory only for `sales`, `real-estate` and `lawyer-accountant`, and not in v1 for non-technical users. `very-sensitive` → local only. See `capabilities/memory.md`. |
| **Default channel** | The first match wins: `local-only` → terminal. WhatsApp business use → WhatsApp Cloud API (customers) + Telegram (owner). Telegram chosen or unsure → Telegram. Terminal/app → Remote Control (claude.ai login) or terminal. The allowlist is **owner only**, always; the only exception is the separate customer-facing profile in `capabilities/whatsapp.md` § Customer-facing bot. |
| **Tools / MCP** | From the profession pack, read-only first. Trust tiers are in `capabilities/tools-mcp.md`. Fiscal tools come from `countries/<cc>.md`. |
| **Jobs** | Always at least a morning briefing at an off-minute in local time (e.g. 07:03), plus the pack's jobs. `capabilities/scheduling.md`. |
| **Security** | Every control in `security-checklist.md`. Not a slot to decide. |

---

## 3. Profession and country nudges

These adjust defaults. They never override Steps 1–5 on their own. **Exception:** a pack's
*Guardrails* section (compliance, data sensitivity, "no customer-facing bot in v1") outranks Steps
1–5, by tie-break 1 (compliance > convenience). A guardrail can only make the design narrower or
safer, never wider.

| Pack | Nudge |
|---|---|
| `health` | Sensitivity starts at `very-sensitive`. Memory stays local. WhatsApp only for appointment reminders, through the Cloud API. |
| `lawyer-accountant` | Sensitivity starts at `very-sensitive`. Tools are read-only. Never store e.firma/CSD. CONTPAQi needs a local Windows host, so it can never go on Railway. Customer-facing bot: v2 only (Step 4 rule 1). |
| `teacher` | Minors' data: anonymize before any cloud model. Grades need human review. |
| `sales`, `real-estate` | WhatsApp Cloud API for clients + Telegram for the owner. Graph memory is a v2 candidate. |
| `smb-restaurant`, `ecommerce` | 24/7 is likely, so default to Railway Tier A. Invoicing stamps, refunds and price changes always need approval. |
| `agency` | Separate memory and credentials per client. This pushes the host to Tier B. |
| `developer` | `claude-code-local` + terminal/Remote Control if Pro/Max. `claude-agent-sdk` only for their own service. |
| `creator`, `founder`, `coach`, `student` | No special override. `student` with `none-min` → the cheapest slot. |

| Country | Nudge |
|---|---|
| `mx`, `co`, `ar` | WhatsApp-first conversation (Step 4). No Meta regulator exception. Local data-law warning once third-party data is involved. |
| `es` | AI disclosure at first contact for any customer-facing bot (EU AI Act Art. 50). EU note on WhatsApp. GDPR household exemption covers personal use only. |
| `other` | Use `countries/other.md`. Ask once about the WhatsApp vs Telegram reality. |

---

## 4. Archetype profiles

Monthly figures are **rough totals for light use (~20 turns/day)** in USD, derived from
`capabilities/costs.md`. "$0 extra" means they already pay a plan and nothing is added. Hardware and
electricity are not counted. Always re-quote with their own usage tier.

| # | Profile (pack · country · key answers) | Runtime | Host | Credential | Model provider | Memory | Default channel | ~USD/month |
|---|---|---|---|---|---|---|---|---|
| 1 | `creator` · mx · Pro · laptop on while working · non-technical · Telegram | `claude-code-local` | Local mac + launchd | `/login` (Pro) | Anthropic via plan | Workspace md via CLAUDE.md imports (auto-memory off) | Telegram (owner allowlist) | $0 extra |
| 2 | `developer` · ar · Max · Mac mini always on · dev · terminal + phone | `claude-code-local` | Local always-on + launchd + Tailscale | `/login` (Max) | Anthropic via plan | Workspace md + CLAUDE.md | Remote Control (Claude app) + Telegram | $0 extra |
| 3 | `coach` · es · Pro · non-technical · only the Claude app · briefings + email drafts | **`cowork` (stop)** | none (vendor) | Claude plan | Anthropic via plan | Project instructions + connectors | Claude app | $0 extra |
| 4 | `founder` · mx · Pro · wants a daily KPI report, no chat · terminal-ok | `claude-p-cron` | Local + launchd / cron | `/login`, or `CLAUDE_CODE_OAUTH_TOKEN` for scripts (`auth-matrix.md`) | Anthropic via plan | Workspace md | Telegram outbound / email | $0 extra |
| 5 | `sales` · co · no plan · WhatsApp-first · 24/7 · `10–30` · client data | `hermes` | Railway Tier A + domain (webhook) | `ANTHROPIC_API_KEY` + Meta Cloud API token | Anthropic routed (`cheap` + `main`) | Workspace md + Hermes memory (graph in v2) | WhatsApp Cloud API (clients) + Telegram (owner) | ~$12–16 + templates |
| 6 | `smb-restaurant` · mx · no plan · customers on WhatsApp · non-technical · `≤10` | `hermes` | Railway Tier A + domain (webhook) | `OPENAI_API_KEY` + Meta Cloud API token | OpenAI routed | Workspace md + Hermes memory | WhatsApp Cloud API (bookings) + Telegram (owner) | ~$9–13 + templates + invoicing plan |
| 7 | `lawyer-accountant` · ar · `local-only` · Apple Silicon 64 GB (`HW-strong`) | `ollama-local` (+ `hermes`) | Local always-on | none | Ollama (local) | Workspace md + sqlite-vec, local | Terminal / local | ~$0 |
| 8 | `health` · mx · `very-sensitive` · 16 GB laptop (`HW-small`) · terminal-ok | `ollama-local` (+ `hermes`), hybrid | Local + supervisor | `ANTHROPIC_API_KEY` for non-patient tasks only | Ollama for patient data · Anthropic `cheap`/`main` for the rest | Workspace md, local; no PHI in memory | Telegram (no patient data) | ~$5–10 |
| 9 | `developer` · other · ChatGPT Plus · dev · terminal | `codex-openai` | Local | `codex login` (ChatGPT) | OpenAI via plan | AGENTS.md + workspace md | Terminal | $0 extra |
| 10 | `real-estate` · mx · ChatGPT · non-technical · WhatsApp + phone apps · **consents to Baileys + second SIM** · old PC always on | `openclaw` (≥ floor in `runtimes/openclaw.md`, gateway never public) | Local always-on (WSL2 if Windows) | Codex login or SIWC (preview), per `auth-matrix.md` | OpenAI via plan | Workspace md + OpenClaw memory | WhatsApp (Baileys, secondary number) + Telegram | $0 extra + SIM |
| 11 | `ecommerce` · co · dev · wants own service (store webhooks + web dashboard) · 24/7 | `claude-agent-sdk` | Railway Tier B (web on; pgvector only if memory needs it) | `ANTHROPIC_API_KEY` | Anthropic (Sonnet chat + Haiku jobs) | Workspace md (+ pgvector if RAG) | Telegram (own adapter) | ~$21–26 light (Tier B ~$12–17 from `capabilities/costs.md` §2 + Sonnet chat/Haiku jobs ~$9); medium ~$76–81 |
| 12 | `founder` · es · Max · terminal-ok · wants **Claude Code itself** 24/7 on Telegram | `claude-code-server` | Railway Tier A (memory cap + restart) | `ANTHROPIC_API_KEY` (default). Subscription login only as the flagged personal alternative, with Gate C consent | Anthropic | Workspace md + CLAUDE.md on volume | Telegram | ~$15–30 (API) / ~$8–16 hosting on the flagged path |
| 13 | `student` · mx · no plan · `none-min` · 8 GB laptop · Telegram | `hermes` | Local while-on (Apple Silicon or WSL2) | `OPENAI_API_KEY` | OpenAI `cheap` slot | Workspace md + Hermes memory | Telegram | ~$1–5 |

Archetype notes:
- Row 5 and row 6, personal use of WhatsApp beyond customers: Gate C grey-zone disclosure (Step 4 rule 2).
- Row 10 without Baileys consent becomes row 6's stack (`hermes` + Cloud API on Railway).
- Row 12: if usage on the flagged path breaks (token expiry, limits), fall back to the API key. Never fall back to Hermes OAuth.

---

## 5. § Quick defaults (used by `/jarvis-quick`)

`/jarvis-quick` asks only: **(Q-a)** profession + 3 jobs, **(Q-b)** channel (Telegram · WhatsApp ·
Terminal/Claude app), **(Q-c)** 24/7 (No, on my computer · Yes, cloud). Combine those answers
with `preflight.agents.claude_auth`:
- `S` = `claude.ai`. Confirm the plan in the defaults block: "Asumo que tienes Claude Pro o Max".
- `K` = `api_key`.

The Architect is itself running in Claude Code, so one of the two is always present. Cloud-provider
auth counts as `K`.

### 5.1 Stack by answer

| Q-b channel | Q-c 24/7 | Login | Runtime | Host | Credential | Provider | Default channel |
|---|---|---|---|---|---|---|---|
| Telegram | No | S | `claude-code-local` | Local + supervisor | `/login` (their plan) | Anthropic via plan | Telegram |
| Telegram | No | K | `claude-code-local` | Local + supervisor | `ANTHROPIC_API_KEY` + spend cap | Anthropic (`main` chat, `cheap` jobs) | Telegram |
| Telegram | Yes | S or K | `hermes` | Railway Tier A | New `ANTHROPIC_API_KEY` + spend cap. If S, say in one line why the plan can't be used inside Hermes. | Anthropic routed | Telegram (polling, outbound only) |
| WhatsApp | Yes | S or K | `hermes` | Railway Tier A + generated domain (webhook) | `ANTHROPIC_API_KEY` + Meta WhatsApp Cloud API token (their own Meta Business account) | Anthropic routed | WhatsApp Cloud API, owner number allowlisted. Telegram offered as the zero-risk fallback. |
| WhatsApp | No | S or K | **Override, stated:** official WhatsApp needs a public URL, so propose the row above (Railway). If they insist on local: Telegram now with `claude-code-local`, and WhatsApp later via `/jarvis-add`. | | | | |
| Terminal/app | No | S | `claude-code-local`, **unless the Cowork stop rule holds**: no git/node in preflight and Q-a jobs are connector-only → `cowork`, then stop | Local + supervisor | `/login` | Anthropic via plan | Remote Control (Claude app) + terminal |
| Terminal/app | No | K | `claude-code-local` | Local + supervisor | `ANTHROPIC_API_KEY` + spend cap | Anthropic | Terminal (Remote Control needs a claude.ai login) |
| Terminal/app | Yes | S | **`cowork`: recommend and stop**, if Q-a jobs fit connectors + scheduled tasks. Otherwise use the next row. | none | Claude plan | Anthropic via plan | Claude app |
| Terminal/app | Yes | K (or S, if Cowork doesn't fit) | `claude-code-server` | Railway Tier A (memory cap + restart) | `ANTHROPIC_API_KEY` + spend cap | Anthropic | Telegram (say why: a cloud box isn't reachable from your terminal without extra setup) |

### 5.2 Everything else: state it in one block

| Slot | Quick default |
|---|---|
| Profession pack | Inferred from Q-a via the signals table in `questions/1-descubrimiento.md`. One pack. |
| Country / timezone | From the language and the system timezone. If WhatsApp was chosen and the country is unclear, that is the **one** `[NEEDS CLARIFICATION]` allowed in quick mode (rates and data law depend on it). |
| Technical level | `none`: guide every step. |
| Sensitivity | `normal`. If the pack is `health`, `lawyer-accountant` or `teacher`: `very-sensitive`, memory local-only, and "third-party personal data" listed as a v1 Non-Goal. If they say "nada sale de mi compu", **leave quick mode** for `/jarvis-start`: hardware decides. |
| Budget / spend cap | Lowest-cost compliant stack above. Provider cap = about 2× the quoted monthly estimate, rounded up. On Railway, also set a usage limit. Both are set before go-live. |
| Model slots | From `models.json` for the provider: `main` for chat, `cheap` for jobs and heartbeats, `max` off unless asked. |
| Memory | Markdown workspace + the runtime's native memory. No vector DB in v1. |
| Tools / MCP | The pack's top two week-one tools (usually email + calendar), **read-only**. Everything else is a Non-Goal for v1, addable with `/jarvis-add`. |
| Jobs | Morning briefing at 07:03 local time + the pack's first job. No heartbeat in v1. |
| Voice | Off. Voice notes are offered later via `/jarvis-add`. |
| Actions | Drafts only. Send, pay, delete, stamp or refund always need approval. |
| Allowlist | Owner only. |
| Name / personality | "Jarvis", calm and direct, in their language. |

Fast-track never removes Gate C. A WhatsApp grey-zone disclosure, any Baileys use (never a quick
default) and a subscription on a server each still need an explicit, logged yes.

---

## 6. Tie-break rules (apply in this order)

1. **Compliance > security > cost > convenience.** A cheaper or easier stack that breaks a provider term or a `SEC-NN` control loses, every time.
2. **Use what's already paid for and installed.** An existing plan, an installed agent or a provider they already have a key with beats a new account (they tell you in Q4; preflight's `keys_present` is never used to decide, rule 7). Example: they are already in Claude Code, so `claude-code-local` beats a fresh `hermes` install for local use.
3. **Fewer moving parts.** One runtime per Jarvis in v1. The only pairing allowed is `ollama-local` + its harness. No n8n, no second gateway, no Tier B unless Step 5 requires it.
4. **Official over unofficial.** Cloud API over Baileys. An official remote MCP over a community MCP over a generated wrapper (`capabilities/tools-mcp.md`).
5. **Local over cloud when both satisfy the profile** (privacy, $0 hosting), unless they need 24/7 and have no always-on box.
6. **`hermes` over `openclaw` by default.** Hermes has an outbound-only gateway and an official WhatsApp path. Pick `openclaw` only when it is the sole fit: Baileys consented, channels or phone apps Hermes lacks, or a ChatGPT plan via Codex login/SIWC. Even then, only at or above the version floor in `runtimes/openclaw.md`, with the gateway private.
7. **`claude-code-server` vs `hermes` for cloud Claude:** `hermes` is the default (lower hosting cost, no idle memory leak). Use `claude-code-server` only when they explicitly want Claude Code's own skills/plugins/workflow 24/7.
8. **Anthropic vs OpenAI provider:** an existing plan or key decides first. Then Anthropic is the default. Then a `≤10` budget with no plan → OpenAI routed.
9. **Two runtimes still tie:** pick the one whose `runtimes/<id>.md` has a package-manager install for their OS (no vendor script), then the one with the longer stable release history.
10. **Budget below the cheapest compliant stack:** say so plainly, then shrink the scope (local host, fewer jobs, the `cheap` slot). Never drop a security control or switch to a non-compliant credential to fit the budget.
11. **Undecidable from the profile:** mark `[NEEDS CLARIFICATION: … — blocks <slot>]` and ask **one** deciding question with a "(Recomendado)" first option.

---

## Sources

- Auth and subscription policy:
  - https://code.claude.com/docs/en/legal-and-compliance
  - https://code.claude.com/docs/en/authentication
  - https://code.claude.com/docs/en/channels
  - https://code.claude.com/docs/en/remote-control
  - https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
  - https://support.claude.com/en/articles/15036540
  - https://www.anthropic.com/legal/consumer-terms (all fetched 2026-10-06; see `auth-matrix.md`)
- OpenAI auth:
  - https://learn.chatgpt.com/docs/auth
  - https://developers.openai.com/siwc/token-sharing-open-source
  - https://docs.openclaw.ai/providers/openai/authentication
- Hermes:
  - WhatsApp (Baileys default + official Cloud API option): https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp
  - Providers: https://hermes-agent.nousresearch.com/docs/integrations/providers
  - Installation (no native Intel Mac support): https://hermes-agent.nousresearch.com/docs/getting-started/installation
- OpenClaw:
  - WhatsApp is Baileys-only: https://docs.openclaw.ai/channels/whatsapp
  - Advisories: https://github.com/advisories/GHSA-g8p2-7wf7-98mq
- Cowork features (secondary; re-checked live by `stack-researcher` before quoting):
  - https://support.claude.com/en/articles/12138966-release-notes
  - https://www.gradually.ai/en/changelogs/claude-cowork/
- Railway plans and billing:
  - https://docs.railway.com/pricing/plans
  - https://docs.railway.com/pricing/understanding-your-bill
- WhatsApp:
  - Usage in LATAM: https://infobip.com/blog/whatsapp-statistics
  - Meta's terms: https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
  - Business vs. general-purpose bots (secondary): https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
  - Pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- EU AI Act Art. 50 timing (secondary): https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html
- Pro/Max not covered by the BAA (secondary; re-checked live by `stack-researcher`): see `professions/health.md`.
