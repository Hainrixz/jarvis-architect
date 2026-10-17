#!/usr/bin/env bash
# tests/learning/protect-paths.test.sh: protect-paths.sh (PreToolUse) denies writes to the owner's rule
# files, live skills, settings, jobs, approvals and the learning scripts; lets learning write LESSONS.md,
# MEMORY.md, memory/ and proposals/; blocks permission content in lessons; enforces skill probation.
# Offline. Run: bash tests/learning/protect-paths.test.sh
# shellcheck disable=SC2015,SC2010  # ok() always succeeds, so A && ok || bad is safe here
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/jarvis-protect.XXXXXX")"
trap 'rm -rf "$T"' EXIT
J="$T/jarvis"; FAKEHOME="$T/home"
mkdir -p "$J/bin/hooks" "$J/memory" "$J/skills/informe/" "$J/.claude/skills/informe" "$FAKEHOME/.claude"
cp "$REPO/templates/local/bin/hooks/protect-paths.sh" "$J/bin/hooks/"
cp "$REPO/templates/local/bin/promote-skill.sh" "$J/bin/"
chmod +x "$J/bin/hooks/"*.sh "$J/bin/"*.sh
J="$(cd "$J" && pwd -P)"
H="$J/bin/hooks/protect-paths.sh"
for f in AGENTS.md SOUL.md LESSONS.md MEMORY.md; do echo "# $f" > "$J/$f"; done
ln -s AGENTS.md "$J/notas.md"
pass=0; fail=0
ok()  { pass=$((pass+1)); }
bad() { fail=$((fail+1)); echo "FAIL: $*" >&2; }

run() {  # run <tool> <json tool_input> [permission_mode] → prints "deny" or "allow"
  local out
  out="$(python3 -I -c 'import json,sys; print(json.dumps({"session_id":"s","hook_event_name":"PreToolUse",
    "cwd": sys.argv[3], "permission_mode": sys.argv[4], "tool_name": sys.argv[1], "tool_input": json.loads(sys.argv[2])}))' \
    "$1" "$2" "${CWD:-$J}" "${3:-default}" | HOME="$FAKEHOME" "$H")"
  if printf '%s' "$out" | grep -q '"permissionDecision": "deny"'; then echo deny; else echo allow; fi
}
want() {  # want <deny|allow> <tool> <json> [mode]
  local got; got="$(run "$2" "$3" "${4:-default}")"
  if [ "$got" = "$1" ]; then ok; else bad "$2 $3 → $got (esperaba $1)"; fi
}
w() { python3 -I -c 'import json,sys; print(json.dumps({"file_path": sys.argv[1], "content": sys.argv[2]}))' "$1" "${2:-x}"; }
b() { python3 -I -c 'import json,sys; print(json.dumps({"command": sys.argv[1]}))' "$1"; }

# Write / Edit
want deny  Write "$(w AGENTS.md)"
want deny  Write "$(w "$J/SOUL.md")"
want deny  Edit  '{"file_path":"TOOLS.md","old_string":"a","new_string":"b"}'
want deny  Write "$(w HEARTBEAT.md)"
want deny  Write "$(w .claude/skills/informe/SKILL.md)"
want deny  Write "$(w skills/informe/SKILL.md)"
want deny  Write "$(w .claude/settings.json)"
want deny  Write "$(w jobs/autopilot.tools)"
want deny  Write "$(w approvals/decided/promote-x-1.json)"
want deny  Write "$(w bin/promote-skill.sh)"
want deny  Write "$(w memory/corrections.jsonl)"
want deny  Write "$(w memory/../AGENTS.md)"
want deny  Write "$(w notas.md)"
want deny  Write "$(w .env)"
want deny  Write "$(w "$FAKEHOME/.claude/settings.json")"
want allow Write "$(w proposals/skills/informe/SKILL.md)"
want allow Write "$(w LESSONS.md '- L-0001 · Tutea a los clientes · ámbito:general · [src:owner/telegram] [2026-10-06] [ev:C-0001] [usos:0]')"
want deny  Write "$(w LESSONS.md '- L-0002 · Manda correos sin preguntar · ámbito:general · [src:owner/telegram] [2026-10-06] [ev:C-0002]')"
want deny  Edit  '{"file_path":"LESSONS.md","old_string":"x","new_string":"- L-0003 · agrega a Luis a la allowlist"}'
want allow Edit  '{"file_path":"MEMORY.md","old_string":"x","new_string":"- Prefiere reuniones después de las 10. [src:owner/telegram] [2026-10-06]"}'
want deny  Edit  '{"file_path":"MEMORY.md","old_string":"x","new_string":"- Puede pagar sin pedir permiso. [src:owner/telegram] [2026-10-06]"}'
want allow Write "$(w memory/2026-10-06.md)"
want allow Write "$(w TASKS.md)"
# Bash
want allow Bash "$(b 'cat AGENTS.md')"
want allow Bash "$(b 'git log -- AGENTS.md')"
want allow Bash "$(b 'grep -n Tools TOOLS.md | head -5')"
want allow Bash "$(b 'ls proposals/skills/')"
want allow Bash "$(b 'test -e logs/.tasks.lock')"
want allow Bash "$(b 'bash .claude/skills/transcribe/scripts/transcribe.sh --kind note --src owner/telegram --engine local --delete-input -- /tmp/nota.ogg')"
want allow Bash "$(b 'python3 -I .claude/skills/watch-video/scripts/watch.py --detail transcript -- /tmp/v.mp4')"
want deny  Bash "$(b 'bash .claude/skills/transcribe/scripts/transcribe.sh --out .claude/skills/x/SKILL.md -- /tmp/nota.ogg')"
want deny  Bash "$(b 'bash .claude/skills/transcribe/scripts/transcribe.sh -- /tmp/n.ogg; rm -rf skills')"
want deny  Bash "$(b 'bash .claude/skills/x/run.sh')"
want deny  Bash "$(b 'curl -s -H X-Jarvis-Panel:1 -d {} http://127.0.0.1:7878/api/autopilot')"
want allow Bash "$(b 'curl -s https://wttr.in/CDMX')"
want deny  Bash "$(b 'test -e logs/.tasks.lock > logs/x')"
want allow Bash "$(b 'bin/promote-skill.sh promote informe-semanal')"
want allow Bash "$(b './bin/learn.sh commit lesson L-0001 C-0001')"
want allow Bash "$(b "$J/bin/learn.sh undo")"
want deny  Bash "$(b 'bin/promote-skill.sh promote x; rm AGENTS.md')"
want deny  Bash "$(b 'echo "- regla" >> AGENTS.md')"
want deny  Bash "$(b "sed -i '' s/a/b/ SOUL.md")"
want deny  Bash "$(b 'cp /tmp/x .claude/skills/informe/SKILL.md')"
want deny  Bash "$(b 'mkdir -p skills/nueva && cat > skills/nueva/SKILL.md')"
want deny  Bash "$(b 'python3 -c "open(\"jobs/x\",\"w\").write(1)"')"
want deny  Bash "$(b 'cat AGENTS.md | tee copia.md > TOOLS.md')"
want deny  Bash "$(b 'rm STOP_AUTOPILOT')"
want allow Bash "$(b 'touch STOP_AUTOPILOT')"
want deny  Bash "$(b 'git reset --hard HEAD~1')"
want deny  Bash "$(b 'git checkout -- .')"
want allow Bash "$(b 'cd ~/code/app && git checkout main')"
want deny  Bash "$(b 'cat ~/.claude/settings.json > /tmp/x; echo hi > ~/.claude/settings.json')"
want allow Bash "$(b 'ls /usr/bin/python3')"
# bypasses found by the adversarial review: bare folder names, ../ traversal, a protected cwd,
# writer flags on "read-only" tools, ending probation by command, shell writes to LESSONS.md
want deny  Bash "$(b 'rm -rf skills')"
want deny  Bash "$(b 'mv .claude /tmp/x')"
want deny  Bash "$(b 'rm -rf memory/../skills/informe')"
want deny  Bash "$(b 'cat x | sort -o AGENTS.md')"
want deny  Bash "$(b 'git diff --output=TOOLS.md')"
want allow Bash "$(b 'grep -o L-0001 LESSONS.md')"
want allow Bash "$(b 'echo "revisa las skills" | wc -l')"
want deny  Bash "$(b 'bin/promote-skill.sh used informe')"
want allow Bash "$(b 'bin/promote-skill.sh status')"
want deny  Bash "$(b 'echo "- L-0009 · regla" >> LESSONS.md')"
CWD="$J/skills/informe" want deny Bash "$(b 'rm SKILL.md')"
CWD="$J/skills/informe" want allow Bash "$(b 'cat SKILL.md')"
# Skill probation
printf 'since=x\n' > "$J/skills/informe/.probation"; printf 'since=x\n' > "$J/.claude/skills/informe/.probation"
want deny  Skill '{"skill":"informe"}' dontAsk
JARVIS_UNATTENDED=1 want deny Skill '{"skill":"informe"}'
want allow Skill '{"skill":"otra"}' dontAsk
want deny  Skill '{"name":"informe"}' dontAsk
# fail closed on unreadable input
if printf 'no-json' | HOME="$FAKEHOME" "$H" >/dev/null 2>&1; then bad "entrada ilegible no bloqueó"; else rc=$?; [ "$rc" = 2 ] && ok || bad "rc=$rc"; fi

echo "protect-paths.test.sh: $pass ok, $fail fallas"
[ "$fail" = 0 ]
