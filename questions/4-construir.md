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

- 8–20 tasks, array order = build order.
- Every task has `acceptance` (EARS) and `verify` commands that exit 0 when correct.
- Steps that need the person (create a bot with BotFather, create an API key, set a spend cap,
  `railway login`, scan a QR, pay for a plan) are `"kind": "user_action"` with exact
  click-by-click instructions and a machine-checkable `postcondition`.
- Mandatory tasks, whatever the runtime:
  1. Create the Jarvis folder + `git init` + `.gitignore` (secrets, `.env*`, state, logs).
  2. Workspace files via `workspace-writer` (SOUL, USER, MEMORY, HEARTBEAT, AGENTS, TOOLS.md).
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
      `curl -fsS http://127.0.0.1:7878/api/health` (Windows PowerShell: `curl.exe`).

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
| Panel (if chosen) | Person opens the panel, sends a message, sees MEMORY.md. Approves the pending test action only on runtimes that write approval files (`claude-agent-sdk` in-core); on `claude-code-local`/`claude-p-cron`/`hermes` approvals are proven in the Approval-gate row (Telegram) and this part is N/A (`capabilities/web-ui.md`) |

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
  tool (`/jarvis-add`), how to check health (`/jarvis-doctor`), monthly cost and where to see it.
- `SECURITY.md`: panic button (revoke keys, stop service, rotate tokens — with exact links),
  allowlist location, what Jarvis may never do alone, how to export/purge memory.

Final message (≤12 lines): what's running and where, how to talk to it, the three week-one jobs it
already does, monthly cost + cap, the two commands to remember (`/jarvis-doctor`, `/jarvis-add`),
and a celebration line. Set state → `done`.
