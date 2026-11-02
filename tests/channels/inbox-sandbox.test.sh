#!/usr/bin/env bash
# tests/channels/inbox-sandbox.test.sh — a voice note or video the owner sends must stay readable
# under the generated sandbox, while the rest of ~/.claude/channels stays hidden.
#
#   bash tests/channels/inbox-sandbox.test.sh
#
# 1. Static: the claude-code-local and claude-code-server sandbox blocks hide the channels dir
#    (denyRead) and re-open ONLY its Telegram inbox (allowRead).
# 2. Resolution: transcribe.sh and watch.py turn adjunto:<name> into <CLAUDE_CONFIG_DIR>/channels/
#    telegram/inbox/<name> (never a path the command has to spell out).
# 3. Emulation (skipped without bwrap + ffmpeg): the same two scripts read a real audio and a real
#    video from inside a mount namespace where channels/ is an empty tmpfs and only the inbox is
#    bound back. This mimics denyRead + allowRead; it is NOT the Claude Code sandbox itself.
#
# Exit: 0 all run tests passed (skips are fine) · 1 a test failed.

set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TRANSCRIBE="$ROOT/templates/skills-base/transcribe/scripts/transcribe.sh"
WATCH="$ROOT/templates/skills-base/watch-video/scripts/watch.py"
PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf 'FAIL  %s\n' "$1"; }
skip() { SKIP=$((SKIP + 1)); printf 'SKIP  %s\n' "$1"; }

WORK=$(mktemp -d "${TMPDIR:-/tmp}/jarvis-inbox-test.XXXXXX")
trap 'rm -rf -- "$WORK"' EXIT

# ---- 1. static: the sandbox blocks in the runtime files ------------------------------------
check_block() { # check_block <file> <heading-regex> <denyRead entry> <allowRead entry>
  python3 -I - "$@" <<'PY'
import json, re, sys
path, heading, deny, allow = sys.argv[1:5]
text = open(path, encoding="utf-8").read()
i = re.search(heading, text)
assert i, "heading not found: " + heading
block = re.search(r"```json\n(.*?)```", text[i.end():], re.S)
assert block, "no json block after the heading"
fs = json.loads(block.group(1))["sandbox"]["filesystem"]
assert deny in fs["denyRead"], "denyRead lacks " + deny
assert fs.get("allowRead") == [allow], "allowRead must be exactly [" + allow + "], got " + repr(fs.get("allowRead"))
assert allow not in fs["denyRead"], "the inbox must not also be denied"
PY
}
if check_block "$ROOT/knowledge/runtimes/claude-code-local.md" '### `\.claude/launch-settings\.json`' '~/.claude/channels' '~/.claude/channels/telegram/inbox'; then
  ok "claude-code-local: channels hidden, only the inbox re-opened"; else bad "claude-code-local: channels hidden, only the inbox re-opened"; fi
if grep -q '"denyRead": \["~/.ssh", "~/.aws", "~/\*\*/.env", "//data/claude"\], "allowRead": \["//data/claude/channels/telegram/inbox"\]' \
     "$ROOT/knowledge/runtimes/claude-code-server.md"; then
  ok "claude-code-server: /data/claude hidden, only the inbox re-opened"; else bad "claude-code-server: /data/claude hidden, only the inbox re-opened"; fi

# ---- 2. adjunto:<name> resolves under CLAUDE_CONFIG_DIR ------------------------------------
CFG="$WORK/cfg"; INBOX="$CFG/channels/telegram/inbox"
mkdir -p "$INBOX"
out=$(CLAUDE_CONFIG_DIR="$CFG" bash "$TRANSCRIBE" -- adjunto:ausente.oga 2>&1 || true)
case "$out" in *"$INBOX/ausente.oga"*) ok "transcribe.sh: adjunto: resolves to the inbox of CLAUDE_CONFIG_DIR" ;; *) bad "transcribe.sh: adjunto: resolves to the inbox ($out)" ;; esac
out=$(CLAUDE_CONFIG_DIR="$CFG" python3 -I "$WATCH" -- adjunto:ausente.mp4 2>&1 || true)
case "$out" in *"$INBOX/ausente.mp4"*) ok "watch.py: adjunto: resolves to the inbox of CLAUDE_CONFIG_DIR" ;; *) bad "watch.py: adjunto: resolves to the inbox ($out)" ;; esac
for bad_name in "../x.oga" "sub/x.oga" ".oculto"; do
  if CLAUDE_CONFIG_DIR="$CFG" bash "$TRANSCRIBE" -- "adjunto:$bad_name" >/dev/null 2>&1; then bad "transcribe.sh rejects adjunto:$bad_name"; else ok "transcribe.sh rejects adjunto:$bad_name"; fi
done

# ---- 3. emulation: read a real voice note and video through a deny + allow namespace -------
if ! command -v bwrap >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  skip "namespace emulation (needs bwrap and ffmpeg)"
elif ! bwrap --ro-bind / / true >/dev/null 2>&1; then
  skip "namespace emulation (bwrap cannot create a namespace here)"
else
  ffmpeg -v error -f lavfi -i "sine=frequency=440:duration=2" -c:a libopus "$INBOX/nota.oga" 2>/dev/null \
    || ffmpeg -v error -f lavfi -i "sine=frequency=440:duration=2" "$INBOX/nota.wav" 2>/dev/null
  NOTA=$(ls "$INBOX"/nota.* 2>/dev/null | head -1); NOTA=${NOTA##*/}
  ffmpeg -v error -f lavfi -i "testsrc=duration=2:size=160x120:rate=5" -pix_fmt yuv420p "$INBOX/clip.mp4" 2>/dev/null
  echo "token-secreto" > "$CFG/channels/telegram/.env"
  run_ns() { # run_ns <allow|deny> cmd...: channels/ is an empty tmpfs; "allow" binds the inbox back
    local mode=$1; shift
    local extra=()
    [ "$mode" = allow ] && extra=(--ro-bind "$INBOX" "$CFG/channels/telegram/inbox")
    bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp --bind "$WORK" "$WORK" --tmpfs "$CFG/channels" "${extra[@]}" --setenv CLAUDE_CONFIG_DIR "$CFG" "$@"
  }
  if [ -z "$NOTA" ]; then skip "voice note fixture (ffmpeg cannot encode opus or wav here)"
  else
    if run_ns allow cat "$INBOX/$NOTA" >/dev/null 2>&1 && ! run_ns allow cat "$CFG/channels/telegram/.env" >/dev/null 2>&1; then
      ok "namespace: the inbox is readable and .env is not"; else bad "namespace: the inbox is readable and .env is not"; fi
    # With the inbox re-opened the note passes the file, MIME and ffmpeg checks. It either transcribes or stops at
    # "falta el modelo / whisper" when this machine has no Whisper (that is not a sandbox problem).
    out=$(run_ns allow bash "$TRANSCRIBE" --engine local -- "adjunto:$NOTA" 2>&1 || true)
    case "$out" in
      *"no existe o no es un archivo normal"*|*"tipo de archivo no permitido"*|*"inválido"*) bad "voice note not readable with allowRead ($out)" ;;
      *) ok "transcribe.sh reads the voice note with the inbox re-opened" ;;
    esac
    out=$(run_ns deny bash "$TRANSCRIBE" --engine local -- "adjunto:$NOTA" 2>&1 || true)
    case "$out" in
      *"no existe o no es un archivo normal"*) ok "control: without allowRead the voice note is unreadable" ;;
      *) bad "control: without allowRead the voice note should be unreadable ($out)" ;;
    esac
  fi
  out=$(run_ns allow python3 -I "$WATCH" --max-frames 2 -- adjunto:clip.mp4 2>&1 || true)
  case "$out" in
    "# Video: clip.mp4"*) ok "watch.py reads the video with the inbox re-opened" ;;
    *) bad "video not readable with allowRead ($out)" ;;
  esac
  out=$(run_ns deny python3 -I "$WATCH" --max-frames 2 -- adjunto:clip.mp4 2>&1 || true)
  case "$out" in
    *"no existe o no es un archivo normal"*) ok "control: without allowRead the video is unreadable" ;;
    *) bad "control: without allowRead the video should be unreadable ($out)" ;;
  esac
fi

printf '\n%d passed, %d failed, %d skipped\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ]
