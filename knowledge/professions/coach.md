# Profession: Coach / consultant

> Pack for coaches, mentors and independent consultants who work 1:1 or in small cohorts: Jarvis prepares each session, turns notes into summaries and homework, chases payments and repurposes what they teach — with client notes treated as confidential and nothing sent to a client without the coach's "sí".

Last verified: 2026-10-06

No versions or model IDs live here. Runtimes: `knowledge/runtimes/<id>.md`. Model slots:
`knowledge/models.json`. Prices: `knowledge/capabilities/costs.md`. Irreversible actions (`IRR-NN`)
and controls (`SEC-NN`): `knowledge/security-checklist.md`.

## Signals

- "doy sesiones", "coaching", "mentoría", "consultoría", "acompañamiento", "mis clientes 1:1"
- "programa de 8 semanas", "cohorte", "mastermind", "tarea para el cliente", "seguimiento"
- "agendan por Calendly / Cal.com", "cobro por link de pago", "Zoom", "Meet"
- "entrenador personal", "coach de vida / negocios / ejecutivo", "coach de carrera"

**Route elsewhere:** psychologists, therapists, nutritionists or anyone keeping clinical records →
primary pack `health` (clinical data rules, CMP-19). Business consultants selling to companies with
a team → consider `founder` or `agency` as secondary. Coaches who live on content → `creator` as
secondary.

## Week-one jobs (pick 3)

| # | Job (their words) | What Jarvis does | Needs |
|---|---|---|---|
| 1 | "Antes de cada sesión dame un resumen de lo que vimos la vez pasada y qué tarea quedó." | ~45 min before a session: last summary, open homework, goals, 3 suggested questions | Calendar (read) + `memory/clients/` |
| 2 | "Después de la sesión, con mi nota de voz, arma el resumen y la tarea para mi cliente." | Transcribes the voice note, writes the session summary to the client file, drafts the follow-up message. The coach sends it (or approves "sí, envía") | Voice notes in (`knowledge/capabilities/voice.md`) · sending = IRR-01 |
| 3 | "Recuérdame quién no me ha pagado y prepárame el mensaje con el link." | Weekly list of unpaid sessions/packages, drafts a kind reminder; a payment link with an amount is created only after approval | Payments (read) · link = IRR-03 |
| 4 | "Cuando alguien agende, avísame y prepárale el cuestionario de bienvenida." | New-booking alert, creates the client file from the intake form, drafts the welcome message | Calendly / Cal.com (read) |
| 5 | "Convierte lo que enseñé esta semana en 3 ideas de post." | Repurposes **anonymized** themes (never client stories without consent) into post ideas | Workspace only |

Default trio: 1, 2, 3.

## Channels

| Channel | Use | Rule |
|---|---|---|
| **Telegram** (owner only) | Default. Voice notes after sessions, pre-session briefs, approvals | SEC-01 allowlist; voice notes are the killer feature here |
| WhatsApp, owner only | If they insist: Cloud API, grey zone for a personal assistant (`knowledge/capabilities/whatsapp.md`) | Never Baileys by default |
| **Messages to clients** | Coaches talk to clients on their everyday WhatsApp. Jarvis **drafts**; the coach copies or forwards from their own phone | Zero policy risk; no bot on the client side in v1 |
| Appointment reminders to clients via Cloud API | Allowed business use (utility templates) | Later via `/jarvis-add`; each outbound template costs money (IRR-09) |

**Hard line (CMP-07):** a coach may not offer "mi coach IA en WhatsApp" to clients or followers
as a product. That makes them an AI provider under Meta's terms. Jarvis is the coach's assistant,
not the product. Same on the subscription side: a Jarvis used by clients is not "personal use" of
a Claude plan (CMP-30, SEC-01).

## Memory

- Markdown workspace + one file per client: `memory/clients/<alias>.md` (goals, agreements,
  session log, homework status). Use an **alias or initials**, not the full name; the
  alias↔contact mapping stays in the coach's own address book, not in the workspace.
- **Local-first.** Session notes are confidential and often touch health, family, money or
  relationships. Default host = the coach's computer; no memory SaaS (Mem0 etc.); cloud embeddings
  only with consent (`knowledge/capabilities/memory.md`, privacy row).
- If a client discloses health/mental-health details, the summary records "tema de salud — ver
  notas del coach", not the details.
- sqlite-vec locally once client files pass ~200 lines total and the coach wants "¿qué le dije a
  X sobre…?".
- Retention: when a client relationship ends, `weekly-review` proposes archiving or purging the file.

## Tools / MCP

| Need | Tool | Tier | Read-only default | Write only for… |
|---|---|---|---|---|
| Calendar | Google Workspace MCP (Calendar), developer preview | T1 | Read events | Creating/accepting events with clients = IRR-06 |
| Bookings | **Calendly** official remote MCP `https://mcp.calendly.com` (OAuth/DCR) **or** **Cal.com** official `https://mcp.cal.com/mcp` (OAuth 2.1) | T1 | List events, invitees, event types | Cancel/reschedule = IRR-04/IRR-06; single-use links fine after yes |
| Payments | **Stripe** official `https://mcp.stripe.com` (OAuth / Agent key) | T1 | `stripe_api_read`; deny `stripe_api_write` | Payment link with amount sent to a client, refunds = IRR-03 |
| Payments (LATAM) | Mercado Pago official MCP is developer-scope only (UNVERIFIED for live payments) → T3 wrapper over MP REST for "who paid?" | T1 dev / T3 | Read payments | Links = IRR-03 |
| Client notes / programs | **Notion** official `https://mcp.notion.com/mcp` — only the "Clientes" database shared | T1 | Read | Page updates after yes (IRR-11 if it feeds automations) |
| Light CRM | HubSpot (`https://mcp.hubspot.com`, free CRM tier) or Pipedrive official MCP (paid plans; endpoint URL UNVERIFIED) | T1 | Read contacts/deals | Stage moves = IRR-11; deletes IRR-04 |
| Meeting transcripts | Google Meet transcripts in Drive via Workspace MCP (Drive read) | T1 | `drive.readonly` scoped to the transcripts folder | — |
| Email | Workspace MCP (Gmail) | T1 | `gmail.readonly` + drafts | Send = IRR-01 |

Zoom/Fathom/other note-takers: no MCP evaluated in this pass (UNVERIFIED). Use exported
transcripts or the coach's voice note instead. Recording a session needs the client's consent.

## Scheduled jobs

Timezone: local time on the coach's machine; **Railway Cron Jobs run in UTC**, convert
(`knowledge/capabilities/scheduling.md`).

| Job | Cron (local) | Slot | Notes |
|---|---|---|---|
| Morning briefing | `3 7 * * 1-6` | `cheap` | Today's sessions, who has pending homework, unpaid items |
| Pre-session check (heartbeat) | `13,43 8-20 * * 1-6` | `cheap` | If a session starts in ≤ 45 min and no brief was sent, run `session-prep`; otherwise silent |
| Payment follow-up list | `17 10 * * 1,4` | `cheap` | Drafts only; nothing goes to clients from cron (SEC-15) |
| Content repurposing | `37 16 * * 5` | `main` | 3 ideas from anonymized weekly themes |
| Weekly review | `7 18 * * 0` | `main` | Clients without a next session, overdue homework, archive proposals |

## Skills

Base: `remember` (always), `morning-briefing`, `meeting-prep` (adapted as `session-prep`),
`draft-reply`, `weekly-review`.

Pack skills (max 3 in week one):

| Skill | One-line spec | Irreversible step |
|---|---|---|
| `session-prep` | Read the client file + calendar event; output last summary, open homework, goal progress, 3 questions; ≤ 12 lines | No |
| `session-summary` | From a voice note or notes: write summary + agreements + homework to `memory/clients/<alias>.md` with date and provenance; draft the client follow-up in the coach's voice; strip health details to a marker | Sending the follow-up = IRR-01 (approval) |
| `payment-chaser` | Cross bookings vs. payments; list unpaid; draft a warm reminder; create a payment link only after "sí, crea el link de $X" | **Yes** — payment link with amount IRR-03 |
| `intake-onboarding` | On a new booking: create the client file from the intake answers (minimum data), draft welcome + privacy line | Sending = IRR-01 |
| `content-repurpose` | Turn the week's anonymized themes into 3 post ideas with hooks; never name or describe identifiable clients | Publishing (if ever connected) IRR-02 |

## Guardrails

- **Confidentiality first.** Client notes are third-party personal data, sometimes sensitive
  (health, sex life, religion, finances). Local memory, aliases, minimum data (SEC-13). In
  Mexico (LFPDPPP 2025), Colombia (Ley 1581 + SIC Circular 002/2024 on AI) and Spain (GDPR) the
  coach needs a privacy notice that says notes are processed with an AI service and names the
  processors (model provider, host). The Architect drafts it from the country file, marked
  "revisar con abogado".
- **Not a therapist.** Jarvis never gives clinical, medical or crisis advice to anyone. If a note
  mentions self-harm, abuse or a crisis, Jarvis flags it to the coach only and suggests local
  emergency resources for the coach to share; it never contacts the client.
- **Pro/Max is not a compliance product** (no BAA). If the coach handles clinical data, switch
  to `health` (CMP-19).
- **Irreversible here:** messages to clients (IRR-01), payment links/refunds (IRR-03), cancelling
  or moving bookings (IRR-04/IRR-06), publishing content (IRR-02). Preview + yes; denied in cron.
- **Client messages and intake forms are untrusted [A].** The session that reads them drafts only
  (SEC-11).
- **Recording consent:** do not process session recordings unless the coach confirms the client
  agreed.

## Interview extras

1. "¿Cómo tomas notas de tus sesiones hoy (libreta, Notion, grabas, nada)?" → decides voice notes vs.
   transcripts vs. Notion.
2. "¿Cómo te pagan y cómo agendan (Calendly, Cal.com, WhatsApp, transferencia)?" → payments and
   booking tools.
3. "¿Tus clientes te cuentan cosas de salud o terapia?" → yes means `health` as secondary pack and
   stricter memory.

## Recommended default stack

| Budget | Stack | Why |
|---|---|---|
| **Low** (has Claude Pro/Max, works from the laptop) | `claude-code-local` + Telegram (voice notes), Calendar + Calendly/Cal.com read-only, local memory | Data stays on their machine; no extra model cost |
| **Low, no subscription** | Same with `ANTHROPIC_API_KEY` + spend cap; `cheap` for heartbeat and lists | Few short jobs per day |
| Non-technical, no messaging needed | `cowork` (recommend and stop) with Calendar/Notion connectors | Nothing to install; CMP-17 if they later want Telegram |
| **Medium** (wants briefs on the phone while the laptop is off) | `hermes` on Railway Tier A, API key + caps, Telegram; client files on the Railway volume, encrypted backups | Say plainly: client notes then live on a cloud host outside their computer (Railway; pick the region closest to them, EU for Spain) — the privacy notice must name it |

## Sources

- Calendly MCP: https://developer.calendly.com/calendly-mcp-server · https://community.calendly.com/developer-faq-62/announcing-the-calendly-mcp-server-5450
- Cal.com MCP: https://cal.com/docs/mcp-server.md
- Stripe MCP: https://docs.stripe.com/mcp
- Mercado Pago MCP scope: https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview
- Notion MCP and HubSpot/Pipedrive MCP: see `knowledge/capabilities/tools-mcp.md` § Sources
- Meta WhatsApp terms (AI-provider clause): https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- Colombia SIC Circular 002/2024 (AI): https://normograma.mintic.gov.co/mintic/compilacion/docs/circular_superindustria_0002_2024.htm
- Mexico LFPDPPP 2025 (secondary): https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies
- Railway cron (UTC): https://docs.railway.com/reference/cron-jobs

UNVERIFIED in this file: Calendly MCP tool count and launch date (secondary/community post);
Mercado Pago live-payment tools; MCPs for Zoom/Fathom; whether a coach's notes fall under any
domestic-use exclusion in Mexico's LFPDPPP 2025.
