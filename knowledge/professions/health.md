# Profession: Health (doctor, dentist, therapist, nutritionist, clinic)

> Pack for health professionals in private practice: agenda, dictation, literature and admin help, built so identifiable patient data never lands in a consumer plan or a SaaS memory, with appointment messaging left to compliant, task-scoped tools.

Last verified: 2026-10-06

No versions or prices live here. Runtimes and security floors: `knowledge/runtimes/*.md`. Model
slots: `knowledge/models.json`. Costs: `knowledge/capabilities/costs.md`. WhatsApp rates and data
law per country: `knowledge/countries/<cc>.md`.

## Signals

- "Soy médico / doctora / dentista / psicóloga / nutrióloga / fisioterapeuta", "tengo consultorio",
  "mi clínica".
- "Pacientes", "citas", "consulta", "expediente clínico", "historia clínica", "recetas",
  "notas de evolución", "seguimiento", "primera vez / subsecuente", "aseguradoras".
- "Mis pacientes no llegan a su cita", "me tardo mucho escribiendo las notas".

Anti-signal: a wellness coach or fitness trainer without clinical records fits `coach`. A clinic
owner who mainly asks about sales, inventory and staff fits `smb-restaurant` as secondary.

## Week-one jobs

| # | Job (as they say it) | Becomes | Patient data? |
|---|---|---|---|
| 1 | "Cada mañana dime cuántas consultas tengo, a qué hora y cuáles son primera vez." | `morning-briefing` on the calendar, events written with **initials or a code**, not full names | Minimal (alias only) |
| 2 | "Le dicto la nota al terminar la consulta y me la ordenas en formato SOAP para pegarla en mi expediente." | `dictation-to-note` — **local** STT + local model; the professional pastes it into their EHR | **Yes → local only** |
| 3 | "Búscame qué hay de nuevo sobre <tratamiento> con fuentes, en 10 líneas." | `literature-brief` | None |
| 4 | "Que a mis pacientes les llegue el recordatorio de su cita un día antes." | **Use the booking tool's own reminders** (Google Calendar appointment schedules, Cal.com, Doctoralia, AgendaPro…), not Jarvis. Jarvis only checks they went out | Stays in the booking tool |
| 5 | "Prepárame el texto para mis redes / la indicación general de cuidados después de X procedimiento." | `draft-reply` / content draft, generic, no patient | None |

Job 4 is deliberately not an autonomous Jarvis job: sending to patients is `IRR-01`/`IRR-09` and
`SEC-15` forbids it unattended. A booking tool that already holds consent and sends reminders is
the compliant shortcut. Which of those tools send WhatsApp reminders officially, and in which
country, is checked at install in the tool's own docs.

## Channels

| Use | Channel | Why |
|---|---|---|
| Owner ↔ Jarvis | **Telegram** (default), owner-only allowlist (`SEC-01`) | Free, no policy risk. Never discuss identifiable patients over it on a cloud model path |
| Privacy-first / dictation | **Open WebUI** on loopback or the terminal, with `ollama-local` | Patient text never leaves the computer |
| Voice | Voice notes → **local** STT (whisper-family) for anything clinical; cloud STT (Deepgram, ElevenLabs Scribe) only for non-patient content (→ `knowledge/capabilities/voice.md`) | Audio of a consultation is health data |
| Patients (optional, later) | **WhatsApp Cloud API** or a BSP, **task-scoped only**: confirm/cancel/reschedule, address, hours, prices, prep instructions. Paid templates = `IRR-09` (→ `knowledge/capabilities/whatsapp.md`) | A practice answering its own patients is an allowed business use. **No medical advice, no diagnosis, no results over the bot**; escalate to a human. **Never Baileys** for a practice number (`SEC-31`, `CMP-05`) |

## Memory

- **Local markdown workspace only** (→ `knowledge/capabilities/memory.md`, row "Health data").
- **No patient data in `MEMORY.md`, `USER.md` or any synced file.** If the professional wants
  per-patient context, it lives in their EHR, not in Jarvis. Jarvis may keep a pointer
  ("paciente P-104: ver expediente") and practice-level facts (hours, prices, protocols).
- **sqlite-vec only locally**, only over the professional's own protocols, guides and templates,
  with a **local** embedding model. Never index clinical notes with a cloud embedding provider.
- **No memory SaaS, no Graphiti, no pgvector on Railway** for this pack.
- Retention: dictation drafts are deleted from the workspace once pasted into the EHR (default
  24 h, written in `SECURITY.md`). The legal record is the EHR (in Mexico NOM-004-SSA3-2012 §5.4
  requires keeping the clinical record at least 5 years from the last medical act — that duty
  belongs to the EHR, not to Jarvis; [DOF 2012-10-15](https://dof.gob.mx/nota_detalle.php?codigo=5272787&fecha=15/10/2012)).

## Tools / MCP

Trust tiers per `knowledge/capabilities/tools-mcp.md` (T1 official remote OAuth · T2 pinned
community · T3 alpha/generated wrapper · T4 Zapier). All start **read-only** (`SEC-22`).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| Google Calendar (Workspace MCP) | T1 | read | Agenda; events by initials/code. Creating/moving patient appointments = `IRR-06` |
| Gmail (Workspace MCP) | T1 | read | Admin mail only (suppliers, insurers' general notices). Mail with patient data → don't route through a cloud model |
| Literature search (built-in web search/fetch on PubMed, guidelines) | built-in | read | No patient data in queries. A PubMed MCP is optional (T2, pin it); check the Claude connector directory for a first-party PubMed connector at install |
| Local STT (whisper-family) + local model (`ollama-local`) | local | local files | For dictation. Hardware rule from `questions/0-preflight.md`; below it, dictation stays manual |
| Booking tool (Cal.com, Google appointment schedules, Doctoralia, AgendaPro…) | varies | read (counts, confirmation status) | Most have no MCP (check the vendor docs at install); read via calendar sync or Zapier (T4). Never give Jarvis delete rights over appointments (`IRR-04`) |
| EHR / expediente clínico electrónico | **none** | — | Jarvis does not read or write the EHR in v1. Copy-paste by the professional |
| Payments (Stripe / Mercado Pago links) | T1 | read | Optional. Creating a payment link with an amount = `IRR-03` |

## Scheduled jobs

Off-minutes only. Local runtimes use the machine's timezone; **Railway cron is UTC**
([docs](https://docs.railway.com/reference/cron-jobs)) — convert (America/Mexico_City UTC−6 all
year, America/Bogota UTC−5, America/Argentina/Buenos_Aires UTC−3, Europe/Madrid UTC+1/+2).
`/loop` and session CronCreate expire after 7 days; use Desktop scheduled tasks or launchd/cron
(→ `knowledge/capabilities/scheduling.md`).

| Job | Example cron (local) | Does | Unattended limits |
|---|---|---|---|
| Morning agenda | `3 7 * * 1-6` | Number of consultations, first-time vs. follow-up (from calendar codes), gaps to fill | Read-only |
| Tomorrow check | `13 18 * * 0-5` | Confirms the booking tool shows tomorrow's reminders sent / confirmations received; lists unconfirmed slots for the owner | Read-only, never messages patients |
| Literature digest | `21 8 * * 1` | One short weekly brief on 1–2 topics the owner chose, with links | Read-only |
| Weekly review | `27 19 * * 5` | Week's admin summary, cancellations count, memory proposals (no patient data) | Proposals only |

## Skills

Base skills: `remember` (always; refuses health data of third parties per `SEC-13`),
`morning-briefing`, `weekly-review`; `inbox-triage` only for admin mail.

Pack skills (week one = at most 3):

| Skill | One-line spec | Approval points |
|---|---|---|
| `dictation-to-note` | Takes a local transcript and returns a structured note (SOAP or the owner's own format), flags missing fields and anything the model inferred; runs **only on the local model** and refuses if the active model is a cloud one | None; output is a draft the professional reviews and pastes |
| `literature-brief` | Searches public sources on a clinical question, returns 5–10 lines with citations and evidence level, plus "esto no sustituye tu juicio clínico" | None |
| `patient-instructions-draft` | Turns the owner's protocol into a generic, plain-language handout (pre-op prep, post-procedure care) without patient identifiers | Sending to a patient = `IRR-01` |
| `agenda-gaps` | Finds free slots and cancellations this week and suggests who on the owner's own waitlist (by code) to offer them to | Contacting anyone = `IRR-01`; booking = `IRR-06` |

## Guardrails

- **Claude Pro/Max is not HIPAA-ready.** Anthropic's BAA covers HIPAA-ready commercial services
  once the organization's Primary Owner signs it: the first-party API, Claude Enterprise with the
  HIPAA configuration, Claude Code in the terminal/Desktop with that configuration, and Claude Code
  on a Console API key **only with ZDR enabled** on qualified accounts. It does **not** cover
  Claude Free, Pro, Max or other consumer plans, Claude Code cloud/web/mobile sessions, or
  third-party MCPs, skills and connectors ([Anthropic Privacy Center](https://privacy.claude.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers),
  fetched 2026-10-06). This is `CMP-19`, a BLOCK. On a Pro/Max Jarvis the Architect says it out
  loud and restricts it to non-patient tasks. Even under a BAA, every MCP/tool in the chain is
  outside it, so the local lane stays the default for patient text.
- **Consumer plans may train on chats.** Free/Pro/Max (including Claude Code on those accounts)
  can use chats for training if "Help improve Claude" is on, retention up to five years; off,
  30 days ([Anthropic](https://www.anthropic.com/news/updates-to-our-consumer-terms)). Have the
  person turn it off regardless.
- **No identifiable patient data to any SaaS** (model, STT, embeddings, memory, BSP) without:
  a contract that covers it (BAA where HIPAA applies; a processor/DPA agreement elsewhere), the
  patient's consent in the privacy notice, and the professional's explicit yes logged in
  `jarvis-spec.md` (Gate C). Default: local path.
- **Health data is sensitive data** in every target country: Mexico (express consent; LFPDPPP 2025
  + General Health Law), Colombia (Ley 1581 sensitive data), Argentina (Ley 25.326), Spain (GDPR
  Art. 9). The Architect generates a draft privacy-notice addendum from the country pack, marked
  "revisar con abogado" (`SEC-32`). HIPAA itself only matters if the practice handles US patients'
  data as a covered entity — ask, don't assume.
- **No clinical decisions.** Jarvis never diagnoses, prescribes, changes a dose or answers a
  patient's clinical question. Any patient-facing text is generic and reviewed.
- **Irreversible list for this pack** (adds to `knowledge/security-checklist.md` §1): any message to
  a patient (`IRR-01`), paid WhatsApp templates (`IRR-09`), creating/cancelling appointments
  (`IRR-06`/`IRR-04`), payment links (`IRR-03`), anything written into the EHR. All denied in cron.
- **Patient bot (if ever added):** discloses it is an AI on first message (mandatory in the EU under
  AI Act Art. 50), offers a human, never asks for symptoms or results.

## Interview extras

1. "¿Atiendes pacientes de Estados Unidos o trabajas con aseguradoras de allá?" → whether HIPAA/BAA
   applies at all.
2. "¿Qué usas hoy para agendar y para el expediente (Doctoralia, AgendaPro, Google Calendar,
   papel…)? ¿Ya manda recordatorios?" → reminders stay in that tool.
3. "¿Quieres dictar notas? Si sí, ¿tu computadora es Mac con chip M o tiene tarjeta de video?" →
   decides whether local dictation is viable.

## Recommended default stack

| Budget | Runtime / host | Model | Channel | Memory | Scope |
|---|---|---|---|---|---|
| **Low** (already pays Claude Pro/Max) | `cowork` if no messaging is needed, else `claude-code-local` with Desktop scheduled tasks | Subscription, training toggle off | Telegram (owner only) | Local markdown | **Non-patient only**: agenda by codes, literature, handouts, admin. Reminders stay in the booking tool |
| **Low, privacy-first** (meets local-model hardware rule) | `ollama-local` under `hermes` or `openclaw` (at/above floor), local only | Local model from `models.json` | Open WebUI on loopback / terminal | Local markdown + local sqlite-vec over protocols | Dictation-to-note and anything with patient text. ≤ 5 tools (`CMP-25`), `num_ctx` set (`CMP-24`) |
| **Medium** (hybrid, recommended for most practices) | `claude-code-local` with an **Anthropic API key** + spend cap for non-patient work, **plus** local `ollama-local` for dictation | `cheap`/`main` from `models.json`; local model for patient text | Telegram + local UI | Local only | Two lanes, written in `AGENTS.md`: cloud lane never sees patient identifiers. A WhatsApp patient bot (Cloud API on Railway via `hermes`) is a later `/jarvis-add`, with consent, minimal data and a signed processor agreement |

## Sources

- Anthropic BAA scope (primary, fetched 2026-10-06): https://privacy.claude.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers
- Anthropic consumer terms (training toggle, retention): https://www.anthropic.com/news/updates-to-our-consumer-terms
- NOM-004-SSA3-2012 §5.4, 5-year minimum (primary, DOF): https://dof.gob.mx/nota_detalle.php?codigo=5272787&fecha=15/10/2012
- Health data as sensitive data in Mexico (secondary): https://iapp.org/news/a/la-proteccion-de-datos-personales-en-los-expedientes-clinicos
- Railway cron (UTC): https://docs.railway.com/reference/cron-jobs
- Meta WhatsApp Business terms (AI-provider clause): https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- WhatsApp general-purpose chatbot ban explained: https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- Mexico LFPDPPP 2025: https://www.ey.com/es_mx/technical/tax/boletines-fiscales/nueva-ley-federal-proteccion-datos-personal-posesion-particulares
- EU AI Act Art. 50 timing: https://www.ropesgray.com/en/insights/viewpoints/2026/08/102nfqm/you-talkin-to-me-operationalising-the-eu-ai-acts-transparency-obligations

`stack-researcher` re-checks these live at install time: which booking tools
send official WhatsApp reminders per country and whether they expose an API/MCP; first-party
PubMed connectors for Claude; local STT accuracy on medical Spanish vocabulary.
