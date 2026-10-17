#!/usr/bin/env bash
# tests/autonomy/apply-ops.test.sh: fixture tests for the autonomy write path.
#   1. parse_tasks.py accepts the template and good fixtures, rejects every bad-*.md fixture;
#   2. apply-ops.sh applies every fixtures/ops/ok-*.json (exit 0, TASKS.md still parses);
#   3. apply-ops.sh rejects every fixtures/ops/rej-*.json (exit 3, TASKS.md byte-identical,
#      no drafts/ or tasks/ written, an autopilot.reject audit line);
#   4. environment cases: TASKS.md parse error (exit 5), drafts/ symlinked into approvals/
#      (exit 3, nothing lands there), held lock (exit 4);
#   5. the post hook and the run-job.sh wrapper extracted from knowledge/capabilities/scheduling.md,
#      with a fake `claude` on PATH: STOP_AUTOPILOT and the daily cap skip the model call; a good
#      ops block is applied and stripped from the delivered text; a bad block fails loudly.
# Usage: bash tests/autonomy/apply-ops.test.sh   (bash 3.2+, jq, python3; no network, no keys)
# shellcheck disable=SC2016  # literal ``` fences in printf formats are intended
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/tests/autonomy/fixtures"
APPLY="$ROOT/templates/local/jobs/apply-ops.sh"
POST="$ROOT/templates/local/jobs/autopilot.post"
PARSE="$ROOT/tests/autonomy/parse_tasks.py"
TODAY=2026-10-06
WORK="$(mktemp -d "${TMPDIR:-/tmp}/apply-ops-test.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PASS=0; FAILN=0
ok()   { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
bad()  { FAILN=$((FAILN + 1)); printf 'FAIL %s\n' "$1"; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

new_jarvis() {  # $1 = dir; a minimal Jarvis folder with the basic fixture
  rm -rf "$1"; mkdir -p "$1/tasks/archive" "$1/jobs" "$1/approvals/pending"
  cp "$FX/tasks-basic.md" "$1/TASKS.md"
  cp "$FX/archive/2026-09.md" "$1/tasks/archive/2026-09.md"
  cp "$APPLY" "$1/jobs/apply-ops.sh"; chmod 700 "$1/jobs/apply-ops.sh"
}
run_apply() {  # $1 dir, $2 ops file → sets RC
  set +e; bash "$1/jobs/apply-ops.sh" --dir "$1" --today "$TODAY" --ops "$2" > "$1/.stdout" 2> "$1/.stderr"; RC=$?; set -e
}
line_of() { grep -E "^- \[[ x]\] $2 " "$1/TASKS.md" || true; }
section_of() {  # which "## " heading a task id sits under
  awk -v id="$2" '/^## /{s=substr($0,4)} $0 ~ "^- \\[[ x]\\] " id " " {print s}' "$1/TASKS.md"
}

echo "# 1. parser"
check "template parses (--template)" "python3 -I '$PARSE' --template '$ROOT/templates/workspace/TASKS.md' >/dev/null"
check "template without --template flags its placeholders" "! python3 -I '$PARSE' '$ROOT/templates/workspace/TASKS.md' >/dev/null 2>&1"
check "tasks-basic.md parses" "python3 -I '$PARSE' '$FX/tasks-basic.md' >/dev/null"
check "filled empty template parses" "python3 -I '$PARSE' '$FX/tasks-empty-template-filled.md' >/dev/null"
for f in "$FX"/bad-*.md; do
  check "parser rejects $(basename "$f")" "! python3 -I '$PARSE' '$f' >/dev/null 2>&1"
done

echo "# 2. accepted ops"
for f in "$FX"/ops/ok-*.json; do
  name="$(basename "$f" .json)"; J="$WORK/$name"; new_jarvis "$J"; run_apply "$J" "$f"
  check "$name exits 0" "[ $RC -eq 0 ]"
  [ "$RC" -eq 0 ] || sed 's/^/     /' "$J/.stderr"
  check "$name leaves a TASKS.md that parses" "python3 -I '$PARSE' '$J/TASKS.md' >/dev/null"
  case "$name" in
    (ok-empty)
      check "ok-empty: TASKS.md byte-identical" "cmp -s '$FX/tasks-basic.md' '$J/TASKS.md'";;
    (ok-l1-draft-done)
      check "ok-l1-draft-done: T-0001 is [x] done" "line_of '$J' T-0001 | grep -q '^- \[x\] T-0001 .* state:done '"
      check "ok-l1-draft-done: T-0001 moved to ## Hecho" "[ \"\$(section_of '$J' T-0001)\" = Hecho ]"
      check "ok-l1-draft-done: drafts/T-0001.md written" "grep -q 'Propuesta para Acme' '$J/drafts/T-0001.md'"
      check "ok-l1-draft-done: 2 autopilot.op audit lines" "[ \$(grep -c '\"action\":\"autopilot.op\"' '$J/logs/audit.jsonl') -eq 2 ]"
      check "ok-l1-draft-done: draft body never in the audit" "! grep -q 'Alcance' '$J/logs/audit.jsonl'"
      check "ok-l1-draft-done: untouched lines byte-identical" "[ \"\$(line_of '$J' T-0007)\" = \"\$(grep -E '^- \[ \] T-0007 ' '$FX/tasks-basic.md')\" ]";;
    (ok-l2-preview)
      check "ok-l2-preview: T-0003 needs_ok" "line_of '$J' T-0003 | grep -q 'state:needs_ok'"
      check "ok-l2-preview: T-0003 moved to ## Hoy" "[ \"\$(section_of '$J' T-0003)\" = Hoy ]"
      check "ok-l2-preview: preview in drafts/T-0003.md" "grep -q 'ana@ejemplo.com' '$J/drafts/T-0003.md'"
      check "ok-l2-preview: nothing in approvals/" "[ -z \"\$(ls -A '$J/approvals/pending')\" ]";;
    (ok-tries-block)
      check "ok-tries-block: tries:3 forces state:blocked" "line_of '$J' T-0004 | grep -q 'state:blocked .*tries:3'"
      check "ok-tries-block: auto-block audited" "grep -q '\"reason\":\"tries\"' '$J/logs/audit.jsonl'";;
    (ok-waiting-nudge)
      check "ok-waiting-nudge: next moved" "line_of '$J' T-0005 | grep -q 'next:2026-10-09'"
      check "ok-waiting-nudge: note in tasks/T-0005.md" "grep -q '^- 2026-10-06 autopilot: Sin respuesta' '$J/tasks/T-0005.md'"
      check "ok-waiting-nudge: new id skips archived T-0010" "line_of '$J' T-0011 | grep -q 'state:inbox · who:jarvis · lvl:L2 · due:2026-10-09 · prio:2 · src:agent/2026-10-06'"
      check "ok-waiting-nudge: added task lands in Bandeja" "[ \"\$(section_of '$J' T-0011)\" = 'Bandeja (capturado, sin confirmar)' ]"
      check "ok-waiting-nudge: note text not in the audit" "! grep -q 'Sin respuesta' '$J/logs/audit.jsonl'";;
    (ok-lvl-down-who-owner)
      check "ok-lvl-down: T-0003 lvl:L1" "line_of '$J' T-0003 | grep -q 'lvl:L1'"
      check "ok-lvl-down: T-0009 handed to owner" "line_of '$J' T-0009 | grep -q 'who:owner'";;
    (ok-five-adds)
      check "ok-five-adds: T-0011..T-0015 in inbox" "[ \$(grep -cE '^- \[ \] T-001[1-5] .*state:inbox' '$J/TASKS.md') -eq 5 ]"
      check "ok-five-adds: untrusted src kept" "line_of '$J' T-0014 | grep -q 'src:email:untrusted/2026-10-06 · conf:0.4'"
      check "ok-five-adds: dep on archived id accepted" "line_of '$J' T-0015 | grep -q 'dep:T-0010'";;
    (ok-who-then-note)
      check "ok-who-then-note: T-0009 handed to owner" "line_of '$J' T-0009 | grep -q 'who:owner'"
      check "ok-who-then-note: note after the hand-off accepted" "grep -q 'Te toca elegir' '$J/tasks/T-0009.md'";;
    (ok-doing-waiting)
      check "ok-doing-waiting: T-0009 doing in Hoy" "[ \"\$(section_of '$J' T-0009)\" = Hoy ]"
      check "ok-doing-waiting: T-0004 in Esperando" "[ \"\$(section_of '$J' T-0004)\" = 'Esperando a otros' ]";;
  esac
done

echo "# 3. rejected ops (exit 3, nothing written)"
for f in "$FX"/ops/rej-*.json; do
  name="$(basename "$f" .json)"; J="$WORK/$name"; new_jarvis "$J"; run_apply "$J" "$f"
  check "$name exits 3" "[ $RC -eq 3 ]"
  [ "$RC" -eq 3 ] || sed 's/^/     /' "$J/.stderr" "$J/.stdout"
  check "$name: TASKS.md byte-identical" "cmp -s '$FX/tasks-basic.md' '$J/TASKS.md'"
  check "$name: no drafts/, no task notes, nothing in approvals/" \
    "[ ! -e '$J/drafts' ] && [ -z \"\$(ls '$J/tasks' | grep -v archive)\" ] && [ -z \"\$(ls -A '$J/approvals/pending')\" ] && [ ! -e '$J/SOUL.md' ]"
  check "$name: audited as autopilot.reject" "grep -q '\"action\":\"autopilot.reject\"' '$J/logs/audit.jsonl'"
done
# Each rejection carries the specific reason (spot checks of the rules the design names).
for pair in rej-lvl-raise:lvl_raise rej-who-owner-to-jarvis:who_owner_to_jarvis rej-unknown-id:unknown_id \
            rej-draft-path-traversal:bad_path rej-draft-id-traversal:bad_id rej-draft-approvals:bad_path \
            rej-sixth-add:too_many_adds rej-add-l3:add_lvl_above_L2 rej-inbox-promote:inbox_quarantine \
            rej-needs-ok-without-preview:needs_ok_without_preview rej-done-l2:done_requires_L1 \
            rej-too-many-tasks:too_many_tasks_per_run rej-unknown-top-key:unknown_top_level_key \
            rej-add-src-owner:add_src_owner rej-bad-json:bad_json rej-tries-jump:tries_must_increase_by_1 \
            rej-add-title-comment:bad_title rej-due-not-allowed:due_not_allowed; do
  name="${pair%%:*}"; reason="${pair#*:}"
  check "$name: reason $reason" "grep -q '\"reason\":\"$reason\"' '$WORK/$name/logs/audit.jsonl'"
done

echo "# 4. environment"
J="$WORK/env-parse"; new_jarvis "$J"; cp "$FX/bad-unknown-state.md" "$J/TASKS.md"
run_apply "$J" "$FX/ops/ok-tries-block.json"
check "TASKS.md parse error → exit 5" "[ $RC -eq 5 ]"
check "TASKS.md parse error → file untouched" "cmp -s '$FX/bad-unknown-state.md' '$J/TASKS.md'"

J="$WORK/env-symlink"; new_jarvis "$J"; ln -s approvals/pending "$J/drafts"
run_apply "$J" "$FX/ops/ok-l2-preview.json"
check "drafts/ symlinked into approvals/ → exit 3" "[ $RC -eq 3 ]"
check "drafts/ symlinked → approvals/pending stays empty" "[ -z \"\$(ls -A '$J/approvals/pending')\" ]"
check "drafts/ symlinked → TASKS.md untouched" "cmp -s '$FX/tasks-basic.md' '$J/TASKS.md'"

J="$WORK/env-lock"; new_jarvis "$J"; mkdir -p "$J/logs/.tasks.lock"
run_apply "$J" "$FX/ops/ok-tries-block.json"
check "held lock → exit 4" "[ $RC -eq 4 ]"
check "held lock → TASKS.md untouched" "cmp -s '$FX/tasks-basic.md' '$J/TASKS.md'"

# Tasks waiting for the owner (needs_ok) or blocked by 3 tries are the owner's to move.
J="$WORK/env-awaiting"; new_jarvis "$J"; run_apply "$J" "$FX/ops/ok-l2-preview.json"
printf '%s\n' '{"ops":[{"op":"set","id":"T-0003","field":"state","value":"doing"}]}' > "$J/.reopen.json"
cp "$J/TASKS.md" "$J/.before.md"; run_apply "$J" "$J/.reopen.json"
check "needs_ok task can't be moved by the autopilot → exit 3" "[ $RC -eq 3 ] && cmp -s '$J/.before.md' '$J/TASKS.md'"
check "needs_ok task → reason awaiting_owner" "grep -q '\"reason\":\"awaiting_owner\"' '$J/logs/audit.jsonl'"
printf '%s\n' '{"ops":[],"drafts":[{"id":"T-0003","body":"otra vista previa"}]}' > "$J/.redraft.json"
run_apply "$J" "$J/.redraft.json"
check "needs_ok preview can't be rewritten unattended → exit 3" "[ $RC -eq 3 ] && grep -q 'ana@ejemplo.com' '$J/drafts/T-0003.md'"

J="$WORK/env-blocked"; new_jarvis "$J"; run_apply "$J" "$FX/ops/ok-tries-block.json"
printf '%s\n' '{"ops":[{"op":"set","id":"T-0004","field":"state","value":"doing"}]}' > "$J/.unblock.json"
cp "$J/TASKS.md" "$J/.before.md"; run_apply "$J" "$J/.unblock.json"
check "blocked task can't be reopened by the autopilot → exit 3" "[ $RC -eq 3 ] && cmp -s '$J/.before.md' '$J/TASKS.md'"
check "blocked task → reason blocked_task" "grep -q '\"reason\":\"blocked_task\"' '$J/logs/audit.jsonl'"

# task.reschedule in AGENTS.md § 10 (owner-only) is what enables `set due`.
J="$WORK/env-resched"; new_jarvis "$J"
printf '# AGENTS\n\n## 9. Otras\ntask.reschedule aquí no cuenta\n\n## 10. Autonomía\n3. Lista L3: task.reschedule\n' > "$J/AGENTS.md"
printf '%s\n' '{"ops":[{"op":"set","id":"T-0003","field":"due","value":"2026-10-06"}]}' > "$J/.due.json"
run_apply "$J" "$J/.due.json"
check "task.reschedule listed in § 10 → set due exits 0" "[ $RC -eq 0 ]"
check "set due → T-0003 due today moves to ## Hoy" "line_of '$J' T-0003 | grep -q 'due:2026-10-06 ' && [ \"\$(section_of '$J' T-0003)\" = Hoy ]"
printf '%s\n' '{"ops":[{"op":"set","id":"T-0001","field":"due","value":"2026-10-01"}]}' > "$J/.past.json"
run_apply "$J" "$J/.past.json"
check "set due in the past → exit 3 (due_in_past)" "[ $RC -eq 3 ] && grep -q '\"reason\":\"due_in_past\"' '$J/logs/audit.jsonl'"
J="$WORK/env-resched-other"; new_jarvis "$J"
printf '# AGENTS\n\n## 9. Otras\ntask.reschedule\n\n## 10. Autonomía\n3. Lista L3: ninguna (lista vacía)\n' > "$J/AGENTS.md"
run_apply "$J" "$FX/ops/rej-due-not-allowed.json"
check "task.reschedule outside § 10 does not count → exit 3" "[ $RC -eq 3 ]"

# Someone edits TASKS.md while the block is being checked: nothing is written (exit 4).
J="$WORK/env-conflict"; new_jarvis "$J"; mkdir -p "$J/shim"
cat > "$J/shim/jq" <<SHIM
#!/usr/bin/env bash
case " \$* " in (*" --rawfile tasks "*) printf '\\n' >> "$J/TASKS.md";; esac
exec "$(command -v jq)" "\$@"
SHIM
chmod 755 "$J/shim/jq"; cp "$J/TASKS.md" "$J/.before.md"
set +e; PATH="$J/shim:$PATH" bash "$J/jobs/apply-ops.sh" --dir "$J" --today "$TODAY" --ops "$FX/ops/ok-l2-preview.json" >/dev/null 2>&1; RC=$?; set -e
check "TASKS.md changed during apply → exit 4" "[ $RC -eq 4 ]"
check "TASKS.md changed during apply → no draft written" "[ ! -e '$J/drafts/T-0003.md' ]"
check "TASKS.md changed during apply → conflict audited" "grep -q '\"reason\":\"conflict\"' '$J/logs/audit.jsonl'"

J="$WORK/env-bad-actor"; new_jarvis "$J"
set +e; bash "$J/jobs/apply-ops.sh" --dir "$J" --actor "../x" --ops "$FX/ops/ok-empty.json" >/dev/null 2>&1; RC=$?; set -e
check "actor with a path → exit 2" "[ $RC -eq 2 ]"

echo "# 5. post hook + run-job.sh wrapper (fake claude)"
SCHED="$ROOT/knowledge/capabilities/scheduling.md"
make_wrapper_jarvis() {  # $1 dir
  new_jarvis "$1"
  awk '/^```bash$/ { inb = 1; buf = ""; next }
       inb && /^```$/ { if (buf ~ /jobs\/run-job.sh <job>: the one wrapper/) { printf "%s", buf; exit } inb = 0; next }
       inb { buf = buf $0 "\n" }' "$SCHED" > "$1/jobs/run-job.sh"
  cp "$POST" "$1/jobs/autopilot.post"
  mkdir -p "$1/.claude/skills/autopilot" "$1/bin"
  printf -- '---\nname: autopilot\n---\n' > "$1/.claude/skills/autopilot/SKILL.md"
  printf 'JARVIS_MODEL_MAIN=sonnet\nJARVIS_MODEL_CHEAP=haiku\nJARVIS_DELIVERY=file\n' > "$1/.env"
  printf 'cheap\n' > "$1/jobs/autopilot.model"
  printf '{"mcpServers": {}}\n' > "$1/mcp.jobs.json"
  # Fake claude: records the call, prints a claude -p JSON whose result is .fake-result.txt
  cat > "$1/bin/claude" <<'FAKE'
#!/usr/bin/env bash
touch .claude-was-called
jq -n --rawfile r .fake-result.txt '{result: $r, is_error: false, total_cost_usd: 0.02, permission_denials: []}'
FAKE
  chmod 755 "$1/bin/claude"
}
run_job() {  # $1 dir → RC
  set +e; ( cd "$1" && PATH="$1/bin:$PATH" bash jobs/run-job.sh autopilot ) >/dev/null 2>&1; RC=$?; set -e
}

J="$WORK/wrap"; make_wrapper_jarvis "$J"
check "run-job.sh extracted from scheduling.md" "grep -q 'STOP_AUTOPILOT' '$J/jobs/run-job.sh' && bash -n '$J/jobs/run-job.sh'"
cat > "$J/.fake-result.txt" <<'RES'
```json
{"ops":[{"op":"set","id":"T-0003","field":"state","value":"needs_ok"}],
 "drafts":[{"id":"T-0003","body":"Para: ana@ejemplo.com\nAsunto: Cotización"}]}
```
Preparé la cotización para Ana (T-0003). Necesito tu OK: "sí, ejecuta T-0003".
RES
touch "$J/STOP_AUTOPILOT"; run_job "$J"
check "STOP_AUTOPILOT → exit 0" "[ $RC -eq 0 ]"
check "STOP_AUTOPILOT → claude never called" "[ ! -e '$J/.claude-was-called' ]"
check "STOP_AUTOPILOT → skipped line in jobs.log" "grep -q 'autopilot skipped: STOP_AUTOPILOT' '$J/logs/jobs.log'"
rm "$J/STOP_AUTOPILOT"

printf '%s\tautopilot\trc=0\terror=false\tcost_est=1.20\tdenied=0\n' "$(date +%Y-%m-%dT%H%M)" > "$J/logs/audit.tsv"
run_job "$J"
check "daily cap reached → claude never called" "[ ! -e '$J/.claude-was-called' ]"
check "daily cap reached → skipped line" "grep -q 'autopilot skipped: daily cap' '$J/logs/jobs.log'"
: > "$J/logs/audit.tsv"

run_job "$J"
check "forced run → exit 0" "[ $RC -eq 0 ]"
check "forced run → claude called" "[ -e '$J/.claude-was-called' ]"
check "forced run → ops applied (T-0003 needs_ok)" "line_of '$J' T-0003 | grep -q 'state:needs_ok'"
check "forced run → autopilot.op audited" "grep -q '\"action\":\"autopilot.op\"' '$J/logs/audit.jsonl'"
check "forced run → delivered text has no ops block" "T=\$(ls '$J'/outbox/*-autopilot.txt) && grep -q 'Necesito tu OK' \$T && ! grep -q '\"ops\"' \$T"
check "forced run → 'autopilot ok' in jobs.log" "grep -q 'autopilot ok$' '$J/logs/jobs.log'"

J="$WORK/wrap-bad"; make_wrapper_jarvis "$J"
printf '```json\n{"ops":[{"op":"set","id":"T-0001","field":"lvl","value":"L3"}]}\n```\nListo.\n' > "$J/.fake-result.txt"
run_job "$J"
check "rejected ops block → wrapper exit 1" "[ $RC -eq 1 ]"
check "rejected ops block → AVISO in outbox" "ls '$J'/outbox/*-autopilot-AVISO.txt >/dev/null 2>&1"
check "rejected ops block → TASKS.md untouched" "cmp -s '$FX/tasks-basic.md' '$J/TASKS.md'"

J="$WORK/wrap-two"; make_wrapper_jarvis "$J"
printf '```json\n{"ops":[]}\n```\n```json\n{"ops":[]}\n```\n' > "$J/.fake-result.txt"
run_job "$J"
check "two ops blocks → wrapper exit 1" "[ $RC -eq 1 ]"

J="$WORK/wrap-silent"; make_wrapper_jarvis "$J"
printf '```json\n{"ops":[{"op":"set","id":"T-0004","field":"tries","value":3}]}\n```\nHEARTBEAT_OK\n' > "$J/.fake-result.txt"
run_job "$J"
check "silent answer → exit 0 and ops still applied" "[ $RC -eq 0 ] && line_of '$J' T-0004 | grep -q 'state:blocked'"
check "silent answer → nothing delivered" "[ -z \"\$(ls '$J'/outbox/*-autopilot.txt 2>/dev/null)\" ] && grep -q 'autopilot ok (silent)' '$J/logs/jobs.log'"

# Seen with a real model: bare ``` fence (no "json") and the silent token after a real note.
J="$WORK/wrap-bare"; make_wrapper_jarvis "$J"
printf 'Elijo T-0004.\n```\n{"ops":[{"op":"set","id":"T-0004","field":"tries","value":3}]}\n```\nPiloto — T-0004 quedó bloqueada.\n\nHEARTBEAT_OK\n' > "$J/.fake-result.txt"
run_job "$J"
check "bare fence → ops applied" "[ $RC -eq 0 ] && line_of '$J' T-0004 | grep -q 'state:blocked'"
check "note + trailing token → note delivered without token or ops" "T=\$(ls '$J'/outbox/*-autopilot.txt) && grep -q 'quedó bloqueada' \$T && ! grep -q 'HEARTBEAT_OK' \$T && ! grep -q '\"ops\"' \$T"
J="$WORK/wrap-bare-other"; make_wrapper_jarvis "$J"
printf 'Ejemplo:\n```\nhola\n```\nListo.\n' > "$J/.fake-result.txt"
run_job "$J"
check "bare fence without ops → kept in the note, TASKS.md untouched" "[ $RC -eq 0 ] && cmp -s '$FX/tasks-basic.md' '$J/TASKS.md' && grep -q hola \$(ls '$J'/outbox/*-autopilot.txt)"

echo
echo "passed: $PASS  failed: $FAILN"
[ "$FAILN" -eq 0 ]
