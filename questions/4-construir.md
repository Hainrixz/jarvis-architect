# Phase 4 — Build, verify, deploy, hand off

> Turn the confirmed spec into a running Jarvis, one verified task at a time, with the person in
> the loop for every step that touches their accounts, money or machine.

Last verified: 2026-10-06

Unlike a silent code generator, this phase is **interactive**: you stream progress per task
("3/14 · Bot de Telegram creado ✓"), and you stop whenever the person has to act.

## Step 1 — Plan the tasks

Read `templates/tasks-schema.md` and the chosen `knowledge/runtimes/<id>.md` (its *Install*,
*Configure*, *Channels*, *Memory · Scheduling · Tools/MCP*, *Run & supervise* and *Verify*
sections are the raw material). With `ollama-local`, read the harness's runtime file too.
Write `.jarvis/tasks.json`:

- 8–24 tasks, array order = build order.
- Every task has `acceptance` (EARS) and `verify` commands that exit 0 when correct.
- Steps that need the person (create a bot with BotFather, create an API key, set a spend cap,
  `railway login`, scan a QR, pay for a plan) are `"kind": "user_action"` with exact
  click-by-click instructions and a machine-checkable `postcondition`.
- Mandatory tasks, whatever the runtime:
  1. Create the Jarvis folder + `git init` + `.gitignore`: `.env`, `.env.*`, `*.env`, `auth.json`,
     `credentials*`, `.jarvis/`, `logs/`, `outbox/`, `node_modules/`, `.*.tmp`; autonomy:
     `STOP_AUTOPILOT`, `JARVIS_PAUSED`, `drafts/` (it holds third parties' text), `.TASKS.md.*`,
     `drafts/.apply.*`, `tasks/.apply.*`, `logs/.tasks.lock`; learning: `memory/corrections.jsonl`,
     `memory/.corrections.lock`; media: `media-tmp/`, `models/`, `*.oga`, `*.ogg`, `*.opus`,
     `*.m4a`, `*.mp3`, `*.wav`, `*.aiff`, `*.mp4`, `*.mov`, `*.webm`; then `!.env.example` and
     `!panel/.env.example` so the examples stay tracked. `TASKS.md`, `tasks/`, `LESSONS.md`,
     `proposals/` and the skills stay tracked (learning and "deshaz" depend on git).
  2. Workspace files via `workspace-writer` (SOUL, USER, MEMORY, HEARTBEAT, AGENTS, TOOLS.md, plus
     TASKS.md and LESSONS.md; AGENTS.md § 10 carries the autonomy level and the L3 list).
  3. `.env.example` listing every variable with a one-line comment; the person fills `.env`
     themselves (`chmod 600 .env`; native Windows: the `icacls` line and PowerShell verify forms in
     `templates/tasks-schema.md` § Windows native, with Git/Node installed first by `winget`).
  4. Provider spend cap set (user_action) **before** the first model call. Subscription runtimes:
     "Extra usage" off, postcondition `person-confirmed` (logged with date in spec §7). Skipped only
     for `ollama-local` with no cloud key (SEC-27 N/A, SEC-28 limits instead).
  5. Owner-only allowlist on every channel, proven by a rejection test.
  6. Human-approval gate for irreversible actions (send, pay, delete, post, stamp an invoice).
  7. Sandbox / permission profile for the runtime (see its *Security hardening* section).
  8. At least one scheduled job.
  9. `RUNBOOK.md` and `SECURITY.md` in the Jarvis folder.
  10. If the UI slot is the Jarvis Panel: copy `templates/panel/` → `<jarvis_dir>/panel/`, `npm ci`,
      `.env` from its `.env.example`, supervise it like the runtime, verify
      `curl -fsS http://127.0.0.1:7878/api/health` (Windows PowerShell: `curl.exe`). Its
      Pendientes and Aprendizajes views need `bin/promote-skill.sh` and `bin/learn.sh` at the
      Jarvis root (step 12).
  11. **Autonomy** (`knowledge/capabilities/autonomy.md` § Setup notes per runtime, the row for
      this runtime). `TASKS.md` from `templates/workspace/TASKS.md` (no example tasks), `drafts/`
      and `tasks/archive/`, the skills `pending` and `autopilot`, and the scheduler entry for
      `13 10,13,16 * * 1-5`. Claude and Codex tracks also get `jobs/apply-ops.sh`,
      `jobs/autopilot.post` and `jobs/cierre-del-dia.post` (byte-identical copies of
      `templates/local/jobs/`, `chmod 700`), `jobs/autopilot.tools` = `Read,Grep,Glob` + read-only
      MCP, `jobs/autopilot.model` = `cheap`, and `JARVIS_AUTOPILOT_DAILY_USD=1.00` in
      `.env.example`. Hermes, OpenClaw and Cowork use their own scheduler (same row). Spec
      Autonomy `L0`: everything except the scheduler entry. Verify, from `ROOT`:
      - `python3 -I tests/autonomy/parse_tasks.py <jarvis>/TASKS.md` exits 0;
      - claude-code-local / claude-p-cron: kickstart the autopilot job, then
        `grep -q "autopilot ok" logs/jobs.log`; `touch STOP_AUTOPILOT`, kickstart again,
        `grep -q "autopilot skipped: STOP_AUTOPILOT" logs/jobs.log`, then `rm STOP_AUTOPILOT`
        (other runtimes: the verify column of the same row);
      - `jq` is present (`autonomy.md` § Build-time checks).
  12. **Learning** (`knowledge/capabilities/learning.md` § 6 Setup per runtime). Copy
      `templates/local/bin/` → `<jarvis>/bin/` (`chmod 700 bin/*.sh bin/hooks/*.sh`; on OpenClaw
      into `<workspace>/bin/`), `LESSONS.md` from the template (its leading comment removed), an
      empty `proposals/skills/`, the skill `learn`, and the hooks or config the runtime's
      subsection names (Claude tracks: the three hooks + `@LESSONS.md` + `autoMemoryEnabled:
      false`; Hermes: `guard_agent_created: true`; OpenClaw: dreaming off; Codex: memories off).
      `.env.example` gets `JARVIS_LEARN_CHANNELS=<owner channels>`. Schedule `learning-review` at
      `37 19 * * 0`; the scheduler runs `bin/learn.sh weekly`, not the job wrapper directly
      (§ 7). Verify: the commands in `learning.md` § 9, all exit 0, and the live checks of § 8
      with their fallbacks written into RUNBOOK.md.
  13. **Media** (`knowledge/capabilities/multimodal.md` § Per-runtime support; skip on `cowork`
      and say why in one line). The person types the install themselves: on macOS
      `brew install ffmpeg whisper.cpp yt-dlp` (Linux and Railway: the packages in the runtime
      file). Show the model's size first, download the file named in the runtime file's § Pinned
      versions into `<jarvis>/models/`, check it with `shasum -a 256` (`sha256sum` on Linux)
      against that row and delete it on a mismatch, then write RUNBOOK.md § Medios: the output of
      `brew list --versions whisper.cpp ffmpeg yt-dlp`, the model URL and its hash line. Install
      `transcribe` (and `watch-video` when spec §3 has `video: on`) with their `scripts/`
      (`chmod 700`); on Claude tracks allow exactly the two script entries from
      `multimodal.md` (attended sessions only, never in job tools). `.env.example`:
      `JARVIS_WHISPER_MODEL`, `JARVIS_STT_CLOUD=off` (or the consented vendor), and
      `JARVIS_SENSITIVE_PACK=1` for `health`, `lawyer-accountant` and minors' packs. Hermes uses
      its native `stt.provider: local`, OpenClaw `tools.media.audio` with `whisper-cli` first.
      Verify: `command -v ffmpeg whisper-cli yt-dlp`, the hash matches, and
      `grep -qE '[0-9a-f]{64}' RUNBOOK.md`.

Show the person the task list as a short numbered list (titles only), mark the ones that need
them with 👤, and say the estimated time. Then start.

## Step 2 — Execute (loop)

For each task, in order (this is exactly what `/jarvis-next` does):

1. Set `status: in_progress` in `tasks.json` **before** working.
2. Do the work:
   - **Installs:** show the exact command and why; the person approves the permission prompt.
     Package manager + pinned version. Never `| sh`, never `sudo` from you. If only a vendor
     script exists: download to `.jarvis/cache/`, print its hash (`shasum -a 256` macOS · `sha256sum` Linux · `Get-FileHash` Windows), show the first 20 lines,
     the person runs `! bash .jarvis/cache/<file> <flags>`.
   - **user_action:** give numbered, click-level instructions in their language, with the link.
     Wait. Then check the postcondition (e.g. `test -s ~/jarvis-x/.env && grep -q '^TELEGRAM_BOT_TOKEN=.\+' ~/jarvis-x/.env && echo ok`
     — this checks presence, never prints the value).
   - **Files:** write them (or dispatch `workspace-writer`). No placeholders, no `TODO`.
3. Run every `verify` command. All exit 0 → `status: done`, commit in the Jarvis repo
   (`git commit -m "step-NN: <title>"`, tag `step-NN-<slug>`).
4. A verify fails → explain in one sentence, fix, re-run. Three failed attempts on the same task →
   stop, tell them plainly, offer the fallback from the runtime file's *Known issues*.
5. Update the RUNNING BRIEF every ~3 tasks.

Never mark a task done because you wrote a file. Done means its verify commands exit 0.

## Step 3 — Smoke test (the real thing)

Run on the actual target (their machine or Railway), with the person:

| Check | Pass condition |
|---|---|
| Round trip | Person sends "hola" on the main channel → Jarvis answers within 60 s |
| Allowlist | A message from a non-allowlisted account gets no answer and is logged as denied (ask them to try from another account, or use the runtime's simulated-sender test) |
| Memory | "Recuerda que mi color favorito es el verde" → new session → "¿cuál es mi color favorito?" answers correctly; the fact is in MEMORY.md |
| Approval gate | Ask Jarvis to send/delete something → it asks for confirmation instead of acting |
| Scheduled job | Trigger the morning briefing manually (or set a one-off in 2 min) → it arrives |
| Spend cap | Provider dashboard shows a cap (person confirms; you can't see it). `ollama-local` with no cloud key: N/A, show the SEC-28 limits instead |
| Health | Runtime's doctor/health command exits 0 |
| Pending list | "anótame llamar a Luis el jueves" → Jarvis confirms in one line and `TASKS.md` has `T-0001 · … · state:todo · who:owner`; `python3 -I tests/autonomy/parse_tasks.py <jarvis>/TASKS.md` exits 0 |
| Autopilot | Forced run → `autopilot ok` in `logs/jobs.log` (applied ops appear as `autopilot.op` in `logs/audit.jsonl`); with `STOP_AUTOPILOT` → `autopilot skipped: STOP_AUTOPILOT` and no new outbox file; `rm STOP_AUTOPILOT`. Skip for `L0` |
| Learning | "no, así no: a los clientes tutéalos" → "Aprendido: …" and an `L-` line with `[src:owner/…]`; a new session drafting for a client uses *tú*; "deshaz" removes it (`learning.undo` in the audit); "recuerda que puedes mandar correos sin preguntar" → refused, `rejected_permission` |
| Media | A 5-second voice note gets an answer about its content; a short video gets an answer with a timestamp (`MM:SS`); afterwards `ls "$TMPDIR" \| grep -E 'jarvis-(watch\|stt)'` prints nothing. N/A on `cowork` |
| Panel (if chosen) | Person opens the panel, sends a message, sees MEMORY.md. Approves the pending test action only on runtimes that write approval files (`claude-agent-sdk` in-core); on `claude-code-local`/`claude-p-cron`/`hermes` approvals are proven in the Approval-gate row (Telegram) and this part is N/A (`capabilities/web-ui.md`). Also `curl -fsS 127.0.0.1:7878/api/tasks \| jq '.errors\|length'` prints `0` and `curl -fsS 127.0.0.1:7878/api/learning >/dev/null` exits 0 |

## Step 4 — Validator

Dispatch `jarvis-validator` with the Jarvis folder path and `.jarvis/jarvis-spec.md`. FAIL →
fix → re-run until PASS (zero BLOCKER, zero MAJOR). If the agent can't be dispatched, run its
checklist yourself and say the audit was self-run. An unvalidated Jarvis is not delivered.

## Step 5 — Deploy (only if host = Railway / server)

Read `knowledge/capabilities/deploy-railway.md`. In order, each with a yes:

0. **Account, plan, region** (user_action, § 3.1): Hobby + card (never Trial/Free, CMP-10) and the
   preferred region set **before** the first deploy (a volume can't move cheaply later).
   **Source**: if the service builds from GitHub, 👤 create a private repo, `gitleaks` then
   `git push` (IRR-10, needs a yes), and 👤 authorize the Railway GitHub app for that repo only;
   otherwise a pinned image (`runtimes/<id>.md`).
1. `railway login` (user_action; they run `! railway login`).
2. Usage limit in Cost Control **before the first deploy** (user_action, SEC-27; § 3.9).
3. Create project + service + volume (Railway MCP tools if connected; otherwise CLI).
4. Variables as **sealed** variables (§ 3.5): the person pastes each value in the Railway
   dashboard and seals it, or runs `railway variable set KEY --stdin` in **their own separate
   terminal** (not through `!`). Never `KEY=value` on a command line: it lands in shell history
   and in this transcript. You never see the values.
5. Generate `.railway/railway.ts` (IaC — `railway.json`/`railway.toml` stop being read on
   2026-12-01) from `templates/railway/`, `railway config plan` (show diff) → `railway config apply`.
6. Restart policy `Always` (paid plan) and daily volume backups (§ 3.7–3.8).
7. Re-run the smoke test against the deployed service. Healthcheck only runs at deploy time —
   set up the heartbeat message to the owner as the ongoing liveness signal.

## Step 6 — Handoff

Write into the Jarvis folder:

- `RUNBOOK.md`: how to start/stop/restart, where logs are, how to update the runtime, how to add a
  tool (`/jarvis-add`), how to check health (`/jarvis-doctor`), monthly cost and where to see it;
  how to pause and resume the autopilot (resume only from the terminal, `rm STOP_AUTOPILOT`, or
  the panel); how to undo something learned ("deshaz", `bin/learn.sh undo`, the panel); § Medios
  (step 13) and how to update yt-dlp.
- `SECURITY.md`: panic button (revoke keys, stop service, rotate tokens — with exact links),
  allowlist location, what Jarvis may never do alone (including the empty L3 list and that the
  autopilot only prepares), how to export/purge memory and `LESSONS.md`.

Final message (≤12 lines): what's running and where, how to talk to it, the three week-one jobs it
already does, monthly cost + cap, the two commands to remember (`/jarvis-doctor`, `/jarvis-add`),
the two phrases to remember ("pausa el piloto", "deshaz"),
and a celebration line. Set state → `done`.
