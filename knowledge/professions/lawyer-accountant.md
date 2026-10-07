# Profession: Lawyer / Accountant

> Pack for lawyers, notaries' staff, accountants and bookkeepers (abogados, despachos, contadores): deadline tracking, client document chasing, drafting and reconciliation, with professional secrecy driving every choice toward local-first and read-only.

Last verified: 2026-10-06

No versions or prices live here. Runtimes and security floors: `knowledge/runtimes/*.md`. Model
slots: `knowledge/models.json`. Costs: `knowledge/capabilities/costs.md`. Fiscal tools, data law
and currency per country: `knowledge/countries/<cc>.md` (`mx`, `co`, `ar`, `es`, `other`).

## Signals

Pick this pack when the person says things like:

- "Soy abogado / abogada", "tengo un despacho", "llevo juicios", "expedientes", "audiencias",
  "términos", "contratos", "amparos", "demandas", "notaría".
- "Soy contador / contadora", "llevo la contabilidad de varios clientes", "declaraciones",
  "cierre de mes", "conciliar CFDI", "el SAT", "la DIAN", "ARCA / AFIP", "Hacienda", "IVA",
  "nómina", "CONTPAQi", "Alegra", "Siigo".
- "Mis clientes nunca me mandan los papeles a tiempo", "se me pasan los vencimientos".

Anti-signal: a founder who only wants to "see my own numbers" fits `founder` (with `smb-restaurant`
or `ecommerce` as secondary), not this pack. This pack is for people who handle **other people's**
legal or fiscal matters.

Lawyer and accountant share one pack because the shape is identical: many clients, hard deadlines,
documents in and out, confidentiality duties, and acts with legal effect that must never be
automated. Split the skills by sub-profession (below).

## Week-one jobs

Written the way the person says them. Pick 3, turn each into a skill or a scheduled job.

| # | Job (as they say it) | Sub-profession | Becomes |
|---|---|---|---|
| 1 | "Cada mañana dime qué vence hoy y esta semana: audiencias, términos, declaraciones." | both | `morning-briefing` + `deadline-check` |
| 2 | "Recuérdame a qué clientes les faltan documentos este mes y prepárame el mensaje para pedírselos." | accountant (lawyer: pruebas, poderes) | `doc-chase` (drafts only) |
| 3 | "Compara los CFDI que emitió y recibió mi cliente contra lo que tiene en su contabilidad y dime qué no cuadra." | accountant (MX) | `cfdi-reconcile` (read-only) |
| 4 | "Hazme un primer borrador de este contrato / escrito con base en mi plantilla y márcame lo que tengo que revisar." | lawyer | `draft-from-template` |
| 5 | "Resúmeme este expediente / este PDF de 80 páginas: partes, fechas, lo que se pide y lo que falta." | lawyer | `case-summary` |

## Channels

| Use | Channel | Why |
|---|---|---|
| Owner ↔ Jarvis | **Telegram** (default) or **terminal / Claude app** (Remote Control) for Claude Code users | Free, official API, zero policy risk; owner-only allowlist (`SEC-01`) |
| Privacy-first / "nada sale de mi compu" | **Jarvis Panel** on loopback through the harness, with `ollama-local` (→ `knowledge/capabilities/web-ui.md`) | Nothing leaves the machine |
| Email | Read the person's inbox via Gmail MCP **read-only**; drafts stay drafts. Optional agent-owned inbox (AgentMail or a dedicated mailbox at the firm's own provider) for receiving client documents (→ `knowledge/capabilities/channels.md` § Email). A hosted agent inbox is one more processor of confidential client files: only with the person's explicit yes and listed in the privacy notice (`SEC-32`); otherwise a dedicated mailbox on the provider they already use | Never give Jarvis send-as-owner rights on day one |
| Clients | **None in week one.** Jarvis drafts the WhatsApp/email message; the professional sends it from their own phone or mail | Professional secrecy + Meta policy; avoids a customer-facing bot entirely |
| WhatsApp to clients (later, optional) | Only the official **Cloud API** or a BSP, task-scoped ("te faltan estos documentos"), utility templates are paid (`IRR-09`) (→ `knowledge/capabilities/whatsapp.md`) | Document chasing for the firm's own clients is a business use. **Never Baileys on a number clients know** (`SEC-31`, `CMP-05`) |

## Memory

- **Markdown workspace**, local, always (→ `knowledge/capabilities/memory.md`).
- **One folder per client** under `memory/topics/clients/<alias>/` with an alias, not the legal
  name, when the person prefers. Store **pointers**, never values: "Constancia de situación fiscal:
  Drive › Clientes › A-017", never the RFC/NIT/CUIT itself (`SEC-13`).
- **sqlite-vec locally** once there are many clients or the person wants to search their own
  templates and past escritos. Embeddings: local model via Ollama by default; a cloud embedding
  provider only with explicit consent, because it is another processor of client data.
- **Client isolation** (many client companies, like `agency.md`): one alias folder per client;
  a job or skill loads only the folder of the client it is working on; a summary for client A
  never quotes another client's folder. Tools follow the same split: **one credential per client
  company** (e.g. one Siigo API credential per company, named `SIIGO_<ALIAS>_*`, each read-only)
  unless the provider offers a documented multi-company accountant access (for Siigo,
  `stack-researcher` checks this in Siigo's docs at install). Whether each client's plan includes API access, and its price, goes
  in the quote as a separate line (`countries/co.md` § Fiscal / invoicing tools).
- **Fiscal calendar per client**: the country pack's § Fiscal calendar says what may be stored
  (e.g. CO: last 1–2 NIT digits + obligations per alias, never the full NIT).
- **Graphiti** (temporal graph) only for a litigation practice with many parties ↔ cases ↔ dates
  changing over time, local host only, flagged experimental. Not week one.
- **No memory SaaS** (Mem0 hosted, Zep cloud) without written consent. Professional secrecy
  (secreto profesional) is a legal duty in every target country; how it maps onto LLM processing is
  not settled the same way in every jurisdiction — say so plainly and recommend the person check with their
  colegio/bar association.

## Tools / MCP

Trust tiers (from `knowledge/capabilities/tools-mcp.md`): **T1** official remote OAuth MCP · **T2**
maintained community MCP pinned to a version · **T3** alpha or generated thin wrapper
(written by the architect itself) · **T4** Zapier MCP fallback. Everything starts **read-only**
(`SEC-22`).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| Google Calendar (Workspace MCP) | T1 | read | Hearings, client meetings, fiscal due dates. Creating events with third parties = `IRR-06` |
| Gmail (Workspace MCP) | T1 | read | Inbox triage; email bodies are untrusted data (`SEC-12`). Send = `IRR-01` |
| Google Drive (Workspace MCP) | T1 | read | Client folders, templates. Overwrite/delete = `IRR-04` |
| PDF / docx / xlsx handling | built-in (Claude Code) or own skill | local files | Prefer working on local copies inside the Jarvis workspace. Vendor document skills only through `knowledge/capabilities/skills.md` § 6 |
| **Alegra** official MCP (MX, CO, ES and others) | T1 | read | Launched 2026-06-08. List its tools after connecting to see write scope and plan gating — keep read-only regardless |
| **Siigo** (CO) community MCP (e.g. `jdlar1/siigo-mcp`) | T2 | read (its default) | Pin version; read its source before install (`SEC-24`) |
| **Facturapi** (MX) via `@codespar/mcp-facturapi` or a generated wrapper | T2/T3 | read (status, download) | Stamp/cancel = `IRR-05`, always preview + yes, output is a draft the accountant reviews. Never route a production key through a third party's remote MCP |
| Facturapi bulk CFDI download / SAT descarga masiva via a PAC | T3 | read | For `cfdi-reconcile`. Pricing in `knowledge/countries/mx.md` |
| **CONTPAQi** (MX) | T3 local only | read via XML/Excel exports | No MCP, no cloud API: Windows bridge next to the install or exports. **Never on Railway** (`CMP-20`) |
| ARCA/AFIP (AR) via `codespar/mcp-afip` | T3 (alpha) | read | Only after reading the source; otherwise work from exported files |
| Case-law / gazette search (SJF of SCJN in MX, CENDOJ in ES, Rama Judicial in CO) | built-in web search/fetch | read | Public sources; cite every result. Automated scraping of court portals may break their terms (read the portal's terms first) — prefer manual lookups the agent summarizes |
| Court e-filing (Tribunal Electrónico, LexNET, etc.) | **none** | — | Out of scope. Jarvis never files, signs or submits |

## Scheduled jobs

Off-minutes only (avoid `:00`/`:30`). Times below are local. Local runtimes use the machine's
timezone (Desktop scheduled tasks, launchd/cron). **Railway cron is UTC** — convert (e.g.
America/Mexico_City is UTC−6 all year; America/Bogota UTC−5; America/Argentina/Buenos_Aires UTC−3;
Europe/Madrid UTC+1/+2 with DST) ([Railway cron docs](https://docs.railway.com/reference/cron-jobs)).
`/loop` and session CronCreate expire after 7 days, so never use them for these
(→ `knowledge/capabilities/scheduling.md`).

| Job | Example cron (local) | Does | Unattended limits |
|---|---|---|---|
| Morning briefing | `3 7 * * 1-5` | Today's hearings/meetings, deadlines in the next 7 days, overnight client emails classified | Read-only |
| Deadline heartbeat | `17 9-18/2 * * 1-5` | Checks `HEARTBEAT.md` (new court notification email? deadline < 48 h without a done mark?) and stays silent (`HEARTBEAT_OK`) when nothing is due | Read-only |
| Fiscal calendar reminder (MX) | `7 9 10,14,16 * *` | Reminds which clients still lack monthly declaration data before the day-17 deadline for monthly ISR provisional payments of personas morales ([LISR art. 14](https://sdv.com.mx/compendio/ley-isr/articulo-14/), secondary compendium, re-checked 2026-10-06) | Read-only. Personas físicas, other regimes and countries: deadlines come from the official calendar (DIAN by NIT digit, ARCA by CUIT digit, AEAT quarterly) loaded into the country pack — **never invented** |
| Document chase draft | `11 10 1,5 * *` | Lists clients missing documents and prepares one draft message per client for the owner to send | **Never sends** (`SEC-15`, `CMP-38`) |
| Weekly review | `23 18 * * 5` | Week summary, slipped deadlines, memory proposals | Proposals only |

## Skills

Base skills from `templates/skills-base/`: `remember` (always), `morning-briefing`, `inbox-triage`,
`weekly-review`; `draft-reply` only if the person wants Jarvis to write client replies (send stays
behind a "sí, envíalo").

Pack skills (written by `workspace-writer`; week one = at most 3):

| Skill | One-line spec | Approval points |
|---|---|---|
| `deadline-check` | Reads calendar + `memory/topics/deadlines.md`, lists every término/vencimiento in the next N days with days remaining, flags anything < 48 h | None (read-only) |
| `doc-chase` | For each client, compares the month's required-documents checklist with what arrived in Drive/email and drafts a polite request in the owner's voice | Sending = `IRR-01`, owner sends or approves each one |
| `cfdi-reconcile` (MX) | Compares issued vs. received CFDI XML (from a download folder or the PAC) against the ledger export; outputs a discrepancy table (UUID, amount, status) | None — never cancels or re-stamps; cancellation = `IRR-05` |
| `draft-from-template` | Fills the owner's own template (contract, escrito, carta) from a short brief; marks every assumption with `[[REVISAR]]` and every legal citation as "verificar" | Signing/sending = `IRR-05`/`IRR-01`; output is always a draft |
| `case-summary` | Summarizes a PDF/expediente into parties, dates, claims, pending actions and open questions, quoting page numbers | None |
| `invoice-preview` (MX, from `countries/mx.md`) | Shows a CFDI preview (receptor alias, concept, amounts, uso CFDI) before stamping | Stamp = `IRR-05`, explicit yes every time, never in cron |

## Guardrails

- **Never store or handle e.firma (FIEL), CSD, certificate files, private keys or their passwords**,
  nor the equivalents elsewhere (DIAN firma electrónica, ARCA clave fiscal, certificado FNMT).
  Jarvis refuses to receive them in chat and never reads them from disk (`SEC-08`, `SEC-13`).
  Stamping goes through the PAC/SaaS that already holds the CSD.
- **Read-only by default** on every accounting, ERP and fiscal tool. Write scopes only on explicit
  request, behind `SEC-14`.
- **Irreversible list for this pack** (adds to `knowledge/security-checklist.md` §1, never removes):
  stamp/cancel CFDI or any electronic invoice (`IRR-05`), submit a declaration, file or sign a court
  document, send anything to a client, court or authority (`IRR-01`), delete or overwrite a client
  document (`IRR-04`), schedule meetings with third parties (`IRR-06`). All denied in cron (`SEC-15`).
- **Legal output is a draft.** Every generated escrito, contract or opinion carries a visible
  "Borrador — revisión profesional obligatoria" line. The model can invent citations: the skill
  asks for verification of every article/tesis/jurisprudencia before use.
- **Data sensitivity.** Client data is confidential and often includes government IDs and finances.
  Never put RFC, CURP, NIT, CUIT, DNI/NIE, bank accounts or card numbers into memory
  (`SEC-13` regexes). Redact before any embedding.
- **Which credential sees client data.** Claude Free/Pro/Max (including Claude Code on those
  accounts) follow the consumer terms: chats may be used for training if "Help improve Claude" is
  on, with retention up to five years; opted out, 30 days. API use falls under the Commercial Terms
  instead ([Anthropic](https://www.anthropic.com/news/updates-to-our-consumer-terms), fetched
  2026-10-06). So: on Pro/Max, the Architect has the person **turn that setting off** and limits the
  Jarvis to non-client tasks or anonymized material; for identifiable client work, use an API key
  (Commercial Terms) or a local model. Retention defaults may have changed — `stack-researcher`
  re-checks at install.
- **Data law.** As soon as Jarvis processes clients' personal data, the country rules apply
  (privacy notice naming the LLM/cloud vendors and the US transfer; Colombia's SIC circulars;
  GDPR in Spain). Generate the draft notice from `knowledge/countries/<cc>.md`, marked "revisar
  con abogado" (`SEC-32`).
- **No customer-facing bot in v1.** If later added, it must disclose it is an AI on first contact
  (mandatory in the EU under AI Act Art. 50; good practice everywhere).

## Interview extras

Ask only what changes the design (max 3):

1. "¿Eres más de litigio/contratos (abogado) o de contabilidad/impuestos (contador)? ¿Cuántos
   clientes llevas más o menos?" → picks the skill set and whether Graphiti/sqlite-vec is needed.
2. "¿Qué sistema usas para facturar y llevar la contabilidad: CONTPAQi, Alegra, Siigo, Facturapi,
   Excel…?" → tool rows; CONTPAQi forces a local Windows host (`CMP-20`).
3. "¿Tus clientes aceptarían que sus datos pasen por un servicio de IA en la nube (con contrato
   comercial), o prefieres que nada de clientes salga de tu compu?" → API key vs. `ollama-local`.

## Recommended default stack

| Budget | Runtime / host | Model | Channel | Memory | Notes |
|---|---|---|---|---|---|
| **Low** (already pays Claude Pro/Max) | `claude-code-local` on their own computer, Desktop scheduled tasks | Subscription, "Help improve Claude" **off** | Telegram (owner only) | Markdown, local | **Non-client and anonymized tasks only**: deadlines, templates, research, own calendar. Client documents only if anonymized |
| **Low, privacy-first** (≥ 32 GB Apple Silicon or ≥ 24 GB VRAM, per `questions/0-preflight.md`) | `ollama-local` under `hermes` or `openclaw` (at/above floor), local only | Local model from `models.json` | Jarvis Panel on loopback (via the harness), or Telegram with consent | Markdown + local sqlite-vec | ≤ 5 tools, one-step jobs (`CMP-25`); `num_ctx` set (`CMP-24`) |
| **Medium** (default for a practice with real client data) | Local host + supervisor: `claude-code-local` (or `claude-p-cron` for briefings) with an **Anthropic API key** and a provider spend cap. Needs 24/7 with no always-on box: `hermes` on Railway Tier A, only after the Gate C `sensitive-data-cloud` consent (`questions/3-confirmacion.md`) | `cheap` for triage/heartbeat, `main` for drafting, `max` only for long expediente analysis | Telegram + Gmail read-only | Markdown + local sqlite-vec | Commercial Terms instead of consumer; still local files. Railway only if the person needs 24/7 **and** accepts client data on a cloud volume — never with CONTPAQi |

## Sources

- Anthropic consumer terms update (training toggle, retention, scope): https://www.anthropic.com/news/updates-to-our-consumer-terms
- Railway cron (UTC, 5-minute minimum, must exit): https://docs.railway.com/reference/cron-jobs
- LISR art. 14, provisional payments by day 17 (secondary compendium): https://sdv.com.mx/compendio/ley-isr/articulo-14/
- Alegra MCP launch: https://www.prnewswire.com/mx/comunicados-de-prensa/alegra-revoluciona-la-gestion-contable-en-mexico-contadores-y-empresarios-ya-pueden-consultar-sus-finanzas-en-tiempo-real-usando-su-ia-favorita-302794164.html · https://developer.alegra.com/llms.txt
- Siigo community MCP: https://glama.ai/mcp/servers/jdlar1/siigo-mcp
- Facturapi community MCP and "drafts your accountant reviews": https://skillselion.com/mcp/tool/io.github.codespar/mcp-facturapi
- CONTPAQi SDK (no cloud API): https://feed.nuget.org/packages/ARSoftware.Contpaqi.Comercial.Sdk.Extras
- codespar LATAM MCP catalog (alpha caveat): https://github.com/codespar/mcp-dev-latam
- Google Workspace MCP servers (developer preview): https://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html
- Mexico LFPDPPP 2025: https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies
- Colombia SIC Circular 002/2024 (AI): https://normograma.mintic.gov.co/mintic/compilacion/docs/circular_superindustria_0002_2024.htm
- EU AI Act Art. 50 timing: https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html

`stack-researcher` re-checks these live at install time: Alegra MCP write scope and plan gating; how professional secrecy rules
treat LLM processing in each country; whether automated access to court portals breaks their terms;
fiscal due dates for regimes and countries other than MX monthly ISR provisional payments of
personas morales.
