#!/usr/bin/env bash
# jobs/apply-ops.sh: apply one autopilot ops block to TASKS.md, all or nothing.
# Canonical copy: templates/local/jobs/apply-ops.sh (rules: knowledge/capabilities/autonomy.md).
# Installed verbatim into every Jarvis that writes TASKS.md through a scheduled job, chmod 700.
#
# Usage: jobs/apply-ops.sh [--dir <jarvis>] [--actor <job>] [--today YYYY-MM-DD] [--ops <file>|-]
#   Reads {"ops":[...],"drafts":[...]} (stdin by default). Validates EVERYTHING first; on any
#   rejection nothing is written. Every applied op and every rejection is one line in
#   logs/audit.jsonl (action autopilot.op / autopilot.reject). Draft bodies and note text are
#   never logged, only their length.
# Exit: 0 applied (or nothing to do) · 2 usage/environment · 3 rejected · 4 lock or conflict ·
#       5 TASKS.md does not parse (fix it in an attended session with the `pending` skill).
# Needs: bash 3.2+, jq with regex support, awk, mktemp. No network, no model, no secrets.
set -euo pipefail

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; }
die() { echo "apply-ops: $2" >&2; exit "$1"; }

DIR="$(cd "$(dirname "$0")/.." && pwd)"   # default: the Jarvis folder (script lives in jobs/)
ACTOR="autopilot"; TODAY=""; OPS_SRC="-"
while [ $# -gt 0 ]; do
  case "$1" in
    (--dir)   [ $# -ge 2 ] || die 2 "--dir needs a value";   DIR="$2"; shift 2;;
    (--actor) [ $# -ge 2 ] || die 2 "--actor needs a value"; ACTOR="$2"; shift 2;;
    (--today) [ $# -ge 2 ] || die 2 "--today needs a value"; TODAY="$2"; shift 2;;
    (--ops)   [ $# -ge 2 ] || die 2 "--ops needs a value";   OPS_SRC="$2"; shift 2;;
    (-h|--help) usage; exit 0;;
    (*) die 2 "unknown argument (see --help)";;
  esac
done
case "$ACTOR" in (""|-*|*[!a-z0-9-]*) die 2 "bad actor name";; esac
[ -n "$TODAY" ] || TODAY="$(date +%Y-%m-%d)"
case "$TODAY" in ([0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;; (*) die 2 "bad --today";; esac
command -v jq >/dev/null 2>&1 || die 2 "jq not found"

if [ "$OPS_SRC" = "-" ]; then OPS_JSON="$(cat)"; else [ -f "$OPS_SRC" ] || die 2 "ops file not found"; OPS_JSON="$(cat "$OPS_SRC")"; fi
cd "$DIR" || die 2 "cannot enter the Jarvis folder"
mkdir -p logs
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

reject_line() {  # one audit line for a rejection decided here in bash (not by the jq rules)
  jq -cn --arg ts "$TS" --arg actor "$ACTOR" --arg reason "$1" \
    '{ts:$ts, source:"apply-ops", actor:$actor, action:"autopilot.reject", reason:$reason, ok:false}' >> logs/audit.jsonl
}

# The only places this script writes: TASKS.md, drafts/T-NNNN.md, tasks/T-NNNN.md, logs/.
# A symlink at any of them could redirect a write (e.g. drafts -> approvals/pending): refuse.
[ -f TASKS.md ] || die 2 "no TASKS.md in $DIR"
[ ! -L logs/audit.jsonl ] || die 3 "logs/audit.jsonl is a symlink; refusing to write through it"
for p in TASKS.md drafts tasks logs; do
  if [ -L "$p" ]; then reject_line "symlink:$p"; die 3 "$p is a symlink; refusing to write through it"; fi
done
[ "${#OPS_JSON}" -le 262144 ] || { reject_line "ops_too_large"; die 3 "ops block larger than 256 KB"; }
printf '%s' "$OPS_JSON" | jq -e 'type == "object"' >/dev/null 2>&1 \
  || { reject_line "bad_json"; die 3 "ops block is not a JSON object"; }

LOCK="logs/.tasks.lock"
mkdir "$LOCK" 2>/dev/null || die 4 "TASKS.md is locked by another writer (logs/.tasks.lock)"
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

ARCHIVED=""
if [ -d tasks/archive ]; then
  ARCHIVED="$(cat tasks/archive/*.md 2>/dev/null | grep -oE 'T-[0-9]{4}' | sort -u | paste -sd, - || true)"
fi
DRAFTS_EXIST="$( (ls drafts 2>/dev/null || true) | jq -R -s -c \
  'split("\n") | map(select(test("^T-[0-9]{4}\\.md$")) | .[0:6])' )"
CK_BEFORE="$(cksum < TASKS.md)"
# `set due` is allowed only when the owner listed the reversible L3 type task.reschedule in
# AGENTS.md § 10 (owner-only file, IRR-07). Read here, never written.
RESCHED=0
if [ -f AGENTS.md ] && [ ! -L AGENTS.md ] && awk '/^## 10[.]/ { p = 1; next } /^## / { p = 0 } p && /task[.]reschedule/ { f = 1 } END { exit !f }' AGENTS.md; then
  RESCHED=1
fi

read -r -d '' PROG <<'JQ' || true
def STATES: ["inbox","todo","doing","waiting","needs_ok","blocked","done","dropped"];
def KEYS: ["due","next","prio","src","tries","dep","conf"];
def VRE: {
  due:   "^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2})?$",
  next:  "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
  prio:  "^[1-3]$",
  src:   "^(owner/[a-z0-9_-]+|email:sent|email:untrusted|calendar|meeting|media|agent)/[0-9]{4}-[0-9]{2}-[0-9]{2}$",
  tries: "^[0-9]{1,2}$",
  dep:   "^T-[0-9]{4}(,T-[0-9]{4})*$",
  conf:  "^(0(\\.[0-9]+)?|1(\\.0+)?)$"
};
def TITLE_RE: "^[^·\\s]([^·\\n\\r]{0,78}[^·\\s])?$";
def LINE_RE: "^- \\[(?<box>[ x])\\] (?<id>T-[0-9]{4}) · (?<title>[^·]+) · state:(?<state>[a-z_]+) · who:(?<who>[a-z]+) · lvl:(?<lvl>L[0-9])(?<rest>( · [^·]*)*)$";
def CANON: {hoy:"## Hoy", prox:"## Próximos", esp:"## Esperando a otros",
            bandeja:"## Bandeja (capturado, sin confirmar)", hecho:"## Hecho"};

def seckey:
  if   test("^(Hoy|Today)\\b"; "i") then "hoy"
  elif test("^(Próximos|Proximos|Next|Upcoming)\\b"; "i") then "prox"
  elif test("^(Esperando|Waiting)"; "i") then "esp"
  elif test("^(Bandeja|Inbox)"; "i") then "bandeja"
  elif test("^(Hecho|Done)\\b"; "i") then "hecho"
  else "other" end;

# Classify every line: comment (inside <!-- -->), heading (## …), task (- [ …), or text.
def annotate:
  . as $L
  | reduce range(0; $L | length) as $i ({out: [], cm: false, sec: "pre"};
      $L[$i] as $t
      | if .cm then
          .out += [{i: $i, kind: "comment", sec: .sec}]
          | (if ($t | contains("-->")) then .cm = false else . end)
        elif ($t | contains("<!--")) then
          .out += [{i: $i, kind: "comment", sec: .sec}]
          | (if ($t | split("<!--") | last | contains("-->")) then . else .cm = true end)
        elif ($t | startswith("## ")) then
          .sec = ($t[3:] | seckey) | .out += [{i: $i, kind: "heading", sec: .sec}]
        elif ($t | startswith("- [")) then
          .out += [{i: $i, kind: "task", sec: .sec}]
        else
          .out += [{i: $i, kind: "text", sec: .sec}]
        end)
  | .out;

def parse_task:
  (first(capture(LINE_RE)) // null) as $m
  | if $m == null then {ok: false, reason: "does not match the task grammar"}
    elif ($m.title | test(TITLE_RE) | not) then {ok: false, reason: "title: 1-80 chars, no '·', no edge spaces"}
    elif (STATES | index($m.state)) == null then {ok: false, reason: "unknown state \($m.state)"}
    elif (["jarvis","owner","other"] | index($m.who)) == null then {ok: false, reason: "unknown who \($m.who)"}
    elif (["L0","L1","L2","L3"] | index($m.lvl)) == null then {ok: false, reason: "unknown lvl \($m.lvl)"}
    elif (($m.box == "x") != ($m.state == "done" or $m.state == "dropped")) then
      {ok: false, reason: "checkbox must be [x] exactly when state is done or dropped"}
    else
      ($m.rest | if . == "" then [] else (.[3:] | split(" · ")) end) as $items
      | (reduce $items[] as $it ({f: {}, err: null};
          if .err != null then .
          else (first($it | capture("^(?<k>[a-z]+):(?<v>.+)$")) // null) as $kv
            | if $kv == null then .err = "bad field '\($it)'"
              elif (KEYS | index($kv.k)) == null then .err = "unknown field \($kv.k)"
              elif .f[$kv.k] != null then .err = "repeated field \($kv.k)"
              elif ($kv.v | test(VRE[$kv.k]) | not) then .err = "bad value for \($kv.k)"
              else .f[$kv.k] = $kv.v end
          end)) as $r
      | if $r.err != null then {ok: false, reason: $r.err}
        else {ok: true, task: {id: $m.id, title: $m.title, state: $m.state, who: $m.who, lvl: $m.lvl, f: $r.f}}
        end
    end;

def ser:
  "- [" + (if .state == "done" or .state == "dropped" then "x" else " " end) + "] " + .id
  + " · " + .title + " · state:" + .state + " · who:" + .who + " · lvl:" + .lvl
  + ([KEYS[] as $k | select(.f[$k] != null) | " · " + $k + ":" + (.f[$k] | tostring)] | join(""));

def target_secs:
  if .state == "inbox" then ["bandeja"]
  elif .state == "waiting" then ["esp"]
  elif .state == "done" or .state == "dropped" then ["hecho"]
  else ["hoy","prox"] end;
def preferred($today):
  if (target_secs | length) == 1 then target_secs[0]
  elif .state == "doing" or .state == "needs_ok" or ((.f.due // "9999-99-99")[0:10] <= $today) then "hoy"
  else "prox" end;

def insert_into($key; $line):
  . as $L | ($L | annotate) as $A
  | ([$A[] | select(.kind == "heading" and .sec == $key) | .i] | first // null) as $h
  | if $h == null then
      ([range(0; $L | length) | select($L[.] != "")] | last // -1) as $lne
      | $L[0:$lne + 1] + ["", CANON[$key], $line] + $L[$lne + 1:]
    else
      ([$A[] | select(.i > $h and .kind == "heading") | .i] | first // ($L | length)) as $end
      | ([range($h + 1; $end) | select($L[.] != "")] | last // $h) as $pos
      | $L[0:$pos + 1] + [$line] + $L[$pos + 1:]
    end;

def E($k; $reason; $target): .errs += [{index: $k, reason: $reason, target: $target}];
def A($obj): .audit += [{ts: $ts, source: "apply-ops", actor: $actor, action: "autopilot.op", ok: true} + $obj];
def isdate: type == "string" and test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$");

def setstate($id; $v; $why):
  .T[$id].state as $from | .T[$id].state = $v | .dirty[$id] = true | .moved[$id] = true
  | A({op: "set", target: $id, field: "state", from: $from, to: $v} + (if $why then {reason: $why} else {} end));

def apply_set($k; $o; $draftids):
  # Ownership, quarantine and closed/waiting-for-owner checks use the task AS READ ($T0), so the
  # order of ops inside one block never matters (e.g. a note after handing a task to the owner).
  ($o | keys - ["op","id","field","value"]) as $extra
  | if ($extra | length) > 0 or ([$o | has("id","field","value")] | all | not) then E($k; "bad_op_shape"; null)
    elif ($o.id | type) != "string" or ($o.id | test("^T-[0-9]{4}$") | not) then E($k; "bad_id"; null)
    elif .T[$o.id] == null then E($k; "unknown_id"; $o.id)
    else
      $o.id as $id | .T[$id] as $t | .T0[$id] as $t0 | $o.field as $f | $o.value as $v
      | if $f == "who" and $t0.who == "owner" and $v == "jarvis" then E($k; "who_owner_to_jarvis"; $id)
        elif $t0.who == "owner" then E($k; "owner_task"; $id)
        elif $t0.state == "inbox" then E($k; "inbox_quarantine"; $id)
        elif $t0.state == "done" or $t0.state == "dropped" then E($k; "closed_task"; $id)
        elif $f == "state" and ($t.state == "done" or $t.state == "dropped") then E($k; "closed_task"; $id)
        elif $t0.state == "needs_ok" and $f != "note" then E($k; "awaiting_owner"; $id)
        elif $t0.state == "blocked" and $f != "note" then E($k; "blocked_task"; $id)
        elif $f == "state" then
          if (["doing","waiting","needs_ok","blocked","done"] | index($v)) == null then E($k; "state_not_allowed"; $id)
          elif $v == "needs_ok" and (["L2","L3"] | index($t.lvl)) == null then E($k; "needs_ok_requires_L2"; $id)
          elif $v == "needs_ok" and ($draftids | index($id)) == null then E($k; "needs_ok_without_preview"; $id)
          elif $v == "done" and $t.lvl != "L1" then E($k; "done_requires_L1"; $id)
          elif $v == "done" and ($draftids | index($id)) == null then E($k; "done_without_draft"; $id)
          else .touched[$id] = true | setstate($id; $v; null) end
        elif $f == "tries" then
          (($t.f.tries // "0") | tonumber) as $cur
          | if ($v | type) != "number" or $v != $cur + 1 then E($k; "tries_must_increase_by_1"; $id)
            elif $v > 3 then E($k; "tries_above_3"; $id)
            else .touched[$id] = true | .T[$id].f.tries = ($v | tostring) | .dirty[$id] = true
              | A({op: "set", target: $id, field: "tries", from: $cur, to: $v})
              | (if $v >= 3 and .T[$id].state != "blocked" then setstate($id; "blocked"; "tries") else . end)
            end
        elif $f == "next" then
          if ($v | isdate | not) then E($k; "bad_date"; $id)
          elif $v < $today then E($k; "next_in_past"; $id)
          else .touched[$id] = true | .T[$id].f.next = $v | .dirty[$id] = true
            | A({op: "set", target: $id, field: "next", from: $t.f.next, to: $v}) end
        elif $f == "note" then
          if ($v | type) != "string" or ($v | length) < 1 or ($v | length) > 300 then E($k; "bad_note"; $id)
          elif ($v | test("[[:cntrl:]]")) then E($k; "bad_note"; $id)
          else .touched[$id] = true | .notes += [{id: $id, title: $t.title, line: "- \($today) \($actor): \($v)"}]
            | A({op: "set", target: $id, field: "note", chars: ($v | length)}) end
        elif $f == "due" then
          if $resched != "1" then E($k; "due_not_allowed"; $id)
          elif ($v | type) != "string" or ($v | test(VRE.due) | not) then E($k; "bad_date"; $id)
          elif $v[0:10] < $today then E($k; "due_in_past"; $id)
          else .touched[$id] = true | .T[$id].f.due = $v | .dirty[$id] = true | .moved[$id] = true
            | A({op: "set", target: $id, field: "due", from: $t.f.due, to: $v}) end
        elif $f == "lvl" then
          if (["L0","L1","L2","L3"] | index($v)) == null then E($k; "bad_lvl"; $id)
          elif $v > $t.lvl then E($k; "lvl_raise"; $id)
          else .touched[$id] = true | .T[$id].lvl = $v | .dirty[$id] = true
            | A({op: "set", target: $id, field: "lvl", from: $t.lvl, to: $v}) end
        elif $f == "who" then
          if $v == "jarvis" then E($k; "who_to_jarvis"; $id)
          elif (["owner","other"] | index($v)) == null then E($k; "bad_who"; $id)
          else .touched[$id] = true | .T[$id].who = $v | .dirty[$id] = true
            | A({op: "set", target: $id, field: "who", from: $t.who, to: $v}) end
        else E($k; "field_not_allowed"; $id) end
    end;

def apply_add($k; $o; $archived):
  ($o | keys - ["op","title","who","lvl","due","next","prio","src","dep","conf"]) as $extra
  | ($o.who // "jarvis") as $who
  | .T as $CT
  | ([KEYS[] as $key | select($key != "src" and $key != "tries" and $o[$key] != null)
      | select(($o[$key] | tostring | test(VRE[$key])) | not)] | length) as $badf
  | if ($extra | length) > 0 then E($k; "bad_op_shape"; null)
    elif (.adds | length) >= 5 then E($k; "too_many_adds"; null)
    elif ($o.title | type) != "string" or ($o.title | test(TITLE_RE) | not) then E($k; "bad_title"; null)
    elif ($o.title | test("<!--|-->|[{][{]|[}][}]")) then E($k; "bad_title"; null)   # would hide lines or fake a placeholder
    elif $o.lvl == "L3" then E($k; "add_lvl_above_L2"; null)
    elif (["L0","L1","L2"] | index($o.lvl)) == null then E($k; "bad_lvl"; null)
    elif (["jarvis","other","owner"] | index($who)) == null then E($k; "bad_who"; null)
    elif $o.src != null and (($o.src | tostring) | startswith("owner/")) then E($k; "add_src_owner"; null)
    elif $o.src != null and (($o.src | tostring) | test(VRE.src) | not) then E($k; "bad_src"; null)
    elif $badf > 0 then E($k; "bad_field"; null)
    elif $o.dep != null and ([$o.dep | split(",")[] | select(. as $d | ($archived | index($d)) == null and $CT[$d] == null)] | length) > 0
      then E($k; "unknown_dep"; null)
    elif .nextnum > 9999 then E($k; "id_space_full"; null)
    else
      ("T-" + ("0000" + (.nextnum | tostring))[-4:]) as $nid
      | .nextnum += 1
      | .T[$nid] = {id: $nid, title: $o.title, state: "inbox", who: $who, lvl: $o.lvl,
                    f: ({src: ($o.src // "agent/\($today)")}
                        + ([KEYS[] as $key | select($key != "src" and $key != "tries" and $o[$key] != null)
                            | {($key): ($o[$key] | tostring)}] | add // {}))}
      | .adds += [$nid]
      | A({op: "add", target: $nid, lvl: $o.lvl, who: $who})
    end;

($tasks | split("\n")) as $L
| ($L | annotate) as $AN
| [$AN[] | select(.kind == "task") | . as $a | ($L[$a.i] | parse_task) + {i: $a.i, sec: $a.sec}] as $P
| [$P[] | select(.ok | not) | "line \(.i + 1): \(.reason)"] as $perr
| ([$P[] | select(.ok) | .task.id] | group_by(.) | map(select(length > 1) | "duplicate id \(.[0])")) as $dups
| if ($perr + $dups | length) > 0 then {ok: false, kind: "parse", errors: ($perr + $dups)}
  else
  ([$P[] | {key: .task.id, value: .task}] | from_entries) as $T
  | ([$P[] | {key: .task.id, value: .i}] | from_entries) as $LINE
  | ([$P[] | {key: .task.id, value: .sec}] | from_entries) as $SEC
  | ($archived | split(",") | map(select(. != ""))) as $ARCH
  | ($in.ops // []) as $O
  | ($in.drafts // []) as $D
  | (([$T | keys[]] + $ARCH) | map(.[2:] | tonumber) | max // 0) as $maxnum
  | {T: $T, T0: $T, errs: [], audit: [], notes: [], adds: [], nextnum: ($maxnum + 1), dirty: {}, moved: {}, touched: {}, drafts: []}
  | (if ($in | keys - ["ops","drafts"] | length) > 0 then E(null; "unknown_top_level_key"; null) else . end)
  | (if ($O | type) != "array" or ($D | type) != "array" then E(null; "ops_and_drafts_must_be_arrays"; null) else . end)
  | if (.errs | length) > 0 then {ok: false, kind: "reject", errors: .errs}
    else
    (if ($O | length) > 30 then E(null; "too_many_ops"; null) else . end)
    # Drafts are validated against the file as read (before ops).
    | reduce range(0; $D | length) as $j (.;
        $D[$j] as $d
        | if ($d | type) != "object" or ($d | keys - ["id","body","path"] | length) > 0 then E("d\($j)"; "bad_draft_shape"; null)
          elif ($d.id | type) != "string" or ($d.id | test("^T-[0-9]{4}$") | not) then E("d\($j)"; "bad_id"; null)
          elif $d.path != null and $d.path != "drafts/\($d.id).md" then E("d\($j)"; "bad_path"; $d.id)
          elif $T[$d.id] == null then E("d\($j)"; "unknown_id"; $d.id)
          elif $T[$d.id].who == "owner" then E("d\($j)"; "owner_task"; $d.id)
          elif $T[$d.id].state == "inbox" then E("d\($j)"; "inbox_quarantine"; $d.id)
          elif $T[$d.id].state == "done" or $T[$d.id].state == "dropped" then E("d\($j)"; "closed_task"; $d.id)
          elif $T[$d.id].state == "needs_ok" then E("d\($j)"; "awaiting_owner"; $d.id)
          elif $T[$d.id].state == "blocked" then E("d\($j)"; "blocked_task"; $d.id)
          elif ($d.body | type) != "string" or ($d.body | length) < 1 or ($d.body | length) > 20000 then E("d\($j)"; "bad_body"; $d.id)
          elif ([.drafts[].id] | index($d.id)) != null then E("d\($j)"; "duplicate_draft"; $d.id)
          else .drafts += [{id: $d.id, body: $d.body}] | .touched[$d.id] = true
            | A({op: "draft", target: $d.id, path: "drafts/\($d.id).md", chars: ($d.body | length)}) end)
    | ([.drafts[].id] + $drafts_exist) as $draftids
    | reduce range(0; $O | length) as $k (.;
        $O[$k] as $o
        | if ($o | type) != "object" then E($k; "op_not_object"; null)
          elif $o.op == "set" then apply_set($k; $o; $draftids)
          elif $o.op == "add" then apply_add($k; $o; $ARCH)
          else E($k; "unknown_op"; null) end)
    | (if (.touched | keys | length) > 3 then E(null; "too_many_tasks_per_run"; null) else . end)
    | if (.errs | length) > 0 then {ok: false, kind: "reject", errors: .errs}
      else
        . as $S
        # 1) regenerate changed lines in place; 2) pull out lines that must change section
        | ([$S.dirty | keys[] | select($LINE[.] != null)]) as $dirty
        | (reduce $dirty[] as $id ($L; .[$LINE[$id]] = ($S.T[$id] | ser))) as $L1
        | [$S.moved | keys[] | select($LINE[.] != null)
            | . as $id | $S.T[$id] as $t
            | select((($t | target_secs | index($SEC[$id])) == null)
                     or ($SEC[$id] == "prox" and ($t | preferred($today)) == "hoy"))
            | {id: $id, i: $LINE[$id], key: ($t | preferred($today))}] as $moves
        | ([$moves[].i]) as $rm
        | [range(0; $L1 | length) | select(. as $x | ($rm | index($x)) == null) | $L1[.]] as $L2
        | (reduce ($moves | sort_by(.i))[] as $mv ($L2; insert_into($mv.key; ($S.T[$mv.id] | ser)))) as $L3
        | (reduce $S.adds[] as $id ($L3; insert_into("bandeja"; ($S.T[$id] | ser)))) as $L4
        | {ok: true, tasks_md: ($L4 | join("\n")), drafts: $S.drafts, notes: $S.notes,
           audit: $S.audit, added: $S.adds, applied: ($S.audit | length)}
      end
    end
  end
JQ

set +e
RES="$(jq -n --rawfile tasks TASKS.md --argjson in "$OPS_JSON" --arg today "$TODAY" --arg actor "$ACTOR" \
  --arg ts "$TS" --arg archived "$ARCHIVED" --arg resched "$RESCHED" --argjson drafts_exist "$DRAFTS_EXIST" "$PROG" 2>&1)"
JRC=$?
set -e
[ "$JRC" -eq 0 ] || { reject_line "internal_error"; die 2 "rule engine failed: $RES"; }

if [ "$(printf '%s' "$RES" | jq -r '.ok')" != "true" ]; then
  KIND="$(printf '%s' "$RES" | jq -r '.kind')"
  if [ "$KIND" = parse ]; then
    reject_line "tasks_md_parse_error"
    printf '%s' "$RES" | jq -r '.errors[] | "apply-ops: TASKS.md " + .' >&2
    exit 5
  fi
  printf '%s' "$RES" | jq -c --arg ts "$TS" --arg actor "$ACTOR" \
    '.errors[] | {ts:$ts, source:"apply-ops", actor:$actor, action:"autopilot.reject", index:.index, reason:.reason, target:.target, ok:false}' >> logs/audit.jsonl
  printf '%s' "$RES" | jq -r '.errors[] | "apply-ops: rejected op \(.index // "-"): \(.reason)\(if .target then " (\(.target))" else "" end)"' >&2
  exit 3
fi

# Someone (owner, panel, pending skill) changed TASKS.md while we computed: write nothing.
[ "$(cksum < TASKS.md)" = "$CK_BEFORE" ] || { reject_line "conflict"; die 4 "TASKS.md changed during apply; nothing written"; }

ND="$(printf '%s' "$RES" | jq '.drafts | length')"
NN="$(printf '%s' "$RES" | jq '.notes | length')"
[ "$ND" -eq 0 ] || { mkdir -p drafts; [ ! -L drafts ] || die 3 "drafts is a symlink"; }
[ "$NN" -eq 0 ] || { mkdir -p tasks; [ ! -L tasks ] || die 3 "tasks is a symlink"; }

i=0
while [ "$i" -lt "$ND" ]; do
  id="$(printf '%s' "$RES" | jq -r ".drafts[$i].id")"
  case "$id" in (T-[0-9][0-9][0-9][0-9]) ;; (*) die 3 "bad draft id";; esac   # defense in depth
  tmp="$(mktemp "drafts/.apply.XXXXXX")"
  printf '%s' "$RES" | jq -j ".drafts[$i].body" > "$tmp"
  printf '\n' >> "$tmp"
  mv -f "$tmp" "drafts/$id.md"
  i=$((i + 1))
done

i=0
while [ "$i" -lt "$NN" ]; do
  id="$(printf '%s' "$RES" | jq -r ".notes[$i].id")"
  case "$id" in (T-[0-9][0-9][0-9][0-9]) ;; (*) die 3 "bad note id";; esac
  tmp="$(mktemp "tasks/.apply.XXXXXX")"
  if [ -f "tasks/$id.md" ] && [ ! -L "tasks/$id.md" ]; then cat "tasks/$id.md" > "$tmp"
  else printf '# %s · %s\n\n' "$id" "$(printf '%s' "$RES" | jq -r ".notes[$i].title")" > "$tmp"; fi
  printf '%s' "$RES" | jq -r ".notes[$i].line" >> "$tmp"
  mv -f "$tmp" "tasks/$id.md"
  i=$((i + 1))
done

tmp="$(mktemp ".TASKS.md.XXXXXX")"
printf '%s' "$RES" | jq -j '.tasks_md' > "$tmp"
mv -f "$tmp" TASKS.md                        # atomic rename on the same filesystem
printf '%s' "$RES" | jq -c '.audit[]' >> logs/audit.jsonl
printf '%s' "$RES" | jq -c '{applied, added}'
