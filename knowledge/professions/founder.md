# Profession: Founder

> Founders, CEOs and small-business directors: a chief-of-staff Jarvis that preps meetings, digests the inbox, tracks KPIs and commitments, and drafts updates for team and investors without ever sending, paying or signing on its own.

Last verified: 2026-10-06

Versions are not pinned here (see `knowledge/runtimes/*.md` and `knowledge/models.json`).

## Signals

- "Tengo una empresa / startup", "soy el CEO / director / dueño", "mis socios"
- "Inversionistas", "levantar ronda", "el board", "el reporte a inversionistas"
- "Mi equipo", "juntas", "no me da la vida con las juntas", "KPIs", "el flujo de caja"
- "Quiero un jefe de gabinete / asistente ejecutivo"

If the business is a restaurant/shop → `smb-restaurant`; online store → `ecommerce`; service firm with
clients → `agency`. Use `founder` as the secondary pack in those cases.

## Week-one jobs

1. "Cada mañana dime qué juntas tengo, con quién, y qué necesito saber de cada una." →
   `morning-briefing` + `meeting-prep`.
2. "Revisa mi correo y dime solo lo que de verdad necesita mi atención; lo demás déjamelo en
   borrador." → `inbox-triage` + `draft-reply` (drafts only).
3. "Cada lunes dame los números de la semana: ventas, caja, lo que se cobró y lo que falta cobrar."
   → `kpi-weekly` skill (read-only finance/CRM).
4. "Después de cada junta, sácame los acuerdos y recuérdame lo que prometí." → `commitments-tracker`.
5. "Ayúdame con el update mensual a inversionistas." → `investor-update` draft.

## Channels

| Use | Channel | Why |
|---|---|---|
| Owner ↔ Jarvis | **Telegram** (default) | Free, no policy risk, voice notes while driving between meetings |
| Owner ↔ Jarvis on WhatsApp | Cloud API only, after Gate C grey-zone disclosure | Personal assistant on WhatsApp is a grey zone (`knowledge/capabilities/whatsapp.md`) |
| Work context | **Slack** (owner DM, Socket Mode or Slack's official MCP for reading) | Team channels are untrusted input [A]; groups off (SEC-02) |
| Delegation by email | **Agent-owned inbox** (e.g. AgentMail) rather than send access on the founder's own mailbox | Keeps the founder's mailbox read-only. See `knowledge/capabilities/channels.md` § Email |
| Quick dictation | Voice notes in Telegram → STT | `knowledge/capabilities/voice.md` |

## Memory

- Markdown workspace. `USER.md`: company one-liner, team by **role** (no personal IDs), top priorities
  this quarter, how they like briefings.
- `memory/topics/people.md` (investors, key clients, team leads: role · last contact · open topics),
  `memory/topics/commitments.md` (who promised what, by when), `memory/topics/kpis.md` (definitions,
  where each number comes from).
- Past ~200 lines or several channels: sqlite-vec (local) or pgvector (Railway Tier B).
- No graph memory: `knowledge/decision-tree.md` Step 6 reserves it for `sales`, `real-estate` and
  `lawyer-accountant`. If the founder pack runs as a secondary to `sales`, follow that pack.
- **Do not store**: cap table details, bank account numbers, RFC/CURP/NIF, salaries of named people
  (SEC-13). Keep them in their source systems and read on demand.

## Tools / MCP

Tiers per `knowledge/capabilities/tools-mcp.md`. Read-only first (SEC-22).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| Gmail · Calendar · Drive (Google Workspace MCP) | T1 (developer preview) | read; Gmail **drafts** only if asked; never send | Outlook/M365 users: Microsoft connector or T4 Zapier (ask which suite they use; check the Claude connector directory for a Microsoft 365 connector first, Zapier only if none is listed) |
| Slack | T1 (`https://mcp.slack.com/mcp`, OAuth; through Claude.ai/Claude Code or a directory-published/internal Slack app) | read/search | Its send tool = IRR-01: leave it out of the profile (SEC-23) |
| Notion | T1 (OAuth) | read | Docs, OKRs, meeting notes |
| CRM: HubSpot / Pipedrive | T1 official remote MCPs | read | See `knowledge/professions/sales.md` for details |
| Stripe | T1 (`https://mcp.stripe.com`) | read (`stripe_api_read`) | From 2026-10-31 only OAuth or **Agent API keys** work; refunds/payouts need Stripe's own approval flow and IRR-03 |
| Accounting: Alegra (MX/CO/…) · Siigo (CO) · Facturapi (MX) | T1 Alegra · T2 Siigo/Facturapi (codespar) | **read-only** | Country tools in `knowledge/countries/<cc>.md`. Stamping/cancelling invoices = IRR-05 |
| Google Sheets (KPI sheet) | T1 (Workspace) or T4 | read | Often the real source of truth for KPIs |
| Web search | built-in or MCP | read | Market and competitor news |

## Scheduled jobs

Local time; Railway cron is UTC (CDMX UTC−6, Bogotá UTC−5, Buenos Aires UTC−3, Madrid UTC+1/+2).
See `knowledge/capabilities/scheduling.md`.

| Job | Cron (local) | Model slot | Output |
|---|---|---|---|
| Morning brief (`morning-briefing` + `meeting-prep` for today) | `3 7 * * 1-5` | `cheap` gather, `main` write | Agenda + one prep card per external meeting + 3 emails that matter |
| Meeting prep heartbeat | `13,43 8-18 * * 1-5` (off-minutes, not `*/30`) | `cheap` | For any meeting starting in the next 45 min: who, last thread, open asks. Silent otherwise |
| Weekly KPIs (`kpi-weekly`) | `7 8 * * 1` | `main` | Numbers vs last week, cash, receivables, 3 things to look at |
| Commitments check | `37 17 * * 1-5` | `cheap` | Promises due tomorrow, by person |
| Investor update draft | `11 9 1 * *` | `main` | Draft in Drive/Notion or as a message; **never sent by Jarvis** |
| Weekly review (`weekly-review`) | `17 18 * * 5` | `main` | Wins, misses, next week's top 3 |

## Skills

From `templates/skills-base/`: `morning-briefing`, `inbox-triage`, `meeting-prep`, `draft-reply`, `remember`, `weekly-review`. Pack-specific:

| Skill id | One-line spec |
|---|---|
| `kpi-weekly` | Pull the defined KPIs from their sources (read-only), compare to last week and target, explain each move in one line, flag missing data instead of guessing. |
| `commitments-tracker` | From meeting notes or a voice note, extract "who · what · by when" into `memory/topics/commitments.md`; remind before due date. |
| `investor-update` | Draft a monthly update (highlights, KPIs, lowlights, asks) from `kpis.md` and the month's notes; marked DRAFT. |
| `decision-memo` | Turn a messy question into a one-page memo: context, options, recommendation, risks. |
| `delegate-email` | Draft an email for the team or a vendor from a one-line instruction; goes to the owner for approval or to the agent-owned outbox. |

## Guardrails

- **Irreversible (SEC-14):** sending email/Slack/WhatsApp to anyone but the owner (IRR-01); calendar
  invites or accepting meetings (IRR-06); payments, refunds, payroll, subscriptions (IRR-03); signing or
  accepting terms, stamping/cancelling invoices (IRR-05); deleting files, emails or CRM records (IRR-04).
- **Inbox = A+B:** the email triage session must not hold a send tool. Output is a digest plus drafts;
  "sí, envía #3" sends one exact draft (`knowledge/security-checklist.md` §2 worked example).
- **Confidential data:** financials, fundraising, HR matters, M&A. Keep memory local or on their own
  Railway volume; no third-party memory SaaS without consent.
- **Third-party data law:** once Jarvis processes employee or customer data, the country data law
  applies (LFPDPPP 2025 in MX, Ley 1581 in CO, Ley 25.326 in AR, GDPR in ES). Point to
  `knowledge/countries/<cc>.md` and list the processors in the Jarvis's `compliance.md`.
- **No impersonation:** drafts are written for the founder to send; Jarvis never writes "as" the
  founder to investors or employees on its own.

## Interview extras

1. "¿Dónde viven tus números: hoja de cálculo, sistema contable, Stripe, CRM?" → KPI sources.
2. "¿Tu Jarvis puede dejar borradores en tu correo, o prefieres que tenga su propio correo para
   delegar?" (default: drafts only)
3. "¿Hay temas que nunca deben salir de tu compu (ronda, socios, nómina)?" → sensitivity and host.

## Recommended default stack

| Budget | Stack |
|---|---|
| Claude Pro/Max, computer on during work | `claude-code-local` + Telegram + Google Workspace (read) + Desktop scheduled tasks. $0 extra |
| Pro/Max, only wants reports, no chat | `claude-p-cron` with a daily KPI report to Telegram/email (archetype 4) |
| Non-technical, Claude app only | `cowork` — recommend and stop (connectors + scheduled tasks cover briefings and drafts) |
| Medium (`10–30`/`30–100`), 24/7 | `hermes` on Railway Tier A, API key + spend cap, Telegram + Slack (read) |
| Max plan, wants Claude Code itself 24/7 | `claude-code-server`, API key default (archetype 12; subscription only as the flagged personal alternative with Gate C) |

## Sources

- Profession → component map (founder row): Jarvis Architect design synthesis built from the sources listed here; component sources below. Slack Socket Mode: https://api.slack.com/socket-mode · Notion MCP: https://developers.notion.com/docs/get-started-with-mcp
- Alegra developer docs (MCP tools): https://developer.alegra.com/llms.txt · Siigo community MCP: https://glama.ai/mcp/servers/jdlar1/siigo-mcp · Facturapi pricing: https://www.facturapi.io/pricing · Facturapi community MCP: https://github.com/codespar/mcp-dev-latam
- Data law: MX LFPDPPP 2025 (EY): https://www.ey.com/es_mx/technical/tax/boletines-fiscales/nueva-ley-federal-proteccion-datos-personal-posesion-particulares · CO SIC Circular Externa 002/2024: https://normograma.mintic.gov.co/mintic/compilacion/docs/circular_superindustria_0002_2024.htm · ES/EU AI Act Art. 50: https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html
- Slack MCP server (`https://mcp.slack.com/mcp`, OAuth; partner clients incl. Claude.ai and Claude Code; only directory-published or internal apps): https://docs.slack.dev/ai/mcp-server/ (fetched 2026-10-06)
- Stripe MCP and Agent API keys (2026-10-31 change): https://docs.stripe.com/mcp
- HubSpot remote MCP GA: https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- Pipedrive MCP launch: https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- Alegra MCP: https://www.prnewswire.com/mx/comunicados-de-prensa/alegra-revoluciona-la-gestion-contable-en-mexico-contadores-y-empresarios-ya-pueden-consultar-sus-finanzas-en-tiempo-real-usando-su-ia-favorita-302794164.html
- Google Workspace MCP developer preview: https://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html
- AgentMail: https://docs.agentmail.to
- Railway cron jobs (UTC): https://docs.railway.com/reference/cron-jobs
