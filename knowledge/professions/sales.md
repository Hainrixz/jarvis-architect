# Profession: Sales

> Salespeople, account executives, brokers and independent reps: a Jarvis that remembers every prospect, researches before calls, drafts follow-ups and keeps the pipeline honest, while every message to a client and every CRM change waits for a "sí".

Last verified: 2026-10-06

Versions are not pinned here (see `knowledge/runtimes/*.md` and `knowledge/models.json`).
WhatsApp per-message prices live in `knowledge/countries/<cc>.md`.

## Signals

- "Vendo …", "soy vendedor / ejecutivo de cuenta / asesor comercial / representante"
- "Prospectos", "leads", "cierres", "el pipeline / embudo", "la cuota", "comisiones"
- "Se me olvida dar seguimiento", "pierdo clientes por no contestar rápido"
- "Uso HubSpot / Pipedrive / Kommo / Excel para mis clientes"
- "Mis clientes me escriben por WhatsApp"

Real-estate agents → `real-estate` (properties ↔ visits). Insurance/financial advisors fit here, with
the data-sensitivity notes below. Selling online with a store → `ecommerce`.

## Week-one jobs

1. "Cada mañana dime a quién tengo que darle seguimiento hoy y prepárame el mensaje." →
   `followup-queue` skill + morning job (drafts only).
2. "Antes de cada llamada dame un resumen de la empresa y de lo que hablamos la última vez." →
   `call-prep` skill (meeting-prep variant).
3. "Te mando una nota de voz después de la llamada y tú la pasas al CRM." → `call-notes` skill
   (CRM note as draft; writing it = owner approval until they trust it).
4. "Avísame si un trato lleva más de 10 días sin moverse." → `stale-deals` heartbeat.
5. "Hazme la cotización para este cliente con el descuento que acordamos." → `quote-draft` skill.

## Channels

| Use | Channel | Why |
|---|---|---|
| Owner ↔ Jarvis | **Telegram** (default) | Free, no policy risk, voice notes after calls |
| Business ↔ its own clients/leads on WhatsApp | **WhatsApp Cloud API** or the BSP they already use (Kommo, Leadsales, Twilio…) | **Allowed** use: lead qualification and follow-ups for the business's own customers. Proactive messages outside the 24 h window need paid templates (IRR-09). See `knowledge/capabilities/whatsapp.md` |
| Owner ↔ Jarvis on WhatsApp | Cloud API after the Gate C grey-zone disclosure | Personal assistant on WhatsApp is a grey zone |
| Email | Gmail/Outlook read + drafts, or an agent-owned inbox for outbound sequences | Never send from the owner's mailbox autonomously |

**Never Baileys on the sales number.** A ban kills the pipeline and the client history on that number.
If the person insists, the consent gate and a secondary number apply (SEC-31).

## Memory

- Markdown workspace. `memory/topics/accounts/<company>.md` (one file per active account: contacts by
  role, pains, budget signals, objections, next step, date of last contact).
- `memory/topics/playbook.md`: product one-liners, pricing rules, approved discounts, objection answers.
- The CRM is the system of record; Jarvis memory holds context the CRM doesn't (tone, personal notes the
  client shared, what worked).
- Past ~200 lines or WhatsApp + Telegram together: sqlite-vec (local) or pgvector (Railway Tier B).
- **Graph memory (Graphiti)** fits this pack (who was the decision-maker before the reorg?), but it is
  experimental: v2 candidate, not for non-technical users in v1 (`knowledge/capabilities/memory.md`).
- **Do not store** card numbers, bank details, RFC/CURP/NIF/DNI, or anything a client marked
  confidential (SEC-13).

## Tools / MCP

Tiers per `knowledge/capabilities/tools-mcp.md`. Read-only first (SEC-22).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| HubSpot | T1 (`https://mcp.hubspot.com`, OAuth 2.1 + PKCE, GA 2026-04-13) | read; notes/tasks write only on request | Stage moves can trigger automations (IRR-11). Deletes = IRR-04 |
| Pipedrive | T1 (official MCP, OAuth, launched 2026-06-30) | read | `stack-researcher` reads the endpoint URL from Pipedrive's docs at install; many lookalike community servers, pin the official one |
| Kommo / amoCRM | T2 (community MCPs, e.g. `cAIborg-ai/amocrm-mcp`) pinned | read | No official MCP found; check Kommo's developer docs at install for a newer one. Popular in LATAM because WhatsApp is built in |
| Gmail · Calendar (Workspace MCP) | T1 (developer preview) | read; drafts on request | |
| Web search / fetch | built-in or Brave/Exa MCP | read | Prospect research from company sites and news; results are [A] |
| Spreadsheet pipeline (Sheets/Excel) | T1 Workspace or T4 | read | Many LATAM reps run the pipeline in a sheet; fine for v1 |
| Quote / invoice tools | country pack (Facturapi, Alegra, Siigo) | read | Issuing an invoice = IRR-05 |
| LinkedIn | **none** | — | LinkedIn's User Agreement §8.2 bans bots, scraping and automated messaging/contact adds. Jarvis may draft a message the owner sends by hand |

Long tail (Zoho, Salesforce, Bitrix24…): T1 vendor MCP if one exists, else T4 Zapier MCP.

## Scheduled jobs

Local time; Railway cron is UTC (CDMX UTC−6, Bogotá UTC−5, Buenos Aires UTC−3, Madrid UTC+1/+2).
See `knowledge/capabilities/scheduling.md`.

| Job | Cron (local) | Model slot | Output |
|---|---|---|---|
| Morning follow-up queue (`morning-briefing` + `followup-queue`) | `7 8 * * 1-5` | `cheap` gather, `main` drafts | Today's calls/meetings + who to follow up + one draft each |
| Pipeline heartbeat (`stale-deals`) | `23 11,16 * * 1-5` | `cheap` | Deals with no activity > N days, new inbound leads unanswered > 2 h. Silent if none |
| Pre-call prep | `13,43 8-18 * * 1-5` | `cheap` | Prep card for any call in the next 45 min |
| Weekly forecast | `37 16 * * 5` | `main` | Commit / best case / at risk, vs quota; commissions estimate (read-only) |
| Monthly cleanup suggestions | `19 9 1 * *` | `main` | Duplicates and dead deals **proposed**, never deleted |

Unattended jobs never send messages, never move CRM stages, never send paid templates (SEC-15).

## Skills

From `templates/skills-base/`: `morning-briefing`, `inbox-triage`, `meeting-prep`, `draft-reply`, `remember`, `weekly-review`. Pack-specific:

| Skill id | One-line spec |
|---|---|
| `followup-queue` | List contacts whose next step is due, with context from memory/CRM and a short draft per channel (WhatsApp/email) in the owner's voice. |
| `call-prep` | Company snapshot (what they do, recent news, size), history with us, open objections, 3 questions to ask; ≤15 lines. |
| `call-notes` | From a voice note transcript, extract summary, next step, date, objections, budget signals; propose the CRM note and stage change for approval. |
| `quote-draft` | Build a quote from `playbook.md` pricing and approved discount rules; flag any discount above the limit; output a draft PDF/doc. |
| `lead-research` | From a company name or site, gather public info only (no LinkedIn scraping), score fit against the ideal-customer profile. |
| `objection-coach` | Given an objection, suggest 2 answers from the playbook and past wins. |

### Autonomy, learning and media hooks

Defaults come from `knowledge/capabilities/autonomy.md`, `knowledge/capabilities/learning.md` and
`knowledge/capabilities/multimodal.md`. What this pack adds:

- **Autonomy:** every commitment the owner makes ("le mando la cotización el jueves") is captured
  by `pending` as `who:owner`; follow-ups with leads are `state:waiting` with `next:`. When a
  `waiting` task's `next` arrives with no reply, the autopilot adds an **L2** nudge task (exact
  draft in `drafts/`, sent only after "sí, ejecuta T-NNNN"). CRM stage moves stay L2 previews.
- **Learning:** corrections to follow-up tone ("más corto", "tutéalos") become lessons with
  `ámbito:draft-reply`.
- **Media:** commitments said in the owner's own voice notes (`transcribe`, `src:owner/<canal>`)
  go straight to `todo`; commitments heard in a recorded call go to the Bandeja.

## Guardrails

- **Irreversible (SEC-14):** any message to a client or lead (IRR-01); WhatsApp templates, SMS, calls
  (IRR-09, they cost money); sending a quote (IRR-01); payment links with amounts (IRR-03); CRM stage moves that trigger
  automations and price/discount changes (IRR-11); CRM deletes/merges (IRR-04); calendar invites to
  clients (IRR-06); issuing invoices (IRR-05).
- **Rule of Two:** inbound WhatsApp/email from leads is untrusted [A] + CRM is private [B]. The session
  that reads leads produces drafts; sending is the owner's "sí" (or a separate actor with approval).
- **No bulk outreach:** no mass unsolicited WhatsApp/email blasts. WhatsApp marketing templates need
  opt-in and cost per message; respect opt-outs immediately.
- **Data law:** client data triggers the country law (LFPDPPP 2025 MX, Ley 1581 + SIC circulars CO,
  Ley 25.326 AR, GDPR ES). The business needs a privacy notice naming the LLM/cloud processors. See
  `knowledge/countries/<cc>.md`.
- **AI disclosure:** a bot answering leads must say it is an assistant at first contact (mandatory in
  Spain under EU AI Act Art. 50; good practice elsewhere).
- **Regulated sales** (insurance, credit, investments): no promises of returns or approvals in drafts;
  flag for the owner. Jarvis does not state per-country rules; it tells the owner to confirm them with their compliance contact.
- **Commissions:** Jarvis can estimate; the company's system is the truth. Never edits payout data.

## Interview extras

1. "¿Dónde llevas a tus clientes hoy: CRM, Excel, WhatsApp, tu cabeza?" → CRM tool or sheet.
2. "¿Tus clientes te escriben a un WhatsApp de la empresa o a tu número personal?" → Cloud API on a
   business number vs Telegram-only for the owner.
3. "¿Hasta qué descuento puedes dar sin pedir permiso?" → `playbook.md` limits for `quote-draft`.

## Recommended default stack

| Budget | Stack |
|---|---|
| Low (`≤10`), Claude Pro, office hours only | `claude-code-local` + Telegram + Gmail/Calendar (read) + CRM read-only + morning queue. $0 extra |
| Medium (`10–30`), WhatsApp-first, 24/7 | `hermes` on Railway Tier A + generated domain for the Meta webhook (signature-checked, SEC-03/SEC-06), `ANTHROPIC_API_KEY` + spend cap, WhatsApp Cloud API for clients + Telegram for the owner, CRM read-only (archetype 5 in `knowledge/decision-tree.md`). Templates billed per message |
| Already on Kommo/Leadsales with WhatsApp | Keep the BSP for client chat; Jarvis reads the CRM (T2) and drafts, the owner sends from the BSP |
| `30–100`, many accounts | Medium stack + pgvector (Tier B); Graphiti as a v2 add-on |

## Sources

- Profession → component map (sales row), integration trust tiers and irreversible-action list: Jarvis Architect design synthesis built from the sources listed here; tool and policy sources below.
- WhatsApp business bots vs. general-purpose ban: https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- Data law: MX LFPDPPP 2025 (EY): https://www.ey.com/es_mx/technical/tax/boletines-fiscales/nueva-ley-federal-proteccion-datos-personal-posesion-particulares · CO SIC Circular Externa 002/2024: https://normograma.mintic.gov.co/mintic/compilacion/docs/circular_superindustria_0002_2024.htm · CO SIC Circular Externa 003/2025: https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20003%20de%202025.pdf
- HubSpot remote MCP GA: https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- Pipedrive MCP launch: https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- Kommo/amoCRM community MCP: https://glama.ai/mcp/servers/@cAIborg-ai/amocrm-mcp/tree/26804dcff7cf3d9d6502167a08257c90057fbe25
- LinkedIn User Agreement §8.2 (no bots, scraping, automated messages): https://www.linkedin.com/legal/user-agreement (fetched 2026-10-06)
- Meta WhatsApp Business terms: https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- WhatsApp pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- EU AI Act Art. 50 timing: https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html
- Railway cron jobs (UTC): https://docs.railway.com/reference/cron-jobs
