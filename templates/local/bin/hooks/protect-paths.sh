#!/usr/bin/env bash
# bin/hooks/protect-paths.sh: Claude Code PreToolUse hook (matcher "Write|Edit|MultiEdit|NotebookEdit|Bash|Skill").
# Canonical copy: templates/local/bin/hooks/ in Jarvis Architect. Rules: knowledge/capabilities/learning.md,
# AGENTS.md §6, SEC-36 in knowledge/security-checklist.md.
#
# Learning may change LESSONS.md, MEMORY.md, memory/ and proposals/ — never the files that hold the
# owner's rules, permissions, jobs or the learning scripts themselves. Denied for Write/Edit and for
# shell commands that would modify them:
#   SOUL.md AGENTS.md TOOLS.md HEARTBEAT.md CLAUDE.md CLAUDE.local.md .mcp.json mcp.jobs.json
#   .claude/ .agents/ skills/ bin/ jobs/ approvals/ logs/ .git/ panel/ vendor/ voices/ .env*
#   memory/corrections.jsonl* memory/.corrections.lock, any .gitignore / .gitattributes
#   ~/.claude/settings*.json ~/.claude/channels/ ~/.hermes/config.yaml ~/.openclaw/openclaw.json ~/.codex/config.toml
#   the unsandboxed side: ~/.local/share/jarvis-voice/ (speaker engine), ~/.config/systemd/user/,
#   ~/Library/LaunchAgents/, ~/.local/bin/ and the shell profiles
# Live skills change only through `bin/promote-skill.sh` (lint + probation + git) and every learning
# change can be undone with `bin/learn.sh undo`; those two scripts are the only allowed shell entry.
# `promote-skill.sh promote` is allowed only for a proposal that is a single SKILL.md (+ PROPOSAL.md)
# whose frontmatter passes the strict grammar below; `learn.sh weekly/review` belong to the timer.
# LESSONS.md / MEMORY.md writes that carry a permission ("sin preguntar", "allowlist", …) are denied,
# and no write may add an `@path` import to LESSONS.md, MEMORY.md, USER.md or memory/ (they load
# into every session). Both checks compare the whole file before and after the edit.
# Skill tool: a skill on probation is denied in unattended runs; its first attended use ends probation.
# These regex checks are the second line: the OS sandbox (`sandbox.filesystem.denyWrite: ["."]`,
# knowledge/runtimes/claude-code-local.md) is what keeps shell writes out of the workspace.
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
# panel/, vendor/ (source builds such as whisper.cpp) and voices/ hold code or settings that run
# outside the sandbox (the panel service, the speaker), so Jarvis never edits them.
PREFIX = (".claude/", ".agents/", "skills/", "bin/", "jobs/", "approvals/", "logs/", ".git/",
          "panel/", "vendor/", "voices/")
OUTSIDE = [os.path.join(HOME, ".claude", "settings.json"), os.path.join(HOME, ".claude", "settings.local.json"),
           os.path.join(HOME, ".claude", "channels") + os.sep, os.path.join(HOME, ".hermes", "config.yaml"),
           os.path.join(HOME, ".hermes", ".env"), os.path.join(HOME, ".openclaw", "openclaw.json"),
           os.path.join(HOME, ".codex", "config.toml"), os.path.join(HOME, ".codex", "auth.json"),
           # what runs unsandboxed or at login: the speaker engine, service units, ~/.local/bin, profiles
           os.path.join(HOME, ".local", "share", "jarvis-voice") + os.sep,
           os.path.join(HOME, ".config", "systemd", "user") + os.sep,
           os.path.join(HOME, "Library", "LaunchAgents") + os.sep, os.path.join(HOME, ".local", "bin") + os.sep,
           os.path.join(HOME, ".bashrc"), os.path.join(HOME, ".bash_profile"), os.path.join(HOME, ".profile"),
           os.path.join(HOME, ".zshrc"), os.path.join(HOME, ".zprofile")]
WHY = "lo cambia solo el dueño (AGENTS.md §6); las skills nuevas entran con bin/promote-skill.sh"
# validator sweep 15 deny-grep (LESSONS.md) and the narrower memory guard (MEMORY.md)
LESSON_BAD = re.compile(r"allowlist|sin preguntar|without asking|api[ _-]?key|token|permis|aprobaci[oó]n autom", re.I)
MEMORY_BAD = re.compile(r"sin preguntar|without asking|sin (pedir )?(permiso|confirmaci[oó]n)|allowlist|"
                        r"lista de permitidos|aprobaci[oó]n autom", re.I)
# Claude Code memory imports: `@path` at the start of a line or after whitespace (emails don't match)
IMPORT = re.compile(r"(?m)(?:^|\s)@\S")
# frontmatter keys a learned skill may carry (same list as lint L14 in bin/promote-skill.sh)
SKILL_KEYS = ("name", "description", "metadata", "allowed-tools", "disable-model-invocation", "argument-hint",
              "created-by", "license", "source", "version", "probation")
SHELL_PRE = re.compile(r"!`|^\s*```!|^\s*!\s*\S", re.M)   # skill `!` preprocessing (lint L15)

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
    # the corrections ledger with its lock and temp files, and git rules at any depth
    if rel.startswith("memory/corrections.jsonl") or rel == "memory/.corrections.lock" \
            or base in (".gitignore", ".gitattributes"):
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
    rel_w = os.path.relpath(a, ROOT).replace(os.sep, "/") if a.startswith(ROOT + os.sep) else ""
    if kind in ("lessons", "memoryfile") or rel_w.startswith("memory/") or rel_w == "USER.md":
        # Rebuild the file as it will be and check the whole result, not only the new text: two small
        # edits can't assemble an import or split a denied word across them.
        try:
            before = open(a, encoding="utf-8").read()
        except OSError:
            before = ""
        after = before
        if tool == "Write":
            after = ti.get("content") or ""
        else:
            steps = ti.get("edits") if tool == "MultiEdit" else [ti]
            for e in steps or []:
                if not isinstance(e, dict):
                    continue
                old, new = e.get("old_string") or "", e.get("new_string") or ""
                if old and old in after:
                    after = after.replace(old, new) if e.get("replace_all") else after.replace(old, new, 1)
                else:
                    after = after + "\n" + new        # can't place it: check the new text anyway
        # before vs after: the base files already name "allowlist" in their own rules, so only what
        # the edit adds is denied (one more import or one more match).
        grew = lambda rx: len(rx.findall(after)) > len(rx.findall(before))
        if grew(IMPORT):
            deny("la memoria y las lecciones no llevan imports `@ruta` (cargarían otros archivos en cada sesión).")
        if kind == "lessons" and grew(LESSON_BAD):
            deny("una lección nunca da permisos ni toca allowlists, llaves o aprobaciones (AGENTS.md §6).")
        if kind == "memoryfile" and grew(MEMORY_BAD):
            deny("la memoria guarda hechos, no permisos (AGENTS.md §6).")
    # tasks/archive/ only holds tasks that existed (TASKS.md, the archive, tasks/T-NNNN.md): an
    # invented high id would exhaust the autopilot's numbering
    if rel_w.startswith("tasks/archive/"):
        seen = " ".join(os.listdir(os.path.join(ROOT, "tasks"))) if os.path.isdir(os.path.join(ROOT, "tasks")) else ""
        for f in [os.path.join(ROOT, "TASKS.md")] + [os.path.join(ROOT, "tasks", "archive", x) for x in
                                                     (os.listdir(os.path.join(ROOT, "tasks", "archive"))
                                                      if os.path.isdir(os.path.join(ROOT, "tasks", "archive")) else [])]:
            try:
                seen += " " + open(f, encoding="utf-8").read()
            except OSError:
                pass
        top = max([int(x) for x in re.findall(r"T-(\d{4})", seen)] or [0])
        if any(int(x) > top + 1 for x in re.findall(r"T-(\d{4})", new_text(ti))):
            deny("el archivo solo guarda tareas que ya existieron en TASKS.md (id mayor al último).")
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
    args = entry.group(2).split() or [""]
    if entry.group(1) == "promote-skill" and args[0] == "used":
        deny("el periodo de prueba termina solo cuando el dueño usa la skill en vivo (o desde el panel), no por comando.")
    # weekly/review start a paid job with no cap and rewrite LESSONS.md: only the Sunday timer runs them
    if entry.group(1) == "learn" and args[0] in ("weekly", "review"):
        deny("`learn.sh weekly/review` lo corre solo el temporizador del domingo, no Jarvis.")
    # promote-skill runs outside the sandbox: the proposal must be one plain SKILL.md (+ PROPOSAL.md,
    # the evidence the script reads and never installs) with known frontmatter keys and no `!` shell
    # preprocessing. bin/promote-skill.sh lints the same rules (L09, L14, L15) once more.
    if entry.group(1) == "promote-skill" and args[0] == "promote":
        if len(args) < 2 or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args[1]):
            deny("nombre de skill inválido.")
        sk = os.path.join(ROOT, "proposals", "skills", args[1])
        skf, pf = os.path.join(sk, "SKILL.md"), os.path.join(sk, "PROPOSAL.md")
        try:
            entries = os.listdir(sk)
            extra = [e for e in entries if e != "SKILL.md"]
            if "SKILL.md" not in entries or extra not in ([], ["PROPOSAL.md"]) or os.path.islink(sk) \
                    or os.path.islink(skf) or not os.path.isfile(skf) \
                    or (extra and (os.path.islink(pf) or not os.path.isfile(pf))):
                deny("una skill aprendida es solo un SKILL.md (sin carpetas, enlaces, scripts ni otros archivos).")
            body = open(skf, encoding="utf-8").read()
        except OSError:
            deny("no encuentro proposals/skills/<nombre>/SKILL.md.")
        fm = re.match(r"\A---\n(.*?)\n---\n", body, re.S)
        if not fm:
            deny("la propuesta no tiene frontmatter válido.")
        # Strict line grammar: column 0 holds only a known `key:` (once); everything else is indented
        # with spaces and never starts with YAML syntax that builds hidden keys ("hooks":, ? hooks,
        # <<:, {…}, anchors, aliases, tags). Only description may be a block scalar.
        bad, keys = [], []
        for ln in fm.group(1).split("\n"):
            if not ln.strip():
                continue
            if "\t" in ln or "\r" in ln or ln.strip() in ("---", "..."):
                bad.append(ln[:30]); continue
            if not ln.startswith(" "):
                m = re.match(r"([a-z-]+):( |$)", ln)
                if not m or m.group(1) not in SKILL_KEYS or m.group(1) in keys \
                        or (re.match(r"[a-z-]+:\s*[{[&*!|>]", ln) and m.group(1) != "description"):
                    bad.append(ln[:30])
                if m:
                    keys.append(m.group(1))
            elif ln.lstrip()[:1] in ("\"", "'", "?", "<", "{", "[", "&", "*", "!"):
                bad.append(ln[:30])
        if bad or SHELL_PRE.search(body):
            deny("la propuesta trae frontmatter no permitido o preprocesado de shell ("
                 + " | ".join(bad or ["!`"]) + ").")
    sys.exit(0)
# 2. the two media skill scripts, started exactly as their SKILL.md says (the only media entries in
#    settings). Only the script path is exempt: its arguments are still checked below, so an --out
#    into a protected folder or a chained command that touches one is still denied.
media = re.match(r"\s*(?:bash\s+(?:\./)?\.claude/skills/transcribe/scripts/transcribe\.sh"
                 r"|python3\s+-I\s+(?:\./)?\.claude/skills/watch-video/scripts/watch\.py)(?=\s|$)", cmd)
if media and os.path.realpath(cwd) == ROOT:
    cmd = "media-script" + cmd[media.end():]
# 2b. the voice-out script (knowledge/capabilities/voice.md § Speaker), same rule: only running it is
#     exempt; bin/speak.sh itself stays protected from Write/Edit and shell edits.
speak = re.match(r"\s*(?:\./)?bin/speak\.sh(?=\s|$)", cmd)
if speak and os.path.realpath(cwd) == ROOT:
    cmd = "speak-script" + cmd[speak.end():]
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
