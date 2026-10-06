# Compatibility: known-bad combinations

> Combinations the Architect must never ship. Each one has the fix to apply instead. A hit is a design bug, not a risk to list.

Last verified: 2026-10-06

## How to use this file

- In DEEP DIVE, and again at the ARCHITECTURE gate (`questions/2-ramas.md` step 8, `questions/3-confirmacion.md` step 1), check every drafted slot combination against the table below.
- **BLOCK** means you change the design and do not offer it as an option. **WARN** means it is allowed only after you tell the person in one line and get a yes at Gate C (`questions/3-confirmacion.md`), logged with the date in `jarvis-spec.md` → *Decisions and consents*. No consent → use the *Do instead* column. **WARN→fix** means the combination may stay, but only with the fix in *Do instead* applied during BUILD; no consent question is needed.
- This file pins no version numbers. Security floors and pinned versions live in `runtimes/<id>.md`. Model IDs, prices and the banned list live in `models.json`.
- Items marked **UNVERIFIED** rest on secondary sources or on facts not yet tested. Have `stack-researcher` re-check them before you cite them to the person.

## Index

| ID | Combination | Level | Do instead (short) |
|---|---|---|---|
| CMP-01 | Ollama / local models hosted on Railway | BLOCK | Run local models on the person's own hardware; use an API model on Railway |
| CMP-02 | Claude Pro/Max subscription login inside Hermes, OpenClaw, NanoClaw or Agent SDK code | BLOCK | `ANTHROPIC_API_KEY` (or Bedrock/Vertex/Foundry credentials) |
| CMP-03 | OpenClaw below the security floor in `runtimes/openclaw.md` | BLOCK | Install the pinned stable version or newer |
| CMP-04 | OpenClaw gateway / Control UI reachable from the internet | BLOCK | Loopback bind + token; remote via Tailscale/SSH |
| CMP-05 | WhatsApp through Baileys (Hermes default, OpenClaw, NanoClaw) without consent or on the main number | BLOCK | WhatsApp Cloud API, or Baileys with logged consent + second number |
| CMP-06 | WhatsApp required + OpenClaw/NanoClaw + no Baileys consent | BLOCK | Hermes (Cloud API) or n8n WhatsApp Cloud node |
| CMP-07 | Jarvis offered as a general-purpose AI assistant to third parties over the WhatsApp Business Platform | BLOCK | Personal use or business-serving-own-customers only |
| CMP-08 | Claude Code Channels with Bedrock, Vertex (Google Cloud) or Foundry credentials | BLOCK | claude.ai login or Console API key |
| CMP-09 | Claude Code Remote Control with an API key or `CLAUDE_CODE_OAUTH_TOKEN` | BLOCK | `/login` with a claude.ai plan, or use Channels instead |
| CMP-10 | Railway Free or Trial plan for a 24/7 Jarvis | BLOCK | Railway Hobby with a usage limit |
| CMP-11 | Two Hermes gateways (or replicas) on one data volume | BLOCK | Exactly 1 replica, 1 volume at `/opt/data` |
| CMP-12 | Railway healthcheck treated as liveness monitoring | WARN→fix | Restart policy `Always` + external uptime monitor |
| CMP-13 | New `railway.json` / `railway.toml`, or relying on it after 2026-12-01 | BLOCK | `.railway/railway.ts` (Infrastructure as Code) |
| CMP-14 | Claude Code Channels on native Windows | WARN (UNVERIFIED) | WSL2 |
| CMP-15 | Gemini CLI on a free Google login | BLOCK | Gemini API key / Vertex, or another runtime |
| CMP-16 | OpenAI tool calling through Chat Completions | BLOCK | Responses API (`/v1/responses`) |
| CMP-17 | Claude Cowork as the runtime when Telegram/WhatsApp/Discord is required | BLOCK | Claude Code local + Channels, or Hermes |
| CMP-18 | Cloud Routines (`/schedule`) for jobs that need local files or local MCP | BLOCK | Desktop scheduled tasks / local cron |
| CMP-19 | HIPAA or other regulated health data on Claude Pro/Max | BLOCK | Local model, or API/Enterprise under a BAA |
| CMP-20 | CONTPAQi integration on Railway | BLOCK | Local Windows bridge or XML/Excel exports |
| CMP-21 | OpenClaw or Claude Code 24/7 on Railway with < 1 GB RAM, or OpenClaw build with < 2 GB | BLOCK | Hobby plan, memory sized per `capabilities/deploy-railway.md` |
| CMP-22 | Claude Code kept alive 24/7 with no memory cap / restart policy | BLOCK | Memory cap + restart policy + supervisor |
| CMP-23 | Railway serverless (app sleeping) on a webhook-driven bot | BLOCK | Serverless off, or Telegram long polling |
| CMP-24 | Ollama with its default context window for an agent with tools + memory | BLOCK | Set `OLLAMA_CONTEXT_LENGTH` / `num_ctx` to 64K (32K hard minimum only where the harness accepts it; Hermes needs ≥64K) |
| CMP-25 | Small local model (≈8–12B) driving many tools or multi-step chains | WARN→fix | ≤ 5 tools, one-step jobs; bigger tier or API for the rest |
| CMP-26 | Forced `tool_choice`, `thinking:disabled` on Opus, or non-default `temperature` on current Claude models | BLOCK | `tool_choice: auto` + strict tools; effort; omit sampling params |
| CMP-27 | A deprecated or legacy model as a default slot | BLOCK | The slots in `models.json` |
| CMP-28 | `claude --bare` with `CLAUDE_CODE_OAUTH_TOKEN` | BLOCK | API key with `--bare`, or drop `--bare` |
| CMP-29 | `CLAUDE_CODE_OAUTH_TOKEN` plus a stored `/login` credential in the same container | BLOCK | One credential only |
| CMP-30 | Jarvis Architect (or anyone) hosting Jarvis for other people on one person's subscription | BLOCK | Each person brings their own key or login |
| CMP-31 | Hermes Anthropic OAuth ("routes as Claude Code") | BLOCK | `ANTHROPIC_API_KEY` |
| CMP-32 | Hermes/OpenClaw reusing a Codex/ChatGPT login on a server | WARN (UNVERIFIED) | `OPENAI_API_KEY`; SIWC only where documented |
| CMP-33 | Railway volume service with replicas > 1 | BLOCK | 1 replica |
| CMP-34 | Claude Managed Agents on Bedrock or Vertex | BLOCK | Claude API key |
| CMP-35 | Private/sensitive data on a free tier that trains on inputs (e.g. Gemini free tier) | BLOCK | Paid API tier or local model |
| CMP-36 | Claude Code sandbox expected on native Windows | BLOCK | WSL2 (bubblewrap sandbox) |
| CMP-37 | Stripe MCP with a full secret key | BLOCK (from 2026-10-31) | Stripe Agent API key or OAuth |
| CMP-38 | Unattended cron jobs allowed to run irreversible actions | BLOCK | Cron defaults to deny; human approval |

---

## Details

### CMP-01 · Ollama / local models on Railway
- **Why it fails:** A CPU-only 7B model needs about 8 GB RAM and 2 vCPU. On Railway that costs roughly $120 a month, and the result is slow. Railway offers no GPUs for this (GPU availability UNVERIFIED for late 2026; the cost alone rules it out).
- **Do instead:** Local models run only on the person's own Mac or PC (`runtimes/ollama-local.md`). On Railway, use an API model from `models.json` (cheapest 24/7 option: OpenAI `cheap` slot with a lean worker). If they want privacy *and* 24/7, use an always-on home machine plus Tailscale (`capabilities/deploy-local.md`).
- **Source:** https://docs.railway.com/pricing/plans (RAM $10/GB-month, CPU $20/vCPU-month), cost model in `capabilities/costs.md`.

### CMP-02 · Claude subscription inside a third-party harness
- **Why it fails:** Anthropic does not permit routing third-party harness traffic through Free/Pro/Max plan credentials. The Agent SDK docs say: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products." Tools that "misrepresent their identity… [or] route third-party traffic against subscription limits" are prohibited, and enforcement can happen without notice.
- **Do instead:** `ANTHROPIC_API_KEY` from the Console for Hermes, OpenClaw, NanoClaw and Agent SDK code (Bedrock, Vertex or Foundry credentials are also allowed when the person already has them). A subscription is valid only in the unmodified `claude` binary, used by its owner (`auth-matrix.md`, SEC-30).
- **Source:** https://code.claude.com/docs/en/legal-and-compliance, https://code.claude.com/docs/en/agent-sdk/overview, https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account

### CMP-03 · OpenClaw below the security floor
- **Why it fails:** CVE-2026-25253 (CVSS 8.8) is a one-click token theft leading to RCE. It works even on loopback-only installs. Later advisories (SSRF, arbitrary file read via `$include`, setup-code replay, workspace `.env` injection) and later hardening releases mean the first patched release is not a safe floor.
- **Do instead:** Install the pinned stable version from `runtimes/openclaw.md` § Pinned versions, and refuse anything below its stated floor (SEC-25). Have `stack-researcher` check the releases page live at install time. Never install prereleases (`-beta`). Even on a current version the Control UI stays off the internet (CMP-04).
- **Source:** https://github.com/advisories/GHSA-g8p2-7wf7-98mq, https://advisories.gitlab.com/npm/openclaw/, https://github.com/openclaw/openclaw/releases

### CMP-04 · OpenClaw gateway exposed publicly
- **Why it fails:** Early default configs bound the gateway to `0.0.0.0:18789` without auth. Internet scans found tens of thousands of exposed instances leaking keys and chat history (counts UNVERIFIED, secondary sources).
- **Do instead:** Bind the gateway and Control UI to `127.0.0.1` with `OPENCLAW_GATEWAY_TOKEN`. Remote access goes through Tailscale `serve`, an SSH tunnel or an authenticated proxy. On Railway, give no public domain to the gateway. Run `openclaw security audit`. Maps to SEC-05 in `security-checklist.md`. Current OpenClaw docs say the gateway binds to loopback by default; still check it, because older configs and Railway templates may not.
- **Source:** https://docs.openclaw.ai/gateway/security, https://adversa.ai/blog/openclaw-security-101-vulnerabilities-hardening-2026/

### CMP-05 · Baileys (unofficial WhatsApp) without consent or on the main number
- **Why it fails:** Baileys emulates WhatsApp Web. That breaks WhatsApp's terms and risks a ban on the number. Hermes docs: "Using a third-party bridge carries a small risk of account restrictions."
- **Do instead:** Default to the **WhatsApp Business Cloud API** (Hermes supports it natively and needs a Meta Business account plus a public webhook, which Railway provides). Offer Baileys only after an explicit warning, logged consent, and a **dedicated second number**. Never use the person's main number. Owner-only allowlist on the bridge (SEC-01). See `capabilities/whatsapp.md` and SEC-31. On a local install the Cloud API needs a public HTTPS webhook (a tunnel), so local + WhatsApp usually means Railway for the webhook part.
- **Source:** https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp, https://docs.openclaw.ai/channels/whatsapp

### CMP-06 · WhatsApp required + OpenClaw/NanoClaw + no Baileys consent
- **Why it fails:** OpenClaw ("production-ready via WhatsApp Web (Baileys)… there is no separate Twilio WhatsApp channel") and NanoClaw are Baileys-only. Without consent, they have no WhatsApp path.
- **Do instead:** Hermes with the Cloud API, or n8n with its WhatsApp Business Cloud node. Otherwise drop WhatsApp and use Telegram.
- **Source:** https://docs.openclaw.ai/channels/whatsapp, https://github.com/qwibitai/nanoclaw

### CMP-07 · General-purpose AI assistant offered over the WhatsApp Business Platform
- **Why it fails:** Meta's WhatsApp Business terms (updated 2026-09-23) bar AI providers from using the platform to "provide, deliver, offer or sell" AI when AI is "the primary functionality". A business assistant that serves the business's own customers (bookings, orders, FAQ) is allowed. A personal Jarvis on the Cloud API is a grey zone, so disclose it.
- **Do instead:** Personal Jarvis: tell the person about the grey zone in one line, or use Telegram. Business: limit the scope to its own customers. Jarvis Architect must never offer "your Jarvis on WhatsApp" as a hosted product.
- **Source:** https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform, https://respond.io/blog/whatsapp-general-purpose-chatbots-ban

### CMP-08 · Claude Code Channels on Bedrock / Vertex / Foundry
- **Why it fails:** The docs say Channels "require Anthropic authentication through claude.ai or a Console API key, and are not available on Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry."
- **Do instead:** A claude.ai login (local, owner only) or `ANTHROPIC_API_KEY`. If the person must stay on Bedrock or Vertex, pick a harness with its own channels (Hermes) and point it at that provider.
- **Source:** https://code.claude.com/docs/en/channels (fetched 2026-10-06)

### CMP-09 · Remote Control with an API key or setup-token
- **Why it fails:** Remote Control requires a claude.ai login. "API keys are not supported", and the setup-token "can't establish Remote Control sessions".
- **Do instead:** `/login` with a Pro/Max/Team/Enterprise plan, kept alive in tmux/screen. On a server with an API key, use Channels (Telegram/Discord) for phone access instead.
- **Source:** https://code.claude.com/docs/en/remote-control, https://code.claude.com/docs/en/authentication#generate-a-long-lived-token

### CMP-10 · Railway Free or Trial for 24/7
- **Why it fails:** Free has $1/month of usage, 0.5 GB RAM per service and a 0.5 GB volume. Trial is a one-time $5 for 30 days. The `Always` restart policy is paid-plan only, so Free and Trial get `On Failure` with at most 10 restarts.
- **Do instead:** Railway Hobby, with a usage limit set **before** deploy (SEC-27). Free or Trial is fine for a demo, and you say so.
- **Source:** https://docs.railway.com/pricing/plans, https://docs.railway.com/deployments/restart-policy

### CMP-11 · Two Hermes gateways on one volume
- **Why it fails:** Hermes docs: "Never run two Hermes gateway containers against the same data directory." State (sessions, memories, `.env`) gets corrupted.
- **Do instead:** One gateway, one replica, one volume mounted at `/opt/data`. To test a new version, use a separate service with its own volume, and stop the old one before switching.
- **Source:** https://hermes-agent.nousresearch.com/docs/user-guide/docker

### CMP-12 · Railway healthcheck as liveness
- **Why it fails:** Railway runs the healthcheck only at deploy time, not continuously. A Jarvis that hangs after deploy stays "healthy".
- **Do instead:** Restart policy `Always` (Hobby or higher), an in-process watchdog, and an external uptime monitor or heartbeat job that alerts the owner. `/jarvis-doctor` checks the real channel round-trip.
- **Source:** https://docs.railway.com/deployments/healthchecks

### CMP-13 · `railway.json` / `railway.toml`
- **Why it fails:** Config as Code is deprecated. New services can no longer adopt it, and existing files stop working on **2026-12-01** (hard cutoff).
- **Do instead:** Generate `.railway/railway.ts` and apply it with `railway config plan` / `railway config apply`. Migrate legacy files with `railway config migrate`. See `capabilities/deploy-railway.md`.
- **Source:** https://docs.railway.com/config-as-code, https://docs.railway.com/infrastructure-as-code

### CMP-14 · Claude Code Channels on native Windows — UNVERIFIED
- **Why it may fail:** Channel plugins are Bun scripts. A native-Windows Channels run has not been tested. Native Windows also has no Claude Code sandbox (CMP-36), and bash-form hooks without Git Bash are expected to fail (UNVERIFIED).
- **Do instead:** Run Claude Code with Channels inside WSL2 (projects in `~`, not `/mnt/c`). If the person refuses WSL2, use Hermes (native Windows supported) or test Channels live and record the result.
- **Source:** https://code.claude.com/docs/en/channels, https://code.claude.com/docs/en/setup, https://code.claude.com/docs/en/sandboxing

### CMP-15 · Gemini CLI on a free Google login
- **Why it fails:** Free login for Gemini CLI ended 2026-06-18. The binary now needs an API key or Vertex. Free users are pointed to the Antigravity CLI, whose free quota is reported at a few dozen requests per day (secondary sources, UNVERIFIED).
- **Do instead:** Use a Gemini API key (paid tier for private data, see CMP-35) or pick another runtime from `decision-tree.md`.
- **Source:** https://dev.to/owen_fox/gemini-cli-free-tier-shut-down-6-fixes-that-work-2026-26hc (secondary)

### CMP-16 · OpenAI tools via Chat Completions
- **Why it fails:** The current OpenAI models are documented on the Responses API. Tool calling for the `main` slot model is not available on Chat Completions, and the wrong endpoint often surfaces as a misleading "unknown model" error.
- **Do instead:** Configure harnesses and custom code to use `/v1/responses`. Before writing a config, list models on the person's own key (`GET /v1/models`) to rule out staged access.
- **Source:** https://developers.openai.com/api/docs/models (fetched 2026-10-06), https://www.callmissed.com/blog/gpt-sol-launch-pricing-model-id-availability (secondary)

### CMP-17 · Cowork + Telegram / WhatsApp / Discord
- **Why it fails:** Claude Cowork reaches the phone through Dispatch and the Claude apps. It has no Telegram, WhatsApp or Discord channel and cannot be self-hosted (secondary sources, partly UNVERIFIED).
- **Do instead:** If the person needs one of those chat apps, use Claude Code local + Channels (subscription OK, owner only) or Hermes (API key). Keep Cowork for low-tech people who are happy to use the Claude app.
- **Source:** https://support.claude.com/en/articles/12138966-release-notes, https://www.gradually.ai/en/changelogs/claude-cowork/ (secondary)

### CMP-18 · Cloud Routines for jobs that need local files
- **Why it fails:** Cloud Routines (`/schedule`) run on Anthropic's cloud in a fresh clone. They have no access to the laptop's files or local-only MCP servers, the minimum interval is 1 hour, and there are reported daily run caps (secondary, UNVERIFIED).
- **Do instead:** Desktop scheduled tasks (machine and app must be on, 1-minute minimum, local files and MCP available), or a local cron / launchd job running `claude -p` (`runtimes/claude-p-cron.md`). Use Routines only for connector-based jobs (Gmail, Calendar) that must run while the laptop is off.
- **Source:** https://code.claude.com/docs/en/scheduled-tasks, https://makerkit.dev/blog/tutorials/claude-code-routines-guide (secondary)

### CMP-19 · Health data (HIPAA or local equivalents) on Claude Pro/Max
- **Why it fails:** Anthropic's BAA covers the API and Enterprise (and Claude Code only with ZDR on qualified accounts), not consumer Pro/Max plans (secondary sources, as of 2026-07, UNVERIFIED). Managed Agents has no ZDR/HIPAA. Patient data in a consumer plan is a compliance failure.
- **Do instead:** Keep identifiable patient data local (Ollama + local memory, `professions/health.md`), or use the API/Enterprise under a signed BAA. A Pro/Max Jarvis handles only non-patient tasks (agenda, literature). For LATAM, also follow the country pack's data-protection warning.
- **Source:** https://platform.claude.com/docs/en/managed-agents/overview; HIPAA scope from dev.to and intuitionlabs.ai (secondary)

### CMP-20 · CONTPAQi on Railway
- **Why it fails:** CONTPAQi has no MCP and no public cloud REST API. Integration goes through a Windows/.NET desktop SDK that must run beside the CONTPAQi installation. Railway cannot host it.
- **Do instead:** A local Windows bridge on the accountant's machine (wrapper via `mcp-tool-forge`), or work from XML/Excel exports. Otherwise say plainly that the integration is not supported. See `countries/mx.md`.
- **Source:** https://feed.nuget.org/packages/ARSoftware.Contpaqi.Comercial.Sdk.Extras, https://github.com/codespar/mcp-dev-latam (LATAM MCP catalog; lists no CONTPAQi server). "No public cloud REST API" is UNVERIFIED

### CMP-21 · Under-sized RAM for OpenClaw / Claude Code on Railway
- **Why it fails:** Railway's OpenClaw templates ask for at least 1 GB, and the Docker build is OOM-killed below 2 GB. Claude Code idles at about 360–700 MB RSS. Free's 0.5 GB cap fits neither.
- **Do instead:** Hobby plan. Size per `capabilities/deploy-railway.md`, or use the prebuilt pinned image instead of building on Railway.
- **Source:** https://station.railway.com/questions/open-claw-need-more-ram-space-c3359798, https://railway.com/deploy/openclaw-railway-o-1

### CMP-22 · Claude Code 24/7 with no memory cap
- **Why it fails:** Open issues report idle leaks of hundreds of MB per minute and headless sessions growing to 10–15 GB RSS. On Railway that is a surprise bill. Locally it freezes the machine.
- **Do instead:** Set a memory limit plus restart policy (Railway), or `launchd`/`systemd` with a memory limit and scheduled restart (local). Set the Railway usage limit first.
- **Source:** https://claudeissues.com/issue/76185-headless-p-session-leaks-to-10-15gb-rss-while-idle-on-long-running-background-ba, https://claudeissues.com/issue/61425-bug-excessive-memory-usage-700-mb-rss-per-cli-instance (secondary trackers)

### CMP-23 · Railway serverless + webhook bot
- **Why it fails:** With serverless on, a service sleeps 5–10 minutes after its last outbound packet, so every webhook message pays a cold start and scheduled jobs inside the process stop.
- **Do instead:** Keep serverless off for the Jarvis core. For Telegram, prefer long polling (no public domain needed).
- **Source:** https://docs.railway.com/deployments/serverless, https://docs.railway.com/guides/ai-discord-telegram-bot

### CMP-24 · Ollama default context for an agent
- **Why it fails:** Ollama picks a default context from VRAM: 4K below 24 GiB, 32K from 24 to 48 GiB, 256K at 48 GiB or more. A system prompt + tools + memory overflows 4K, and tool calling quietly gets worse.
- **Do instead:** Set `OLLAMA_CONTEXT_LENGTH` (or `num_ctx`). Ollama's docs say agents and coding tools "should be set to at least 64000 tokens". Treat 32K as the hard minimum on smaller machines **only for harnesses that accept it**: Hermes refuses to start below 64K, so under Hermes pick a smaller model rather than a smaller context (fallback order on 12 GB VRAM: `qwen3.5:9b` → KV cache `q8_0` → close other GPU apps; `runtimes/ollama-local.md`). Choose a tier from `models.json` → `local` that fits that context in memory.
- **Source:** https://docs.ollama.com/context-length (fetched 2026-10-06)

### CMP-25 · Small local model with many tools
- **Why it fails:** Models of about 8–12B fail on long tool lists and multi-step chains (qualitative, UNVERIFIED benchmarks).
- **Do instead:** Give them at most about 5 tools and one-step jobs (triage, summaries). Route multi-step work to a larger local tier or an API `main` slot, with consent if the data is private.
- **Source:** https://localaimaster.com/blog/best-ollama-models-for-agents (secondary)

### CMP-26 · Old request parameters on current Claude models
- **Why it fails:** On Opus 5.5, Sonnet 5.5 and Fable 5.1, forced `tool_choice` (`any`/`tool`) returns 400. On Opus 5.5, `thinking:{type:"disabled"}` returns 400. On 4.7 and later models, a non-default `temperature`/`top_p`/`top_k` returns 400. Some OpenAI-compatible shims and third-party harnesses may send these (Hermes/OpenClaw behaviour UNVERIFIED).
- **Do instead:** `tool_choice: auto` with strict tool schemas or structured outputs. Control depth with `effort`. Omit sampling parameters. During BUILD, run one tool-calling smoke test against the chosen harness + model.
- **Source:** https://platform.claude.com/docs/en/about-claude/model-deprecations (parameter deprecations), https://platform.claude.com/docs/en/about-claude/models/overview, https://platform.claude.com/docs/en/models/fable-5-1/overview

### CMP-27 · Deprecated or legacy model as a default
- **Why it fails:** Deprecated models stop working on their retirement date, and legacy ones cost more than or the same as their successors.
- **Do instead:** Fill slots only from `models.json` → `cheap`/`main`/`max`, and never from its `banned` list. Entries under `fallbacks` are used only when their trigger in `replaces` applies (for example, a deprecation notice on the `cheap` Claude model). Before writing any ID, re-check the deprecations page live.
- **Source:** https://platform.claude.com/docs/en/about-claude/model-deprecations, https://developers.openai.com/api/docs/pricing

### CMP-28 · `--bare` with the setup-token
- **Why it fails:** Bare mode does not read `CLAUDE_CODE_OAUTH_TOKEN`, so the run fails to authenticate.
- **Do instead:** Use `ANTHROPIC_API_KEY` with `--bare`, or run without `--bare` when the token is used.
- **Source:** https://code.claude.com/docs/en/authentication

### CMP-29 · Setup-token plus a stored login in the same container
- **Why it fails:** In `--channels` mode the CLI used a stored, expired Keychain/`.credentials.json` login instead of the valid env token (issue #80091). OAuth auto-refresh in long `--channels` sessions is also reported broken (#44945).
- **Do instead:** Exactly one credential per container. The default on servers is `ANTHROPIC_API_KEY` (`auth-matrix.md`). If the token path is chosen, make sure no `~/.claude/.credentials.json` exists.
- **Source:** https://github.com/anthropics/claude-code/issues/80091, https://github.com/anthropics/claude-code/issues/44945

### CMP-30 · Hosting Jarvis for other people on one subscription
- **Why it fails:** The Consumer Terms forbid sharing an account or making it "available to anyone else". Products for others must use API keys.
- **Do instead:** Each person runs their own Jarvis with their own API key or their own login in the unmodified binary. The channel allowlist contains only the owner (SEC-01, SEC-30).
- **Source:** https://www.anthropic.com/legal/consumer-terms, https://code.claude.com/docs/en/legal-and-compliance

### CMP-31 · Hermes Anthropic OAuth
- **Why it fails:** Hermes docs say its Anthropic OAuth "routes as Claude Code against your Anthropic account". That is the identity-misrepresentation pattern Anthropic prohibits.
- **Do instead:** `ANTHROPIC_API_KEY` in Hermes.
- **Source:** https://hermes-agent.nousresearch.com/docs/integrations/providers, https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account

### CMP-32 · Codex/ChatGPT login reused by Hermes or OpenClaw on a server — UNVERIFIED
- **Why it may fail:** Hermes can import `~/.codex/auth.json`. Whether OpenAI sanctions a third party reusing the Codex client token is undocumented. OpenAI's official path for plan usage in third-party apps is Sign in with ChatGPT (SIWC, preview, with limits such as no hosted MCP).
- **Do instead:** `OPENAI_API_KEY` by default. On OpenClaw, SIWC with a VM host ID is documented and may be offered as a second option.
- **Source:** https://developers.openai.com/siwc/token-sharing-open-source, https://docs.openclaw.ai/providers/openai/authentication

### CMP-33 · Railway volume + replicas
- **Why it fails:** A service can mount one volume, and services with a volume cannot use replicas. Each redeploy has a short downtime.
- **Do instead:** 1 replica for the Jarvis core. Tell the person that a redeploy causes a few seconds of downtime.
- **Source:** https://docs.railway.com/volumes/reference

### CMP-34 · Managed Agents on Bedrock or Vertex
- **Why it fails:** Claude Managed Agents is not available on Bedrock or Vertex.
- **Do instead:** Claude API key, or a self-run harness on Bedrock/Vertex.
- **Source:** https://platform.claude.com/docs/en/about-claude/pricing

### CMP-35 · Private data on a free tier that trains on inputs
- **Why it fails:** Google states that free-tier Gemini API data may be used to improve its products. That is a bad fit for a private Jarvis, and a legal problem once client data is involved (see the country pack).
- **Do instead:** A paid API tier or a local model. Keep free tiers for tests with fake data.
- **Source:** https://ai.google.dev/gemini-api/docs/pricing

### CMP-36 · Claude Code sandbox on native Windows
- **Why it fails:** Native Windows has no sandbox (macOS uses Seatbelt, Linux/WSL2 use bubblewrap). The sandbox control in `security-checklist.md` cannot pass.
- **Do instead:** WSL2 with `bubblewrap` and `socat` installed through the distro package manager (the person runs the install command themselves; the agent never uses sudo). On Ubuntu 24.04+, also check `kernel.apparmor_restrict_unprivileged_userns` and follow the AppArmor step in the sandboxing docs. Maps to SEC-07.
- **Source:** https://code.claude.com/docs/en/sandboxing

### CMP-37 · Stripe MCP with a full secret key
- **Why it fails:** From 2026-10-31, full secret keys and non-Agent restricted keys get 401 on the Stripe MCP. A full secret key also breaks least privilege.
- **Do instead:** OAuth or a Stripe Agent API key, read-only scopes first (SEC-22). Refunds and payouts keep Stripe's human-approval URL and SEC-14.
- **Source:** https://docs.stripe.com/mcp

### CMP-38 · Unattended jobs with irreversible actions
- **Why it fails:** A cron or heartbeat run has no human present. Sending money, stamping or cancelling a CFDI, mailing third parties or deleting data without review breaks the human-approval control.
- **Do instead:** Cron defaults to deny for irreversible actions (Hermes `cron_mode: deny` or equivalent; SEC-15). The job drafts the action and asks the owner on their channel, with an exact preview (SEC-14). The canonical irreversible-action list is in `security-checklist.md` § 1.
- **Source:** `security-checklist.md`; https://hermes-agent.nousresearch.com/docs/user-guide/docker

## Sources

- https://code.claude.com/docs/en/channels
- https://code.claude.com/docs/en/remote-control
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/legal-and-compliance
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/sandboxing
- https://code.claude.com/docs/en/scheduled-tasks
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.claude.com/docs/en/about-claude/model-deprecations
- https://platform.claude.com/docs/en/about-claude/pricing
- https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
- https://www.anthropic.com/legal/consumer-terms
- https://developers.openai.com/api/docs/models
- https://developers.openai.com/siwc/token-sharing-open-source
- https://docs.railway.com/pricing/plans
- https://docs.railway.com/deployments/restart-policy
- https://docs.railway.com/deployments/healthchecks
- https://docs.railway.com/deployments/serverless
- https://docs.railway.com/config-as-code
- https://docs.railway.com/volumes/reference
- https://hermes-agent.nousresearch.com/docs/user-guide/docker
- https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp
- https://hermes-agent.nousresearch.com/docs/integrations/providers
- https://docs.openclaw.ai/channels/whatsapp
- https://docs.openclaw.ai/gateway/security
- https://github.com/advisories/GHSA-g8p2-7wf7-98mq
- https://advisories.gitlab.com/npm/openclaw/
- https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- https://ai.google.dev/gemini-api/docs/pricing
- https://docs.stripe.com/mcp
- https://docs.ollama.com/context-length
