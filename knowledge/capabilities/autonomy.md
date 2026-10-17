# Capability: Autonomy

> How a Jarvis keeps its own pending list (`TASKS.md`), knows what comes next, and moves work forward alone three times a weekday ("piloto con permiso"): levels L0–L3, the one-line task grammar, the autopilot algorithm, the deterministic writer `apply-ops.sh`, per-runtime wiring, the kill switch, and why the autopilot never executes anything irreversible.

Last verified: 2026-10-06

No versions live here. Scheduler details and minimum versions: `knowledge/capabilities/scheduling.md`
and `knowledge/runtimes/<id>.md`. Model slot for the autopilot: `cheap` in `knowledge/models.json`.
Costs: `knowledge/capabilities/costs.md`. Security IDs: `knowledge/security-checklist.md`
(SEC-14, SEC-15, SEC-34, SEC-35). Known-bad combinations: `knowledge/compatibility.md` (CMP-41).

## Decision rule

Every Jarvis gets `TASKS.md`, the `pending` skill and the task sections of the briefing. The
autopilot job is on by default. The Architect asks nothing about it beyond the single combined
defaults question in `questions/2-ramas.md`.

| Situation (spec §3 Autonomy) | Level default | Autopilot job | L3 list (AGENTS.md § 10) |
|---|---|---|---|
| **Default** | `L1` for `who:jarvis` tasks | `13 10,13,16 * * 1-5`, `cheap`, 12 turns, 0.50 USD/run, `JARVIS_AUTOPILOT_DAILY_USD=1.00` | Empty |
| Owner says "solo recuérdame", "no hagas nada solo" | `L0` | Off (no job). `TASKS.md`, `pending`, briefing and heartbeat still run | Empty |
| Sensitive pack (`health`, `lawyer-accountant`, minors in `teacher`) | `L1` | On, read tools limited to the pack's local sources; drafts stay local | Empty, and the Architect does not offer L3 |
| `cowork` | `L1` | One local-folder scheduled task on weekdays (Cowork has no cron) | Empty |
| `ollama-local`, small model tier | `L1` | On, **one** task per run (skill variable `max_tasks` = 1, CMP-25) | Empty |
| Owner asks for a specific L3 action | `L1` + that one type | On | Only types tagged **reversible** below, written by the owner in AGENTS.md § 10 from the terminal, consent in spec §7 |

Never: a Cloud Routine as the autopilot (CMP-41), `/loop` or `CronCreate` as the autopilot (they
are session-scoped and expire after 7 days, `scheduling.md` rule 1), or a job that executes an
IRR action (SEC-15).

## Levels

| Level | What Jarvis does alone | What needs the owner |
|---|---|---|
| **L0** | Remembers and reminds (heartbeat, briefing) | Everything |
| **L1** (default) | Prepares: reads, researches, summarizes, writes drafts into `drafts/T-NNNN.md` | Sending or using the draft |
| **L2** | Writes the **exact** preview of an irreversible action (recipient, full text, amount, path, time) and sets `state:needs_ok` | The action itself: "sí, ejecuta T-NNNN" in a live session, then the normal AGENTS.md § 3 flow (5-minute, one-use yes; SEC-14, SEC-16) |
| **L3** | One reversible action of a type listed in AGENTS.md § 10, when the job has that tool | Adding the type to § 10 (owner, terminal only, IRR-07) |

L3 types the Architect may write into § 10 (all on the owner's own data, all undoable):

| Type | Reversible because | Tool requirement |
|---|---|---|
| `calendar.block.private` | An event on the owner's own calendar **with no guests**; delete restores the prior state | A calendar tool that cannot add attendees (or a create tool with attendees stripped by the core) |
| `email.label` | Adding a label to a message in the owner's mailbox; removing it restores | A label-only tool, never send/archive/delete |
| `task.reschedule` | Moving a task's `due:` inside `TASKS.md` | None beyond the ledger: `apply-ops.sh` accepts `set due` only while this type is listed in AGENTS.md § 10 |

Anything that sends, publishes, pays, deletes, invites or stamps is IRR (`security-checklist.md`
§ 1) and can never be L3. The validator grades a non-reversible type in § 10 as BLOCKER (sweep 14).

## TASKS.md

Template: `templates/workspace/TASKS.md`. One task per line; details in `tasks/T-NNNN.md`, drafts
in `drafts/T-NNNN.md`, finished tasks of past months in `tasks/archive/YYYY-MM.md`. Sections, in
this order: `## Hoy`, `## Próximos`, `## Esperando a otros`, `## Bandeja (capturado, sin confirmar)`,
`## Hecho`.

### Task line grammar (one regex everywhere)

```
- [ ] T-0042 · <title ≤80> · state:<inbox|todo|doing|waiting|needs_ok|blocked|done|dropped> · who:<jarvis|owner|other> · lvl:<L0|L1|L2|L3> [· due:YYYY-MM-DD[THH:MM]] [· next:YYYY-MM-DD] [· prio:1-3] [· src:<owner/<canal>|email:sent|email:untrusted|calendar|meeting|media|agent>/<YYYY-MM-DD>] [· tries:N] [· dep:T-NNNN[,T-NNNN]] [· conf:0-1]
```

- Separator: ` · ` (U+00B7 with one space each side). The title never contains `·` and has no
  leading or trailing space. Titles the autopilot adds also never contain `<!--`, `-->` or `{{`
  `}}` (a comment marker would hide the lines after it; braces would trip validator sweep 10).
- `[x]` exactly when `state` is `done` or `dropped`.
- Optional fields: each at most once, any order when written by hand; `apply-ops.sh` writes them in
  the order above.
- Lines inside `<!-- … -->` are ignored, so the grammar comment in the template is safe.
- Ids are unique across `TASKS.md` and `tasks/archive/`. New id = highest seen + 1.

Three implementations parse it and must agree: `tests/autonomy/parse_tasks.py` (the validator and
CI), `templates/local/jobs/apply-ops.sh` (jq) and the panel's `store.js` (`listTasks`). The panel
keeps unparseable lines as raw text and never rewrites them.

### State rules

- Only `src:owner/*` items (said by the owner on an allowlisted channel) go straight to `todo`.
  Everything else starts in `inbox`, the same quarantine as `memory/inbox.md` (SEC-13), and moves
  to `todo` only when the owner confirms it ("¿Agrego estos?" in the briefing, or the panel).
- Relative dates ("mañana", "el jueves") resolve against the message timestamp and the time zone
  in USER.md.
- Commitments the owner makes in chat ("le mando la cotización el jueves") are captured by the
  `pending` skill with `src:owner/<canal>` and announced in the same reply, so the owner can undo.
- `tries` reaches 3 → `blocked`. `blocked` and `needs_ok` tasks move only through the owner
  (`apply-ops.sh` lets the autopilot add a note to them, nothing else).

## The autopilot

Skill: `templates/skills-base/autopilot/SKILL.md` (the job prompt on Claude tracks; attached to the
cron job on Hermes and OpenClaw). The design follows the long-running-harness pattern of keeping
progress in a file the next run reads first and working one item at a time
([Anthropic, Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)).

```
0. Stop silently if STOP, STOP_AUTOPILOT or JARVIS_PAUSED exists; quiet hours (USER.md); or today's
   autopilot cost (sum of cost_est in logs/audit.tsv) ≥ JARVIS_AUTOPILOT_DAILY_USD (1.00).
   On the run-job.sh tracks the wrapper checks the files and the cap BEFORE calling the model.
1. Read TASKS.md, AGENTS.md § 10, memory/heartbeat-state.md, LESSONS.md (if present).
2. Candidates: state ∈ {todo, doing, waiting with next ≤ today}, who ∈ {jarvis, other},
   deps done, tries < 3.
3. Rank: overdue > due today > prio > oldest. Take at most 3 (1 on small local models).
   Skills on probation (a `.probation` marker, learning.md § Probation) are not followed.
4. Per level: L1 → draft (done if complete, doing + note if not);
   L2 → exact preview in drafts/ + state needs_ok;
   L3 → only if listed in § 10, reversible, and the job has the tool; otherwise as L2;
   waiting → read-only check for a reply; if none, next +2 business days and a new L2 nudge task
   (enters the Bandeja); failure → tries + 1, at 3 → blocked.
5. Output one ```json {"ops":[…],"drafts":[{"id","body"}]}``` block, then ≤ 6 lines for the owner,
   or only the silent token if nothing changed.
```

### `apply-ops.sh` rules

Canonical copy: `templates/local/jobs/apply-ops.sh` (bash 3.2 + jq + awk, no network, no model).
The post hook `templates/local/jobs/autopilot.post` extracts the single ops block from the job's
output, pipes it in, and hands the rest of the text to the wrapper for delivery. Exit codes: `0`
applied, `2` usage, `3` rejected, `4` lock or concurrent edit, `5` TASKS.md does not parse.

Everything is validated first; one bad op rejects the whole block and nothing is written. Writes
then go temp file → rename in the same folder, under the `logs/.tasks.lock` lock, and only if
`TASKS.md` did not change while the block was being checked.

| Allowed | Rule |
|---|---|
| `set state` | To `doing`, `waiting`, `needs_ok` (only L2/L3 **with** a draft), `blocked`, `done` (only L1 **with** a draft) |
| `set tries` | Exactly +1, at most 3; reaching 3 forces `blocked` |
| `set next` | A date, today or later |
| `set note` | One line, ≤ 300 characters, appended to `tasks/T-NNNN.md` |
| `set due` | Only while `task.reschedule` is in AGENTS.md § 10 (read by the script, never written); today or later |
| `set lvl` | Down only |
| `set who` | To `owner` or `other` only |
| `add` | `lvl` ≤ L2, at most 5 per run, always `state:inbox`, `src` defaults to `agent/<today>` |
| drafts | Only `drafts/T-NNNN.md` for an existing, open, non-owner, non-inbox task that is not `needs_ok` or `blocked`, ≤ 20,000 characters |

Ownership, quarantine and closed checks use each task as it was read, so the order of ops inside
a block never changes the outcome (a note after `set who owner` is accepted).

| Rejected (reason in the audit) | Why |
|---|---|
| `lvl_raise`, `add_lvl_above_L2` | No self-promotion (SEC-34) |
| `who_owner_to_jarvis`, `owner_task`, `who_to_jarvis` | The owner's tasks are the owner's |
| `unknown_id` (archived ids too), `bad_id` | No writes to tasks that don't exist |
| `bad_path`, symlinked `drafts/`/`tasks/`/`TASKS.md`/`logs/`/`logs/audit.jsonl` | No path traversal, nothing lands in `approvals/` or outside the three write paths |
| `inbox_quarantine`, `state_not_allowed`, `closed_task` | The autopilot can't confirm its own captures or reopen work |
| `awaiting_owner`, `blocked_task` | A `needs_ok` preview the owner may be reading, or a task blocked after 3 tries, is the owner's to move |
| `due_not_allowed`, `due_in_past`, `bad_date` | `due` belongs to the owner unless `task.reschedule` is listed |
| `bad_title` | Over 80 characters, `·`, comment markers or `{{`/`}}` |
| `needs_ok_without_preview`, `done_requires_L1`, `done_without_draft` | An L2 action is never "done" without the owner |
| `add_src_owner` | The autopilot can't claim the owner said something |
| `too_many_tasks_per_run` (> 3), `too_many_adds` (> 5), `too_many_ops` (> 30) | Caps (SEC-35) |
| `unknown_top_level_key`, `unknown_op`, `field_not_allowed`, `bad_json` | Anything not in this table |

Every applied op is one `autopilot.op` line in `logs/audit.jsonl` (`actor`, `op`, `target`,
`field`, `from`, `to`); every rejection is an `autopilot.reject` line with its `reason`. Draft
bodies and note text are never logged, only their length (SEC-18).

Tests: `bash tests/autonomy/apply-ops.test.sh` runs every fixture in `tests/autonomy/fixtures/`
(accepted, rejected with the file byte-identical, symlink into `approvals/`, held lock, a
concurrent edit of `TASKS.md` during the check, parse error, `needs_ok`/`blocked` tasks,
`task.reschedule` on and off) and the real `run-job.sh` extracted from `scheduling.md` with a fake `claude` (STOP_AUTOPILOT
and the daily cap skip the model call; a good block is applied and stripped from the message; a
bad block sends the AVISO). `python3 -I tests/autonomy/parse_tasks.py --template templates/workspace/TASKS.md`
checks the template.

## Per runtime

| Runtime | Autopilot job | How TASKS.md is written | Kill switch |
|---|---|---|---|
| `claude-code-local` / `claude-p-cron` | launchd / systemd → `jobs/run-job.sh autopilot`; tools `Read,Grep,Glob` + read-only MCP (`scheduling.md` § Autopilot on this wrapper) | `jobs/autopilot.post` → `jobs/apply-ops.sh`. Attended sessions use the `pending` skill with Edit | `STOP_AUTOPILOT` (checked by the wrapper before the model) |
| `claude-code-server` | supercronic line `13 10,13,16 * * 1-5 /app/bin/jarvis-job autopilot`, `TZ` set | `bin/jarvis-job` gains the same STOP_AUTOPILOT check, daily cap and `.post` call (`runtimes/claude-code-server.md` § Autonomy) | Same file on the volume |
| `claude-agent-sdk` | In-process cron job in the core (`protect: true`, owner's timezone) | In-process tool `ledger_update` (zod schema = the ops JSON) whose handler runs `jobs/apply-ops.sh` with the JSON on stdin, so one rule set serves every runtime. `canUseTool` denies every other write for `kind: "job"` | Same file, plus a flag in the core |
| `hermes` | `hermes cron create "13 10,13,16 * * 1-5" "<prompt>" --skill autopilot --deliver "telegram:<owner_id>"` | Hermes file tools on the workspace `TASKS.md` (not Hermes's own MEMORY.md), mode (C) of the skill. `approvals.cron_mode: deny`, read-only MCP only | `hermes cron pause <job>` + the file |
| `openclaw` | `openclaw automations add --name autopilot --cron "13 10,13,16 * * 1-5" --tz <tz> --session isolated --message "<prompt>" --announce --channel telegram --to <owner_id>`, cheap `--model` | Agent file tools, mode (C). The heartbeat stays the sensor (`NO_REPLY`, `activeHours`) | `openclaw automations disable <jobId>` + the file |
| `codex-openai` | launchd / systemd → `codex exec --sandbox read-only` with the skill as prompt | Output wrapped as `{"result": …}` → `jobs/autopilot.post` → `apply-ops.sh` | The file |
| `ollama-local` | Whatever the harness on top runs (Hermes cron or OpenClaw automations), one task per run, strict JSON | As that harness | As that harness |
| `cowork` | Scheduled task "Piloto", **local folder** `~/Jarvis` (remote tasks can't read local files, `runtimes/cowork.md`), weekdays, approval mode that asks | Cowork file edits, mode (C) | Toggle the task off + the file |

Session commands such as `/loop` serve only live sessions. Cloud Routines are never the autopilot:
"there is no permission-mode picker" and they call connectors "all without stopping for
approval" ([routines](https://code.claude.com/docs/en/routines); CMP-41).

## Setup notes per runtime

What the BUILD phase writes into `tasks.json` (`questions/4-construir.md` step 11):

| Runtime | Task | Verify (exits 0 when healthy) |
|---|---|---|
| all | `TASKS.md` from the template; `drafts/`, `tasks/archive/` created; `pending`, `autopilot` skills installed | `python3 -I tests/autonomy/parse_tasks.py TASKS.md` from the Architect repo, pointed at the Jarvis folder |
| `claude-code-local` / `claude-p-cron` | Files in `scheduling.md` § Autopilot on this wrapper; LaunchAgent `com.jarvis.autopilot` or systemd timer | `launchctl kickstart -k gui/$(id -u)/com.jarvis.autopilot && sleep 90 && grep -q "autopilot ok" logs/jobs.log`; then `touch STOP_AUTOPILOT`, kickstart, `grep -q "autopilot skipped: STOP_AUTOPILOT" logs/jobs.log`, `rm STOP_AUTOPILOT` |
| `claude-code-server` | supercronic line + `bin/jarvis-job` changes | `railway logs` shows `autopilot ok` after a forced run; with `STOP_AUTOPILOT` on the volume, `autopilot skipped` |
| `claude-agent-sdk` | Cron job + `ledger_update` tool calling `apply-ops.sh` | Unit test: an ops block with `lvl` raised returns exit 3 from the tool and leaves `TASKS.md` unchanged |
| `hermes` | `hermes cron create … --skill autopilot`, model set with `hermes cron edit <id> --model <cheap>` | `hermes cron list` shows it; `hermes cron run <id>` delivers or stays `[SILENT]` |
| `openclaw` | `openclaw automations add …` | `openclaw automations list` shows it; `openclaw automations run <jobId>` |
| `cowork` | user_action: create the "Piloto" task on the Scheduled page with the skill text as prompt and `~/Jarvis` as folder | The person sees one manual run result |

## Security

- **SEC-34 Read/draft profile, no self-promotion.** The autopilot reads untrusted content [A] and
  private data [B], so it gets no [C]: its only writes are workspace files and a message to the
  owner ([Willison on the Agents Rule of Two](https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/),
  SEC-11). Job tools are `Read,Grep,Glob` + read-only MCP (`run-job.sh` refuses Bash/Edit/Write).
  `apply-ops.sh` rejects an upward `lvl`, `who:owner→jarvis` and any path outside `drafts/` and
  `tasks/`. The L3 list lives only in AGENTS.md § 10, holds only reversible types on the owner's
  data, is empty by default, and Jarvis can never edit it (IRR-07). Enabling an L3 type gives the
  autopilot one narrow [C] on the owner's own data; that is why it takes a terminal edit and a
  spec §7 consent.
- **SEC-35 Caps and the off switch.** Per run: `--max-turns 12`, `--max-budget-usd 0.50`, at most
  3 tasks and 5 new tasks. Per day: `JARVIS_AUTOPILOT_DAILY_USD`. Per task: 3 tries. The same tool
  with the same arguments 3 times ends the run (AGENTS.md § 7). `STOP_AUTOPILOT` is proven with a
  forced run at build time. Pausing works from chat ("pausa el piloto"), because it removes power;
  **resuming never does**: only the terminal (`rm STOP_AUTOPILOT`) or the panel with its session
  and an explicit confirm.
- **Irreversible actions stay attended (SEC-14, SEC-15).** The autopilot never writes
  `approvals/pending` (`web-ui.md` § Approvals, step 4). L2 work ends at `needs_ok` with an exact
  preview; the action runs only after "sí, ejecuta T-NNNN" in a live session.
- **Quarantine (SEC-13).** Tasks from email, calendar, meetings, media or the agent itself start in
  the Bandeja and need the owner's confirmation. Instructions inside content are never turned into
  tasks (AGENTS.md § 2).
- **Audit (SEC-29).** `autopilot.op` / `autopilot.reject` lines in `logs/audit.jsonl`; the weekly
  review reports applied and rejected ops and the week's autopilot cost.
- **Direct-edit runtimes** (Hermes, OpenClaw, Cowork) rely on the skill text for the same rules.
  The weekly review lists every `lvl:L3` task (an alert when its type is not in § 10) and every
  level or owner change in the audit, and `TASKS.md` is git-tracked, so a drift is visible within
  a week and undoable.

## Build-time checks

Each one is an action at install time with a fallback, run by the build or `stack-researcher`:

- **Hermes skill attach:** the cron docs show `--skill <name>` (repeatable) on
  `hermes cron create` ([Hermes cron](https://hermes-agent.nousresearch.com/docs/user-guide/features/cron)).
  If the pinned Hermes rejects the flag, put "Usa la skill autopilot" at the start of the prompt.
- **Hermes agent-made jobs:** if the pinned Hermes has a config key that stops the agent from
  scheduling its own cron jobs (cron docs), set it off; otherwise the weekly review lists
  `hermes cron list` so an extra job is seen.
- **OpenClaw automation tool policy:** take the keys that deny send/exec in isolated automation
  sessions from `runtimes/openclaw.md` § Security hardening and prove them with a forced run whose
  prompt asks for a send: it must be refused ([managing jobs](https://docs.openclaw.ai/automation/cron-jobs/managing-jobs)).
- **`jq` present:** `command -v jq && echo '"a"' | jq -e 'test("a")'` (the script needs jq's regex
  support). Recent macOS releases ship `/usr/bin/jq`; if the check fails, `brew install jq`; on Linux use the distro package, and in the
  Railway image add it to the Dockerfile. Without it `apply-ops.sh` exits 2 and the wrapper sends
  the AVISO.
- **Time zone:** the first forced run must land at the expected local minute (`scheduling.md`
  § Timezones).

## Sources

- Long-running agent harness pattern (progress file read first, one item at a time): https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents (fetched 2026-10-06)
- Agents Rule of Two [A]/[B]/[C]: https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/ (fetched 2026-10-06)
- Hermes cron (`--skill`, `pause`/`resume`, `[SILENT]`, `edit --model`): https://hermes-agent.nousresearch.com/docs/user-guide/features/cron (fetched 2026-10-06)
- OpenClaw automations (`add`/`create`, `--session isolated`, `--tz`, `disable`/`enable`, `--model`): https://docs.openclaw.ai/automation/cron-jobs/managing-jobs (fetched 2026-10-06)
- OpenClaw heartbeat (`NO_REPLY`, `activeHours`): https://docs.openclaw.ai/gateway/heartbeat
- Claude Code session-scoped scheduling (`/loop`, 7-day expiry): https://code.claude.com/docs/en/scheduled-tasks
- Claude Code Routines (no permission picker, connectors without approval): https://code.claude.com/docs/en/routines
- `claude -p` flags used by the job: https://code.claude.com/docs/en/cli-reference
- Agent SDK in-process cron (croner `protect`): https://croner.56k.guru/usage/configuration/
- Wrapper, post hook and job pack: `knowledge/capabilities/scheduling.md`
