# Profession: Student

> University and adult students, thesis writers and self-learners: a cheap Jarvis that plans the week, tracks deadlines, quizzes them and explains readings, acting as a tutor and never as a ghostwriter.

Last verified: 2026-10-06

Versions are not pinned here (see `knowledge/runtimes/*.md` and `knowledge/models.json`).

## Signals

- "Soy estudiante", "estoy en la uni / la facultad / la prepa", "estoy haciendo mi tesis / TFG / TFM"
- "Tareas", "exámenes", "parciales", "entregas", "el semestre / cuatrimestre"
- "Estoy aprendiendo inglés / a programar / para una certificación"
- "No me organizo", "se me pasan las fechas", "quiero estudiar mejor"
- "No tengo presupuesto", "algo gratis o casi gratis"

Teachers → `teacher`. Learning to code to work as a dev → `student` now, `developer` later.

## Age gate (ask first, before anything else in this pack)

Anthropic's consumer terms require users to be **at least 18** (or the local age of consent, whichever
is higher). For OpenAI, read the current minimum-age and parental-consent rules at
https://openai.com/policies/terms-of-use/ before offering an OpenAI runtime to a minor. If the person is under 18: **stop the build**, explain that an adult
(parent/guardian) must own the accounts, keys and spend cap, and continue only with that adult present.
Never collect a minor's personal data beyond first name and school level.

## Week-one jobs

1. "Cada mañana dime qué tengo que entregar esta semana y en qué me conviene trabajar hoy." →
   `study-plan` skill + morning job.
2. "Te paso el PDF de la lectura y me haces un resumen y 10 preguntas tipo examen." → `reading-digest`
   + `quiz-me` skills.
3. "Pregúntame cada noche 5 cosas de lo que vimos para que no se me olviden." → `quiz-me` with
   spaced repetition + evening job.
4. "Ayúdame con mi tesis: revisa si mi argumento tiene sentido y qué fuentes me faltan." →
   `thesis-coach` skill (feedback, not text to paste).
5. "Recuérdame dos días antes de cada entrega." → deadline heartbeat.

## Channels

| Use | Channel | Why |
|---|---|---|
| Student ↔ Jarvis | **Telegram** (default; local-only profiles: see § $0 privacy-first variant) | Free, no policy risk; PDFs work, voice notes need STT per runtime (`knowledge/capabilities/voice.md`) |
| Claude app user | Remote Control / Claude app (Pro) or `cowork` | If they already pay Pro and don't want a bot |
| WhatsApp | Only after the Gate C grey-zone disclosure (`knowledge/capabilities/whatsapp.md`); a Cloud API setup is more work than it's worth for this pack | Telegram is simpler and free |
| Group chats (class groups) | **Off** (SEC-02) | Classmates' messages are untrusted input and third-party data |

## Memory

- Markdown workspace only. `USER.md`: school, program, semester, courses, how they learn best,
  timezone. `memory/topics/courses/<course>.md`: syllabus dates, professor's rules (incl. AI policy),
  weak topics.
- `memory/topics/deadlines.md`: one line per due date.
- No vector or graph memory in v1. Add sqlite-vec locally only if they want to search across many
  readings (thesis literature) — `knowledge/capabilities/memory.md`.
- Don't store classmates' data, grades of others, or school login credentials (SEC-13).

## Tools / MCP

Tiers per `knowledge/capabilities/tools-mcp.md`. Read-only first (SEC-22). Keep the tool list short:
fewer tools = lower cost and less to break.

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| PDF / docs reading | built-in (Claude Code reads PDFs) or a pdf skill | read | Readings, slides, past exams |
| Web search / fetch | built-in or Brave/Tavily MCP (free tiers) | read | Results are untrusted [A]; always cite sources |
| Google Calendar / Drive (Workspace MCP) | T1 (developer preview) | read; calendar write for study blocks only if asked | **School-managed Google accounts** may block third-party apps by admin policy (if the connection fails with an admin error, that is the cause): use a personal account if blocked |
| Notion | T1 (OAuth) | read; write to one "Estudio" page if asked | Many students already keep notes here |
| Zotero (thesis) | T2 (community, e.g. `54yyyu/zotero-mcp`, `kujenga/zotero-mcp`) pinned | **read** | Several forks have write tools; pick a read-only one or disable writes |
| Google Classroom / Moodle / Canvas | T3 wrapper or none | read | No official MCP listed; check the platform's developer docs at install. v1: they paste or forward the assignment |

## Scheduled jobs

Local time; Railway cron is UTC (CDMX UTC−6, Bogotá UTC−5, Buenos Aires UTC−3, Madrid UTC+1/+2).
Use the `cheap` model slot for every job to keep the bill near zero. See
`knowledge/capabilities/scheduling.md`.

| Job | Cron (local) | Model slot | Output |
|---|---|---|---|
| Morning study plan (`morning-briefing` + `study-plan`) | `13 7 * * 1-6` | `cheap` | Today's classes, what's due, one 50-min focus block suggestion |
| Evening quiz (`quiz-me`) | `7 21 * * 0-4` | `cheap` | 5 questions from this week's topics; answers checked on reply |
| Deadline heartbeat | `17 18 * * *` | `cheap` | Anything due in ≤48 h. Silent otherwise |
| Sunday week plan (`weekly-review`) | `33 19 * * 0` | `main` | Next week's plan by course, based on deadlines and weak topics |

## Skills

From `templates/skills-base/`: `morning-briefing`, `remember`, `weekly-review`. Pack-specific:

| Skill id | One-line spec |
|---|---|
| `study-plan` | Turn deadlines + class schedule into today's plan with time blocks; never more than 3 priorities. |
| `reading-digest` | From a PDF/reading, produce a 10-line summary, key terms, and the 3 ideas most likely to be examined; cite page numbers. |
| `quiz-me` | Ask questions one at a time, grade the answer, explain mistakes, and schedule missed items for spaced repetition in `memory/topics/courses/`. |
| `explain-like-tutor` | Explain a concept step by step with a worked example, then check understanding with one question; never just hand over homework answers. |
| `thesis-coach` | Review structure, argument and citations; list missing sources and logical gaps; give feedback, not paragraphs to paste. |
| `citation-check` | Check that every claim in a draft has a source and the reference list matches the required style (APA/ISO 690…). |

## Guardrails

- **Academic integrity:** Jarvis is a tutor. It explains, quizzes and gives feedback; it does not write
  graded work for submission or take exams. Before helping on an assignment it checks the course's AI
  policy in `memory/topics/courses/<course>.md`; if unknown, it asks.
- **Irreversible (SEC-14):** submitting assignments or posting to school platforms (IRR-02), emailing
  professors or classmates (IRR-01), any purchase (IRR-03), deleting files (IRR-04).
- **Citations:** never invent references. Every source has a link or a DOI the student can open;
  unconfirmed ones are marked.
- **Cost:** spend cap set very low before the first call (SEC-27). Cheapest compliant slot by default.
- **Privacy:** no classmates' or teachers' personal data in memory; groups off.
- **Minors:** see § Age gate. If the person is under 18, an adult owns every account and approves the design.

## Interview extras

1. "¿Cuántos años tienes?" (only to confirm 18+; see Age gate) → continue or bring an adult.
2. "¿Tu escuela o tus profes tienen reglas sobre usar IA?" → seeds the integrity rule per course.
3. "¿Tienes Claude Pro o ChatGPT, o lo hacemos casi gratis?" → runtime and model slot.

## $0 privacy-first variant (`ollama-local` + `hermes`, no external channel)

When the student picks "nada sale de mi compu" with no budget (`decision-tree.md` Step 1):

- **Channel:** terminal + Jarvis Panel on loopback through Hermes (`knowledge/capabilities/web-ui.md`).
  No Telegram unless they accept it with logged consent.
- **Notifications without a push channel:** jobs use `--deliver local` (writes the result) plus a
  desktop notification. Linux: a systemd user timer runs a tiny script after each job that calls
  `notify-send "Jarvis" "<first line>"` on the newest file in `~/.hermes/cron/output/<job_id>/`;
  macOS: `osascript -e 'display notification …'`. The quiz "answers checked on reply" happens in the
  panel chat.
- **Missed jobs:** a PC that was off skips the run. The deadline check runs at boot as well (a
  systemd user unit `jarvis-deadlines-catchup.service` with `WantedBy=default.target` that triggers
  `hermes cron run <deadline job>`), and two or three times a day with "si ya avisaste hoy, responde
  [SILENT]" (`knowledge/capabilities/scheduling.md`).
- **PDFs:** the PDF folder is mounted read-only into the Hermes container (`-v ~/Documentos/Facultad:/opt/jarvis/lecturas:ro`).
  Text extraction with `pdftotext` (poppler) on the host or in the image, pinned by `stack-researcher`;
  `reading-digest` reads in chunks of ~20 pages so it fits a 64K context on a small model, then
  merges. No vector index in v1 (one PDF at a time is a file read).
- **Memory:** `memory/topics/courses/<materia>.md` and `memory/topics/deadlines.md` live in the
  writable `memory/` mount (`knowledge/runtimes/hermes.md` § Workspace mapping); Hermes' own
  `MEMORY.md` (2,200 chars) holds only the essentials.
- **Model:** the hardware class decides (`knowledge/models.json` → `hardware_classes`); on
  `HW-small` say once that quizzes and summaries will be slower and simpler than a cloud model's.

## Recommended default stack

| Budget | Stack |
|---|---|
| Already pays Claude Pro | `claude-code-local` + Telegram + Desktop scheduled tasks + markdown memory. $0 extra. Non-technical and only uses the Claude app → `cowork` (recommend and stop) |
| Already pays ChatGPT | `codex-openai` if terminal-friendly; otherwise `hermes` local with an `OPENAI_API_KEY` + spend cap (a ChatGPT plan is not reused inside Hermes; see `knowledge/auth-matrix.md`) |
| Low (`0`/`≤10`), no plan, **not** local-only (local-only → § $0 privacy-first variant, which always wins) | `hermes` local while the laptop is on, `OPENAI_API_KEY` with the `cheap` slot, Telegram, spend cap (archetype 13 in `knowledge/decision-tree.md`, ~$1–5/month) |
| `$0`, privacy-first, strong laptop | `ollama-local` under `hermes`, if `HW` allows (see `knowledge/runtimes/ollama-local.md`); quality is lower |
| No 24/7 needed | Never Railway for this pack by default: the laptop-on schedule is enough |

## Sources

- Profession → component map (student row): Jarvis Architect design synthesis built from the sources listed here. Cheapest compliant slot (model prices): https://developers.openai.com/api/docs/pricing · https://platform.claude.com/docs/en/about-claude/pricing · archetype 13 in `knowledge/decision-tree.md`.
- Anthropic consumer terms, minimum age 18: https://www.anthropic.com/legal/consumer-terms (fetched 2026-10-06)
- OpenAI terms of use (read the age rules here at install): https://openai.com/policies/terms-of-use/
- Zotero MCP community servers: https://glama.ai/mcp/servers/kujenga/zotero-mcp , https://www.getdrio.com/mcp/io-github-54yyyu-zotero-mcp (2026-10-06)
- Google Workspace MCP developer preview: https://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html
- Notion MCP (OAuth, `https://mcp.notion.com/mcp`): https://developers.notion.com/docs/get-started-with-mcp (fetched 2026-10-06)
- Railway cron jobs (UTC): https://docs.railway.com/reference/cron-jobs
