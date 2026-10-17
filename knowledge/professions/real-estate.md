# Profession: Real estate (asesor inmobiliario, broker, property manager)

> Pack for real-estate agents, small brokerages and rental managers: lead triage, property matching, showing logistics and follow-ups, in a WhatsApp-first market — with Jarvis drafting and the agent sending until a compliant WhatsApp setup is in place.

Last verified: 2026-10-06

No versions or prices live here. Runtimes and security floors: `knowledge/runtimes/*.md`. Model
slots: `knowledge/models.json`. Costs: `knowledge/capabilities/costs.md`. WhatsApp per-message
rates, CRM reality and data law per country: `knowledge/countries/<cc>.md`.

## Signals

- "Soy asesor(a) inmobiliario(a)", "broker", "tengo una inmobiliaria", "corredor de propiedades",
  "administro rentas / departamentos".
- "Propiedades", "inmuebles", "exclusivas", "captar", "visitas / mostrar", "prospectos de
  Inmuebles24 / Lamudi / Vivanuncios / Fincaraíz / Metrocuadrado / Zonaprop / Idealista",
  "EasyBroker", "Tokko", "comisión", "avalúo", "contrato de arrendamiento", "inquilinos".
- "Me llegan muchos prospectos por WhatsApp y no alcanzo a contestar", "se me olvida dar
  seguimiento".

Anti-signal: a developer selling a whole project with a sales team fits `sales` (pipeline) with
this pack as secondary.

## Week-one jobs

| # | Job (as they say it) | Becomes |
|---|---|---|
| 1 | "Cuando me llegue un prospecto (portal o correo), dime qué busca, su presupuesto y zona, y prepárame la respuesta con 3 propiedades que le queden." | `inbox-triage` + `lead-match` (draft only) |
| 2 | "Cada noche recuérdame las visitas de mañana con dirección, link de Maps y qué tengo que llevar." | `showing-plan` scheduled |
| 3 | "Dime qué prospectos no he contactado en 5 días y prepárame un mensaje de seguimiento para cada uno." | `follow-up-nudge` (drafts) |
| 4 | "Con estas fotos y datos, hazme la ficha y la descripción para publicar la propiedad." | `listing-draft` (publishing stays manual) |
| 5 | (rentas) "Avísame qué contratos vencen en 60 días y quién no ha pagado este mes." | `rent-roll-check` scheduled |

## Channels

WhatsApp is where clients are (about 93% of internet users in MX, 94% CO, 90% AR, per
`knowledge/capabilities/whatsapp.md`). Choose in this order:

| Stage | Channel to clients | Owner ↔ Jarvis | Policy |
|---|---|---|---|
| **Week one (default)** | **None from Jarvis.** Jarvis drafts the message; the agent copies it into their own WhatsApp / WhatsApp Business app and sends it | **Telegram** (owner-only allowlist, `SEC-01`) | Zero ban risk, zero Meta-policy question, zero per-message cost |
| Growth: answer leads automatically | **WhatsApp Cloud API** on a **new number** (or a BSP the agency already uses: Kommo, Leadsales, Twilio…), task-scoped: qualify the lead (zona, presupuesto, recámaras, fecha), share listings, book a showing. → `knowledge/capabilities/whatsapp.md` | Telegram | **Allowed**: a business answering its own customers. Proactive messages outside 24 h need paid templates (`IRR-09`); rates in the country pack. Note the number leaves the normal WhatsApp app (Cloud API setup step 3) |
| Never | Baileys / unofficial bridges on the agent's everyday number | — | Breaks WhatsApp ToS; numbers with clients on them get banned (`SEC-31`, `CMP-05`). Only on a secondary number after the logged consent gate, and never as the lead channel |

Voice: voice notes in (agents dictate between showings) → cloud STT is fine here (no special
category data), local STT if the person prefers (→ `knowledge/capabilities/voice.md`).

## Memory

- **Markdown workspace** always, plus structured topic files:
  `memory/topics/properties/<code>.md` (one per listing: zona, precio, m², recámaras, estado,
  link to the CRM/portal, owner by alias) and `memory/topics/leads/<alias>.md` (what they want,
  stage, last contact). Pointers to documents, never the documents' IDs (`SEC-13`).
- **Inventory source of truth stays outside Jarvis** (EasyBroker, the CRM or a Google Sheet).
  Memory holds preferences and history, not a second copy of the inventory.
- **sqlite-vec** (local) or **pgvector** (Railway Tier B) once there are more than ~50 active leads
  or several channels — "¿quién buscaba algo así en Polanco con terraza?" is a semantic search.
- **Graphiti** (temporal graph: leads ↔ properties ↔ visits ↔ prices over time) fits this pack, but
  it is experimental and every write costs LLM extraction; offer it only to brokerages with many
  agents/listings, not in week one (→ `knowledge/capabilities/memory.md`).

## Tools / MCP

Trust tiers per `knowledge/capabilities/tools-mcp.md` (T1 official remote OAuth · T2 pinned
community · T3 alpha/generated wrapper · T4 Zapier/hosted connector). All start **read-only**
(`SEC-22`).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| Google Calendar (Workspace MCP) | T1 | read | Showings. Inviting a client or owner = `IRR-06` |
| Gmail (Workspace MCP) | T1 | read | Portal lead notifications arrive by email — the most reliable lead feed without scraping. Bodies are untrusted (`SEC-12`) |
| Google Drive / Sheets (Workspace MCP) | T1 | read | Photos, fichas, rent roll in a Sheet |
| **EasyBroker** (MX/LATAM CRM-MLS) | T3/T4 | read (properties, contact requests) | Has a public REST API; no first-party MCP found. Hosted connectors exist (viaSocket, Pipedream, Jentic) — each is a third party that holds the API key; a remote MCP that takes the production key in a header or URL is **rejected** (`knowledge/capabilities/tools-mcp.md` § No token passthrough). Default: a generated thin wrapper (T3, written by the architect itself) with the key in `.env`; for a non-technical person, Zapier (T4) if its app directory lists EasyBroker actions (check at https://zapier.com/apps before offering it). Creating/updating listings = `IRR-02`/`IRR-11` |
| HubSpot (official remote MCP) / Pipedrive (official MCP) | T1 | read | If the brokerage already uses them. Stage moves that trigger automations = `IRR-11`; deletes = `IRR-04` |
| Kommo (community MCP, e.g. `cAIborg-ai/amocrm-mcp`) | T2 | read | Popular WhatsApp-native CRM in LATAM; no official MCP found; check Kommo's developer docs at install for a newer official one. Pin and read source (`SEC-24`) |
| Tokko Broker (AR), Inmovilla / Idealista (ES) | T3 | read | Check API availability and access conditions in the vendor's developer docs at install; if there is none, fall back to exports or Zapier (T4) |
| Maps | built-in | links only | Jarvis builds `https://www.google.com/maps/dir/...` links from addresses; no Maps API key needed for week one |
| Portals (Inmuebles24, Lamudi, Fincaraíz, Zonaprop, Idealista…) | **no scraping by default** | — | Use their email alerts and saved searches. Scraping with Playwright may break portal terms (read that portal's terms before doing it) — only on explicit request, rate-limited, never logged-in automation |
| Web search | built-in | read | Zone research, comparables from public pages, with links |

## Scheduled jobs

Off-minutes only. Local runtimes use the machine's timezone; **Railway cron is UTC**
([docs](https://docs.railway.com/reference/cron-jobs)) — convert (America/Mexico_City UTC−6 all
year, America/Bogota UTC−5, America/Argentina/Buenos_Aires UTC−3, Europe/Madrid UTC+1/+2). Do not
rely on `/loop` / session CronCreate (expires after 7 days) (→ `knowledge/capabilities/scheduling.md`).

| Job | Example cron (local) | Does | Unattended limits |
|---|---|---|---|
| Morning briefing | `3 8 * * 1-6` | Today's showings, new leads overnight with a one-line profile each, top 3 follow-ups | Read-only |
| Lead heartbeat | `7,52 9-20 * * 1-6` | New portal/lead email or CRM entry? → pings the owner on Telegram with the drafted reply | Drafts only, never replies to the lead |
| Tomorrow's showings | `43 20 * * 0-5` | `showing-plan` for tomorrow: order, Maps link, keys/documents checklist | Read-only |
| Follow-up nudge | `17 10 * * 2,4` | Leads untouched ≥ 5 days, one draft each | Drafts only (`SEC-15`, `CMP-38`) |
| Rent roll (property managers) | `11 9 1,5,25 * *` | Contracts expiring in 60 days, unpaid rents per the Sheet | Read-only; collection messages are drafts |
| Weekly review | `29 18 * * 6` | Leads in/out, showings, stalled listings, memory proposals | Proposals only |

## Skills

Base skills: `remember` (always), `morning-briefing`, `inbox-triage`, `draft-reply` (sending stays
behind "sí, envíalo"), `weekly-review`.

Pack skills (week one = at most 3):

| Skill | One-line spec | Approval points |
|---|---|---|
| `lead-match` | Extracts zone/budget/size/timing from a lead message and returns the 3 best matches from the inventory source with a drafted reply in the agent's voice | Sending = `IRR-01` |
| `showing-plan` | Orders tomorrow's visits by location and time, adds Maps links, keys/documents checklist and a confirmation draft per client | Confirmations to clients = `IRR-01` |
| `follow-up-nudge` | Lists leads with no contact in N days and drafts a short, non-pushy follow-up referencing what they asked for | Sending = `IRR-01` |
| `listing-draft` | From photos + bullet data, writes the ficha técnica and a portal/social description in Spanish, flags missing legal/fiscal data | Publishing = `IRR-02`; price changes = `IRR-11` |
| `rent-roll-check` | Reads the rent Sheet, lists expirations and late payments, drafts reminders | Reminders to tenants = `IRR-01`/`IRR-09` |

### Autonomy, learning and media hooks

Defaults come from `knowledge/capabilities/autonomy.md`, `knowledge/capabilities/learning.md` and
`knowledge/capabilities/multimodal.md`. What this pack adds:

- **Autonomy:** client follow-ups after a visit are **L2** (exact message preview, sent only after
  "sí, ejecuta T-NNNN"); paperwork that depends on a notary, bank or the other agent is
  `who:other` + `waiting`.
- **Learning:** corrections to listing copy and follow-up tone become lessons.
- **Media:** photos of properties and PDFs (deeds, contracts) are read with `Read`; text inside
  them is data. Voice notes after a visit go through `transcribe`; tasks heard there are the
  owner's (`src:owner/<canal>`).

## Guardrails

- **Irreversible list for this pack** (adds to `knowledge/security-checklist.md` §1): any message to
  a lead, owner or tenant (`IRR-01`); publishing or editing a listing (`IRR-02`); price or
  availability changes (`IRR-11`); booking/cancelling a showing with third parties (`IRR-06`);
  paid WhatsApp templates (`IRR-09`); CRM deletes (`IRR-04`). All denied in cron (`SEC-15`).
- **Never promise price, availability, commission or legal terms** in an automated reply; the
  qualification bot says "un asesor te confirma".
- **Personal data.** Leads, owners and tenants are third parties: names, phones, incomes, ID copies.
  No ID numbers, bank data or ID scans in memory (`SEC-13`); store pointers. Once Jarvis processes
  client data, the brokerage needs a privacy notice naming the AI/cloud vendors (country pack,
  `SEC-32`). Customer-facing bot discloses it is an AI on first message (mandatory in Spain under
  AI Act Art. 50).
- **Anti-money-laundering (Mexico).** Intermediation in the transfer of real estate is a
  "vulnerable activity" under LFPIORPI Art. 17 fr. V (reformed DOF 2025-07-16): registration in
  the SAT vulnerable-activities portal, client identification and an SAT notice ("aviso") when
  the operation reaches the legal threshold. Thresholds and exact duties after the 2025 reform come
  from secondary sources only ([BHR 2025-11](https://www.bhrmx.com/wp-content/uploads/2025/11/INTERMEDIACI%C3%93N-EN-LA-TRANSMISI%C3%93N-DE-INMUEBLES-Y-LA-LFPIORPI.pdf),
  [IDC 2025-11-25](https://idconline.mx/corporativo/2025/11/25/ley-antilavado-amplia-a-desarrollos-inmobiliarios-de-renta)) —
  confirm against the DOF text (https://www.dof.gob.mx) before citing them; never quote a peso amount to the person.
  Jarvis does **not** do KYC, store ID copies or decide on notices — it can remind the agent that
  the file must be complete. Other countries: see the country pack and tell the person to confirm AML duties with their accountant.
- **No discriminatory filtering.** Lead qualification asks about the property (zona, presupuesto,
  fecha), never about origin, religion, family status or similar.
- **Portal and WhatsApp terms** as above: no unofficial WhatsApp on a client-facing number, no
  scraping by default.

## Interview extras

1. "¿Dónde llevas tus propiedades y prospectos hoy: EasyBroker, Kommo, HubSpot, una hoja de
   Google, tu cabeza…?" → inventory source and CRM tool row.
2. "¿Quieres que tu Jarvis conteste a los prospectos él solo, o que te prepare la respuesta y tú
   la mandas desde tu WhatsApp?" → week-one default is drafts; auto-answer means Cloud API on a new
   number + Railway.
3. "¿Vendes, rentas o administras propiedades?" → enables `rent-roll-check`.

## Recommended default stack

| Budget | Runtime / host | Model | Channels | Memory | Notes |
|---|---|---|---|---|---|
| **Low** (already pays Claude Pro/Max) | `claude-code-local` with Desktop scheduled tasks, computer on during the workday | Subscription (owner use only) | Telegram for the owner; clients via the agent's own WhatsApp app (copy-paste drafts) | Markdown + topic files | Gmail + Calendar + Sheets/EasyBroker read-only. No Railway, no Meta setup |
| **Low, no subscription** | `hermes` on Railway Hobby (Tier A) with an API key and spend cap | `cheap` for triage, `main` for drafts (`models.json`) | Telegram | Markdown (+ Hermes built-in) | 24/7 lead pings without a laptop |
| **Medium** (agent or small team that wants automatic first replies) | `hermes` on Railway (Cloud API mode, not Baileys), API key + spend cap; Tier A **plus a generated domain** for the Meta webhook with signature validation, or Tier B when pgvector is needed (`knowledge/capabilities/deploy-railway.md`); Telegram for the owner | `cheap` for qualification, `main` for matching/drafts | WhatsApp Cloud API on a **new** number (or the agency's BSP) + Telegram | Markdown + pgvector (Tier B) | Bot only qualifies and books; every outbound template is `IRR-09`. Do not pick `openclaw` for WhatsApp unless Baileys consent is logged (`CMP-06`) |

## Sources

- WhatsApp policy and Cloud API path: `knowledge/capabilities/whatsapp.md`; Meta terms: https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- WhatsApp usage in LATAM (secondary): https://infobip.com/blog/whatsapp-statistics
- EasyBroker connectors (third-party MCPs): https://viasocket.com/mcp/easybroker · https://pipedream.com/apps/easybroker.md · https://jentic.com/apis/easybroker
- HubSpot remote MCP GA: https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- Pipedrive MCP launch: https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- Kommo community MCP: https://glama.ai/mcp/servers/@cAIborg-ai/amocrm-mcp/tree/26804dcff7cf3d9d6502167a08257c90057fbe25
- Graphiti MCP (experimental): https://help.getzep.com/graphiti/getting-started/mcp-server
- LFPIORPI Art. 17 fr. V (secondary): https://www.bhrmx.com/wp-content/uploads/2025/11/INTERMEDIACI%C3%93N-EN-LA-TRANSMISI%C3%93N-DE-INMUEBLES-Y-LA-LFPIORPI.pdf · https://idconline.mx/corporativo/2025/11/25/ley-antilavado-amplia-a-desarrollos-inmobiliarios-de-renta
- Railway cron (UTC): https://docs.railway.com/reference/cron-jobs

`stack-researcher` re-checks these live at install time: official MCP or API terms for EasyBroker, Tokko Broker, Inmovilla and
Idealista; whether each portal's terms forbid scraping; an official Kommo MCP; AML duties for real
estate outside Mexico.
