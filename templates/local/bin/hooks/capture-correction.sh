#!/usr/bin/env bash
# bin/hooks/capture-correction.sh: Claude Code UserPromptSubmit hook (learning capture).
# Canonical copy: templates/local/bin/hooks/ in Jarvis Architect. Rules: knowledge/capabilities/learning.md.
#
# Reads the hook JSON on stdin (fields: prompt, session_id, permission_mode, cwd).
# When an OWNER message (local terminal, or a <channel> event from an allowlisted chat channel,
# never a group) looks like a correction, it appends a redacted `C-NNNN` record with
# outcome "pending" to memory/corrections.jsonl and returns hookSpecificOutput.additionalContext
# so the model finishes the job with the `learn` skill. It never blocks a prompt, never prints a
# secret, and never runs in unattended jobs (permission_mode dontAsk or JARVIS_UNATTENDED=1).
#
# Config (non-secret, read from the environment, else parsed from .env, never sourced):
#   JARVIS_LEARN_CHANNELS  channel names whose events count as the owner (default "telegram discord imessage")
#   JARVIS_LEARN_SOURCE    set by a non-channel front end (e.g. "panel") to mark its prompts as attended
# bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PY=""
for c in "${JARVIS_PYTHON:-}" /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  [ -n "$c" ] && command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
done
[ -n "$PY" ] || exit 0          # no python: capture is skipped; the learn skill still works by hand

cfg_get() {  # one non-secret key from .env, parsed (never sourced); prints nothing if absent
  [ -f "$ROOT/.env" ] || return 0
  grep -E "^$1=" "$ROOT/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '\r"' || true
}
LEARN_CHANNELS="${JARVIS_LEARN_CHANNELS:-$(cfg_get JARVIS_LEARN_CHANNELS)}"
export LEARN_CHANNELS="${LEARN_CHANNELS:-telegram discord imessage}"
export JARVIS_ROOT="$ROOT"

read -r -d '' PYCODE <<'PYEOF' || true
import json, os, re, sys, time, datetime, unicodedata

ROOT = os.environ["JARVIS_ROOT"]
LEDGER = os.path.join(ROOT, "memory", "corrections.jsonl")
LOCK = os.path.join(ROOT, "memory", ".corrections.lock")

try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
prompt = d.get("prompt") or ""
mode = d.get("permission_mode") or ""
session = str(d.get("session_id") or "")[:80]
src_override = re.sub(r"[^a-z0-9_-]", "", os.environ.get("JARVIS_LEARN_SOURCE", "").lower())[:24]

if os.environ.get("JARVIS_UNATTENDED") == "1":
    sys.exit(0)
if mode in ("dontAsk", "bypassPermissions") and not src_override:
    sys.exit(0)  # scheduled `claude -p` jobs run in dontAsk: never learn from them

channels = [c for c in re.split(r"[\s,]+", os.environ.get("LEARN_CHANNELS", "").lower()) if c]

def owner_text(t):
    # drop quoted / fenced third-party content: only the owner's own words count (AGENTS.md §2)
    t = re.sub(r"<untrusted>.*?</untrusted>", " ", t, flags=re.S | re.I)
    t = "\n".join(l for l in t.splitlines() if not l.lstrip().startswith(">"))
    return t.strip()

segments = []
tags = list(re.finditer(r"<channel\s+([^>]*)>(.*?)</channel>", prompt, re.S))
opens = len(re.findall(r"<channel[\s>]", prompt)); closes = prompt.count("</channel>")
if tags and (opens != len(tags) or closes != len(tags)):
    sys.exit(0)                           # nested or unbalanced tags: someone may be forging an owner event
if tags:
    for m in tags:
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        source = attrs.get("source", "").lower()
        if not next((c for c in channels if c in source), None):
            sys.exit(0)                   # a webhook / unknown channel shares this prompt: a forged tag could
                                          # follow its body, so nothing in this prompt teaches Jarvis
    for m in tags:
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        source = attrs.get("source", "").lower()
        name = next((c for c in channels if c in source), None)
        chat, user = attrs.get("chat_id"), attrs.get("user_id")
        if attrs.get("chat_type", "private") not in ("private", "dm", "direct"):
            continue                      # groups never teach Jarvis
        if chat and user and chat != user:
            continue                      # Telegram: a DM has chat_id == user_id
        segments.append((name, owner_text(m.group(2))))
elif "<channel" not in prompt:
    segments.append((src_override or "terminal", owner_text(prompt)))

UNDO = re.compile(r"^\s*(deshaz(lo)?|desh[aá]z(lo)?|undo( that| it)?|revierte (eso|lo [uú]ltimo)|"
                  r"olvida lo que (acabas de aprender|aprendiste))\b", re.I)
PERMISSION = re.compile(
    r"(sin (preguntar(me)?|pedir(me)? (permiso|confirmaci[oó]n)|avisar(me)?|mi (ok|aprobaci[oó]n))|"
    r"without (asking|confirmation|my (ok|approval))|no (me )?(preguntes|pidas (permiso|confirmaci[oó]n))|"
    r"don'?t (ask|wait for)( me| my)?|no need to ask|"
    r"\b(allowlist|lista de permitidos|api[ _-]?keys?|tokens? de|contrase[nñ]a|password)\b|"
    r"(puedes|tienes permiso (de|para)|est[aá]s autorizad[oa] (a|para)) (mandar|enviar|pagar|publicar|borrar|cobrar|transferir)|"
    r"you (can|may|are allowed to) (send|pay|post|publish|delete|charge|transfer))", re.I)
CORRECTION = re.compile(
    r"\b(no,? as[ií] no|as[ií] no|te dije|ya te (hab[ií]a )?dicho|prefiero|mejor (usa|haz|as[ií]|pon)|"
    r"no me gusta|deja de|nunca (m[aá]s )?|siempre (usa|haz|pon|escribe)|est[aá] mal|corrige|eso no|"
    r"la pr[oó]xima vez|de ahora en adelante|a partir de ahora|en vez de|en lugar de|no vuelvas a|"
    r"no uses|no pongas|te equivocaste|"
    r"no,? not like that|not like that|i told you|i('ve| have)? already (told|said)|i prefer|"
    r"(please )?stop (doing|using|adding|writing|calling)|don'?t (ever )?(use|do|write|add|say|call)|"
    r"never (use|do|write|add|say|again)|always (use|do|write|add)|that'?s (wrong|not right|incorrect)|"
    r"from now on|next time|instead of|you got (it|that) wrong)\b", re.I)

def redact(s):
    s = re.sub(r"sk-[A-Za-z0-9_\-]{8,}", "[redactado]", s)
    s = re.sub(r"\b(xox[abposr]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{20,})", "[redactado]", s)
    s = re.sub(r"\b[0-9]{8,10}:[A-Za-z0-9_-]{30,}", "[redactado]", s)                    # bot tokens
    s = re.sub(r"(?i)\b(password|contrase[nñ]a|clave|token|api[ _-]?key)\s*[:=]\s*\S+", r"\1: [redactado]", s)
    s = re.sub(r"\b[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]\b", "[redactado]", s)        # CURP
    s = re.sub(r"\b[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}\b", "[redactado]", s)                  # RFC
    s = re.sub(r"\b[XYZ]?[0-9]{7,8}[A-Z]\b", "[redactado]", s)                             # DNI / NIE
    s = re.sub(r"\b[A-Z]{2}[0-9]{2}(?: ?[A-Z0-9]{4}){3,7}\b", "[redactado]", s)            # IBAN
    s = re.sub(r"(?:\d[ -]?){12,19}", "[redactado] ", s)                                   # cards, CLABE, accounts
    s = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[correo]", s)
    s = re.sub(r"\+?\d[\d ()-]{8,}\d", "[teléfono]", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= 280 else s[:279] + "…"

def words(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return set(w for w in re.findall(r"[a-z]{3,}", s))

def load():
    out = []
    try:
        with open(LEDGER, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        out.append(json.loads(line))
                    except Exception:
                        pass
    except FileNotFoundError:
        pass
    return out

hits = []
for chan, text in segments:
    if not text or text.startswith("/"):
        continue
    if UNDO.search(text):
        hits.append((chan, text, "undo", "undo"))
    elif PERMISSION.search(text):
        hits.append((chan, text, "permission_request", "regex:permission"))
    elif CORRECTION.search(text):
        hits.append((chan, text, "correction", "regex:correction"))
if not hits:
    sys.exit(0)

os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
for _ in range(60):                     # tiny mkdir lock: hooks of two sessions never interleave ids
    try:
        os.mkdir(LOCK); break
    except FileExistsError:
        time.sleep(0.05)
else:
    sys.exit(0)
notes = []
try:
    rows = load()
    nxt = 1 + max([int(r["id"][2:]) for r in rows if str(r.get("id", "")).startswith("C-") and r["id"][2:].isdigit()] or [0])
    now = datetime.datetime.now().astimezone()
    cutoff = now - datetime.timedelta(days=14)
    with open(LEDGER, "a", encoding="utf-8") as f:
        for chan, text, hint, trigger in hits:
            quote = redact(text)
            cid = "C-%04d" % nxt; nxt += 1
            repeat_of = None
            if hint == "correction":
                w = words(quote)
                for r in reversed(rows):
                    try:
                        ts = datetime.datetime.fromisoformat(r.get("ts", ""))
                    except Exception:
                        continue
                    if ts < cutoff or r.get("hint") != "correction" or r.get("outcome") in ("ignored", "undone"):
                        continue
                    o = words(r.get("quote", ""))
                    if w and o and len(w & o) / len(w | o) >= 0.5:
                        repeat_of = r.get("id"); break
            rec = {"id": cid, "ts": now.isoformat(timespec="seconds"), "session": session,
                   "channel": chan, "actor": "owner", "trigger": trigger, "hint": hint,
                   "quote": quote, "class": None, "outcome": "pending", "ref": None,
                   "repeat_of": repeat_of, "nudged": False}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            if hint == "undo":
                notes.append(f"{cid}: {chan} pidió DESHACER. Corre `bin/learn.sh undo` (o `bin/learn.sh undo <L-id|skill>` si nombró algo), "
                             f"responde «Deshecho: …» en una línea y cierra con `bin/learn.sh close {cid} not_a_correction undone`.")
            elif hint == "permission_request":
                notes.append(f"{cid}: parece una petición de AMPLIAR PERMISOS. No es una lección (AGENTS.md §6): no la guardes; "
                             f"explica en una línea que solo el dueño cambia AGENTS.md/TOOLS.md o usa /jarvis-add, y cierra con "
                             f"`bin/learn.sh close {cid} permission_request rejected_permission`.")
            else:
                extra = f" Es la 2.ª vez en 14 días (igual a {repeat_of}): trátala como procedimiento → skill." if repeat_of else ""
                notes.append(f"{cid}: posible corrección de {chan}.{extra} Usa la skill `learn`: hecho→remember; preferencia/error→LESSONS.md "
                             f"+ `bin/learn.sh commit lesson <L-id> {cid}`; procedimiento→proposals/skills/<nombre>/ + "
                             f"`bin/promote-skill.sh promote <nombre>`; si no era corrección: `bin/learn.sh close {cid} not_a_correction ignored`.")
finally:
    os.rmdir(LOCK)

ctx = "Jarvis aprendizaje (memory/corrections.jsonl): " + " | ".join(notes) + \
      " Avisa al dueño en UNA línea («Aprendido: …»)."
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": ctx}}, ensure_ascii=False))
PYEOF

# Never block or break the owner's prompt: any internal error ends as "no decision".
"$PY" -I -c "$PYCODE" 2>/dev/null || exit 0
exit 0
