#!/usr/bin/env bash
# bin/hooks/protect-paths.sh: Claude Code PreToolUse hook (matcher "Write|Edit|MultiEdit|NotebookEdit|Bash|Skill").
# Canonical copy: templates/local/bin/hooks/ in Jarvis Architect. Rules: knowledge/capabilities/learning.md,
# AGENTS.md §6, SEC-36 in knowledge/security-checklist.md.
#
# Learning may change LESSONS.md, MEMORY.md, memory/ and proposals/ — never the files that hold the
# owner's rules, permissions, jobs or the learning scripts themselves. Denied for Write/Edit and for
# shell commands that would modify them:
#   SOUL.md AGENTS.md TOOLS.md HEARTBEAT.md CLAUDE.md CLAUDE.local.md .mcp.json mcp.jobs.json
#   .claude/ .agents/ skills/ bin/ jobs/ approvals/ logs/ .git/ .env* memory/corrections.jsonl
#   ~/.claude/settings*.json ~/.claude/channels/ ~/.hermes/config.yaml ~/.openclaw/openclaw.json ~/.codex/config.toml
# Live skills change only through `bin/promote-skill.sh` (lint + probation + git) and every learning
# change can be undone with `bin/learn.sh undo`; those two scripts are the only allowed shell entry.
# LESSONS.md / MEMORY.md writes that carry a permission ("sin preguntar", "allowlist", …) are denied.
# Skill tool: a skill on probation is denied in unattended runs; its first attended use ends probation.
# Output: hookSpecificOutput.permissionDecision "deny" + reason, or nothing (no decision).
# Fails closed: unreadable input or no python → exit 2 (blocks the tool call). bash 3.2 compatible.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PY=""
for c in "${JARVIS_PYTHON:-}" /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 python3; do
  [ -n "$c" ] && command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }
done
[ -n "$PY" ] || { echo "protect-paths: python3 no encontrado; bloqueado por seguridad" >&2; exit 2; }
export JARVIS_ROOT="$ROOT"

read -r -d '' PYCODE <<'PYEOF' || true
import json, os, re, subprocess, sys

ROOT = os.path.realpath(os.environ["JARVIS_ROOT"])
HOME = os.path.realpath(os.path.expanduser("~"))

def deny(reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                      "permissionDecisionReason": "Jarvis protect-paths: " + reason}}, ensure_ascii=False))
    sys.exit(0)

try:
    d = json.load(sys.stdin)
except Exception:
    print("protect-paths: entrada ilegible; bloqueado por seguridad", file=sys.stderr)
    sys.exit(2)

tool = d.get("tool_name") or ""
ti = d.get("tool_input") or {}
cwd = d.get("cwd") or ROOT
mode = d.get("permission_mode") or ""
unattended = os.environ.get("JARVIS_UNATTENDED") == "1" or mode in ("dontAsk", "bypassPermissions")

EXACT = {"SOUL.md", "AGENTS.md", "TOOLS.md", "HEARTBEAT.md", "CLAUDE.md", "CLAUDE.local.md",
         ".mcp.json", "mcp.jobs.json", "memory/corrections.jsonl"}
PREFIX = (".claude/", ".agents/", "skills/", "bin/", "jobs/", "approvals/", "logs/", ".git/")
OUTSIDE = [os.path.join(HOME, ".claude", "settings.json"), os.path.join(HOME, ".claude", "settings.local.json"),
           os.path.join(HOME, ".claude", "channels") + os.sep, os.path.join(HOME, ".hermes", "config.yaml"),
           os.path.join(HOME, ".hermes", ".env"), os.path.join(HOME, ".openclaw", "openclaw.json"),
           os.path.join(HOME, ".codex", "config.toml"), os.path.join(HOME, ".codex", "auth.json")]
WHY = "lo cambia solo el dueño (AGENTS.md §6); las skills nuevas entran con bin/promote-skill.sh"
# validator sweep 15 deny-grep (LESSONS.md) and the narrower memory guard (MEMORY.md)
LESSON_BAD = re.compile(r"allowlist|sin preguntar|without asking|api[ _-]?key|token|permis|aprobaci[oó]n autom", re.I)
MEMORY_BAD = re.compile(r"sin preguntar|without asking|sin (pedir )?(permiso|confirmaci[oó]n)|allowlist|"
                        r"lista de permitidos|aprobaci[oó]n autom", re.I)

def resolve(p):
    p = os.path.expanduser(str(p))
    if not os.path.isabs(p):
        p = os.path.join(cwd, p)
    return os.path.realpath(p)            # resolves ../ and symlinks of existing parents

def classify(abs_path):
    """'protected' | 'lessons' | 'memoryfile' | None"""
    for o in OUTSIDE:
        if abs_path == o.rstrip(os.sep) or (o.endswith(os.sep) and abs_path.startswith(o)):
            return "protected"
    if abs_path != ROOT and not abs_path.startswith(ROOT + os.sep):
        return None
    rel = os.path.relpath(abs_path, ROOT).replace(os.sep, "/")
    base = rel.rsplit("/", 1)[-1]
    if rel in EXACT or rel.startswith(PREFIX) or rel + "/" in PREFIX or base.startswith(".env"):
        return "protected"
    if rel == "LESSONS.md":
        return "lessons"
    if rel == "MEMORY.md":
        return "memoryfile"
    return None

def new_text(t):
    parts = [t.get("content"), t.get("new_string"), t.get("new_source")]
    for e in t.get("edits") or []:
        if isinstance(e, dict):
            parts.append(e.get("new_string"))
    return "\n".join(p for p in parts if isinstance(p, str))

if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
    p = ti.get("file_path") or ti.get("notebook_path") or ti.get("path")
    if not p:
        sys.exit(0)
    a = resolve(p)
    kind = classify(a)
    if kind == "protected":
        deny(f"{os.path.relpath(a, ROOT) if a.startswith(ROOT) else p} {WHY}.")
    if kind == "lessons" and LESSON_BAD.search(new_text(ti)):
        deny("una lección nunca da permisos ni toca allowlists, llaves o aprobaciones (AGENTS.md §6). "
             "Registra la petición con `bin/learn.sh close <C-id> permission_request rejected_permission`.")
    if kind == "memoryfile" and MEMORY_BAD.search(new_text(ti)):
        deny("la memoria guarda hechos, no permisos (AGENTS.md §6).")
    sys.exit(0)

if tool == "Skill":
    name = str(ti.get("skill") or ti.get("name") or ti.get("command") or "").strip().lstrip("/")
    name = name.split(":")[-1].split()[0] if name else ""
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name or "-"):
        sys.exit(0)
    on_probation = any(os.path.exists(os.path.join(ROOT, d_, name, ".probation"))
                       for d_ in ("skills", ".claude/skills", ".agents/skills"))
    if not on_probation:
        sys.exit(0)
    if unattended:
        deny(f"la skill «{name}» está en periodo de prueba: no corre sin el dueño presente hasta su primer uso en vivo.")
    script = os.path.join(ROOT, "bin", "promote-skill.sh")
    if os.access(script, os.X_OK):
        subprocess.run([script, "used", name], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=30, check=False)
    sys.exit(0)

if tool != "Bash":
    sys.exit(0)

cmd = str(ti.get("command") or "")
r = re.escape(ROOT)
# 1. the two learning entry points, alone, with plain arguments only. `promote-skill.sh used` is not
#    one of them: probation ends only through a real attended Skill call (below) or the owner's panel.
entry = re.fullmatch(r"\s*(?:\./|" + r + r"/)?bin/(promote-skill|learn)\.sh((?:\s+[A-Za-z0-9._:-]+)*)\s*", cmd)
if entry and (os.path.realpath(cwd) == ROOT or cmd.strip().startswith(ROOT + "/")):
    if entry.group(1) == "promote-skill" and (entry.group(2).split() or [""])[0] == "used":
        deny("el periodo de prueba termina solo cuando el dueño usa la skill en vivo (o desde el panel), no por comando.")
    sys.exit(0)
# 2. the two media skill scripts, started exactly as their SKILL.md says (the only media entries in
#    settings). Only the script path is exempt: its arguments are still checked below, so an --out
#    into a protected folder or a chained command that touches one is still denied.
media = re.match(r"\s*(?:bash\s+(?:\./)?\.claude/skills/transcribe/scripts/transcribe\.sh"
                 r"|python3\s+-I\s+(?:\./)?\.claude/skills/watch-video/scripts/watch\.py)(?=\s|$)", cmd)
if media and os.path.realpath(cwd) == ROOT:
    cmd = "media-script" + cmd[media.end():]
# 3. the panel's API is the owner's (resume the autopilot, approve, undo): never from Jarvis's shell
if re.search(r"(?i)x-jarvis-panel|/api/(autopilot|tasks|learning|approvals|memory|jobs|chat|login)\b", cmd):
    deny("la API del panel es solo para el dueño (reanudar el piloto, aprobar, deshacer): ábrelo tú en el panel.")

B = r"(?:^|(?<=[\s'\"=<>|;&(]))"            # token boundary (not after '/', so proposals/skills/ is fine)
mentions = []
for name in sorted(EXACT):
    if re.search(r"(?:^|(?<=[\s'\"=<>|;&(/]))(?:\./)?" + re.escape(name) + r"(?![\w.-])", cmd):
        mentions.append(name)
for pre in PREFIX:
    if re.search(B + r"(?:\./)?" + re.escape(pre), cmd) or re.search(r + "/" + re.escape(pre), cmd):
        mentions.append(pre)
if re.search(B + r"(?:\S*/)?\.env\b", cmd):
    mentions.append(".env")
for o in OUTSIDE:
    tail = o.replace(HOME, "~", 1).rstrip("/")
    if tail in cmd or o.rstrip("/") in cmd or tail.replace("~", "$HOME", 1) in cmd:
        mentions.append(tail)
stop_only = re.search(B + r"(?:\./)?STOP(?:_AUTOPILOT)?\b", cmd)
# every path-like token, resolved against the hook's cwd: catches bare `skills`, `bin`, `.claude`,
# `memory/../skills/x`, `--file=AGENTS.md` and relative paths typed while cwd is inside a protected folder
import shlex
lessons_shell = False
try:
    toks = shlex.split(cmd, comments=False, posix=True)
except ValueError:
    toks = cmd.split()
for tok in toks:
    for cand in [tok] + tok.split("=")[1:]:
        if not cand or cand.startswith("-") or re.search(r"[*?\[\]{}$`]", cand) and "/" not in cand:
            continue
        k = classify(resolve(cand))
        if k == "protected":
            mentions.append(os.path.relpath(resolve(cand), ROOT) if resolve(cand).startswith(ROOT) else cand)
        elif k == "lessons":
            lessons_shell = True
cwd_rel = classify(os.path.realpath(cwd) + os.sep + "x") if os.path.realpath(cwd) != ROOT else None
if cwd_rel == "protected":
    mentions.append("cwd " + os.path.relpath(os.path.realpath(cwd), ROOT))

def read_only(c):
    c = re.sub(r"\s(?:\d?>\s*/dev/null|\d?>&\d)", " ", c)
    if re.search(r"[;`>]|&&|\|\||\$\(|<\(|\n", c):
        return False
    first_ok = {"cat", "head", "tail", "less", "more", "grep", "egrep", "rg", "wc", "ls", "diff", "stat",
                "file", "shasum", "sha256sum", "md5", "jq", "test", "["}   # test/[: lock checks (AGENTS.md § 9)
    pipe_ok = {"grep", "egrep", "rg", "head", "tail", "wc", "sort", "uniq", "cut", "tr", "jq", "cat", "less"}
    for i, seg in enumerate(c.split("|")):
        w = seg.strip().split()
        if not w:
            return False
        if w[0] == "git" and i == 0:
            if len(w) < 2 or w[1] not in ("log", "show", "diff", "status", "blame"):
                return False
            if any(a.startswith("--output") or a in ("--ext-diff", "-o") for a in w[2:]):
                return False
            continue
        if w[0] not in (first_ok if i == 0 else pipe_ok):
            return False
        # flags that make a "reader" write a file or run a program
        if w[0] == "sort" and any(a.startswith("-o") or a.startswith("--output") for a in w[1:]):
            return False
        if w[0] == "rg" and any(a.startswith("--pre") for a in w[1:]):
            return False
    return True

if lessons_shell and not mentions and not read_only(cmd):
    deny("LESSONS.md se cambia con Edit (así se revisa cada lección) y luego `bin/learn.sh commit`, no desde la terminal.")
if mentions:
    if not read_only(cmd):
        deny(f"este comando modificaría {', '.join(sorted(set(mentions)))}: {WHY}.")
    sys.exit(0)
if stop_only and re.search(r"\b(rm|mv|unlink|rmdir|git)\b", cmd):
    deny("el interruptor STOP / STOP_AUTOPILOT solo lo quita el dueño.")
# git commands that rewrite workspace files or history, run in this folder
if not re.search(r"(?:^|[;&|]\s*)cd\s|\s-C\s", cmd) and re.search(
        r"(?:^|[;&|]\s*)git\s+(reset|checkout|restore|stash|clean|revert|rebase|filter-branch|filter-repo|"
        r"update-ref|am|apply|cherry-pick|commit\s+.*--amend|push\s+.*(-f\b|--force))", cmd):
    deny("git que reescribe archivos o historial del workspace: para deshacer un aprendizaje usa `bin/learn.sh undo`.")
sys.exit(0)
PYEOF

if ! "$PY" -I -c "$PYCODE"; then
  echo "protect-paths: error interno; bloqueado por seguridad" >&2
  exit 2
fi
exit 0
