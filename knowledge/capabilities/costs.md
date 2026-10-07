# Capability: Costs

> What a Jarvis costs per month (model tokens + hosting + any plan it rides on), how the Architect quotes it before the yes, and how it sets hard caps so the quote can't be blown.

Last verified: 2026-10-06

Every figure in this file is a **cost estimate in USD, before tax**, computed on 2026-10-06 from the
sources in § Sources. Unit prices and model IDs live in `knowledge/models.json` (the source of
truth); they are repeated here only so the estimates can be checked. `stack-researcher` re-checks
prices before a quote. If the live price differs, the live price wins: say so in one line and
recompute.

## Decision rule

Apply top to bottom. The first row that matches sets the cost shape; the cap rows always apply.

| If… | Then the quote is… | Caps to set before go-live (SEC-27) | One line for the person |
|---|---|---|---|
| They already pay Claude Pro/Max and the runtime is `claude-code-local`, `claude-p-cron` or `cowork` | **$0 extra**. The plan price, already paid | None at a provider. Confirm paid "extra usage" stays **off** unless they say yes in the same turn | "Usa tu plan de Claude, no pagas nada extra. Si llegas al límite del plan, espera a que se reinicie." |
| They already pay a ChatGPT plan and the runtime is `codex-openai` | **$0 extra** (`stack-researcher` re-checks plan prices live on openai.com before quoting; see § Subscriptions) | None at a provider | "Usa tu plan de ChatGPT, no pagas nada extra." |
| Runtime is `ollama-local` | **~$0**. Hardware and electricity not counted | None (no provider bill). For a hybrid setup, cap the cloud key | "Corre en tu compu: no pagas por uso, solo la luz." |
| Any API key (Anthropic, OpenAI) | **Token estimate** for their usage tier (§ 3) × routing (§ 3) | Provider cap ≈ **2× the monthly token estimate, rounded up** | "Pagas solo lo que Jarvis use, con un tope mensual que tú fijas." |
| Paying through OpenRouter credits | Token estimate **+ 5.5%** | OpenRouter key credit limit + the same 2× rule | "OpenRouter cobra 5.5% extra por darte una sola llave para muchos modelos." |
| Model slot is Claude `main` or `max` (Sonnet 5.5 / Opus 5.5) | Token counts already **×1.3** (new tokenizer) in § 3 | — | "Estos modelos cuentan ~30% más tokens por el mismo texto; ya está en el cálculo." |
| Host is Railway | + **hosting** from § 2 (Hobby, never Free, for anything 24/7) | Railway **usage limit**: soft alert ≈ the hosting estimate, hard limit = max($10 (Railway's minimum), ~2× the hosting estimate) | "El servidor cuesta ~$5–16 al mes según el programa; pongo un tope para que no se pase." |
| Their budget (Q5 in `decision-tree.md`) is below the cheapest compliant stack | Say so plainly, then shrink scope: local host, fewer jobs, the `cheap` slot | Same caps | Never drop a `SEC-NN` control or switch to a non-compliant credential to fit a budget (`decision-tree.md` rule 10) |

Defaults to say out loud in `/jarvis-quick`: *"Costo: ~$X/mes con uso ligero (modelo ~$Y + servidor ~$Z). Pongo un tope de $N en tu cuenta antes de encenderlo."*

---

## 1. Unit prices (cost basis, verified 2026-10-06)

USD per million tokens (MTok), standard tier. Slot names and IDs come from `knowledge/models.json`.
Do not copy IDs from this table into a spec; read them from `models.json`.

| Provider · slot | Model | Input | Cache write (5 min) | Cache read | Output | Tokenizer | Source |
|---|---|---|---|---|---|---|---|
| anthropic · `cheap` | Claude Haiku 4.5 | 1.00 | 1.25 | 0.10 | 5.00 | old (×1.0) | [platform pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| anthropic · `main` | Claude Sonnet 5.5 | 2.00 | 2.50 | 0.20 | 10.00 | new (×1.3) | same |
| anthropic · `max` | Claude Opus 5.5 | 4.00 | 5.00 | 0.20 | 20.00 | new (×1.3) | same |
| openai · `cheap` | GPT-6 Luna | 0.10 | — | 0.01 | 0.50 | — | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| openai · `main` | GPT-6.1 Sol | 2.00 | — | 0.10 | 10.00 | — | same |
| openai · `max` | GPT-6 Astra | 10.00 | — | 1.00 | 50.00 | — | same |

Modifiers (Anthropic, from the pricing page, re-fetched 2026-10-06):

- **Tokenizer uplift.** Claude 4.7 and later (so Sonnet 5.5 and Opus 5.5) "produces approximately
  30% more tokens for the same text". Haiku 4.5 uses the old tokenizer. Every estimate below
  multiplies Sonnet 5.5 / Opus 5.5 token counts by 1.3. For real budgets use `count_tokens`, not
  word counts.
- **Batch API:** 50% off input and output (both vendors). Good for nightly digests that can wait.
- **US-only inference** (`inference_geo: "us"`): ×1.1 on every token category. Not needed for LATAM/Spain users; global is the default.
- **Web search** (Claude server tool): $10 per 1,000 searches, plus tokens. Web fetch: tokens only.
- **Managed Agents:** + $0.08 per running session-hour. Not used by any default Jarvis.
- Fast mode, 1-hour cache writes: not used by default; see the pricing page if a design needs them.

Banned or legacy models (deprecated Sonnet 4.5, `gpt-5.5`, the `gpt-5.6-*` family) cost the same or
more than their successors and are never quoted. The list is `banned` in `models.json`; the reason
is `compatibility.md` CMP-27.

## 2. Hosting on Railway (verified 2026-10-06)

Railway rates ([plans](https://docs.railway.com/pricing/plans),
[understanding your bill](https://docs.railway.com/pricing/understanding-your-bill)):
RAM $10 per GB-month · CPU $20 per vCPU-month · volume $0.15 per GB-month · egress $0.05 per GB.
Railway bills **actual usage, not allocated limits**. Hobby is $5/month and includes $5 of usage,
so the bill is **max($5, usage)**. Free ($1 credit, 0.5 GB RAM cap per service) and Trial ($5
one-time) can't run `Always` restart and don't fit any gateway → never for 24/7
([restart policy](https://docs.railway.com/deployments/restart-policy)).

Footprints are averages over a 24/7 month, mostly idle.

| Workload | RAM / CPU assumed | Footprint basis | Usage $/month | **Hobby bill $/month** |
|---|---|---|---|---|
| Lean custom worker (calls the Messages or Responses API directly, Telegram webhook) | 0.15 GB / 0.02 vCPU | Estimate; after deploy, `/jarvis-doctor` reads real RAM from the Railway metrics and updates the quote | ~1.9 | **5** |
| `claude-agent-sdk` worker (spawns a CLI subprocess per query) | 0.4 GB / 0.05 vCPU | Estimate from Claude Code idle RSS; confirm with the Railway service metrics after the first day | ~5 | **5–6** |
| `hermes` gateway, 1–3 channels, 1 GB volume | 0.6 GB / 0.05 vCPU | "400 to 950 MB" CLI + gateway (secondary sources; confirm with the Railway service metrics after the first day) | ~7.2 | **7–8**; **9–11** with Railway Postgres (~0.2 GB) |
| `openclaw` gateway, headless, one agent | 0.8 GB / 0.05 vCPU | Railway templates ask ≥1 GB; the Docker build needs 2 GB or is OOM-killed | ~9.2 | **9–10**; **12–13** with a database |
| `claude-code-server` (Claude Code kept alive 24/7) | 0.7–1.5 GB / 0.05 vCPU | ~360–700 MB idle RSS; open issues report idle/headless leaks (see `compatibility.md` CMP-22) | 8–16 | **8–16**. Needs a memory cap + auto-restart |
| `ollama-local` on Railway, 7B model, CPU only | 8 GB / 2 vCPU | — | ~120 | **Not viable.** Local models run only on the person's own hardware (`compatibility.md` CMP-01) |
| **Tier B add-ons** (add to the core row above) | | | | |
| + Jarvis Panel inside the core process | +0.1 GB | Node + Hono, mostly idle; estimate, confirm in Railway metrics | +~1 | core bill +~1 |
| + separate `jarvis-web` service (webhooks/dashboard) | 0.1–0.2 GB / 0.01 vCPU | Estimate, confirm in Railway metrics | +~1.5–2.5 | +~2 |
| + Tailscale subnet-router service | 0.05–0.1 GB / 0.01 vCPU | Estimate, confirm in Railway metrics | +~0.7–1.2 | +~1 |
| + pgvector (template) + its volume | 0.2–0.5 GB / 0.02 vCPU + ~1 GB disk | Estimate, confirm in Railway metrics | +~2.5–5.5 | +~3–6 |
| + `backup-cron` + bucket | runs minutes a day; dumps of a few MB | Bucket pricing per [plans](https://docs.railway.com/pricing/plans), re-checked live by `stack-researcher` before quoting | <1 | <1 |

Tier B examples: `claude-agent-sdk` core + panel in core + Tailscale ≈ **$7–8** ("Tier B-lite");
add `jarvis-web` + pgvector + backups ≈ **$12–17**. The RAM footprint for `claude-agent-sdk`
(0.4 GB average, 1.5 GB service cap, Anthropic's "1 GiB per agent" starting point) is the one in
`runtimes/claude-agent-sdk.md` § Cost; this table uses the average.

Builds are free per Railway's [plans](https://docs.railway.com/pricing/plans)); if the person is worried about build cost, `stack-researcher` re-checks that page before quoting; the Railway usage limit (§ 7) caps it either way.
Railway's own guide puts a full agent stack (API, worker, Postgres, Redis, bucket) at "$10 to $30 a month"
([estimate-ai-agent-costs](https://docs.railway.com/guides/estimate-ai-agent-costs)). A personal Jarvis is one service + volume (Tier A) and lands at the low end.

Local hosting is $0 in this model. The machine, electricity and an optional second SIM are the
person's own costs; say so, don't quote them.

## 3. Usage tiers and token cost

### Tier assumptions (say these out loud when quoting)

| Tier | Looks like | Turns / month | Input per turn | Cache hit rate | Output per turn | Monthly input / output (before ×1.3) |
|---|---|---|---|---|---|---|
| **Light** | ~20 messages a day + a morning briefing | 600 | 8k | 70% | 500 | 4.8M / 0.3M |
| **Medium** | ~100 messages a day + several crons | 3,000 | 15k | 80% | 800 | 45M / 2.4M |
| **Heavy** | Agentic tool loops all day (coding, research, many tools) | 12,000 | 30k | 85% | 1.5k | 360M / 18M |

Calculation rules: uncached Anthropic input is billed at the 5-minute cache-write rate (1.25×);
Sonnet 5.5 and Opus 5.5 counts are ×1.3; OpenAI uncached input at the plain input rate. Input per
turn includes system prompt, workspace files (`SOUL.md`, `MEMORY.md`…), tool schemas and history,
which is why it is far larger than the message itself. Most non-technical people are **Light**.
Pick Medium if they want WhatsApp with customers, more than ~50 messages a day, or more than three
**user-facing** scheduled jobs (briefings, reminders, digests). Mandatory maintenance jobs (weekly
memory review, weekly version/`npm audit` check, liveness heartbeat, SEC-29 denied-senders summary)
don't count toward the tier: quote them as one fixed line, ~$0.2–0.5/month on the `cheap` slot.
Heavy only for developers running long tool loops.

### Token cost per month (USD, computed 2026-10-06)

| Model (slot) | Light | Medium | Heavy |
|---|---|---|---|
| Claude Opus 5.5 (`anthropic.max`) | 18.0 | 130 | 899 |
| Claude Sonnet 5.5 (`anthropic.main`) | 9.5 | 70 | 489 |
| Claude Haiku 4.5 (`anthropic.cheap`) | 3.6 | 27 | 188 |
| GPT-6 Astra (`openai.max`) | 32.8 | 246 | 1,746 |
| GPT-6.1 Sol (`openai.main`) | 6.2 | 46 | 319 |
| GPT-6 Luna (`openai.cheap`) | 0.3 | 2.5 | 17.5 |
| **Claude routed** (80% `cheap`, 20% `main`) | **4.8** | **35** | **248** |
| **OpenAI routed** (80% `cheap`, 20% `main`) | **1.5** | **11** | **78** |

Routing is the default design (`questions/2-ramas.md` § Model slots): `cheap` for heartbeats,
triage, summaries and jobs; `main` for conversation; `max` off unless asked. That is why the routed
rows, not the single-model rows, feed the quotes, **when the runtime really routes 80% to `cheap`**.
Check the runtime's code path: `claude-agent-sdk` (as written in its runtime file) sends **every
chat turn** to `main` and only jobs to `cheap`, so a chat-heavy person is close to the Sonnet line.
For it, quote "Sonnet chat + Haiku jobs" with the split stated (e.g. 85% chat / 15% jobs → Light
~$8.6, Medium ~$64), and size the cap from the Sonnet-only figure. One provider per conversation thread (caches and
Claude thinking blocks are tied to the model; see `models.json` notes).

If the person pays through **OpenRouter credits, add 5.5%** (card purchases; 5% by crypto; 8% on
the Business plan). BYOK through OpenRouter is free up to "$25,000 of list price inference / month",
then 5%. No per-request fee ([openrouter.ai/pricing](https://openrouter.ai/pricing),
[FAQ](https://openrouter.ai/docs/faq)).

Haiku 4.5 caveat: it is Active with retirement "not sooner than October 15, 2026" and no successor
named; Anthropic gives ≥60 days' notice, so not before ~2026-12-05. If it is retired, the
Anthropic `cheap` slot moves to the first `fallbacks` entry in `models.json` (Sonnet 5.5 at effort
low, $2/$10 with the ×1.3 uplift; not Sonnet 5, which is Legacy, `compatibility.md` CMP-27): Claude
routed Light rises from ~$4.8 to the Sonnet 5.5 line (~$9.5), about 2× (the cheap slot alone is
~2.6× more expensive).
Re-check on every `/jarvis-refresh`
([deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)).

## 4. Subscriptions

| Plan | Price (USD/month) | What it covers | Source |
|---|---|---|---|
| Claude Pro | 20 (17/month billed annually, $200 up front) | Claude app, Claude Code, Cowork; one shared usage limit | [claude.com/pricing](https://claude.com/pricing) |
| Claude Max 5x | from 100 | Same, 5× the Pro usage | same |
| Claude Max 20x | 200 | Same, 20× the Pro usage | same (the live page summary showed "From $100" for both Max tiers on 2026-10-06; re-check) |
| ChatGPT Go / Plus / Pro | 8 / 20 / 100 (5x) or 200 (20x) | ChatGPT + Codex | Secondary source ([TechCrunch 2026-04-09](https://techcrunch.com/2026/04/09/chatgpt-pro-plan-100-month-codex/)); `stack-researcher` re-checks [openai.com/chatgpt/pricing](https://openai.com/chatgpt/pricing) live before quoting |

- "Claude Code is included in all paid plans. It shares the same usage limits as the rest of your
  plan" ([claude.com/pricing](https://claude.com/pricing)). `claude -p` and Agent SDK use on a plan
  also draw from those limits ([support 15036540](https://support.claude.com/en/articles/15036540)).
- A plan is a flat price with a **usage ceiling**, not a dollar meter: when the limit is reached
  Jarvis waits for the reset. Providers don't publish a token figure for plan limits, so never promise
  "X messages a day"; say "si llegas al límite, espera al reinicio".
- A plan only ever counts for the unmodified `claude` binary used by its owner (or `codex` for a
  ChatGPT plan). Hermes, OpenClaw, Agent SDK products and any other harness use an **API key** and
  are quoted with § 3 (`auth-matrix.md`).

## 5. Reconciled quote table (total USD/month, verified 2026-10-06)

Model tokens + hosting. Hardware, electricity, WhatsApp template fees (`countries/<cc>.md`), voice
(`capabilities/voice.md`) and paid tools (invoicing, CRM) are **not** included; add them as
separate lines when the design uses them.

| # | Runtime | Credential | Hosting | Light | Medium | Heavy | Caveats |
|---|---|---|---|---|---|---|---|
| 1 | `claude-code-local` / `claude-p-cron` / `cowork` | Claude plan | Local (or vendor, for Cowork) | 20 (Pro) | 100 (Max 5x) | 200 (Max 20x) | $0 extra if they already pay. No token figure is published for plan limits; quote the plan, not messages |
| 2 | `claude-code-server`, 24/7 | Claude plan (**flagged path**, Gate C consent) | Railway Hobby | 28–36 | 108–116 | 208–216 | Default for this runtime is an API key (`auth-matrix.md`); subscription 24/7 on a server is a grey zone under Anthropic's terms: explain the risk and get Gate C consent, or use an API key. Memory-leak risk (CMP-22) |
| 3 | `claude-agent-sdk` worker, Sonnet chat + Haiku jobs (85/15) | `ANTHROPIC_API_KEY` | Railway Hobby (Tier A) | ~14 | ~70 | ~450 | Sonnet-only: 15 / 76 / 495 (use it for the cap). Truly routed 80/20: 10 / 41 / 254. Tier B: add § 2 add-ons |
| 4 | `claude-agent-sdk` worker, Sonnet chat + Haiku jobs (85/15) | `ANTHROPIC_API_KEY` | Local | ~9 | ~64 | ~444 | Truly routed: 5 / 35 / 248 |
| 5 | `hermes`, OpenAI routed | `OPENAI_API_KEY` | Railway Hobby | 9–13 | 18–22 | 85–89 | +5.5% on tokens if via OpenRouter credits |
| 6 | `hermes`, Claude routed | `ANTHROPIC_API_KEY` | Railway Hobby | 12–16 | 42–46 | 255–259 | |
| 7 | `hermes` + `ollama-local` | none | Local hardware | ~0 | ~0 | ~0 | Quality ceiling = the local model |
| 8 | `openclaw`, Claude routed | `ANTHROPIC_API_KEY` | Railway Hobby | 14–18 | 44–48 | 257–261 | Build needs 2 GB RAM |
| 9 | `openclaw`, OpenAI routed | `OPENAI_API_KEY` | Railway Hobby | 11–15 | 20–24 | 87–91 | |
| 10 | `codex-openai` | ChatGPT plan | Local | 20 (Plus) | 100 (Pro) | 200 (Pro) | Plan prices re-checked live by `stack-researcher` before quoting |
| 11 | Lean custom worker, `openai.cheap` only | `OPENAI_API_KEY` | Railway Hobby | 5 | 7.5 | 22.5 | Cheapest 24/7 cloud option; weakest model |

Not in the table: `claude-code-server` with an API key (the compliant default). Quote it as
Railway § 2 row (8–16) + Claude routed § 3 (Light ~$4.8 → **~$13–21**; Medium ~$43–51).
`decision-tree.md` § 4 archetype 12 rounds this to ~$15–30 to leave headroom for Sonnet-heavy chat.

## 6. How the Architect presents a quote

Done at ARCHITECTURE (`questions/3-confirmacion.md`), after `stack-researcher` has re-checked the
prices it is about to use.

1. **Pick the tier from what they said**, not from what they hope: messages a day, number of
   scheduled jobs, whether customers write to it. State the tier and its assumptions in one line.
2. **Split the number**: `~$X/mes (modelo ~$Y + servidor ~$Z)`. Plan-based stacks say
   "$0 extra, usa tu plan de <Pro/Max>".
3. **Name the multipliers before they commit**: the ×1.3 tokenizer for Claude `main`/`max`, the
   5.5% OpenRouter fee, the Haiku 4.5 retirement caveat if `anthropic.cheap` is in the design.
   While the `cheap` slot has an open retirement window, **size the cap on the post-fallback cost**
   (the Sonnet 5.5 line), so the automatic move to the fallback can't hit the cap in week one; and
   `/jarvis-doctor` warns when `models.json` marks the retirement as announced.
   If the design keeps the built-in web search on, add a line: $10 per 1,000 searches (a
   briefing with ~5 searches a weekday ≈ 110 searches ≈ $1.1/month).
4. **Show the 5× case** (pre-mortem angle 1): "Si lo usas 5 veces más, serían ~$… — por eso el tope."
5. **State the cap** (§ 7) and what happens when it is hit: Jarvis stops answering until next month
   or until they raise it. Nothing else breaks and no surprise bill arrives.
6. **Currency.** Quote in USD (that is what providers bill). Add one line: "Tu banco puede cobrar
   tipo de cambio y tu país puede sumar impuestos a servicios digitales." Exact local tax rates are
   not tracked here; use `countries/<cc>.md` if it covers it, otherwise say only the line above.
7. **Separate extras** as their own lines: WhatsApp template messages, a second SIM, voice minutes,
   invoicing folios, paid MCP tools (e.g. an invoicing/accounting plan with API access).
8. **One-time "costo de armarlo".** The Architect itself runs in Claude Code. On a Pro/Max login it
   uses the plan's limits ($0 extra). On a Console API key, a full `/jarvis-start` (interview,
   `stack-researcher`, build, `jarvis-validator`) is roughly **$5–20 once** (estimate:
   it depends on the model Claude Code uses and how many build retries there are; the dedicated
   workspace spend limit below caps it).
   Say it before DISCOVERY ends for API-key users, and recommend a dedicated Console workspace with
   its own spend limit for Claude Code itself (§ 7), never the Default Workspace. A free claude.ai
   account can't run Claude Code; for a `0` budget with no plan, say so and suggest `/jarvis-quick`
   to keep the session short.
8. The person must accept the quote and the cap explicitly. Write both into `jarvis-spec.md` §6
   (no `{{cap}}` left, or `jarvis-validator` flags SEC-27).

Example (Spanish, Light, `hermes` + Claude routed on Railway):

```
Costo estimado: ~$13/mes (modelo ~$5 + servidor ~$8), uso ligero (~20 mensajes al día).
Si lo usas 5 veces más: ~$32/mes.
Tope de gasto: $10 en Anthropic y $20 en Railway (aviso a los $8). Si se alcanza, Jarvis se pausa
hasta el mes siguiente; no te llega una factura sorpresa.
```

## 7. Setting caps (SEC-27), per provider

All caps are `user_action` tasks in `tasks.json`, ordered **before** the first model call or deploy.
The Architect can't see dashboards; the person confirms with a screenshot or a "listo".

**Sizing rule:** provider cap ≈ 2× the monthly token estimate, rounded up to a round number
(`decision-tree.md` § 5.2). Railway hard limit = max($10, ~2× the hosting estimate); soft alert at
the estimate.

| Provider | Where | What to set | What happens at the limit | Source |
|---|---|---|---|---|
| **Anthropic API** | Claude Console → Settings → Workspaces → *new workspace* "jarvis-<slug>" → **Spend limits** tab | A **dedicated workspace** with a monthly spend limit and alert thresholds, and an API key created **in that workspace**. Optional: rate limits tab (requests/tokens per minute) | Requests in that workspace are refused until the month resets or the limit is raised | [workspaces](https://platform.claude.com/docs/en/build-with-claude/workspaces) |
| **OpenAI API** | Platform → Project settings → **Limits** → Spend → *Edit spend limit*; also org limits | A dedicated project for Jarvis with a **project hard limit**, plus spend alerts (e.g. 50/75/90%) | `429` with code `project_spend_limit_exceeded` (org: `organization_spend_limit_exceeded`). Enforcement is "not instantaneous": spend can slightly exceed the cap | [spend-limits guide](https://developers.openai.com/api/docs/guides/spend-limits) |
| **OpenRouter** | Key settings → credit limit on the key | A per-key credit limit; prepaid credits are themselves a ceiling | Key stops working past its limit | [openrouter.ai/pricing](https://openrouter.ai/pricing) (if the per-key limit field isn't where described, use prepaid credits as the ceiling) |
| **Railway** | Workspace → **Usage** page, or `railway usage limit set --target workspace --soft <alert> --hard <limit>` | **Soft limit** = email alert; **hard limit** ≥ $10 | Hard limit: "all your workloads will be taken offline". Reminders at 75/90/100%. Compute and Railway-Agent limits are separate | [cost control](https://docs.railway.com/pricing/cost-control) |
| **Claude / ChatGPT plan** | Plan settings | Keep paid **extra usage** off unless they say yes in the same turn (SKILL rule 8) | Jarvis waits for the plan's limit to reset | [claude.com/pricing](https://claude.com/pricing) |

Notes:

- **Anthropic: never the Default Workspace.** Limits can't be set on it ("You cannot set limits on
  the Default Workspace"), and a workspace limit can't exceed the organization's. One workspace and
  one key per Jarvis also makes revocation clean (`security-checklist.md` incident steps).
- The Anthropic organization-level spend limit (Settings → Limits) also applies; mention it if they
  use the same org for other work.
- The OpenAI hard-limit launch date (reported as 2026-07-22) comes from a secondary source; what
  matters is the live guide, which documents the hard limit. Older write-ups say the error is
  `insufficient_quota`; the live guide says `project_spend_limit_exceeded`, and the live guide wins.
  Treat either code as "cap reached".
- A Railway hard limit takes the service offline: the person must know Jarvis goes silent when it
  is hit. Set the soft alert low enough that they hear about it first.
- Provider caps are the backstop. App-side limits (max turns, loop breaker, per-job budget, kill
  switch) are SEC-28 and go in the runtime config (`runtimes/<id>.md` § Security hardening).

## 8. Setup notes per runtime

| Runtime | Cost lever to configure | Cap |
|---|---|---|
| `claude-code-local`, `claude-p-cron` | Plan: nothing metered. API-key variant: `cheap` model for crons, `--max-turns` on every `claude -p` | Plan limit / Anthropic workspace limit |
| `claude-code-server` | Memory cap + restart policy (hosting cost), API key by default | Anthropic workspace + Railway usage limit |
| `claude-agent-sdk` | `maxTurns`, a per-day $ budget in code, `cheap` for background jobs | Anthropic workspace (+ Railway) |
| `hermes`, `openclaw` | Model routing in their config: `cheap` for heartbeats/jobs, `main` for chat | Provider cap + Railway usage limit |
| `codex-openai` | Plan: nothing metered | Plan limit |
| `ollama-local` | None (local). In hybrid setups, route only non-sensitive work to the cloud key | Cloud key cap only |
| `cowork` | Plan only | Extra usage off |

Exact config keys are in each `runtimes/<id>.md` § Cost.

## Security

- **SEC-27**: provider spend cap and Railway usage limit set before the first model call or deploy.
  Missing → MAJOR.
- **SEC-28**: app-side turn limits, loop breaker and kill switch; a runaway loop is a cost incident.
- A leaked key is a cost incident too: the dedicated, capped workspace/project bounds the damage.
  Rotate per `security-checklist.md`.
- Never fit a budget by switching to a non-compliant credential (a Claude plan inside Hermes, an
  unofficial WhatsApp bridge without consent). Compliance > security > cost (`decision-tree.md`).
- Never read a billing dashboard or key on the person's behalf; they confirm caps themselves (SKILL rule 7).

## Re-checked live before quoting

`stack-researcher` (and `/jarvis-refresh` for maintainers) re-checks these against the live source before
they reach a quote. If a live figure differs, the live figure wins and the quote says so.

- ChatGPT plan prices: [openai.com/chatgpt/pricing](https://openai.com/chatgpt/pricing).
- Plan limits: no token or message figure is published; quote the plan price and the reset behaviour only.
- Consumer Claude plan running Claude Code 24/7 headless on a server (quote row 2): grey zone; read the current consumer terms and usage policy, explain the risk, Gate C consent or API key.
- Hermes and OpenClaw RAM footprints: confirmed from Railway service metrics after the first day; `/jarvis-doctor` updates the quote.
- Lean worker and Agent SDK footprints: same metrics check.
- Railway build billing: [docs.railway.com/pricing/plans](https://docs.railway.com/pricing/plans).
- OpenAI hard-limit behaviour ([spend-limits guide](https://developers.openai.com/api/docs/guides/spend-limits)); OpenRouter per-key limit ([openrouter.ai/pricing](https://openrouter.ai/pricing)).
- Local digital-services tax on USD card charges: only from `countries/<cc>.md`; otherwise the generic bank/tax line.
- Max 20x price: [claude.com/pricing](https://claude.com/pricing) previously listed $200; the 2026-10-06 page summary rendered "From $100" for both Max tiers. Re-check on `/jarvis-refresh`.

## Sources

Fetched 2026-10-06 unless noted.

- https://platform.claude.com/docs/en/about-claude/pricing (unit prices, tokenizer ×1.3, batch, inference_geo ×1.1, web search, Managed Agents; re-fetched 2026-10-06)
- https://platform.claude.com/docs/en/about-claude/model-deprecations (Haiku 4.5 retirement window)
- https://platform.claude.com/docs/en/build-with-claude/workspaces (workspace spend and rate limits; re-fetched 2026-10-06)
- https://claude.com/pricing (Pro/Max prices, Claude Code included; re-fetched 2026-10-06)
- https://support.claude.com/en/articles/15036540 (Agent SDK / `claude -p` draw from plan limits)
- https://developers.openai.com/api/docs/pricing and https://developers.openai.com/api/docs/models (OpenAI prices and IDs)
- https://developers.openai.com/api/docs/guides/spend-limits (project/org hard limits, 429 codes; re-fetched 2026-10-06)
- https://openrouter.ai/pricing and https://openrouter.ai/docs/faq (5.5% fee, BYOK; re-fetched 2026-10-06)
- https://docs.railway.com/pricing/plans, https://docs.railway.com/pricing/understanding-your-bill (rates, Hobby = max($5, usage))
- https://docs.railway.com/pricing/cost-control (soft/hard usage limits, $10 minimum; re-fetched 2026-10-06)
- https://docs.railway.com/deployments/restart-policy (`Always` restart on paid plans only)
- https://docs.railway.com/guides/estimate-ai-agent-costs ("$10 to $30 a month" full agent stack)
- https://railway.com/deploy/openclaw-railway-o-1 and https://station.railway.com/questions/open-claw-need-more-ram-space-c3359798 (OpenClaw RAM)
- https://horadecodar.com.br/?p=42535 and https://www.virtua.cloud/de/vps/hermes-agent (Hermes RAM, secondary)
- https://claudeissues.com/issue/61425-bug-excessive-memory-usage-700-mb-rss-per-cli-instance and https://claudeissues.com/issue/76185-headless-p-session-leaks-to-10-15gb-rss-while-idle-on-long-running-background-ba (Claude Code idle memory)
- https://techcrunch.com/2026/04/09/chatgpt-pro-plan-100-month-codex/ (ChatGPT plan prices, secondary)
