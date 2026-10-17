#!/usr/bin/env bash
# bin/hooks/learn-nudge.sh: Claude Code Stop hook (learning nudge).
# Canonical copy: templates/local/bin/hooks/ in Jarvis Architect. Rules: knowledge/capabilities/learning.md.
#
# Reads the hook JSON on stdin (session_id, stop_hook_active, permission_mode). If a correction
# captured in THIS session (memory/corrections.jsonl, outcome "pending") was not closed, it returns
# hookSpecificOutput.additionalContext once per record so the model closes it with the `learn`
# skill. It never returns decision "block", never nudges twice for the same record, and does
# nothing when stop_hook_active is true or the run is unattended. bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PY=""
for c in "${JARVIS_PYTHON:-}" /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  [ -n "$c" ] && command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
done
[ -n "$PY" ] || exit 0
[ -f "$ROOT/memory/corrections.jsonl" ] || { cat >/dev/null; exit 0; }
export JARVIS_ROOT="$ROOT"

read -r -d '' PYCODE <<'PYEOF' || true
import json, os, sys, time

ROOT = os.environ["JARVIS_ROOT"]
LEDGER = os.path.join(ROOT, "memory", "corrections.jsonl")
LOCK = os.path.join(ROOT, "memory", ".corrections.lock")
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if d.get("stop_hook_active") is True:
    sys.exit(0)                                   # already continuing because of a Stop hook
if os.environ.get("JARVIS_UNATTENDED") == "1" or d.get("permission_mode") in ("dontAsk", "bypassPermissions"):
    sys.exit(0)
session = str(d.get("session_id") or "")[:80]
if not session:
    sys.exit(0)

for _ in range(60):
    try:
        os.mkdir(LOCK); break
    except FileExistsError:
        time.sleep(0.05)
else:
    sys.exit(0)
pending = []
try:
    rows, raw = [], []
    with open(LEDGER, encoding="utf-8") as f:
        for line in f:
            s = line.rstrip("\n")
            if not s.strip():
                continue
            try:
                r = json.loads(s)
            except Exception:
                rows.append(None); raw.append(s); continue
            rows.append(r); raw.append(None)
    changed = False
    for r in rows:
        if r and r.get("session") == session and r.get("outcome") == "pending" and not r.get("nudged"):
            r["nudged"] = True; changed = True
            pending.append(r["id"])
    if changed:
        tmp = LEDGER + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            for r, s in zip(rows, raw):
                f.write((json.dumps(r, ensure_ascii=False) if r is not None else s) + "\n")
        os.replace(tmp, LEDGER)
finally:
    os.rmdir(LOCK)

if pending:
    ids = ", ".join(pending)
    ctx = (f"Jarvis aprendizaje: quedó sin cerrar {ids}. Antes de terminar, clasifícala(s) con la skill `learn` "
           f"y ciérralas con `bin/learn.sh` (si no era una corrección: `bin/learn.sh close <C-id> not_a_correction ignored`). "
           f"No repitas tu respuesta anterior; si aprendiste algo, avisa en una línea.")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "Stop", "additionalContext": ctx}}, ensure_ascii=False))
PYEOF

"$PY" -I -c "$PYCODE" 2>/dev/null || exit 0
exit 0
