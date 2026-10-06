---
name: jarvis-next
description: >-
  Resume building a Jarvis from .jarvis/tasks.json — picks the next unblocked task, runs it, runs
  its verify commands, and marks it done only when they all exit 0. EN — "continue", "next step",
  "resume my build". ES — "sigue", "siguiente paso", "continuamos", "dónde me quedé".
argument-hint: "[--list | --task T07 | --done T07]"
---

# /jarvis-next — continue the build

Load the `jarvis-start` skill's rules first (keys, money and safe-install rules apply to every task).

1. Read `./.jarvis/state.json` and `./.jarvis/tasks.json`. Missing → say there's no build in
   progress and offer `/jarvis-start`.
2. Restate the RUNNING BRIEF from `state.json → brief` in ≤5 lines.
3. Flags:
   - `--list` → print `NN · status · title` for every task (👤 for `user_action`) and stop.
   - `--task <id>` → work on that task if its dependencies are `done`; otherwise say which aren't.
   - `--done <id>` → run that task's full verify list; mark `done` only if every command exits 0.
4. No flag:
   - A task left `in_progress` = crash recovery. Re-run its verify list. All pass → mark `done`
     (commit + tag). Otherwise continue that task.
   - Else pick the **first** `pending` task (array order) whose dependencies are all `done`.
5. Execute it per `questions/4-construir.md` Step 2. One task per invocation unless the person says
   "sigue con todo" — then loop, pausing at every `user_action` and every task with a `cost`.
6. After the last task: move to VERIFY (smoke test + `jarvis-validator`) as in `questions/4-construir.md`.

Never re-plan, never invent tasks, never edit a verify command to make it pass. If the plan is
wrong, say so and offer to go back to ARCHITECTURE for that slot.
