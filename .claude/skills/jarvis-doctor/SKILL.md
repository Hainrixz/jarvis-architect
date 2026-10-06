---
name: jarvis-doctor
description: >-
  Health check for a Jarvis that's already built: is it running, reachable, inside its spend cap,
  up to date above the security floor, and still locked to its owner? Read-only by default.
  EN — "is my Jarvis ok", "Jarvis not answering", "health check". ES — "mi Jarvis no contesta",
  "revisa mi Jarvis", "está bien mi Jarvis", "doctor".
argument-hint: "[path to the Jarvis folder]"
---

# /jarvis-doctor

Load the `jarvis-start` skill's rules (never read secrets; ask before any change).

1. Find the Jarvis: argument path, else `.jarvis/tasks.json → jarvis_dir`, else ask.
2. Read its `jarvis-spec.md` (copied into the folder at handoff) and `RUNBOOK.md`.
3. Run read-only checks and report a traffic light per row:

| Check | How |
|---|---|
| Process alive | runtime's status command from `knowledge/runtimes/<id>.md` § Verify (launchctl/systemctl/pm2/`railway status`) |
| Runtime health | `claude doctor` · `hermes doctor` / `hermes --version` · `openclaw doctor` · `ollama list` |
| Version ≥ security floor | compare installed version with the floor in the runtime file; floor broken = 🔴 |
| Channel reachable | ask the owner to send "ping"; check the log line |
| Allowlist intact | grep the channel config for wildcards / `open` policies (fail on any) |
| Secrets not in git | `git -C <dir> ls-files | grep -E '\.env$|auth\.json|credentials'` must be empty |
| Recent errors | last 50 log lines, summarised in ≤3 lines (never paste raw logs) |
| Scheduled jobs | last run time of each job |
| Cost | remind where to look (provider dashboard, Railway usage); you can't see billing |

4. For each 🔴 / 🟡: one-line cause + the exact fix. Apply fixes only after a yes.
