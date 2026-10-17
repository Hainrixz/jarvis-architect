#!/usr/bin/env python3
"""Validate Jarvis TASKS.md files against the one task grammar.

Usage:  python3 -I tests/autonomy/parse_tasks.py [--template] [--json] FILE [FILE ...]

Same grammar as templates/local/jobs/apply-ops.sh and knowledge/capabilities/autonomy.md:

  - [ ] T-0042 · <title 1-80, no '·'> · state:<...> · who:<...> · lvl:<L0-L3> [· key:value]...

Checks per file: every task line (a line starting with "- [" outside an HTML comment) parses,
ids are unique, the checkbox is [x] exactly for done/dropped, optional fields are known, not
repeated and well formed, and the four working sections exist (## Hoy, ## Próximos,
## Esperando a otros, ## Bandeja ...). Without --template, a leftover {{placeholder}} outside a
comment is an error too (validator sweep 10). Exit 0 when every file is valid, 1 otherwise.
--json prints the parsed tasks of each valid file (stdout), for tools that need the same parse.
Standard library only; safe to run with -I.
"""
import json
import re
import sys

STATES = ("inbox", "todo", "doing", "waiting", "needs_ok", "blocked", "done", "dropped")
WHO = ("jarvis", "owner", "other")
LEVELS = ("L0", "L1", "L2", "L3")
KEYS = ("due", "next", "prio", "src", "tries", "dep", "conf")
VRE = {
    "due": r"[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2})?",
    "next": r"[0-9]{4}-[0-9]{2}-[0-9]{2}",
    "prio": r"[1-3]",
    "src": r"(owner/[a-z0-9_-]+|email:sent|email:untrusted|calendar|meeting|media|agent)/[0-9]{4}-[0-9]{2}-[0-9]{2}",
    "tries": r"[0-9]{1,2}",
    "dep": r"T-[0-9]{4}(,T-[0-9]{4})*",
    "conf": r"(0(\.[0-9]+)?|1(\.0+)?)",
}
TITLE_RE = re.compile(r"[^·\s]([^·\n\r]{0,78}[^·\s])?")
LINE_RE = re.compile(
    r"- \[(?P<box>[ x])\] (?P<id>T-[0-9]{4}) · (?P<title>[^·]+) · state:(?P<state>[a-z_]+)"
    r" · who:(?P<who>[a-z]+) · lvl:(?P<lvl>L[0-9])(?P<rest>( · [^·]*)*)"
)
SECTIONS = {
    "hoy": re.compile(r"(Hoy|Today)\b", re.I),
    "prox": re.compile(r"(Próximos|Proximos|Next|Upcoming)\b", re.I),
    "esp": re.compile(r"(Esperando|Waiting)", re.I),
    "bandeja": re.compile(r"(Bandeja|Inbox)", re.I),
}


def parse_line(line):
    """Return (task_dict, None) or (None, reason)."""
    m = LINE_RE.fullmatch(line)
    if not m:
        return None, "does not match the task grammar"
    if not TITLE_RE.fullmatch(m["title"]):
        return None, "title: 1-80 chars, no '·', no edge spaces"
    if m["state"] not in STATES:
        return None, "unknown state " + m["state"]
    if m["who"] not in WHO:
        return None, "unknown who " + m["who"]
    if m["lvl"] not in LEVELS:
        return None, "unknown lvl " + m["lvl"]
    if (m["box"] == "x") != (m["state"] in ("done", "dropped")):
        return None, "checkbox must be [x] exactly when state is done or dropped"
    fields = {}
    rest = m["rest"]
    for item in (rest[3:].split(" · ") if rest else []):
        kv = re.fullmatch(r"([a-z]+):(.+)", item)
        if not kv:
            return None, "bad field '%s'" % item
        key, val = kv.group(1), kv.group(2)
        if key not in KEYS:
            return None, "unknown field " + key
        if key in fields:
            return None, "repeated field " + key
        if not re.fullmatch(VRE[key], val):
            return None, "bad value for " + key
        fields[key] = val
    task = {"id": m["id"], "title": m["title"], "state": m["state"], "who": m["who"], "lvl": m["lvl"]}
    task.update(fields)
    return task, None


def check_file(path, template):
    errors, tasks, seen, found = [], [], set(), set()
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().split("\n")
    except (OSError, UnicodeDecodeError) as exc:
        return ["cannot read: %s" % exc], []
    in_comment = False
    for n, line in enumerate(lines, 1):
        if in_comment:
            if "-->" in line:
                in_comment = False
            continue
        if "<!--" in line:
            in_comment = "-->" not in line.split("<!--")[-1]
            continue
        if not template and "{{" in line:
            errors.append("line %d: leftover placeholder" % n)
        if line.startswith("## "):
            for key, rx in SECTIONS.items():
                if rx.match(line[3:]):
                    found.add(key)
            continue
        if line.startswith("- ["):
            task, reason = parse_line(line)
            if reason:
                errors.append("line %d: %s" % (n, reason))
                continue
            if task["id"] in seen:
                errors.append("line %d: duplicate id %s" % (n, task["id"]))
            seen.add(task["id"])
            tasks.append(task)
    for key in ("hoy", "prox", "esp", "bandeja"):
        if key not in found:
            errors.append("missing section ## %s" % {"hoy": "Hoy", "prox": "Próximos",
                                                       "esp": "Esperando a otros",
                                                       "bandeja": "Bandeja (capturado, sin confirmar)"}[key])
    return errors, tasks


def main(argv):
    template = "--template" in argv
    as_json = "--json" in argv
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        print(__doc__.strip().split("\n\n")[1], file=sys.stderr)
        return 2
    bad = 0
    out = {}
    for path in files:
        errors, tasks = check_file(path, template)
        if errors:
            bad += 1
            for err in errors:
                print("%s: %s" % (path, err), file=sys.stderr)
        else:
            out[path] = tasks
            if not as_json:
                print("%s: OK (%d tasks)" % (path, len(tasks)))
    if as_json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
