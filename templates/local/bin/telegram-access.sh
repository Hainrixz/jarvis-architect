#!/usr/bin/env bash
# bin/telegram-access.sh: owner-only access manager for the Claude Code Telegram plugin (SEC-01, SEC-04).
# Canonical copy: templates/local/bin/ in Jarvis Architect. Rules: knowledge/runtimes/claude-code-local.md § Channels.
#
# The Jarvis session cannot change its own allowlist: guard.sh denies `access.json` and `channels/`,
# protect-paths.sh denies edits under ~/.claude/channels, and the sandbox can't read that folder. So
# `/telegram:access pair|policy|allow|remove` fails inside the session on purpose. The owner runs this
# script instead, in a plain terminal outside Jarvis. It writes the same access.json shape the
# plugin's own skill writes (plugin skills/access/SKILL.md § State shape).
#
#   bin/telegram-access.sh status                 policy, allowlisted IDs, groups, pending codes + expiry
#   bin/telegram-access.sh pair <code>            approve one pending code (compare it with the phone first)
#   bin/telegram-access.sh remove <senderId>      drop an ID from the allowlist
#   bin/telegram-access.sh policy <allowlist|pairing|disabled>   allowlist also clears pending codes
#
# Refuses to run inside Claude Code (CLAUDECODE is set there). Writes atomically, mode 600.
# State dir: $TELEGRAM_STATE_DIR, else $CLAUDE_CONFIG_DIR/channels/telegram, else ~/.claude/channels/telegram.
set -euo pipefail
if [ -n "${CLAUDECODE:-}" ]; then
  echo "Esto solo lo corre el dueño en una terminal normal, fuera de Jarvis." >&2
  exit 3
fi
DIR="${TELEGRAM_STATE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/channels/telegram}"
exec /usr/bin/env python3 -I - "$DIR" "$@" <<'PY'
import json, os, sys, tempfile, time

d, args = sys.argv[1], sys.argv[2:]
p = os.path.join(d, "access.json")
USAGE = "Uso: bin/telegram-access.sh [status | pair <código> | remove <senderId> | policy <allowlist|pairing|disabled>]"
try:
    with open(p) as f:
        a = json.load(f)
except FileNotFoundError:
    a = {"dmPolicy": "pairing", "allowFrom": [], "groups": {}, "pending": {}}
a.setdefault("allowFrom", [])
a.setdefault("groups", {})
a.setdefault("pending", {})
now = time.time() * 1000


def save():
    os.makedirs(d, mode=0o700, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".access.")
    with os.fdopen(fd, "w") as f:
        json.dump(a, f, indent=2)
        f.write("\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, p)


cmd = args[0] if args else "status"
if cmd == "status" and len(args) <= 1:
    print(f"dmPolicy: {a.get('dmPolicy')}")
    print(f"allowFrom: {a['allowFrom']}")
    print(f"groups: {len(a['groups'])}")
    for code, e in a["pending"].items():
        left = int((e.get("expiresAt", 0) - now) / 60000)
        print(f"pendiente: código {code} · senderId {e.get('senderId')} · vence en {left} min")
elif cmd == "pair" and len(args) == 2:
    e = a["pending"].get(args[1])
    if not e or e.get("expiresAt", 0) < now:
        sys.exit("Código no encontrado o vencido. Escríbele al bot otra vez para recibir uno nuevo.")
    sid = str(e["senderId"])
    if sid not in a["allowFrom"]:
        a["allowFrom"].append(sid)
    del a["pending"][args[1]]
    save()
    ap = os.path.join(d, "approved")
    os.makedirs(ap, mode=0o700, exist_ok=True)
    with open(os.path.join(ap, sid), "w") as f:   # the plugin polls approved/ and says "you're in"
        f.write(str(e["chatId"]))
    print(f"Aprobado: {sid}")
elif cmd == "remove" and len(args) == 2:
    a["allowFrom"] = [x for x in a["allowFrom"] if x != args[1]]
    save()
    print(f"Quitado: {args[1]}")
elif cmd == "policy" and len(args) == 2 and args[1] in ("allowlist", "pairing", "disabled"):
    a["dmPolicy"] = args[1]
    if args[1] == "allowlist":
        a["pending"] = {}
    save()
    print(f"dmPolicy: {args[1]}")
else:
    sys.exit(USAGE)
PY
