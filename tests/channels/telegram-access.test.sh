#!/usr/bin/env bash
# tests/channels/telegram-access.test.sh: bin/telegram-access.sh pairs only a known, unexpired code,
# writes the plugin's access.json shape (mode 600) plus approved/<id>, clears pending on allowlist,
# refuses inside Claude Code and rejects bad arguments.
# Offline. Run: bash tests/channels/telegram-access.test.sh
# shellcheck disable=SC2015  # ok() always succeeds, so A && ok || bad is safe here
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/jarvis-tgaccess.XXXXXX")"
trap 'rm -rf "$T"' EXIT
S="$T/state"; mkdir -p "$S"
A="$REPO/templates/local/bin/telegram-access.sh"
pass=0; fail=0
ok()  { pass=$((pass+1)); }
bad() { fail=$((fail+1)); echo "FAIL: $*" >&2; }
ta()  { env -u CLAUDECODE TELEGRAM_STATE_DIR="$S" bash "$A" "$@"; }
get() { python3 -I -c 'import json,sys; a=json.load(open(sys.argv[1])); print(eval(sys.argv[2]))' "$S/access.json" "$1"; }

now_ms=$(( $(date +%s) * 1000 ))
python3 -I - "$S/access.json" "$now_ms" <<'PY'
import json, sys
p, now = sys.argv[1], int(sys.argv[2])
json.dump({"dmPolicy": "pairing", "allowFrom": [], "groups": {}, "pending": {
    "abc123": {"senderId": "123456789", "chatId": "123456789", "createdAt": now, "expiresAt": now + 3600000},
    "old999": {"senderId": "555", "chatId": "555", "createdAt": now - 7200000, "expiresAt": now - 3600000},
    "zzz777": {"senderId": "987654321", "chatId": "987654321", "createdAt": now, "expiresAt": now + 3600000}}},
    open(p, "w"))
PY

# 1. inside Claude Code it refuses and changes nothing
out="$(CLAUDECODE=1 TELEGRAM_STATE_DIR="$S" bash "$A" pair abc123 2>&1)" && bad "ran inside Claude Code" || ok
printf '%s' "$out" | grep -q 'fuera de Jarvis' && ok || bad "refusal message"
[ "$(get 'a["allowFrom"]')" = "[]" ] && ok || bad "allowlist changed while refusing"

# 2. status lists pending codes
ta status | grep -q 'código abc123' && ok || bad "status shows pending"

# 3. unknown and expired codes are refused
ta pair nope00 >/dev/null 2>&1 && bad "unknown code paired" || ok
ta pair old999 >/dev/null 2>&1 && bad "expired code paired" || ok
[ "$(get 'a["allowFrom"]')" = "[]" ] && ok || bad "allowlist changed by a refused code"

# 4. a valid code pairs exactly that sender, removes only that code, writes approved/<id>
ta pair abc123 | grep -qx 'Aprobado: 123456789' && ok || bad "pair output"
[ "$(get 'a["allowFrom"]')" = "['123456789']" ] && ok || bad "allowFrom after pair"
[ "$(get '"abc123" in a["pending"]')" = "False" ] && ok || bad "paired code still pending"
[ "$(get '"zzz777" in a["pending"]')" = "True" ] && ok || bad "other pending code removed by pair"
[ "$(cat "$S/approved/123456789")" = "123456789" ] && ok || bad "approved/<id> file"
[ "$(stat -c %a "$S/access.json" 2>/dev/null || stat -f %Lp "$S/access.json")" = 600 ] && ok || bad "access.json mode 600"

# 5. pairing twice does not duplicate
python3 -I - "$S/access.json" "$now_ms" <<'PY'
import json, sys
p, now = sys.argv[1], int(sys.argv[2]); a = json.load(open(p))
a["pending"]["again1"] = {"senderId": "123456789", "chatId": "123456789", "createdAt": now, "expiresAt": now + 3600000}
json.dump(a, open(p, "w"))
PY
ta pair again1 >/dev/null && [ "$(get 'len(a["allowFrom"])')" = 1 ] && ok || bad "duplicate ID after second pair"

# 6. policy allowlist clears pending; groups untouched
ta policy allowlist >/dev/null
[ "$(get 'a["dmPolicy"]')" = allowlist ] && ok || bad "policy not set"
[ "$(get 'a["pending"]')" = "{}" ] && ok || bad "pending not cleared by allowlist"
[ "$(get 'a["groups"]')" = "{}" ] && ok || bad "groups changed"

# 7. bad arguments are refused
ta policy open >/dev/null 2>&1 && bad "invalid policy accepted" || ok
ta pair >/dev/null 2>&1 && bad "pair without code accepted" || ok
ta allow 42 >/dev/null 2>&1 && bad "unknown subcommand accepted" || ok

# 8. remove
ta remove 123456789 >/dev/null && [ "$(get 'a["allowFrom"]')" = "[]" ] && ok || bad "remove"

echo "telegram-access: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
