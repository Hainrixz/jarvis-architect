#!/usr/bin/env bash
# transcribe.sh: voice note or recording -> text, local first (whisper.cpp + ffmpeg).
# Part of the Jarvis `transcribe` skill (templates/skills-base/transcribe/SKILL.md).
# Rules: knowledge/capabilities/multimodal.md, SEC-38. bash 3.2 compatible (macOS).
#
# Usage:
#   transcribe.sh [--kind note|recording] [--lang es] [--src owner/<canal>|untrusted/<origen>]
#                 [--engine local|cloud] [--out FILE] [--delete-input] -- <audio-file>
#
# Env (names only; values live in the Jarvis .env):
#   JARVIS_WHISPER_MODEL   path to the GGML model (default: the first of models/ggml-large-v3-turbo-q5_0.bin,
#                          ggml-small.bin, ggml-base-q5_1.bin that exists; .env is unreadable in the sandbox)
#   JARVIS_DIR             Jarvis folder (default: current directory)
#   JARVIS_STT_LANG        default language (default: es)
#   JARVIS_STT_CLOUD       groq | openai | off (default off). Set only when spec §3 says stt: cloud.
#   JARVIS_STT_CLOUD_MODEL vendor model ID, written by the Architect after a live check
#   JARVIS_SENSITIVE_PACK  1 when a sensitive pack (health, legal, minors) is active: cloud is refused
#   GROQ_API_KEY / OPENAI_API_KEY  only read when JARVIS_STT_CLOUD selects that vendor
#
# Exit codes: 0 ok · 2 usage/refused input · 3 missing tool or model · 4 engine failure.
# Never installs anything, never prints secrets, never keeps audio in the workspace.

set -euo pipefail
umask 077

die() { code=$1; shift; printf 'transcribe: %s\n' "$*" >&2; exit "$code"; }

# Claude Code's Bash tool does not load .env, so read the few names this script uses from
# $JARVIS_DIR/.env when they are not already set. Plain NAME=value lines only; never sourced.
dotenv() {
  name=$1
  cur=${!name:-}
  [ -z "$cur" ] || return 0
  f="${JARVIS_DIR:-.}/.env"
  [ -f "$f" ] || return 0
  val=$(grep -E "^${name}=" "$f" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//') || true
  [ -z "$val" ] || export "$name=$val"
}
for v in JARVIS_WHISPER_MODEL JARVIS_STT_LANG JARVIS_STT_CLOUD JARVIS_STT_CLOUD_MODEL JARVIS_SENSITIVE_PACK; do
  dotenv "$v"
done

KIND=note
LANG_CODE=${JARVIS_STT_LANG:-es}
SRC=untrusted/desconocido
ENGINE=local
OUT=
DELETE_INPUT=0
IN=

while [ $# -gt 0 ]; do
  case "$1" in
    --kind|--lang|--src|--engine|--out) [ $# -ge 2 ] || die 2 "falta el valor de $1" ;;
  esac
  case "$1" in
    --kind) KIND=${2:-}; shift 2 ;;
    --lang) LANG_CODE=${2:-}; shift 2 ;;
    --src) SRC=${2:-}; shift 2 ;;
    --engine) ENGINE=${2:-}; shift 2 ;;
    --out) OUT=${2:-}; shift 2 ;;
    --delete-input) DELETE_INPUT=1; shift ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    --) shift; IN=${1:-}; shift || true; break ;;
    -*) die 2 "opción desconocida: $1" ;;
    *) IN=$1; shift ;;
  esac
done
[ $# -eq 0 ] || die 2 "sobran argumentos después del archivo"
[ -n "$IN" ] || die 2 "falta el archivo de audio (uso: transcribe.sh [opciones] -- archivo)"

case "$KIND" in note|recording) ;; *) die 2 "--kind debe ser note o recording" ;; esac
case "$ENGINE" in local|cloud) ;; *) die 2 "--engine debe ser local o cloud" ;; esac
printf '%s' "$LANG_CODE" | grep -Eq '^([a-z]{2}|auto)$' || die 2 "--lang inválido"
printf '%s' "$SRC" | grep -Eq '^(owner|untrusted)/[a-z0-9._-]{1,40}$' || die 2 "--src inválido"
case "$OUT" in -*|*..*) die 2 "--out inválido" ;; esac

# --- 1. The input: a regular local file, never a URL, never an option-looking name -------------
case "$IN" in
  -*) die 2 "nombre de archivo que empieza con '-': rechazado" ;;
  *://*) die 2 "solo archivos locales; para enlaces usa la skill watch-video" ;;
esac
if [ ! -f "$IN" ] || [ -L "$IN" ]; then die 2 "no existe o no es un archivo normal: $IN"; fi

TMP=
cleanup_input() {
  if [ "$DELETE_INPUT" = 1 ] && [ -f "$IN" ]; then rm -f -- "$IN"; fi
}
# Runs on every exit, success or failure: temp dir gone, input audio gone when --delete-input.
cleanup_all() {
  if [ -n "$TMP" ]; then rm -rf -- "$TMP"; fi
  cleanup_input
}
trap cleanup_all EXIT
trap 'exit 130' INT TERM

# --- 2. MIME allowlist + size and duration limits ----------------------------------------------
MIME=$(file --mime-type -b -- "$IN" 2>/dev/null || echo unknown)
case "$MIME" in
  audio/ogg|audio/opus|audio/mpeg|audio/mp3|audio/mp4|audio/x-m4a|audio/m4a|audio/aac|audio/x-hx-aac-adts|\
  audio/wav|audio/x-wav|audio/vnd.wave|audio/aiff|audio/x-aiff|audio/webm|audio/flac|audio/x-flac|\
  video/mp4|video/quicktime|video/webm|application/ogg) ;;
  *) die 2 "tipo de archivo no permitido ($MIME). Solo audio o video comunes" ;;
esac

BYTES=$(wc -c < "$IN" | tr -d ' ')
if [ "$KIND" = note ]; then MAX_BYTES=$((20 * 1024 * 1024)); MAX_SECS=600
else MAX_BYTES=$((500 * 1024 * 1024)); MAX_SECS=3600; fi
[ "$BYTES" -le "$MAX_BYTES" ] || die 2 "archivo demasiado grande ($BYTES bytes; máximo $MAX_BYTES para $KIND)"

for t in ffmpeg ffprobe; do
  command -v "$t" >/dev/null 2>&1 || die 3 "falta $t. Instálalo tú con: brew install ffmpeg (Windows: winget install Gyan.FFmpeg)"
done

DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 -protocol_whitelist file "file:$IN" 2>/dev/null | head -n1 || true)
DUR=${DUR%%.*}
case "$DUR" in ''|*[!0-9]*) die 2 "no pude leer la duración: el archivo no parece audio válido" ;; esac
if [ "$DUR" -gt "$MAX_SECS" ]; then
  if [ "$KIND" = note ]; then die 2 "nota de más de 10 minutos: vuelve a llamar con --kind recording"
  else die 2 "grabación de más de 60 minutos: córtala en partes primero"; fi
fi

# --- 3. Temp dir outside the workspace, always removed -----------------------------------------
TMP=$(mktemp -d "${TMPDIR:-/tmp}/jarvis-stt.XXXXXX")

# 16 kHz mono PCM; recordings are cut into 10-minute parts so memory stays flat.
if [ "$KIND" = recording ] && [ "$DUR" -gt 600 ]; then
  ffmpeg -nostdin -hide_banner -loglevel error -protocol_whitelist file -i "file:$IN" -vn -ar 16000 -ac 1 -c:a pcm_s16le \
    -f segment -segment_time 600 "$TMP/part_%03d.wav" || die 4 "ffmpeg no pudo convertir el audio"
else
  ffmpeg -nostdin -hide_banner -loglevel error -protocol_whitelist file -i "file:$IN" -vn -ar 16000 -ac 1 -c:a pcm_s16le \
    "$TMP/part_000.wav" || die 4 "ffmpeg no pudo convertir el audio"
fi

# --- 4. Speech to text -------------------------------------------------------------------------
TEXT="$TMP/transcript.txt"
: > "$TEXT"

run_local() {
  command -v whisper-cli >/dev/null 2>&1 || die 3 "falta whisper-cli. Instálalo tú con: brew install whisper.cpp"
  MODEL=${JARVIS_WHISPER_MODEL:-}
  if [ -z "$MODEL" ]; then  # .env is unreadable inside the Claude Code sandbox: take the pinned models in order
    for m in ggml-large-v3-turbo-q5_0.bin ggml-small.bin ggml-base-q5_1.bin; do
      MODEL="${JARVIS_DIR:-.}/models/$m"; [ -f "$MODEL" ] && break
    done
  fi
  [ -f "$MODEL" ] || die 3 "falta el modelo de Whisper en $MODEL (ver RUNBOOK.md § Medios para descargarlo)"
  for wav in "$TMP"/part_*.wav; do
    base=${wav%.wav}
    # The Claude Code sandbox blocks Metal (GPU): on failure, retry once on the CPU (-ng).
    whisper-cli -m "$MODEL" -l "$LANG_CODE" -nt -np -otxt -of "$base" -f "$wav" >/dev/null 2>"$TMP/whisper.err" \
      || whisper-cli -ng -m "$MODEL" -l "$LANG_CODE" -nt -np -otxt -of "$base" -f "$wav" >/dev/null 2>"$TMP/whisper.err" \
      || die 4 "whisper-cli falló: $(tail -n 2 "$TMP/whisper.err" | tr -d '\r')"
    cat "$base.txt" >> "$TEXT"
  done
}

run_cloud() {
  [ "${JARVIS_SENSITIVE_PACK:-0}" != 1 ] || die 2 "hay un paquete sensible activo: la transcripción en la nube está prohibida (CMP-39). Usa --engine local"
  vendor=${JARVIS_STT_CLOUD:-off}
  case "$vendor" in
    groq) url=https://api.groq.com/openai/v1/audio/transcriptions; keyvar=GROQ_API_KEY ;;
    openai) url=https://api.openai.com/v1/audio/transcriptions; keyvar=OPENAI_API_KEY ;;
    *) die 2 "la nube no está autorizada en la spec (JARVIS_STT_CLOUD=$vendor). Usa --engine local" ;;
  esac
  model=${JARVIS_STT_CLOUD_MODEL:-}
  [ -n "$model" ] || die 3 "falta JARVIS_STT_CLOUD_MODEL en .env"
  dotenv "$keyvar"
  key=${!keyvar:-}
  [ -n "$key" ] || die 3 "falta $keyvar en .env"
  command -v curl >/dev/null 2>&1 || die 3 "falta curl"
  hdr="$TMP/auth.hdr"
  printf 'Authorization: Bearer %s\n' "$key" > "$hdr"   # header file, so the key never shows in `ps`
  key=
  # --form-string: a value starting with @ or < is sent as text, never read as a file.
  form=(--form-string "model=$model" --form-string "response_format=text")
  [ "$LANG_CODE" = auto ] || form+=(--form-string "language=$LANG_CODE")   # no field = vendor autodetects
  for wav in "$TMP"/part_*.wav; do
    curl -fsS --max-time 300 -H @"$hdr" -F "file=@$wav" "${form[@]}" "$url" >> "$TEXT" 2>"$TMP/curl.err" \
      || die 4 "el servicio de transcripción falló (detalle sin secretos: $(sed 's/Bearer [^ ]*/Bearer ***/g' "$TMP/curl.err" | tail -n1))"
    printf '\n' >> "$TEXT"
  done
  rm -f -- "$hdr"
}

if [ "$ENGINE" = cloud ]; then run_cloud; else run_local; fi

# --- 5. Mark provenance (owner voice note vs. untrusted media) ---------------------------------
# Strip any tag-like text the speaker could use to break out of the wrapper.
BODY=$(sed -e 's/^[[:space:]]*//' -e 's/<\/*[A-Za-z_]*media[^>]*>//g' "$TEXT" | awk 'NF' )
[ -n "$BODY" ] || BODY="(sin voz reconocible)"
case "$SRC" in
  owner/*) OPEN="<media_transcript src=\"$SRC\" kind=\"$KIND\" seconds=\"$DUR\">"; CLOSE="</media_transcript>" ;;
  *) OPEN="<untrusted_media src=\"$SRC\" kind=\"$KIND\" seconds=\"$DUR\">"; CLOSE="</untrusted_media>" ;;
esac

if [ -n "$OUT" ]; then
  mkdir -p -- "$(dirname -- "$OUT")"
  { printf '%s\n%s\n%s\n' "$OPEN" "$BODY" "$CLOSE"; } > "$OUT"
  printf 'Transcripción guardada en %s (%s s de audio)\n' "$OUT" "$DUR"
else
  printf '%s\n%s\n%s\n' "$OPEN" "$BODY" "$CLOSE"
fi

# --- 6. Audit (no content, no file names) ------------------------------------------------------
AUDIT=${JARVIS_AUDIT_LOG:-${JARVIS_DIR:-.}/logs/audit.jsonl}
if [ -d "$(dirname "$AUDIT")" ]; then
  printf '{"ts":"%s","source":"transcribe","action":"media.transcribe","engine":"%s","kind":"%s","seconds":%s,"src":"%s","deleted_input":%s,"ok":true}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ENGINE" "$KIND" "$DUR" "${SRC%%/*}" \
    "$([ "$DELETE_INPUT" = 1 ] && echo true || echo false)" >> "$AUDIT" 2>/dev/null || true
fi
# Deleting the input audio (--delete-input) happens in the EXIT trap, also on failure.
