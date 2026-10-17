#!/usr/bin/env bash
# tests/media/run.sh — offline tests for the transcribe and watch-video skills.
#
#   bash tests/media/run.sh
#
# Needs: ffmpeg + ffprobe, whisper-cli (Homebrew whisper.cpp), python3, and a small GGML model.
# Optional: macOS `say` (else a pre-made fixture is synthesized with ffmpeg and the transcript
# assertion is skipped), yt-dlp (only for the opt-in online test).
#
# Env:
#   JARVIS_TEST_WHISPER_MODEL  path to a small model (ggml-base-q5_1.bin is enough). If unset, the
#                              test looks in $JARVIS_MEDIA_CACHE (default ~/.cache/jarvis-media).
#                              The test never downloads it: see knowledge/runtimes/claude-code-local.md
#                              § Pinned versions for the URL and SHA-256.
#   JARVIS_MEDIA_ONLINE=1      also run the online captions test (network; no video download).
#
# Exit: 0 all run tests passed (skips are fine) · 1 a test failed. Missing tools → SKIP, exit 0,
# so CI can run it optionally.

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TRANSCRIBE="$ROOT/templates/skills-base/transcribe/scripts/transcribe.sh"
WATCH="$ROOT/templates/skills-base/watch-video/scripts/watch.py"
PASS=0; FAIL=0; SKIP=0

ok()   { PASS=$((PASS + 1)); printf 'PASS  %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf 'FAIL  %s\n' "$1"; }
skip() { SKIP=$((SKIP + 1)); printf 'SKIP  %s\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }
count_dirs() { n=0; for d in "$TMPBASE"/"$1"*; do [ -d "$d" ] && n=$((n + 1)); done; echo "$n"; }

WORK=$(mktemp -d "${TMPDIR:-/tmp}/jarvis-media-test.XXXXXX")
trap 'rm -rf -- "$WORK"' EXIT
TMPBASE=$(python3 -I -c 'import tempfile; print(tempfile.gettempdir())')

# ---- static checks (always run) ------------------------------------------------------------
if bash -n "$TRANSCRIBE"; then ok "transcribe.sh: bash -n"; else bad "transcribe.sh: bash -n"; fi
if have shellcheck; then
  if shellcheck "$TRANSCRIBE" "$0"; then ok "shellcheck"; else bad "shellcheck"; fi
else skip "shellcheck (not installed)"; fi
if python3 -I -c 'import ast,sys; ast.parse(open(sys.argv[1]).read())' "$WATCH"; then
  ok "watch.py: parses"; else bad "watch.py: parses"; fi
if grep -nE 'brew install|pip3? install|npx |curl[^|]*\|[[:space:]]*(ba|z)?sh|cookies-from-browser|--cookies[ =]' \
     "$TRANSCRIBE" "$WATCH" | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#|Instálalo tú|brew install (ffmpeg|whisper\.cpp|yt-dlp)' ; then
  bad "no auto-install / no cookies in skill scripts"
else ok "no auto-install / no cookies in skill scripts"; fi

# ---- URL validation (offline: rejected before any network call) ---------------------------
for u in "-x" "http://127.0.0.1/x" "file:///etc/passwd" "http://localhost/v" "http://[::1]/v" \
         "http://169.254.169.254/latest" "http://10.0.0.5/v" "https://u:p@example.com/v" \
         "https://example.com:8080/v" "http://2130706433/" "ftp://example.com/v"; do
  set +e; out=$(python3 -I "$WATCH" --detail transcript -- "$u" 2>&1); rc=$?; set -e
  if [ "$rc" = 2 ]; then ok "watch.py rejects $u"; else bad "watch.py rejects $u (rc=$rc: $out)"; fi
done
set +e; python3 -I "$WATCH" --cleanup /etc >/dev/null 2>&1; rc=$?; set -e
if [ "$rc" = 2 ]; then ok "watch.py --cleanup refuses non-temp dirs"; else bad "watch.py --cleanup /etc rc=$rc"; fi
printf 'keep me\n' > "$WORK/notes.docx"
set +e; python3 -I "$WATCH" --delete-input -- "$WORK/notes.docx" >/dev/null 2>&1; rc=$?; set -e
if [ "$rc" = 2 ] && [ -f "$WORK/notes.docx" ]; then ok "watch.py --delete-input never deletes a refused file"
else bad "watch.py refused file (rc=$rc, deleted=$([ -f "$WORK/notes.docx" ] && echo no || echo yes))"; fi
printf '#EXTM3U\n#EXTINF:1.0,\nfile:/etc/hosts\n#EXT-X-ENDLIST\n' > "$WORK/playlist.mp4"
set +e; python3 -I "$WATCH" --detail visual -- "$WORK/playlist.mp4" >/dev/null 2>&1; rc=$?; set -e
if [ "$rc" = 2 ]; then ok "watch.py refuses a playlist renamed to .mp4 (magic bytes)"; else bad "watch.py playlist rc=$rc"; fi
set +e; out=$(bash "$TRANSCRIBE" -- "-x" 2>&1); rc=$?; set -e
if [ "$rc" = 2 ]; then ok "transcribe.sh rejects '-x'"; else bad "transcribe.sh rejects '-x' (rc=$rc)"; fi
printf 'not audio\n' > "$WORK/fake.ogg"
set +e; bash "$TRANSCRIBE" -- "$WORK/fake.ogg" >/dev/null 2>&1; rc=$?; set -e
if [ "$rc" = 2 ]; then ok "transcribe.sh rejects a non-audio file by MIME"; else bad "transcribe.sh MIME rc=$rc"; fi
set +e; JARVIS_SENSITIVE_PACK=1 JARVIS_STT_CLOUD=groq bash "$TRANSCRIBE" --engine cloud -- "$WORK/fake.ogg" >/dev/null 2>&1; rc=$?; set -e
if [ "$rc" = 2 ]; then ok "transcribe.sh checks the file before any cloud call"; else bad "cloud guard rc=$rc"; fi

# ---- media pipeline (needs ffmpeg + whisper-cli + model) -----------------------------------
MODEL=${JARVIS_TEST_WHISPER_MODEL:-}
if [ -z "$MODEL" ]; then
  for c in "${JARVIS_MEDIA_CACHE:-$HOME/.cache/jarvis-media}"/ggml-base-q5_1.bin \
           "${JARVIS_MEDIA_CACHE:-$HOME/.cache/jarvis-media}"/ggml-base.bin; do
    if [ -f "$c" ]; then MODEL=$c; break; fi
  done
fi
MISSING=
for t in ffmpeg ffprobe whisper-cli; do have "$t" || MISSING="$MISSING $t"; done
[ -n "$MODEL" ] && [ -f "$MODEL" ] || MISSING="$MISSING whisper-model"
if [ -n "$MISSING" ]; then
  skip "media pipeline: missing$MISSING (brew install ffmpeg whisper.cpp; model → JARVIS_TEST_WHISPER_MODEL)"
else
  export JARVIS_WHISPER_MODEL="$MODEL"
  PHRASE="Recuérdame mandar la cotización a Ana mañana"
  CAN_ASSERT_TEXT=1
  if have say && say -v '?' 2>/dev/null | grep -q '^Paulina'; then
    say -v Paulina "$PHRASE" -o "$WORK/t.aiff"
  else
    CAN_ASSERT_TEXT=0
    ffmpeg -nostdin -loglevel error -f lavfi -i "sine=frequency=440:duration=3" "$WORK/t.aiff"
    skip "transcript content (no macOS 'say -v Paulina'; using a tone instead)"
  fi
  cp "$WORK/t.aiff" "$WORK/keep.aiff"

  # 1) transcribe.sh: text contains "cotización", audio deleted, temp dir gone
  before=$(count_dirs jarvis-stt.)
  set +e; out=$(bash "$TRANSCRIBE" --kind note --src owner/telegram --delete-input -- "$WORK/t.aiff" 2>&1); rc=$?; set -e
  after=$(count_dirs jarvis-stt.)
  printf '%s\n' "$out" | sed 's/^/      | /'
  if [ "$rc" = 0 ]; then ok "transcribe.sh exit 0"; else bad "transcribe.sh exit $rc"; fi
  if [ "$CAN_ASSERT_TEXT" = 1 ]; then
    if printf '%s' "$out" | grep -qi 'cotizaci[oó]n'; then ok "transcript contains 'cotización'"; else bad "transcript contains 'cotización'"; fi
  fi
  if printf '%s' "$out" | grep -q '^<media_transcript src="owner/telegram"'; then ok "owner provenance tag"; else bad "owner provenance tag"; fi
  if [ ! -e "$WORK/t.aiff" ]; then ok "input audio deleted (--delete-input)"; else bad "input audio deleted"; fi
  if [ "$after" -le "$before" ]; then ok "transcribe temp dir removed"; else bad "transcribe temp dir left behind"; fi

  # 1b) without --delete-input the owner's file is kept, and untrusted media is wrapped
  set +e; out=$(bash "$TRANSCRIBE" --src untrusted/reenviado -- "$WORK/keep.aiff" 2>&1); rc=$?; set -e
  if [ "$rc" = 0 ] && [ -f "$WORK/keep.aiff" ] && printf '%s' "$out" | grep -q '^<untrusted_media src="untrusted/reenviado"'; then
    ok "owner file kept without --delete-input; untrusted wrapper"; else bad "keep/untrusted wrapper (rc=$rc)"; fi

  # 1b2) no JARVIS_WHISPER_MODEL (the sandbox can't read .env): the pinned model found in models/ is used
  mkdir -p "$WORK/jd/models"; ln -s "$MODEL" "$WORK/jd/models/ggml-base-q5_1.bin"
  set +e; out=$(cd "$WORK/jd" && env -u JARVIS_WHISPER_MODEL JARVIS_DIR="$WORK/jd" bash "$TRANSCRIBE" --src owner/telegram -- "$WORK/keep.aiff" 2>&1); rc=$?; set -e
  if [ "$rc" = 0 ] && printf '%s' "$out" | grep -q '^<media_transcript'; then ok "model found in models/ without JARVIS_WHISPER_MODEL"
  else bad "model fallback (rc=$rc)"; fi

  # 1c) cloud guards: a sensitive pack or no spec consent → refused before any network call
  set +e
  JARVIS_SENSITIVE_PACK=1 JARVIS_STT_CLOUD=groq bash "$TRANSCRIBE" --engine cloud -- "$WORK/keep.aiff" >/dev/null 2>&1; rc1=$?
  JARVIS_STT_CLOUD=off bash "$TRANSCRIBE" --engine cloud -- "$WORK/keep.aiff" >/dev/null 2>&1; rc2=$?
  set -e
  if [ "$rc1" = 2 ] && [ "$rc2" = 2 ]; then ok "cloud STT refused with sensitive pack / without consent"
  else bad "cloud guards (rc=$rc1/$rc2)"; fi

  # 2) watch.py on a synthetic 20 s video with that audio
  ffmpeg -nostdin -loglevel error -f lavfi -i "testsrc=d=20:s=640x360:r=25" -i "$WORK/keep.aiff" \
    -filter_complex "[1:a]apad[a]" -map 0:v -map "[a]" -t 20 -c:v libx264 -pix_fmt yuv420p -c:a aac "$WORK/v.mp4"
  set +e; python3 -I "$WATCH" --detail balanced --json -- "$WORK/v.mp4" > "$WORK/w.json" 2>"$WORK/w.err"; rc=$?; set -e
  if [ "$rc" = 0 ]; then ok "watch.py exit 0"; else bad "watch.py exit $rc: $(cat "$WORK/w.err")"; fi
  if [ "$rc" = 0 ]; then
    python3 -I - "$WORK/w.json" "$CAN_ASSERT_TEXT" > "$WORK/check.txt" <<'PY' || true
import json, sys, re
d = json.load(open(sys.argv[1]))
fr = d["frames"]
print("NFRAMES", len(fr))
print("FRAMES_OK" if 0 < len(fr) <= 100 else "FRAMES_BAD")
print("TS_OK" if all(re.fullmatch(r"\d{2}:\d{2}", f["t"]) for f in fr) else "TS_BAD")
print("TRANSCRIPT_OK" if d["transcript"].strip() else "TRANSCRIPT_BAD")
if sys.argv[2] == "1":
    print("COTIZ_OK" if re.search(r"cotizaci[oó]n", d["transcript"], re.I) else "COTIZ_BAD")
print("DIR", d["frames_dir"])
for f in fr:
    print("FILE", f["path"])
PY
    sed 's/^/      | /' "$WORK/check.txt" | grep -v '| FILE' || true
    for k in FRAMES TS TRANSCRIPT; do
      if grep -q "^${k}_OK" "$WORK/check.txt"; then ok "watch.py $k"; else bad "watch.py $k"; fi
    done
    if [ "$CAN_ASSERT_TEXT" = 1 ]; then
      if grep -q '^COTIZ_OK' "$WORK/check.txt"; then ok "watch.py transcript contains 'cotización'"; else bad "watch.py transcript content"; fi
    fi
    big=0
    while IFS= read -r f; do
      wh=$(ffprobe -v error -show_entries stream=width,height -of csv=p=0 "$f")
      w=${wh%,*}; h=${wh#*,}
      if [ "$w" -gt 512 ] || [ "$h" -gt 512 ]; then big=$((big + 1)); fi
    done < <(sed -n 's/^FILE //p' "$WORK/check.txt")
    if [ "$big" = 0 ]; then ok "all frames ≤512px"; else bad "$big frames larger than 512px"; fi
    DIR=$(sed -n 's/^DIR //p' "$WORK/check.txt")
    python3 -I "$WATCH" --cleanup "$DIR" >/dev/null
    if [ ! -e "$DIR" ]; then ok "watch.py temp dir removed by --cleanup"; else bad "watch.py temp dir still there"; fi
  fi

  # 2b) a section (--start/--end) keeps real timestamps
  set +e; python3 -I "$WATCH" --detail visual --start 0:05 --end 0:15 --json -- "$WORK/v.mp4" > "$WORK/s.json" 2>/dev/null; rc=$?; set -e
  if [ "$rc" = 0 ] && python3 -I - "$WORK/s.json" <<'PY2'
import json, shutil, sys
d = json.load(open(sys.argv[1]))
secs = [f["seconds"] for f in d["frames"]]
if d["frames_dir"]:
    shutil.rmtree(d["frames_dir"], ignore_errors=True)
sys.exit(0 if secs and min(secs) >= 4.5 and max(secs) <= 15.5 else 1)
PY2
  then ok "watch.py --start/--end labels frames with the real time"; else bad "watch.py section timestamps (rc=$rc)"; fi

  # 3) transcript-only mode leaves no temp dir at all
  before=$(count_dirs jarvis-watch-)
  set +e; python3 -I "$WATCH" --detail transcript -- "$WORK/v.mp4" >/dev/null 2>&1; rc=$?; set -e
  after=$(count_dirs jarvis-watch-)
  if [ "$rc" = 0 ] && [ "$after" -le "$before" ]; then ok "transcript-only run leaves no temp dir"; else bad "transcript-only temp (rc=$rc)"; fi
fi

# ---- optional online test: captions only, no video download --------------------------------
if [ "${JARVIS_MEDIA_ONLINE:-0}" = 1 ]; then
  if have yt-dlp; then
    set +e; out=$(python3 -I "$WATCH" --detail transcript --lang en -- "https://www.youtube.com/watch?v=jNQXAC9IVRw" 2>&1); rc=$?; set -e
    if [ "$rc" = 0 ] && printf '%s' "$out" | grep -qi 'elephants'; then ok "online captions (no download)"
    else bad "online captions (rc=$rc): $(printf '%s' "$out" | tail -n1)"; fi
  else skip "online test: yt-dlp not installed"; fi
else
  skip "online test (set JARVIS_MEDIA_ONLINE=1)"
fi

printf '\nmedia tests: %d passed, %d failed, %d skipped\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" = 0 ]
