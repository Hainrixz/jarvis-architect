#!/usr/bin/env bash
# bin/promote-skill.sh: the only way a learned skill goes live. Deterministic: no model involved.
# Canonical copy: templates/local/bin/ in Jarvis Architect. Rules: knowledge/capabilities/learning.md
# § Skills that write themselves, knowledge/capabilities/skills.md § 6, SEC-36.
#
#   bin/promote-skill.sh lint <dir>        lint a skill folder (exit 0 = pass, 1 = fail)
#   bin/promote-skill.sh promote <name>    proposals/skills/<name>/ → live, after lint, on probation,
#                                          git-committed, audited (learning.promote)
#   bin/promote-skill.sh used <name>       first attended use: ends probation (learning.probation_cleared)
#   bin/promote-skill.sh retire <name>     removes a learned skill from the live folders (learning.retire)
#   bin/promote-skill.sh status            learned skills and which are on probation
# Undo any of these: bin/learn.sh undo <name>  (git revert of that learning commit).
#
# Automatic like Hermes (skills.write_approval: false + guard_agent_created: true): no approval
# record is needed for a NEW skill or a new version of a skill Jarvis itself created. Replacing a
# skill the owner or the Architect wrote needs an owner decision from the panel or terminal
# (approvals/decided/promote-<name>-*.json, ≤10 min old), which Jarvis cannot write (protect-paths).
# Never: learn, remember, pending, autopilot (edited by hand only). Refuses with a STOP file, in
# unattended runs (JARVIS_UNATTENDED=1), and past 3 promotions per 24 h.
# Live folders: skills/ plus JARVIS_SKILL_DIRS (relative, space-separated; default ".claude/skills"),
# read from the environment or parsed from .env. Never prints file contents. bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY=""
for c in "${JARVIS_PYTHON:-}" /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  [ -n "$c" ] && command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
done
die() { echo "promote-skill: $*" >&2; exit "${2:-1}"; }
[ -n "$PY" ] || die "python3 no encontrado" 2

PROTECTED_NAMES="learn remember pending autopilot"
MAX_PER_DAY="${JARVIS_MAX_PROMOTIONS_PER_DAY:-3}"

cfg_get() {
  [ -f "$ROOT/.env" ] || return 0
  grep -E "^$1=" "$ROOT/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '\r"' || true
}
SKILL_DIRS="${JARVIS_SKILL_DIRS:-$(cfg_get JARVIS_SKILL_DIRS)}"
SKILL_DIRS="${SKILL_DIRS:-.claude/skills}"

valid_name() { printf '%s' "$1" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$' && [ "${#1}" -le 64 ]; }
valid_reldir() {  # relative, no .., no leading dash, simple characters only
  case "$1" in (""|/*|-*|*..*|*[!A-Za-z0-9._/-]*) return 1;; esac; return 0
}
live_dirs() {
  printf '%s\n' skills
  local d; for d in $SKILL_DIRS; do
    valid_reldir "$d" || die "JARVIS_SKILL_DIRS inválido: $d" 2
    [ "$d" = skills ] || printf '%s\n' "$d"
  done
}

audit() {  # audit <event> <ref> [sha] [extra]: one JSON line in logs/audit.jsonl
  mkdir -p logs
  "$PY" -I - "$1" "$2" "${3:-}" "${4:-}" >> logs/audit.jsonl <<'PYEOF'
import json, sys, datetime
ev, ref, sha, extra = sys.argv[1:5]
rec = {"ts": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "event": ev,
       "ref": ref, "actor": "promote-skill.sh"}
if sha: rec["commit"] = sha
if extra: rec["detail"] = extra
print(json.dumps(rec, ensure_ascii=False))
PYEOF
}

git_commit() {  # git_commit <message> <paths...>: commits only those paths, prints the short sha
  local msg="$1"; shift
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "la carpeta del Jarvis no es un repo git (paso 1 de questions/4-construir.md)" 2
  local p keep=()
  for p in "$@"; do git add -A -- "$p" >/dev/null 2>&1 || true; done
  for p in "$@"; do   # only pathspecs git knows (a never-tracked draft that moved away is skipped)
    if [ -e "$p" ] || [ -n "$(git diff --cached --name-only -- "$p" 2>/dev/null)" ]; then keep+=("$p"); fi
  done
  if [ "${#keep[@]}" -eq 0 ] || git diff --cached --quiet -- "${keep[@]}"; then echo ""; return 0; fi
  local idargs=()
  [ -n "$(git config user.email 2>/dev/null || true)" ] || idargs=(-c user.name=Jarvis -c user.email=jarvis@localhost)
  git ${idargs[@]+"${idargs[@]}"} commit -q --no-verify -m "$msg" -- "${keep[@]}" >/dev/null
  git rev-parse --short HEAD
}

lint() {  # lint <dir> [mode]: prints findings by rule id and file:line, never the matched text
  "$PY" -I - "$1" "$PROTECTED_NAMES" <<'PYEOF'
import os, re, stat, sys
d, protected = sys.argv[1], sys.argv[2].split()
name = os.path.basename(os.path.normpath(d))
errs = []
def err(rule, msg): errs.append(f"{rule} {msg}")
skill = os.path.join(d, "SKILL.md")
if not os.path.isfile(skill):
    print(f"LINT FAIL {name}\nL01 falta SKILL.md"); sys.exit(1)
text = open(skill, encoding="utf-8", errors="replace").read()
m = re.match(r"---\n(.*?)\n---\n", text, re.S)
if not m:
    err("L01", "SKILL.md sin frontmatter YAML entre líneas ---")
    fm, body = "", text
else:
    fm, body = m.group(1), text[m.end():]
def field(k):
    mm = re.search(r"^" + re.escape(k) + r":[ \t]*(.*)$", fm, re.M)
    return mm.group(1).strip().strip("'\"") if mm else None
native = os.environ.get("JARVIS_LINT_NATIVE") == "1"   # skills a runtime wrote itself (Hermes skills-learned/)
# L14: strict frontmatter grammar. This script runs outside the sandbox and the runtime loads every
# key, so a learned skill may carry only known keys (hooks:, model:, context:, agent:, shell: would
# give it powers). Column 0 holds only `key:` once; indented lines never start with YAML syntax that
# builds hidden keys ("hooks":, ? hooks, <<:, {…}, anchors, aliases, tags); only description may be
# a block scalar. Same rules as bin/hooks/protect-paths.sh. Native skills: only the risky keys.
SKILL_KEYS = ("name", "description", "metadata", "allowed-tools", "disable-model-invocation", "argument-hint",
              "created-by", "license", "source", "version", "probation")
RISKY_KEYS = ("hooks", "model", "context", "agent", "shell", "permissions", "permissionMode")
seen_keys = []
for i, ln in enumerate(fm.split("\n"), 2):
    if not ln.strip():
        continue
    if "\t" in ln or "\r" in ln or ln.strip() in ("---", "..."):
        err("L14", f"SKILL.md:{i} frontmatter con tabulador, CR o separador YAML"); continue
    if not ln.startswith(" "):
        k = re.match(r"([A-Za-z-]+):( |$)", ln)
        key = k.group(1) if k else ""
        if native:
            if not k or key in RISKY_KEYS:
                err("L14", f"SKILL.md:{i} clave de frontmatter no permitida")
        elif not k or key not in SKILL_KEYS or key in seen_keys:
            err("L14", f"SKILL.md:{i} clave de frontmatter no permitida o repetida")
        elif re.match(r"[a-z-]+:\s*[{[&*!|>]", ln) and key != "description":
            err("L14", f"SKILL.md:{i} valor YAML con sintaxis no permitida")
        seen_keys.append(key)
    elif not native and ln.lstrip()[:1] in ("\"", "'", "?", "<", "{", "[", "&", "*", "!"):
        err("L14", f"SKILL.md:{i} línea de frontmatter con sintaxis YAML no permitida")
fname = field("name")
if fname != name or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name) or len(name) > 64:
    err("L02", "name debe ser igual a la carpeta (a-z, 0-9, guiones, ≤64)")
if name in protected or name.lower() in ("synced",) or name.startswith("anthropic-skills"):
    err("L02", "nombre reservado: esa skill solo la edita el dueño a mano")
desc = field("description") or ""
if not (1 <= len(desc) <= 1024):
    err("L03", "description vacía o de más de 1024 caracteres")
if not native and not re.search(r"^\s+created-by:\s*agent\s*$", fm, re.M):
    err("L12", "metadata.created-by: agent es obligatorio en una skill aprendida")
# allowed-tools: never shell, writes, bare fetch, wildcards or send/spend tools
at = ""
mm = re.search(r"^allowed-tools:[ \t]*(.*(?:\n[ \t]+-.*)*)", fm, re.M)
if mm:
    at = mm.group(1)
if at and re.search(r"\b(Bash|Write|Edit|MultiEdit|NotebookEdit|PowerShell)\b|\bWebFetch\b(?!\()|\*", at):
    err("L06", "allowed-tools con shell, escritura, WebFetch sin dominio o comodín")
if at and re.search(r"(send|reply|post|publish|pay|charge|transfer|refund|delete|remove|invite|create_invoice|stamp)", at, re.I):
    err("L06", "allowed-tools con una herramienta que envía, publica, paga o borra")
sends = re.search(r"\b(env[ií]a|enviar|env[ií]ale|manda|mandar|m[aá]ndale|publica|publicar|paga|pagar|cobra|cobrar|"
                  r"transfiere|transferir|send|publish|post to|pay|charge|transfer)\b", body, re.I)
if sends and not re.search(r"^disable-model-invocation:\s*true\s*$", fm, re.M):
    err("L07", "la skill envía, publica o paga: necesita disable-model-invocation: true")
total, files = 0, 0
for dp, dns, fns in os.walk(d):
    for n in dns + fns:
        p = os.path.join(dp, n)
        if os.path.islink(p):
            err("L09", f"{os.path.relpath(p, d)}: enlace simbólico no permitido")
    for n in fns:
        p = os.path.join(dp, n); rel = os.path.relpath(p, d)
        files += 1
        st = os.lstat(p); total += st.st_size
        if n == ".probation":
            continue
        if not re.search(r"\.(md|txt|csv|json)$", n) or st.st_mode & (stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH):
            err("L09", f"{rel}: solo texto (.md .txt .csv .json), sin scripts ni ejecutables")
            continue
        t = open(p, encoding="utf-8", errors="replace").read()
        for i, line in enumerate(t.splitlines(), 1):
            if re.search(r"(curl|wget)[^|\n]*\|\s*(ba|z)?sh|irm[^|\n]*\|\s*iex|\bsudo\s|\b(brew|pip3?|pipx|npm|pnpm|yarn|gem|cargo)\s+(install|i|add)\b|\bnpx\s+-y\b", line, re.I):
                err("L04", f"{rel}:{i} instala o descarga y ejecuta código")
            if re.search(r"\b(curl|wget|Invoke-WebRequest|iwr)\b", line, re.I):
                err("L04", f"{rel}:{i} descarga desde la red")
            if re.search(r"sk-ant-[A-Za-z0-9]|sk-[A-Za-z0-9]{20,}|xox[abposr]-|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|"
                         r"\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b|-----BEGIN [A-Z ]*PRIVATE KEY|(?:\d[ -]?){13,19}", line):
                err("L05", f"{rel}:{i} parece un secreto o número de tarjeta/cuenta")
            if re.search(r"allowlist|lista de permitidos|access\.json|\.claude/settings|settings(\.local)?\.json|"
                         r"bypassPermissions|dangerously|--yolo|HERMES_YOLO|write_approval|guard_agent_created|"
                         r"approvals/(pending|decided)|\.env\b|auto[- ]?aprob|auto[- ]?approv|sin preguntar|without asking", line, re.I):
                err("L08", f"{rel}:{i} toca permisos, allowlists, aprobaciones o credenciales")
            if re.search(r"[​-‏‪-‮⁦-⁩﻿]", line):
                err("L10", f"{rel}:{i} caracteres invisibles o de dirección")
            if "<!--" in line:
                err("L10", f"{rel}:{i} comentario HTML (instrucciones ocultas)")
            # L15: `!` preprocessing runs a shell command when the skill loads, before any permission check
            if re.search(r"!`|^\s*```!|^\s*!\s*\S", line):
                err("L15", f"{rel}:{i} preprocesado de shell (!`…`, ```! o línea que empieza con !)")
            if re.search(r"[A-Za-z0-9+/]{120,}={0,2}", line):
                err("L10", f"{rel}:{i} bloque tipo base64")
if text.count("\n") > 500:
    err("L13", "SKILL.md de más de 500 líneas")
if files > 20 or total > 65536:
    err("L13", "más de 20 archivos o 64 KB")
if errs:
    print(f"LINT FAIL {name}"); print("\n".join(sorted(set(errs)))); sys.exit(1)
print(f"LINT OK {name}")
PYEOF
}

is_agent_skill() {  # every live copy was created by Jarvis (metadata created-by: agent); at least one exists
  local d found=1
  for d in $(live_dirs); do
    [ -e "$d/$1" ] || continue
    [ -f "$d/$1/SKILL.md" ] && grep -Eq '^[[:space:]]+created-by:[[:space:]]*agent[[:space:]]*$' "$d/$1/SKILL.md" || return 1
    found=0
  done
  return "$found"
}
exists_live() {  # a skill with that name is live in any skill folder
  local d; for d in $(live_dirs); do [ -e "$d/$1" ] && return 0; done; return 1
}

owner_decided() {  # approvals/decided/promote-<name>-*.json, ≤10 min old, decision approve
  "$PY" -I - "$1" <<'PYEOF'
import glob, json, os, sys, time
for p in sorted(glob.glob(f"approvals/decided/promote-{sys.argv[1]}-*.json")):
    try:
        r = json.load(open(p, encoding="utf-8"))
    except Exception:
        continue
    if time.time() - os.path.getmtime(p) <= 600 and r.get("decision") in ("approve", "approved", "sí", "si", "yes"):
        sys.exit(0)
sys.exit(1)
PYEOF
}

promotions_last_day() {
  [ -f logs/audit.jsonl ] || { echo 0; return; }
  "$PY" -I - <<'PYEOF'
import json, datetime
now = datetime.datetime.now().astimezone(); n = 0
for line in open("logs/audit.jsonl", encoding="utf-8", errors="replace"):
    try:
        r = json.loads(line)
        if r.get("event") == "learning.promote" and now - datetime.datetime.fromisoformat(r["ts"]) < datetime.timedelta(hours=24):
            n += 1
    except Exception:
        pass
print(n)
PYEOF
}

cmd="${1:-}"; name="${2:-}"
case "$cmd" in
  lint)
    if [ -z "$name" ] || [ ! -d "$name" ]; then die "uso: promote-skill.sh lint <carpeta>" 2; fi
    lint "$name" ;;

  promote)
    valid_name "$name" || die "nombre inválido" 2
    [ -f STOP ] && die "STOP activo: no promuevo nada" 3
    [ "${JARVIS_UNATTENDED:-}" = 1 ] && die "ejecución desatendida: las skills nuevas solo entran con el dueño presente" 3
    case " $PROTECTED_NAMES " in (*" $name "*) die "«${name}» solo la edita el dueño a mano" 4;; esac
    src="proposals/skills/$name"
    [ -f "$src/SKILL.md" ] || die "no existe $src/SKILL.md" 2
    if ! out="$(lint "$src")"; then
      printf '%s\n' "$out"
      audit learning.lint_fail "$name" "" "$(printf '%s' "$out" | sed -n '2,$p' | cut -d' ' -f1 | sort -u | paste -sd, -)"
      exit 1
    fi
    if exists_live "$name" && ! is_agent_skill "$name"; then
      owner_decided "$name" || die "«${name}» la escribió el dueño o el Architect: la propuesta queda en $src y se aplica desde el panel (Aprendizajes) o la terminal" 4
    fi
    n="$(promotions_last_day)"
    [ "$n" -lt "$MAX_PER_DAY" ] || die "ya van $n skills nuevas en 24 h; la propuesta espera en $src" 5
    stamp="$(date +%Y-%m-%dT%H%M%S)"
    ev="$(grep -Eo 'C-[0-9]{4,}' "$src/PROPOSAL.md" 2>/dev/null | sort -u | paste -sd, - || true)"
    for d in $(live_dirs); do   # preflight: every live folder writable, or nothing changes (no half promotion)
      probe=""
      { mkdir -p "$d" && probe="$(mktemp "$d/.promote-probe.XXXXXX")"; } 2>/dev/null \
        || die "no puedo escribir en $d (en Claude Code el sandbox protege .claude/skills: bin/promote-skill.sh y bin/learn.sh van en sandbox.excludedCommands de launch-settings.json y headless-settings.json); nada cambió, la propuesta sigue en $src" 6
      rm -f -- "$probe"
    done
    paths=()
    for d in $(live_dirs); do
      mkdir -p "$d"
      rm -rf -- "${d:?}/$name"
      mkdir -p "$d/$name"
      ( cd "$src" && find . -type f ! -name PROPOSAL.md -print ) | while IFS= read -r f; do
        mkdir -p "$d/$name/$(dirname "$f")"; cp -p "$src/$f" "$d/$name/$f"
      done
      printf 'since=%s\nevidence=%s\n' "$stamp" "${ev:-none}" > "$d/$name/.probation"
      paths+=("$d/$name")
    done
    mkdir -p proposals/applied
    mv "$src" "proposals/applied/$name-$stamp"
    paths+=("proposals/applied/$name-$stamp" "$src")
    sha="$(git_commit "learning: promote skill $name" "${paths[@]}")"
    audit learning.promote "$name" "$sha" "probation;evidence=${ev:-none}"
    echo "Skill nueva: $name (en prueba: los trabajos programados no la usan hasta que la uses una vez conmigo). Para quitarla: «deshaz» o bin/learn.sh undo $name" ;;

  used)
    valid_name "$name" || die "nombre inválido" 2
    [ "${JARVIS_UNATTENDED:-}" = 1 ] && die "solo cuenta un uso con el dueño presente" 3
    found=0; paths=()
    for d in $(live_dirs); do
      if [ -f "$d/$name/.probation" ]; then rm -f "$d/$name/.probation"; found=1; paths+=("$d/$name"); fi
    done
    [ "$found" = 1 ] || { echo "«${name}» no está en prueba"; exit 0; }
    sha="$(git_commit "learning: skill $name out of probation" "${paths[@]}")"
    audit learning.probation_cleared "$name" "$sha"
    echo "«${name}» ya puede usarse en trabajos programados." ;;

  retire)
    valid_name "$name" || die "nombre inválido" 2
    is_agent_skill "$name" || die "«${name}» no es una skill aprendida; la retira el dueño a mano" 4
    paths=()
    for d in $(live_dirs); do
      [ -d "$d/$name" ] && { rm -rf -- "${d:?}/$name"; paths+=("$d/$name"); }
    done
    [ "${#paths[@]}" -gt 0 ] || { echo "«${name}» no está en las carpetas vivas"; exit 0; }
    sha="$(git_commit "learning: retire skill $name" "${paths[@]}")"
    audit learning.retire "$name" "$sha"
    echo "Retirada: $name. Para recuperarla: bin/learn.sh undo $name" ;;

  status)
    for s in skills/*/; do
      [ -d "$s" ] || continue
      n="$(basename "$s")"
      is_agent_skill "$n" || continue
      if [ -f "$s/.probation" ]; then echo "$n  en prueba"; else echo "$n  activa"; fi
    done ;;

  *) die "uso: promote-skill.sh lint <carpeta> | promote <nombre> | used <nombre> | retire <nombre> | status" 2 ;;
esac
