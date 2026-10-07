# Capability: WhatsApp

> How a Jarvis reaches WhatsApp in LATAM and Spain without getting the person's number banned or breaking Meta's terms: the official Cloud API by default, a BSP for businesses, and the unofficial Baileys bridge only behind a logged consent gate on a secondary number.

Last verified: 2026-10-06

Versions are not pinned here. For runtime versions see `knowledge/runtimes/hermes.md` and `knowledge/runtimes/openclaw.md`. Per-message prices live in `knowledge/countries/<cc>.md` (`mx`, `co`, `ar`, `es`, `other`).

## Decision rule

Ask two things first: **who writes to the bot** (only the owner, or the business's customers) and **which number** (a new one, or the person's everyday number).

| Situation | Path | Policy status | Default runtime |
|---|---|---|---|
| A business answers **its own customers** (bookings, orders, FAQs, lead qualification, appointment reminders) | **Cloud API** directly, or a **BSP** if they already use one (Kommo, Leadsales, Twilio…) | **Allowed.** AI is ancillary to the business service | `hermes` (Cloud API mode) on Railway, or n8n with the WhatsApp Business Cloud node |
| One person wants a **personal "ask me anything" Jarvis** on WhatsApp | **Cloud API** with the free test number or a new number of their own | **Grey zone** (see § Policy). Low enforcement risk at personal volume, not compliant by the letter. Say so in two lines | `hermes` (Cloud API mode) on Railway |
| Personal use, wants **zero policy risk** | **Telegram** instead (see `knowledge/capabilities/channels.md`); WhatsApp stays optional | No WhatsApp risk at all | any |
| Insists on WhatsApp **without a Meta account**, or wants OpenClaw / NanoClaw specifically | **Baileys** (unofficial WhatsApp Web bridge) | **Breaks WhatsApp ToS; number can be banned.** Only after the Spanish consent gate below, logged, on a **secondary number** | `hermes` (Baileys mode) or `openclaw` |
| Anyone wants to **offer "Jarvis on WhatsApp" to other people as a product or service** | **None. Refuse.** | **Forbidden** by Meta's AI-provider clause (outside Italy, Brazil and the EEA, and even there only on Meta's conditions) | — |
| The person's **everyday personal number** | Never for Baileys. For the Cloud API, only if they accept that the number moves off the normal WhatsApp app (see Step 3) | — | — |
| Laptop-only Jarvis (no Railway) and wants the Cloud API | Needs a public HTTPS webhook: Tailscale Funnel (see `knowledge/capabilities/deploy-local.md`), or move to Railway | — | `hermes` |

Hard lines:
- **Never default to Baileys.** It is offered only when the person asks for it or rejects the Cloud API, and only after consent.
- If WhatsApp is a requirement and the person **does not** consent to Baileys, **do not pick `openclaw` or NanoClaw**, because they have no official WhatsApp path.
- Stock Claude Code (`claude-code-local`, `claude-code-server`, `claude-p-cron`) has **no official WhatsApp channel**. Don't wire community bridges into it.

## Why WhatsApp matters here

- WhatsApp reaches about 93% of internet users in Mexico, 94% in Colombia and 90% in Argentina; Telegram is secondary in all three ([Infobip 2026](https://infobip.com/blog/whatsapp-statistics), secondary source). For this audience "everyone I know is on WhatsApp" is the normal answer. A Telegram-only answer feels wrong to them, so explain the tradeoff instead of ignoring the request.
- Telegram is still the right **personal** default when the person accepts it: free, official bot API, no ban risk.

## Policy: Meta's AI-provider clause

**What the terms say.** The Meta Terms for WhatsApp Business Platform (page shows *last updated 23 September 2026*) bar "AI Providers" from using the platform to provide, deliver, offer or sell AI technologies when AI is "the primary functionality (not incidental or ancillary)", as Meta decides at its sole discretion. Separately, WhatsApp Business data may not be used to train AI, except fine-tuning a model exclusively for your own use. ([Meta terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform), fetched 2026-10-06)

**Timeline.** The clause applied to new users from 2025-10-15 and to **all users from 2026-01-15** ([TechCrunch 2025-10-18](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform), [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)).

**Regulator exceptions** (Meta is legally required to let AI providers in):

| Market | What happened | Source |
|---|---|---|
| **Italy (+39)** | AGCM interim measures, December 2025. Meta exempts Italian numbers. Meta charged AI providers for non-template messages to +39 users 2026-02-16 → 2026-05-12, and **no longer charges from 2026-05-13** | [TechCrunch 2025-12-24](https://techcrunch.com/2025/12/24/italy-tells-meta-to-suspend-its-policy-that-bans-rival-ai-chatbots-from-whatsapp/), [Meta AI-providers pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) (fetched 2026-10-06) |
| **Brazil (+55)** | CADE preventive measure upheld 2026-03-04; daily fines upheld April 2026. Meta charges AI providers for non-template messages to Brazilian users from 2026-03-11 (still listed as ongoing on 2026-10-06) | [CNN Brasil](https://www.cnnbrasil.com.br/economia/negocios/cade-mantem-medida-preventiva-que-obriga-meta-a-permitir-chatbots-de-ia-no-whatsapp/), [Meta AI-providers pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) |
| **EU / EEA (incl. Spain)** | European Commission interim measures 2026-06-09 ordering access for rival general-purpose assistants; Meta is appealing. Meta's page lists EEA countries (Spain included) as charged for AI-provider non-template messages 2026-03-11 → 2026-05-12, and **no longer charged from 2026-05-13** | [Houthoff](https://www.houthoff.com/insights/news/a-rare-show-offorce-commission-deploys-interim-measures-against-meta-to-safeguard-ai-competition/), [Meta AI-providers pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) |
| **Mexico, Colombia, Argentina, rest of LATAM** | **No exception.** The clause applies in full | [Meta terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform); none listed on [Meta AI-providers page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) |

The exceptions are moving targets (appeals pending). Have `stack-researcher` re-check them before quoting.

**How the Architect classifies a use.** This is the Architect's interpretation, not legal advice; no lawyer has reviewed it, and the person hears that before choosing.

| Class | Example | Verdict | What the Architect says |
|---|---|---|---|
| **Allowed** | A restaurant's bot takes bookings; a clinic sends appointment reminders; a real-estate agent qualifies leads; a shop answers order status | AI is ancillary to the business | "Esto es justo lo que Meta permite: un negocio atendiendo a sus clientes." |
| **Grey** | One person, own WABA, talks to an open-ended Jarvis that does everything | The clause targets providers *distributing* assistants, and nobody is selling anything. But AI is plainly the primary function, and Meta decides at its discretion. Low enforcement risk at personal volume; not compliant by the letter. In Italy, Brazil and the EEA the risk is lower | "WhatsApp prohibió los asistentes de IA de uso general. Para un Jarvis solo tuyo el riesgo práctico es bajo, pero técnicamente es zona gris. Telegram no tiene ese problema." |
| **Forbidden** | Offering "your own Jarvis on WhatsApp" to clients, students or followers; a hosted Jarvis service; Jarvis Architect itself hosting WhatsApp bots for people | That makes the person (or this repo) an AI provider | "Eso Meta lo prohíbe. Para clientes, el bot tiene que ser parte de tu negocio, no el producto." |

Never let a generated Jarvis or this repo be positioned as an AI provider on WhatsApp.

**Unofficial bridges.** Baileys, whatsapp-web.js, WAHA and similar reverse-engineer WhatsApp Web. They break WhatsApp's terms and the number can be restricted or banned without warning ([Zylos 2026-01-26](https://zylos.ai/research/2026-01-26-whatsapp-api-automation); reports of bans "within days", secondary: zenvanriel.com, betterclaw.io 2026-04). Hermes' own docs say: "WhatsApp does **not** officially support third-party bots outside the Business API. Using a third-party bridge carries a small risk of account restrictions." ([Hermes WhatsApp docs](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp)). Railway's `waha-secure-with-webhook` template is also unofficial; the same consent gate applies.

## Options and tradeoffs

| Path | Cost | Setup effort | Ban risk | Needs public webhook | Best for |
|---|---|---|---|---|---|
| **Meta Cloud API, direct** | Platform fee per Meta rate card (see `knowledge/countries/<cc>.md`); a personal Jarvis is about $0 (see § Pricing) | Medium: Meta developer app, WABA, token, webhook | None from Meta for compliant use | Yes (Railway, or Tailscale Funnel locally) | Default for personal and small-business Jarvis |
| **BSP** (Twilio, YCloud, Gupshup, Zenvia, Leadsales, Kommo, Wati, respond.io, Infobip) | Meta rate + BSP markup or monthly plan (varies; check each) | Low to medium; Spanish support; some do the Meta onboarding for you | None for compliant use | Usually yes, or the BSP inbox | Businesses that already run WhatsApp sales/support, or want a human inbox next to the bot |
| **Baileys** (unofficial) | $0 platform fee | Low: scan a QR | **High**; number can be banned | No (outbound session) | Only with consent, secondary number, personal use |

BSPs active in LATAM ([YCloud LATAM list](https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america), secondary):
- **Leadsales**: Meta-appointed WhatsApp solution partner for LATAM SMEs ([Contxto](https://www.contxto.com/en/news/meta-chooses-leadsales-as-whatsapp-solution-partner-for-latin-america/)).
- **Kommo** (ex amoCRM): CRM with WhatsApp built in, very common in LATAM sales teams. No official MCP found as of 2026-10-06 (`stack-researcher` re-checks); community MCPs exist, see `knowledge/capabilities/tools-mcp.md`.
- **Zenvia**: offices in Mexico and Argentina. **Twilio**, **Gupshup**, **YCloud**, **Wati**, **respond.io**, **Infobip**: regional coverage.
- Rule: if the business already pays a BSP, connect Jarvis to that BSP rather than registering the number a second time. One number can only sit on one Cloud API setup at a time.

## Pricing (pointer only)

- Rates per country and category (marketing, utility, authentication) are in `knowledge/countries/mx.md`, `co.md`, `ar.md`, `es.md`, `other.md`. Do not quote them from here.
- **24-hour window.** Free-form replies are only possible within 24 h of the person's last message. Anything Jarvis sends **first** after that (a morning brief, a reminder) must be an approved **template**, billed at the utility or marketing rate of the recipient's country. Tell the person: "Si tú le escribes primero a Jarvis cada día, casi no cuesta; si Jarvis te escribe primero, cada mensaje es una plantilla con costo."
- **Service replies — sources differ:** Meta's pricing doc (fetched 2026-10-06) still says non-template messages are free; respond.io and flowcall say that from 2026-10-01 service replies are charged after the first 1,000 per number per month. Either way a personal Jarvis stays well under 1,000 replies, so its reply cost is about $0. `stack-researcher` re-checks the official rate card at install time; for a business bot that may pass 1,000 replies a month, quote with the charged reading ([Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [respond.io](https://respond.io/blog/whatsapp-pricing-change-2026.md)).
- Proactive templates cost money, so they are on the human-approval list for business bots (see `knowledge/security-checklist.md`).

## Setup: Cloud API, step by step (for a non-technical person)

Mark each human step as a `kind: "user_action"` task in `tasks.json`, with a post-condition the Architect can check. The person types secrets into Railway variables or `.env` themselves; **they never paste them into the chat.**

**Step 0. What you need.** A personal Facebook account, about 30 minutes, and the Jarvis service on Railway already created (see `knowledge/capabilities/deploy-railway.md`) so it has an HTTPS address.

**Step 1. Create the Meta app.**
1. Go to developers.facebook.com → *My Apps* → *Create app*.
2. Choose the use case **"Connect with customers through WhatsApp"** ([Meta get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)).
3. Link or create a Meta Business portfolio and a WhatsApp Business Account (WABA) when asked.
4. Post-condition: the app dashboard shows *WhatsApp → API Setup*.

**Step 2. Use the free test number first.**
1. In *API Setup*, Meta gives a test business number (usually a +1 555 number).
2. Under **To**, add the owner's own WhatsApp number and confirm the code WhatsApp sends.
3. The test number can only message numbers on that list; the commonly cited limit is **5 recipients** ([Wati](https://www.wati.io/en/blog/test-whatsapp-message-sends-safely/), [WANotifier help](https://help.wanotifier.com/en/article/test-phone-number-limitations-kt0ly2/); Meta's page does not state the number; if adding a recipient fails, that is the limit). That is enough for a personal Jarvis.
4. Press *Send message* to get the "hello_world" template on the phone. Post-condition: the person confirms they received it.

**Step 3. (Optional) Move to a real number.** Only for a business, or if the test number feels odd.
- Use a **new number** (new SIM or eSIM). A number registered on the Cloud API stops working in the regular WhatsApp / WhatsApp Business app unless Meta's "coexistence" onboarding is used (before using coexistence, check in WhatsApp Manager or with the BSP that it is offered in the person's country; if not, use a new number).
- Add the number, verify by SMS or call, and set the display name; Meta reviews the display name. Business verification is required to raise messaging limits (`stack-researcher` reads the current thresholds from Meta's messaging-limits page at install).

**Step 4. Create a permanent token.** The token shown in *API Setup* is temporary; Meta says it "expires quickly" ([Meta get started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)).
1. In Meta Business settings → *Users → System users*, create a system user and assign it the app and the WABA.
2. Generate a token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions (if the UI labels differ, pick the two permissions whose names contain `whatsapp_business`).
3. The person pastes it **straight into Railway variables**, not into the chat.
4. Also copy (not secret): the **Phone number ID** and the **WABA ID** from *API Setup*. Copy the **App secret** from *App settings → Basic* into Railway variables (it is secret).

**Step 5. The webhook on Railway.**
1. The Jarvis service must be a **web service with a public domain** (not a worker). **Leave serverless/sleep off**, or the first message after a pause cold-starts ([Railway serverless](https://docs.railway.com/deployments/serverless)).
2. Choose a random **verify token** (any long string; the person generates it, it goes into Railway variables).
3. In the Meta app → *WhatsApp → Configuration → Webhook*: callback URL `https://<service>.up.railway.app/<webhook-path>` and the same verify token. For `hermes` the default path is `/whatsapp/webhook` on port `8090`, so the Railway domain targets port 8090 and the URL is `https://<service>.up.railway.app/whatsapp/webhook` ([Hermes WhatsApp Cloud docs](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud)). Meta sends a GET with `hub.mode=subscribe`, `hub.verify_token` and `hub.challenge`; the service must check the token and echo `hub.challenge` ([Meta webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)).
4. Subscribe to the **`messages`** field.
5. Every POST must be checked: compute HMAC-SHA256 of the **raw request body** with the **App secret** and compare it (constant-time) to the value after `sha256=` in the **`X-Hub-Signature-256`** header. Reject on mismatch with 401/403 ([Meta webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)).
6. Answer 200 immediately and process in the background (Railway cuts HTTP requests after 5 minutes without data; see `knowledge/capabilities/deploy-railway.md`).
7. Only one webhook URL per app is active; switching URLs overwrites it ([n8n WhatsApp Trigger docs](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.whatsapptrigger/)). Use a separate Meta app for testing if the person needs both.

**Step 6. Allowlist and smoke test.**
1. Set the owner allowlist (owner's number in E.164 digits) in the runtime config. Messages from anyone else get no answer.
2. Smoke test: owner sends "hola" → Jarvis replies within the window; a message from a non-allowlisted number gets nothing; a POST with a wrong signature returns 401/403 in the Railway logs.

`.env.example` lines for a custom Cloud API adapter (Agent SDK or own code; names are this project's convention, not Meta's). Hermes uses `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_APP_SECRET`, `WHATSAPP_CLOUD_VERIFY_TOKEN` and `WHATSAPP_CLOUD_ALLOWED_USERS` instead (see `knowledge/runtimes/hermes.md`); n8n stores them as credentials in its UI:

```
WHATSAPP_ACCESS_TOKEN=         # system-user token, set in Railway variables only
WHATSAPP_PHONE_NUMBER_ID=      # from API Setup (not secret)
WHATSAPP_BUSINESS_ACCOUNT_ID=  # WABA ID (not secret)
WHATSAPP_APP_SECRET=           # App settings → Basic; used for X-Hub-Signature-256
WHATSAPP_VERIFY_TOKEN=         # random string you chose for the GET handshake
WHATSAPP_ALLOWED_NUMBERS=5215500000000   # fake example; owner only, E.164 digits, no "+"
```

## Baileys consent gate (Spanish, shown verbatim)

Show this before any Baileys setup, through `AskUserQuestion`, with the Cloud API or Telegram as the "(Recomendado)" first option. Proceed only on an explicit "Acepto". Log it in `.jarvis/state.json → consents[]` as `{ "id": "whatsapp-baileys", "accepted_at": "<ISO timestamp>", "text_version": "2026-10-06", "secondary_number": true }`, and copy it as a dated row ("secondary number: yes") into `jarvis-spec.md` §7 *Decisions and consents* and into the Jarvis's `SECURITY.md`. Without that row the validator blocks the build (`SEC-31`, `CMP-05`).

> **Antes de conectar WhatsApp por la vía no oficial (Baileys), lee esto:**
>
> 1. Esta conexión imita WhatsApp Web. **WhatsApp no la permite** en sus términos, y el número que uses **puede ser bloqueado o suspendido sin aviso**, a veces en pocos días.
> 2. Por eso **no vamos a usar tu número personal**. Necesitas un **número secundario** (un chip o eSIM nuevo) que puedas perder sin problema.
> 3. Tu Jarvis solo responderá a los números que tú autorices. No lo usaremos para mandar mensajes masivos ni a gente que no te escribió.
> 4. Existe una alternativa oficial y sin riesgo de bloqueo (la API de WhatsApp Cloud de Meta) y otra gratis y sin riesgo (Telegram). Te recomiendo cualquiera de las dos.
> 5. Si el número se bloquea, tu Jarvis sigue funcionando por los otros canales; solo pierdes WhatsApp en ese número.
>
> ¿Aceptas el riesgo y confirmas que vas a usar un número secundario?
> - **Mejor uso la API oficial (Recomendado)**
> - Mejor uso Telegram
> - **Acepto el riesgo y usaré un número secundario**

If the person answers "Acepto" but says they will use their main number: stop, explain point 2 again, and do not continue until they have a secondary number. Baileys is **never** used for customer-facing business bots, for health, legal or accounting packs, or for anyone but the owner.

## Customer-facing bot (the documented SEC-01 exception)

A business answering its own customers is allowed by Meta (§ Decision rule), but the owner's
Jarvis must never answer them: its allowlist stays **owner only** (SEC-01), and it holds private
data [B] and actions [C]. Customers get a **separate, restricted profile**. Until every row below
is built and validated, the customer bot is a Non-Goal (`/jarvis-add` v2), and in v1 Jarvis only
**drafts** the messages the owner sends from their own phone.

| Control | What the customer profile must have | SEC |
|---|---|---|
| Separation | Its own process and state: a second Hermes gateway with its own `HERMES_HOME` (on Railway, a second service with its own volume), or a separate route in a `claude-agent-sdk` core. Never the owner's gateway with a wider allowlist. Hermes multi-profile flags: see [multi-profile gateways](https://hermes-agent.nousresearch.com/docs/user-guide/multi-profile-gateways) (read the exact flags from that page and pin them in `runtimes/hermes.md` before use) | SEC-01, SEC-23 |
| Who may write | **Known customers** (an accountant's 30 clients, a coach's students): an explicit list of E.164 numbers in `WHATSAPP_CLOUD_ALLOWED_USERS`, edited only by the owner in a terminal or the Railway dashboard, never by a chat message. **Unknown public** (restaurant bookings): an open sender list is allowed **only** on a profile with no private data and no actions beyond replying to that sender (Rule of Two: [A] only), and the validator checks that profile's toolset | SEC-01, SEC-04, SEC-11 |
| Tools | No [C] tools (no send-to-others, pay, delete, invoice). Read access only to a public `faq.md` / menu / price list. Anything else ("¿qué documentos me faltan?") becomes a **request to the owner**: the owner's Jarvis drafts the answer, the owner approves, then it is sent | SEC-11, SEC-14, SEC-22 |
| Per-client data | **None in the customer profile.** A model can't be trusted to keep client A's data from client B. Per-sender answers need code that maps the sender's number to one client alias **outside the model** and loads only that alias's folder (`claude-agent-sdk`, `dev` only), with a cross-client leak test | SEC-12, SEC-13 |
| AI disclosure | First message to every new sender: "Hola, soy el asistente con IA de <negocio>. Un humano revisa lo importante." | SEC-32 |
| Data law | Privacy notice + processor list (LLM provider, Railway, Meta) from `countries/<cc>.md` § Data-protection law; for sensitive professions also the country's impact-assessment note (CO: SIC) | SEC-32 |
| Memory | The customer profile keeps no long-term memory about people (`memory.enabled: false` or equivalent); conversations are logged hashed (SEC-29) | SEC-13, SEC-20 |

Validator checks (customer profile only): no `*ALLOW_ALL_USERS=true` unless its toolset is the
public-FAQ set; allowlist file not writable by the agent; no MCP server with write scopes; the
first-message disclosure is in its SOUL; a test message asking for another client's data gets a
refusal plus an owner notification.

## Runtime support

| Runtime | Cloud API (official) | Baileys (unofficial) | Notes |
|---|---|---|---|
| `hermes` | **Yes**: separate `whatsapp_cloud` adapter (`hermes whatsapp-cloud` wizard); needs a Meta Business app and a public HTTPS webhook. `WHATSAPP_CLOUD_APP_SECRET` is mandatory: without it inbound delivery is refused with 503 | Yes, and it is Hermes' **default** WhatsApp mode (`WHATSAPP_ENABLED`, `WHATSAPP_MODE`, allowlist `WHATSAPP_ALLOWED_USERS`) | Default to Cloud API whenever the host is Railway. Never set `WHATSAPP_ALLOW_ALL_USERS` or `*`. Never set `WHATSAPP_CLOUD_ALLOW_ALL_USERS` either ([Hermes docs](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp), [Hermes WhatsApp Cloud docs](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud)). Env vars and versions: `knowledge/runtimes/hermes.md` |
| `openclaw` | **No.** "there is no separate Twilio WhatsApp channel" | Yes, only path. QR login `openclaw channels login --channel whatsapp`; `channels.whatsapp.dmPolicy` (`pairing` default, use `allowlist`) + `allowFrom` | Never `dmPolicy: "open"` / `allowFrom: ["*"]`. Headless hosts need a way to get the QR to the phone ([OpenClaw docs](https://docs.openclaw.ai/channels/whatsapp)). Version floor: `knowledge/runtimes/openclaw.md` |
| NanoClaw (Agent SDK based; API key) | No | Yes, only path (`/add-whatsapp`-style channel skill) | Same consent gate ([NanoClaw README](https://github.com/qwibitai/nanoclaw)) |
| n8n (automation layer, no runtime file) | **Yes**: official WhatsApp Business Cloud node + WhatsApp Trigger node | No | One webhook per Meta app; test vs production URL overwrite each other ([n8n docs](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.whatsapptrigger/)). Good for SMB bots with a visual flow |
| `claude-agent-sdk` | Build it: a small webhook adapter (Steps 5–6) or Twilio's WhatsApp API | Possible but don't | Developer path; API key per `knowledge/auth-matrix.md` |
| `claude-code-local` · `claude-code-server` · `claude-p-cron` | **No official channel** ([Claude Code channels](https://code.claude.com/docs/en/channels)) | Community bridges only (unreviewed; full source review before any use) | Pick `hermes` or n8n for WhatsApp instead |
| `codex-openai` | No native channel | No | Pair with `hermes` or n8n |
| `ollama-local` | Via `hermes` (Ollama as model provider) | Via `hermes` or `openclaw` | Cloud API still needs a public webhook (Railway or Tailscale Funnel) even if the model is local |
| `cowork` | No | No | No WhatsApp or Telegram channel. If WhatsApp is a must, pick `hermes` instead |

## Security

Each line maps to a control in `knowledge/security-checklist.md`:
- **Owner-only allowlist** (`SEC-01`) on every path, by phone number in E.164 digits. No wildcard, no "allow all". The only exception is the separate customer profile in § Customer-facing bot.
- **Webhook signature** (`SEC-03`, `SEC-06`): verify `X-Hub-Signature-256` with the App secret on every POST; verify token on the GET handshake. Only the webhook route is public; dashboards stay private.
- **Secrets** (`SEC-17`, `SEC-18`, `SEC-21`): access token and App secret in Railway variables / `.env`, never in git, never in chat. Rotate the system-user token if it leaks.
- **Groups off** by default (`SEC-02`). Baileys in groups reads everything in the group; don't.
- **Human approval** (`SEC-14`, `SEC-15`) before Jarvis sends a template, messages a number that hasn't written first, or messages anyone other than the owner.
- **Prompt injection** (`SEC-11`, `SEC-12`, `SEC-23`): inbound WhatsApp text from customers is untrusted input; customer-facing bots get a read-only tool profile.
- **Data law and AI disclosure** (`SEC-32`): a business bot processes customers' personal data. Add an "Soy un asistente con IA" line to the first message (mandatory in the EU under AI Act Art. 50, good practice everywhere), and name the LLM, BSP and Railway as processors in the privacy notice. Country details: `knowledge/countries/<cc>.md`.
- **Unofficial bridges** (`SEC-31`): Baileys only with the logged consent above and a secondary number.
- **Health, legal, accounting packs**: Cloud API only, never Baileys; keep sensitive data out of long-term memory.

## Re-checked at install

`stack-researcher` checks these against Meta's live pages before quoting; the live answer wins.

- Policy grey zone: whether a single-person, self-hosted assistant on the Cloud API counts as "primary functionality" AI under Meta's clause. This is an interpretation: explain the risk and let the person decide (§ Policy).
- Test-number recipient limit (5 per secondary sources; Meta's page states no number).
- Coexistence (same number in the app and the API) per country; business-verification thresholds; system-user permission labels.
- Service-reply charges from 2026-10-01 (sources differ, see § Pricing).
- Status of the EU and Brazil measures after Meta's appeals.

## Sources

- https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform (fetched 2026-10-06; last updated 2026-09-23)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers (fetched 2026-10-06)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started (fetched 2026-10-06)
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started (fetched 2026-10-06)
- https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform
- https://techcrunch.com/2025/12/24/italy-tells-meta-to-suspend-its-policy-that-bans-rival-ai-chatbots-from-whatsapp/
- https://www.cnnbrasil.com.br/economia/negocios/cade-mantem-medida-preventiva-que-obriga-meta-a-permitir-chatbots-de-ia-no-whatsapp/
- https://www.houthoff.com/insights/news/a-rare-show-offorce-commission-deploys-interim-measures-against-meta-to-safeguard-ai-competition/
- https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- https://respond.io/blog/whatsapp-pricing-change-2026.md
- https://www.flowcall.co/blog/whatsapp-business-api-pricing
- https://infobip.com/blog/whatsapp-statistics
- https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america
- https://www.contxto.com/en/news/meta-chooses-leadsales-as-whatsapp-solution-partner-for-latin-america/
- https://www.wati.io/en/blog/test-whatsapp-message-sends-safely/
- https://help.wanotifier.com/en/article/test-phone-number-limitations-kt0ly2/
- https://zylos.ai/research/2026-01-26-whatsapp-api-automation
- https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp (fetched 2026-10-06)
- https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud (fetched 2026-10-06)
- https://docs.openclaw.ai/channels/whatsapp (fetched 2026-10-06)
- https://github.com/qwibitai/nanoclaw
- https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.whatsapptrigger/ (fetched 2026-10-06)
- https://code.claude.com/docs/en/channels
- https://docs.railway.com/deployments/serverless
- https://github.com/WhiskeySockets/Baileys
