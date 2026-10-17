#!/usr/bin/env bash
# bin/learn.sh: the learning ledger. Every learning change is checked, git-committed, audited and undoable.
# Canonical copy: templates/local/bin/ in Jarvis Architect. Rules: knowledge/capabilities/learning.md, SEC-36/37.
#
#   bin/learn.sh close <C-id> <class> <outcome> [ref]   close a captured correction (memory/corrections.jsonl)
#   bin/learn.sh commit <lesson|fact|retire|activate> <ref> [C-id]
#                                    after the model edited LESSONS.md (lesson/retire/activate) or MEMORY.md
#                                    (fact): checks it, commits only that file, audits learning.<kind>.
#                                    A change that carries a permission is reverted (rejected_permission).
#   bin/learn.sh undo [ref]          "deshaz": git-reverts the newest learning commit (or the newest whose
#                                    subject names <ref>: L-0007, C-0031, a skill name) → learning.undo
#   bin/learn.sh review              weekly, deterministic, no model: retires lessons with usos:0 older than
#                                    60 days, retires exact duplicates, expires week-old pending captures,
#                                    lints learned skills (and skills-learned/, where Hermes writes its own),
#                                    commits them, writes memory/weekly/learning-YYYY-Www.md
#   bin/learn.sh weekly              review, then jobs/run-job.sh learning-review (the digest) if present
# Never prints quotes, secrets or file contents beyond ids. Refuses (except undo) when STOP exists.
# bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PY=""
for c in "${JARVIS_PYTHON:-}" /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  [ -n "$c" ] && command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
done
die() { echo "learn: $*" >&2; exit "${2:-1}"; }
[ -n "$PY" ] || die "python3 no encontrado" 2

audit() {  # audit <event> <ref> [sha] [detail]
  mkdir -p logs
  "$PY" -I - "$1" "$2" "${3:-}" "${4:-}" >> logs/audit.jsonl <<'PYEOF'
import json, sys, datetime
ev, ref, sha, extra = sys.argv[1:5]
rec = {"ts": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "event": ev,
       "ref": ref, "actor": "learn.sh"}
if sha: rec["commit"] = sha
if extra: rec["detail"] = extra
print(json.dumps(rec, ensure_ascii=False))
PYEOF
}

need_git() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "la carpeta del Jarvis no es un repo git (paso 1 de questions/4-construir.md)" 2
}
idargs() { [ -n "$(git config user.email 2>/dev/null || true)" ] || printf '%s\n' -c user.name=Jarvis -c user.email=jarvis@localhost; }
git_id() {  # git with a fallback identity when none is configured
  local a; a="$(idargs)"
  if [ -n "$a" ]; then git -c user.name=Jarvis -c user.email=jarvis@localhost "$@"; else git "$@"; fi
}

close_c() {  # close_c <C-id> <class> <outcome> [ref]
  "$PY" -I - "$@" <<'PYEOF'
import json, os, sys, time
cid, cls, outcome = sys.argv[1:4]
ref = sys.argv[4] if len(sys.argv) > 4 else None
CLASSES = {"fact", "preference", "procedure", "mistake", "permission_request", "not_a_correction"}
OUTCOMES = {"lesson", "memory", "skill_draft", "skill", "rejected_permission", "ignored", "pending", "undone", "expired"}
import re
if not re.fullmatch(r"C-\d{4,}", cid) or (cls not in CLASSES and cls != "keep") or outcome not in OUTCOMES:
    print("learn: id, clase o resultado inválido", file=sys.stderr); sys.exit(2)
if ref is not None and not re.fullmatch(r"[A-Za-z0-9._:-]{1,64}", ref):
    print("learn: referencia inválida", file=sys.stderr); sys.exit(2)
L, LOCK = "memory/corrections.jsonl", "memory/.corrections.lock"
if not os.path.exists(L):
    print(f"learn: no existe {L}", file=sys.stderr); sys.exit(2)
for _ in range(100):
    try: os.mkdir(LOCK); break
    except FileExistsError: time.sleep(0.05)
else:
    print("learn: ledger ocupado", file=sys.stderr); sys.exit(2)
try:
    lines = open(L, encoding="utf-8").read().splitlines()
    found = False
    for i, s in enumerate(lines):
        try: r = json.loads(s)
        except Exception: continue
        if r.get("id") == cid:
            if cls != "keep" or not r.get("class"):
                r["class"] = cls if cls != "keep" else ("fact" if outcome == "memory" else "preference")
            r["outcome"] = outcome
            if ref: r["ref"] = ref
            lines[i] = json.dumps(r, ensure_ascii=False); found = True
    if not found:
        print(f"learn: {cid} no existe", file=sys.stderr); sys.exit(2)
    with open(L + ".tmp", "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.replace(L + ".tmp", L)
finally:
    os.rmdir(LOCK)
PYEOF
}

check_change() {  # check_change <kind> <file>: exit 0 ok · 3 permission content · 4 format problem
  local added
  added="$(git diff -U0 HEAD -- "$2" 2>/dev/null | grep -E '^\+[^+]' | cut -c2- || true)"
  [ -n "$added" ] || added="$( [ -n "$(git ls-files -- "$2")" ] || cat "$2" )"
  LEARN_ADDED="$added" "$PY" -I - "$1" "$2" <<'PYEOF'
import os, re, sys
kind, path = sys.argv[1], sys.argv[2]
added = os.environ.get("LEARN_ADDED", "")
if kind == "fact":
    bad = re.compile(r"sin preguntar|without asking|sin (pedir )?(permiso|confirmaci[oó]n)|allowlist|lista de permitidos|aprobaci[oó]n autom", re.I)
else:  # validator sweep 15 deny-grep
    bad = re.compile(r"allowlist|sin preguntar|without asking|api[ _-]?key|token|permis|aprobaci[oó]n autom", re.I)
if bad.search(added):
    sys.exit(3)
text = open(path, encoding="utf-8").read()
text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
problems = []
if kind == "fact":
    for l in added.splitlines():
        if l.startswith("- ") and "[src:" not in l:
            problems.append("hecho sin [src:…]")
else:
    sec, ids, active = None, set(), 0
    fmt = re.compile(r"^- L-\d{4,} · .+ · ámbito:[a-z0-9-]+ · \[src:[^\]]+\] \[\d{4}-\d{2}-\d{2}\] \[ev:(C-\d{4,}|import:[a-z-]+)\]")
    for l in text.splitlines():
        if l.startswith("## "):
            sec = l[3:].strip().lower()
        if not l.startswith("- L-"):
            continue
        m = re.match(r"- (L-\d{4,})", l)
        if m.group(1) in ids: problems.append(f"{m.group(1)} repetida")
        ids.add(m.group(1))
        if not fmt.match(l): problems.append(f"{m.group(1)} sin el formato de LESSONS.md")
        if sec == "activas": active += 1
    if active > 60: problems.append("más de 60 lecciones activas: retira una antes")
if problems:
    print("learn: " + "; ".join(sorted(set(problems))), file=sys.stderr); sys.exit(4)
PYEOF
}

cmd="${1:-}"
case "$cmd" in
  close)
    [ $# -ge 4 ] || die "uso: learn.sh close <C-id> <class> <outcome> [ref]" 2
    close_c "$2" "$3" "$4" ${5+"$5"}
    [ "$4" = rejected_permission ] && audit learning.rejected_permission "$2"
    [ "$4" = ignored ] && audit learning.ignored "$2"
    echo "ok $2 $4" ;;

  commit)
    kind="${2:-}"; ref="${3:-}"; cid="${4:-}"
    [ -f STOP ] && die "STOP activo: no guardo aprendizajes" 3
    case "$kind" in (lesson|retire|activate) file=LESSONS.md;; (fact) file=MEMORY.md;; (*) die "uso: learn.sh commit <lesson|fact|retire|activate> <ref> [C-id]" 2;; esac
    printf '%s' "$ref" | grep -Eq '^[A-Za-z0-9._:-]{1,64}$' || die "referencia inválida" 2
    [ -z "$cid" ] || printf '%s' "$cid" | grep -Eq '^C-[0-9]{4,}$' || die "C-id inválido" 2
    need_git
    [ -f "$file" ] || die "no existe $file" 2
    set +e; check_change "$kind" "$file"; rc=$?; set -e
    if [ "$rc" = 3 ]; then
      if [ -n "$(git ls-files -- "$file")" ]; then git checkout -q HEAD -- "$file"; fi
      [ -n "$cid" ] && close_c "$cid" permission_request rejected_permission
      audit learning.rejected_permission "${cid:-$ref}" "" "$file"
      die "rechazado: lo aprendido nunca da permisos ni toca allowlists, llaves o aprobaciones (AGENTS.md §6). $file quedó como estaba." 3
    fi
    [ "$rc" = 0 ] || exit 4
    git add -- "$file"
    if git diff --cached --quiet -- "$file"; then echo "sin cambios en $file"; exit 0; fi
    msg="learning: $kind $ref"; [ -n "$cid" ] && msg="$msg ($cid)"
    git_id commit -q --no-verify -m "$msg" -- "$file" >/dev/null
    sha="$(git rev-parse --short HEAD)"
    case "$kind" in (lesson) out=lesson;; (fact) out=memory;; (*) out="";; esac
    if [ -n "$cid" ] && [ -n "$out" ]; then close_c "$cid" keep "$out" "$ref"; fi
    audit "learning.$kind" "$ref" "$sha" "${cid:-}"
    echo "ok $ref $sha" ;;

  undo)
    ref="${2:-}"
    [ -z "$ref" ] || printf '%s' "$ref" | grep -Eq '^[A-Za-z0-9._:-]{1,64}$' || die "referencia inválida" 2
    need_git
    target="$("$PY" -I - "$ref" <<'PYEOF'
import re, subprocess, sys
ref = sys.argv[1]
log = subprocess.run(["git", "log", "-n", "300", "--format=%H%x1f%s%x1f%b%x1e"], capture_output=True, text=True).stdout
reverted, cands = set(), []
for entry in log.split("\x1e"):
    parts = entry.strip("\n").split("\x1f")
    if len(parts) < 3: continue
    sha, subj, body = parts
    if not subj.startswith("learning: "): continue
    for m in re.finditer(r"Reverts: ([0-9a-f]{7,40})", body): reverted.add(m.group(1))
    if subj.startswith("learning: undo"): continue
    if subj.startswith("learning: weekly review") and not ref: continue
    cands.append((sha, subj))
for sha, subj in cands:
    if any(sha.startswith(r) or r.startswith(sha) for r in reverted): continue
    if ref and not re.search(r"(^|[\s(])" + re.escape(ref) + r"($|[\s),])", subj): continue
    print(sha + "\t" + subj); break
PYEOF
)"
    [ -n "$target" ] || die "no encontré un aprendizaje para deshacer${ref:+ con «${ref}»}" 4
    sha="${target%%	*}"; subj="${target#*	}"
    if ! git revert --no-commit "$sha" >/dev/null 2>&1; then
      git revert --abort >/dev/null 2>&1 || true
      die "no se pudo deshacer «${subj}» automáticamente (hubo cambios después); ábrelo en el panel o pídeselo al dueño" 5
    fi
    git_id commit -q --no-verify -m "learning: undo ${subj#learning: }" -m "Reverts: $sha" >/dev/null
    new="$(git rev-parse --short HEAD)"
    for c in $(printf '%s' "$subj" | grep -Eo 'C-[0-9]{4,}' || true); do
      close_c "$c" not_a_correction undone 2>/dev/null || true
    done
    # the "deshaz" message itself opened a pending hint:undo record: it is fulfilled now (no Stop nudge)
    for c in $([ -f memory/corrections.jsonl ] && "$PY" -I -c 'import json,sys
for s in open(sys.argv[1], encoding="utf-8"):
    try: r = json.loads(s)
    except Exception: continue
    if r.get("hint") == "undo" and r.get("outcome") == "pending": print(r.get("id", ""))' memory/corrections.jsonl || true); do
      close_c "$c" not_a_correction undone "${ref:-last}" 2>/dev/null || true
    done
    audit learning.undo "${ref:-last}" "$new" "reverts ${sha:0:12}: ${subj#learning: }"
    echo "Deshecho: ${subj#learning: }" ;;

  review)
    [ -f STOP ] && { echo "STOP activo: revisión omitida"; exit 0; }
    need_git
    report="$("$PY" -I - <<'PYEOF'
import datetime, glob, json, os, re, subprocess
now = datetime.datetime.now().astimezone(); today = now.date()
iso = today.isocalendar(); week = "%d-W%02d" % (iso[0], iso[1])
out = [f"# Aprendizaje · semana {week}", "", f"Generado por bin/learn.sh review el {today.isoformat()}. Sin modelo.", ""]
retired = []
if os.path.exists("LESSONS.md"):
    lines = open("LESSONS.md", encoding="utf-8").read().split("\n")
    sec, seen, keep, moved = None, {}, [], []
    norm = lambda s: re.sub(r"\W+", " ", s.lower()).strip()
    for l in lines:
        if l.startswith("## "): sec = l[3:].strip().lower()
        m = re.match(r"- (L-\d{4,}) · (.+?) · ámbito:", l)
        if sec == "activas" and m:
            d = re.search(r"\[(\d{4}-\d{2}-\d{2})\]", l); u = re.search(r"\[usos:(\d+)\]", l)
            old = d and (today - datetime.date.fromisoformat(d.group(1))).days > 60
            if old and (u is None or u.group(1) == "0"):
                moved.append(l + f" [retirada:{today.isoformat()} sin-uso]"); retired.append(m.group(1)); continue
            k = norm(m.group(2))
            if k in seen:
                moved.append(l + f" [retirada:{today.isoformat()} duplicada:{seen[k]}]"); retired.append(m.group(1)); continue
            seen[k] = m.group(1)
        keep.append(l)
    if moved:
        i = next((n for n, l in enumerate(keep) if l.strip().lower() == "## retiradas"), None)
        if i is None:
            keep += ["", "## Retiradas"]; i = len(keep) - 1
        keep[i + 1:i + 1] = moved
        open("LESSONS.md", "w", encoding="utf-8").write("\n".join(keep))
    out.append(f"- Lecciones activas: {len(seen)} · retiradas hoy: {', '.join(retired) or 'ninguna'}")
rows = []
L = "memory/corrections.jsonl"
if os.path.exists(L):
    changed, raw = False, open(L, encoding="utf-8").read().splitlines()
    for i, s in enumerate(raw):
        try: r = json.loads(s)
        except Exception: continue
        try:
            ts = datetime.datetime.fromisoformat(str(r.get("ts") or now.isoformat()).replace("Z", "+00:00"))
            if ts.tzinfo is None: ts = ts.astimezone()
        except ValueError:
            continue                      # one bad line never stops the weekly review
        if r.get("outcome") == "pending" and (now - ts).days >= 7:
            r["outcome"] = "expired"; raw[i] = json.dumps(r, ensure_ascii=False); changed = True
        if (now - ts).days < 7: rows.append(r)
    if changed:
        open(L + ".tmp", "w", encoding="utf-8").write("\n".join(raw) + "\n"); os.replace(L + ".tmp", L)
by = {}
for r in rows:
    k = f"{r.get('class') or r.get('hint')}→{r.get('outcome')}"; by[k] = by.get(k, 0) + 1
out.append(f"- Correcciones de la semana: {len(rows)} ({', '.join(f'{k}: {v}' for k, v in sorted(by.items())) or 'ninguna'})")
rep = sorted({r['id'] for r in rows if r.get('repeat_of') and r.get('outcome') not in ('skill', 'skill_draft', 'undone')})
out.append(f"- Repetidas sin skill todavía: {', '.join(rep) or 'ninguna'}")
learned, prob, lint_fail = [], [], []
for s in sorted(glob.glob("skills/*/SKILL.md")):
    t = open(s, encoding="utf-8", errors="replace").read()
    if not re.search(r"^\s+created-by:\s*agent\s*$", t, re.M): continue
    n = s.split("/")[1]; learned.append(n)
    if os.path.exists(f"skills/{n}/.probation"): prob.append(n)
    rc = subprocess.run(["bin/promote-skill.sh", "lint", f"skills/{n}"], capture_output=True).returncode
    if rc != 0: lint_fail.append(n)
out.append(f"- Skills aprendidas: {', '.join(learned) or 'ninguna'} · en prueba: {', '.join(prob) or 'ninguna'} · fallan el lint: {', '.join(lint_fail) or 'ninguna'}")
nat, nat_fail = [], []
for s in sorted(glob.glob("skills-learned/*/SKILL.md")):          # Hermes skills.create_dir
    n = s.split("/")[1]; nat.append(n)
    env = dict(os.environ, JARVIS_LINT_NATIVE="1")
    if subprocess.run(["bin/promote-skill.sh", "lint", f"skills-learned/{n}"], capture_output=True, env=env).returncode != 0:
        nat_fail.append(n)
if nat:
    out.append(f"- Skills que escribió el runtime (skills-learned/): {', '.join(nat)} · fallan el lint: {', '.join(nat_fail) or 'ninguna'}")
pend = len(glob.glob("proposals/skills/*/SKILL.md"))
out.append(f"- Propuestas esperando (proposals/skills/): {pend}")
home = os.path.expanduser("~")
native = []
u = os.path.join(home, ".hermes", "skills", ".usage.json")
if os.path.exists(u):
    try:
        data = json.load(open(u, encoding="utf-8"))
        items = data.items() if isinstance(data, dict) else []
        ag = sorted(k for k, v in items if isinstance(v, dict) and v.get("created_by") == "agent")
        native.append(f"Hermes: {len(ag)} skills creadas por el agente ({', '.join(ag[:10])})")
    except Exception:
        native.append("Hermes: .usage.json ilegible")
cur = sorted(glob.glob(os.path.join(home, ".hermes", "logs", "curator", "*", "REPORT.md")))
if cur: native.append("Hermes curator: último reporte " + os.path.relpath(cur[-1], home))
pend_h = glob.glob(os.path.join(home, ".hermes", "pending", "skills", "*"))
if pend_h: native.append(f"Hermes: {len(pend_h)} escrituras de skills en espera")
for p in ("DREAMS.md", "workspace/DREAMS.md"):
    if os.path.exists(p): native.append(f"OpenClaw: {p} existe (dreaming debería estar apagado)")
if os.path.isdir(os.path.join(home, ".codex", "memories")): native.append("Codex: ~/.codex/memories existe (memories debería estar apagado)")
out.append("- Memoria nativa: " + ("; ".join(native) if native else "nada que importar"))
os.makedirs("memory/weekly", exist_ok=True)
path = f"memory/weekly/learning-{week}.md"
open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
print(path + "\t" + ",".join(retired))
PYEOF
)"
    path="${report%%	*}"; retired="${report#*	}"
    sha=""
    snap=(LESSONS.md "$path"); [ -d skills-learned ] && snap+=(skills-learned)
    git add -A -- "${snap[@]}" 2>/dev/null || true
    if ! git diff --cached --quiet -- "${snap[@]}" 2>/dev/null; then
      msg="learning: weekly review $(basename "$path" .md)"; [ -n "$retired" ] && msg="$msg retire $retired"
      git_id commit -q --no-verify -m "$msg" -- "${snap[@]}" >/dev/null 2>&1 || true
      sha="$(git rev-parse --short HEAD)"
    fi
    audit learning.review "$(basename "$path" .md)" "$sha" "retired=${retired:-none}"
    echo "$path" ;;

  weekly)
    "$0" review >/dev/null
    if [ -x jobs/run-job.sh ]; then exec jobs/run-job.sh learning-review; fi
    echo "revisión escrita; no hay jobs/run-job.sh para el resumen" ;;

  *) die "uso: learn.sh close|commit|undo|review|weekly (ver cabecera)" 2 ;;
esac
