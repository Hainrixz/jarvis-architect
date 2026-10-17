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
| Autopilot | last run, paused or not, today's cost against `JARVIS_AUTOPILOT_DAILY_USD`, blocked tasks, `TASKS.md` parse errors, rejects in the last 7 days (commands below). Paused is 🟡, never "fixed" by you: only the owner resumes |
| Learning | the three hooks present (Claude tracks), captures still `pending` after 7 days, active lessons out of 60, skills on probation, learned skills failing the lint, last `learning.review` |
| Media | `whisper-cli` and `ffmpeg` on PATH, the model file's SHA-256 equal to the runtime file's pin, `yt-dlp --version` no more than 30 days behind the latest release, no leftover `jarvis-watch-*` folders. Skip on `cowork` |
| Panel (if installed) | `GET /api/autopilot` (`paused`, `stopped`, `last_run`, `cost_today`, `actions_today`) and `GET /api/tasks` (`errors`, `needs_ok`) |

   Commands for the last four rows, run inside the Jarvis folder (they print counts and ids,
   never message content):

   ```bash
   # Autopilot (knowledge/capabilities/autonomy.md)
   grep autopilot logs/jobs.log | tail -1                        # last run
   test -e STOP_AUTOPILOT && echo paused || echo running
   awk -F'\t' -v d="$(date +%Y-%m-%d)" '$2 == "autopilot" && index($1, d) == 1 { v = $5; sub(/^cost_est=/, "", v); s += v } END { printf "%.4f\n", s + 0 }' logs/audit.tsv
   grep -c 'state:blocked' TASKS.md
   python3 -I "$ROOT/tests/autonomy/parse_tasks.py" TASKS.md   # exit 0 = parses
   since=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)
   grep 'autopilot.reject' logs/audit.jsonl | jq -r --arg s "$since" 'select(.ts >= $s) | .reason' | sort | uniq -c
   # Learning (knowledge/capabilities/learning.md § 9)
   for f in bin/hooks/capture-correction.sh bin/hooks/learn-nudge.sh bin/hooks/protect-paths.sh; do test -x "$f" || echo "missing $f"; done
   python3 -I -c 'import json,sys,datetime as d;t=d.datetime.now(d.timezone.utc)-d.timedelta(days=7);print(sum(1 for l in open(sys.argv[1]) if l.strip() and (r:=json.loads(l)).get("outcome")=="pending" and d.datetime.fromisoformat(r["ts"].replace("Z","+00:00"))<t))' memory/corrections.jsonl
   sed -n '/^## Activas/,/^## /p' LESSONS.md | grep -c '^- L-'   # out of 60
   find skills .claude/skills -name .probation 2>/dev/null
   for d in skills/*/; do grep -q 'created-by: agent' "$d/SKILL.md" 2>/dev/null && { bin/promote-skill.sh lint "$d" >/dev/null || echo "lint fails: $d"; }; done
   grep '"learning.review"' logs/audit.jsonl | tail -1 | jq -r .ts
   # Media (knowledge/capabilities/multimodal.md)
   command -v whisper-cli ffmpeg yt-dlp
   shasum -a 256 models/ggml-*.bin                               # compare with the runtime file's pin
   yt-dlp --version; gh api repos/yt-dlp/yt-dlp/releases/latest --jq .tag_name 2>/dev/null
   ls "${TMPDIR:-/tmp}" | grep -c '^jarvis-watch-'
   ```

   yt-dlp versions are dates (`YYYY.MM.DD`): more than 30 days behind the latest tag is 🟡, with
   the update command from the runtime file. With no `gh`, skip the comparison and say so.

4. For each 🔴 / 🟡: one-line cause + the exact fix. Apply fixes only after a yes. Never resume
   the autopilot, end a skill's probation or edit `LESSONS.md` yourself: name the panel button or
   the terminal command the owner runs.
