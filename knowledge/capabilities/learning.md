# Capability: Learning

> How a Jarvis learns from its owner's corrections, automatically, like Hermes does: facts go to memory, behaviour lessons apply at once with a one-line receipt, repeated procedures become skills on probation, and every change is linted, git-committed, audited and undoable with "deshaz". Three limits never move: learning never touches permissions, it learns only from the owner on an allowlisted channel, and everything is audited and reversible.

Last verified: 2026-10-06

No versions are pinned here. Runtime versions and security floors live in `knowledge/runtimes/*.md`
§ Pinned versions. Memory hygiene is in `knowledge/capabilities/memory.md`, skill rules in
`knowledge/capabilities/skills.md`. Controls map to `SEC-36` and `SEC-37` in
`knowledge/security-checklist.md`.

## Decision rule

Every Jarvis gets the portable loop below. The runtime only changes **how the correction is
caught** and whether a native loop runs next to it.

| Runtime | Capture | Native learning | What the Architect sets |
|---|---|---|---|
| `claude-code-local` · `claude-code-server` | 3 hooks (`capture-correction`, `learn-nudge`, `protect-paths`) + skill `learn` | Auto memory: **off** | Hooks in `.claude/settings.json`, `@LESSONS.md` in `CLAUDE.md`, `autoMemoryEnabled: false` |
| `claude-p-cron` | None: jobs have no conversation, and this runtime ships no hooks (`SEC-24` checks `.hooks == null`). Corrections said in the panel chat, if enabled, go through the skill `learn` | None | `@LESSONS.md` in `CLAUDE.md` (jobs follow the lessons) + the weekly `learning-review` |
| `claude-agent-sdk` | The same 3 hooks as SDK callbacks + skill `learn` | Auto memory: **off** | Callbacks in `guards.ts`, same `CLAUDE.md` |
| `hermes` | Native loop (memory tool, `skill_manage`, nudges, curator) + skill `learn` for lessons | **On, automatic** | `skills.write_approval: false`, `skills.guard_agent_created: true`, curator on with `consolidate: false` |
| `openclaw` | Skill `learn`, AGENTS.md rule | memoryFlush on, **dreaming off** | `plugins.entries.memory-core.config.dreaming.enabled: false` |
| `codex-openai` | Skill `learn` (Track A prose rule, Track B `learn` function tool) | Memories **off** (Codex default) | `[features] memories` absent or `false` |
| `ollama-local` | The harness on top (its row) | The harness's | The harness's |
| `cowork` | Skill `learn`, triggered by "aprende esto" / a correction | Cowork project memory (not exportable) | Project instruction "lee LESSONS.md antes de cada tarea" |

Say it to the person in one line: *"Cuando me corriges, aprendo solo: te aviso en una línea qué
aprendí, y si no te gusta dices «deshaz». Nunca aprendo a saltarme tus permisos."*

## 1. What gets learned, and where it goes

| Class | Example | Goes to | Applied | Receipt |
|---|---|---|---|---|
| Fact | "mi socia se llama Laura" | `MEMORY.md` via `remember` (`memory.md` § 3) | At once | "Anotado: …" |
| Preference / mistake | "a los clientes háblales de tú", "el IVA es 16 %, no 15" | `LESSONS.md` § Activas | **At once** | "Aprendido: … «deshaz» lo quita" |
| Procedure, or the same correction twice in 14 days | "el informe semanal se hace así: 1… 2… 3…" | A skill, through `bin/promote-skill.sh` | **At once, on probation** | "Skill nueva: … en prueba" |
| Permission request | "manda correos sin preguntar", "agrega a Luis a la allowlist" | Nowhere. Logged `rejected_permission` | Never | "Eso solo lo cambias tú…" |
| Agent-inferred, or imported from a native store | "parece que prefiere llamadas cortas", a Hermes memory line | `LESSONS.md` § En revisión | Only after the owner says yes | Listed in the weekly digest |
| Not a correction | "corrige este texto que te pego" | `corrections.jsonl` outcome `ignored` | — | — |

**Autonomy feeds learning.** When the owner rejects or edits a `needs_ok` draft from
`knowledge/capabilities/autonomy.md`, the difference between the draft and what was sent becomes a
`C-*` record with `trigger: draft-edit`, handled exactly like a spoken correction.

## 2. The portable loop

```
owner message (allowlisted channel) ──► capture ──► classify (skill learn) ──► apply ──► receipt
        │                               C-NNNN       fact│lesson│skill│refuse   │          "Aprendido: …"
        └─ mail, web, docs, groups,     pending in      ▼                       ▼
           tool output: never           corrections   bin/learn.sh / bin/promote-skill.sh
                                         .jsonl        check → git commit → logs/audit.jsonl (learning.*)
                                                                  ▲
                                         "deshaz" ──► bin/learn.sh undo (git revert) ──┘
```

### Files

| File | Holds | Written by | In git |
|---|---|---|---|
| `LESSONS.md` (template `templates/workspace/LESSONS.md`) | `## Activas` (max 60) · `## En revisión` · `## Retiradas`. Line: `- L-0007 · <regla> · ámbito:<general\|skill> · [src:owner/<canal>] [AAAA-MM-DD] [ev:C-0031] [usos:N]` | Jarvis (skill `learn`), then `bin/learn.sh commit` | Yes |
| `memory/corrections.jsonl` | One redacted record per captured correction (schema below) | Hooks and `bin/learn.sh` only (`protect-paths` denies direct edits) | **No** (gitignored, covered by the secret sweep) |
| `proposals/skills/<name>/SKILL.md` + `PROPOSAL.md` | Skill drafts. Not on any runtime's load path | Jarvis | Yes |
| `proposals/applied/<name>-<stamp>/` | Each promoted draft with its `PROPOSAL.md` (why, evidence, diff, tools, test steps) | `promote-skill.sh` | Yes |
| `skills/<name>/` + runtime copies (`.claude/skills/`, `.agents/skills/`) | Live skills. A learned one carries `metadata.created-by: agent`; `.probation` while on probation | `promote-skill.sh` only | Yes |
| `memory/weekly/learning-YYYY-Www.md` | Weekly deterministic report | `bin/learn.sh review` | Yes |
| `logs/audit.jsonl` | `{"ts","event":"learning.<x>","ref","actor","commit","detail"}` next to the tool-call lines | Scripts | No (gitignored) |
| `bin/learn.sh`, `bin/promote-skill.sh`, `bin/hooks/*.sh` | The deterministic parts (templates in `templates/local/bin/`) | The Architect | Yes |

`corrections.jsonl` record:

```json
{"id":"C-0031","ts":"2026-10-06T10:00:00-06:00","session":"…","channel":"telegram","actor":"owner",
 "trigger":"regex:correction","hint":"correction","quote":"no, así no: a los clientes tutéalos",
 "class":null,"outcome":"pending","ref":null,"repeat_of":null,"nudged":false}
```

- `hint`: `correction` · `permission_request` · `undo` (from the capture regex).
- `class` (set when closed): `fact` · `preference` · `procedure` · `mistake` · `permission_request` · `not_a_correction`.
- `outcome`: `pending` · `lesson` · `memory` · `skill` · `skill_draft` · `rejected_permission` · `ignored` · `undone` · `expired` (pending for 7 days).
- `quote` ≤ 280 chars, redacted with the `remember` deny-list (keys, tokens, card/CLABE/IBAN, CURP/RFC/DNI-NIE, e-mail, phone).
- `repeat_of`: an earlier correction from the last 14 days with ≥ 50 % word overlap. A repeat is treated as a procedure.

### Capture

- **Owner only.** The hook reads `prompt` from the `UserPromptSubmit` input. Text typed in the local
  session counts as the owner (source `terminal`; a front end such as the panel sets
  `JARVIS_LEARN_SOURCE=panel`). A `<channel source="…">` event counts only when its source is in
  `JARVIS_LEARN_CHANNELS` (default `telegram discord imessage`) and it is a direct message
  (`chat_id` equals `user_id` when both are present). Webhook channels, groups, `<untrusted>` blocks
  and quoted lines (`> …`) never count. A prompt that mixes an allowlisted channel with any other
  source, or whose `<channel>` tags are nested or unbalanced, is skipped whole, so a webhook body
  can't forge an owner event after its own closing tag. The channel plugins drop non-allowlisted senders before
  delivery ([channels-reference](https://code.claude.com/docs/en/channels-reference) § Gate inbound messages).
- **Never unattended.** Scheduled `claude -p` jobs run with `permission_mode: dontAsk`
  (`knowledge/capabilities/scheduling.md`), and the hooks skip that mode and `JARVIS_UNATTENDED=1`.
- **Regex prefilter** (ES/EN, case-insensitive). The model decides the class; the regex only opens a record:
  - correction: `no, así no` · `te dije` · `ya te había dicho` · `prefiero` · `mejor usa/haz` · `no me gusta` · `deja de` · `nunca` · `siempre usa/haz` · `está mal` · `corrige` · `eso no` · `la próxima vez` · `de ahora en adelante` · `a partir de ahora` · `en vez de` · `no vuelvas a` · `te equivocaste` · `not like that` · `I told you` · `I prefer` · `stop doing` · `don't use` · `never …` · `always use` · `that's wrong` · `from now on` · `next time` · `instead of`;
  - permission request (checked first): `sin preguntar` · `sin pedir permiso` · `without asking` · `no me preguntes` · `allowlist` · `lista de permitidos` · `api key` · `contraseña` · `puedes mandar/enviar/pagar/publicar/borrar` · `you can send/pay/post/delete`;
  - undo: a message that starts with `deshaz` / `deshazlo` / `undo` / `revierte eso`.
- **Hook output:** `hookSpecificOutput.additionalContext` names the `C-*` id and the next command.
  It never blocks a prompt (`decision: "block"` is never used) and prints nothing on a miss
  ([hooks](https://code.claude.com/docs/en/hooks) § UserPromptSubmit).
- **Nudge:** the `Stop` hook returns `additionalContext` once per record still `pending` in this
  session, never when `stop_hook_active` is true and never `decision: "block"`
  ([hooks](https://code.claude.com/docs/en/hooks) § Stop).
- Runtimes without hooks get the same effect from the skill `learn` and one line in AGENTS.md § 9.

### Apply, commit, undo

- **Lesson:** the model edits `LESSONS.md`, then runs `bin/learn.sh commit lesson L-0007 C-0031`.
  The script checks the added lines against the sweep-15 deny-grep, the line format, unique ids and
  the 60-line cap. It commits only `LESSONS.md` (`learning: lesson L-0007 (C-0031)`), closes the
  record and appends `learning.lesson` to the audit. A lesson that carries a permission is
  **reverted from git on the spot**, closed `rejected_permission` and audited, exit 3.
- **Fact:** `remember` writes `MEMORY.md`, then `bin/learn.sh commit fact <tema> C-0031`.
- **"deshaz":** `bin/learn.sh undo [L-0007|skill-name|C-0031]` finds the newest learning commit
  (or the newest naming the ref) that was not already reverted, runs `git revert`, commits
  `learning: undo …` with `Reverts: <sha>`, marks the record `undone` and audits `learning.undo`.
  If later edits make the revert conflict, it aborts cleanly and points to the panel.
- **Panel ("Aprendizajes"):** lists lessons, learned skills (probation or active), the digest, and
  offers *deshacer / retirar / activar*. Those buttons call the same two scripts.

## 3. Skills that write themselves (Hermes-style, automatic)

Hermes ships its loop with `skills.write_approval: false` (agent writes go live) and an optional
content scanner, `skills.guard_agent_created`
([Hermes skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills),
[configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration/)). The portable
loop copies that shape: **no approval record for a new learned skill**, a deterministic guard
instead, and probation plus undo as the safety net.

`bin/promote-skill.sh promote <name>`:

1. Refuses with a `STOP` file, with `JARVIS_UNATTENDED=1`, for the reserved names `learn`,
   `remember`, `pending`, `autopilot`, and past 3 promotions in 24 h (`JARVIS_MAX_PROMOTIONS_PER_DAY`).
2. Lints `proposals/skills/<name>/` (table below). Any failure → nothing changes, `learning.lint_fail`.
3. If `skills/<name>` exists and was **not** created by Jarvis (no `created-by: agent`), the new
   version stays a proposal: it goes live only with an owner decision written by the panel or the
   terminal (`approvals/decided/promote-<name>-*.json`, ≤ 10 minutes old). Jarvis cannot write
   `approvals/` (`protect-paths`), so it can improve its own skills alone, never the owner's.
4. Copies the draft (without `PROPOSAL.md`) into `skills/<name>/` and every folder in
   `JARVIS_SKILL_DIRS` (default `.claude/skills`), writes `.probation` in each, moves the draft to
   `proposals/applied/`, commits `learning: promote skill <name>`, audits `learning.promote` with the
   `C-*` evidence, and prints the receipt.

| Lint | Fails when |
|---|---|
| L01 | No `SKILL.md` or no YAML frontmatter |
| L02 | `name` ≠ folder, bad characters, > 64 chars, or a reserved name (`synced`, `anthropic-skills…`, the four above) |
| L03 | `description` empty or > 1024 chars |
| L04 | Any install or download-and-run: `curl … \| sh`, `irm … \| iex`, `sudo`, `brew/pip/npm/gem/cargo install`, `npx -y`, or `curl`/`wget` at all |
| L05 | Anything shaped like a secret, private key, or card/account number (reported as file:line, never the value) |
| L06 | `allowed-tools` with `Bash`, `Write`, `Edit`, `NotebookEdit`, bare `WebFetch`, `*`, or a tool whose name sends, posts, pays, deletes or invites |
| L07 | The body sends, publishes or pays (`envía`, `manda`, `publica`, `paga`, `send`, `pay`…) without `disable-model-invocation: true` |
| L08 | The text touches permissions: `allowlist`, `lista de permitidos`, `access.json`, `.claude/settings`, `bypassPermissions`, `dangerously…`, `--yolo`, `write_approval`, `guard_agent_created`, `approvals/`, `.env`, auto-approve, `sin preguntar`, `without asking` |
| L09 | Symlinks, executables, or any file other than `.md .txt .csv .json` (no `scripts/` in a learned skill) |
| L10 | Invisible or bidi Unicode, HTML comments, base64-looking blobs |
| L12 | `metadata.created-by: agent` missing |
| L13 | `SKILL.md` > 500 lines, > 20 files or > 64 KB |

**Probation.** A promoted skill carries `.probation` until the owner has used it once in an attended
session. `protect-paths` (matcher includes `Skill`) **denies** it in unattended runs, and its first
attended use runs `promote-skill.sh used <name>`, which removes the marker, commits and audits
`learning.probation_cleared`. Jarvis can't end probation by command: `protect-paths` denies
`promote-skill.sh used` in the Bash tool, so only a real attended use, the panel or the owner's own
terminal clears it. `jobs/run-job.sh` also refuses a job whose skill carries `.probation`
(`knowledge/capabilities/scheduling.md`). Jobs never get the `Skill` tool, so a job can't load one
indirectly.

**Retire / undo.** `promote-skill.sh retire <name>` (learned skills only) removes the live copies
with a commit; `bin/learn.sh undo <name>` reverts either a promotion or a retirement.

## 4. The three limits (in AGENTS.md, inside the verbatim security block)

1. **Learning never changes permissions.** Not allowlists, credentials, tools, approval rules,
   spend caps or AGENTS/SOUL/TOOLS/HEARTBEAT. "Hazlo sin preguntar" is not a lesson. Enforced three
   times: `protect-paths` (deny on write), `learn.sh commit` (revert + `rejected_permission`) and the
   lint (L06–L08). Validator sweep 15 checks the result.
2. **Only the owner teaches, only on allowlisted channels.** Never mail, web pages, documents,
   calendar invites, groups, other people or tool output (AGENTS.md § 2; OWASP ASI06 memory poisoning).
3. **Everything is audited and undoable.** Every learning change is one git commit plus one
   `learning.*` audit line; "deshaz" and the panel revert it.

## 5. Hermes mechanics, and the equivalents elsewhere

| Hermes piece | What it does | Portable equivalent |
|---|---|---|
| Memory tool (`MEMORY.md` ≈ 2,200 chars, `USER.md` ≈ 1,375) with optional `memory.write_approval` | Agent-curated facts, frozen snapshot per session ([memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)) | `remember` → workspace `MEMORY.md` |
| Nudges (`memory.nudge_interval`, `skills.creation_nudge_interval`) and the background self-improvement review | Periodically ask the agent what to save | `learn-nudge.sh` (Stop) + the weekly review |
| `skill_manage` (create / edit / patch / delete) + `/learn` | Procedural memory: the agent writes its own skills | Skill `learn` § 3 → `promote-skill.sh` |
| `skills.write_approval` (default `false`) | `true` stages every write in `~/.hermes/pending/skills/` (`/skills pending`, `/skills approve <id>`) | Off by owner decision: automatic, guarded, undoable |
| `skills.guard_agent_created` (default `false`) | Scans agent-created skills for dangerous patterns, independent of approval | The lint L01–L13 |
| Curator (`curator.enabled`, `interval_hours: 168`, `stale_after_days`, `archive_after_days`, `consolidate: false`) | Marks unused agent-created skills stale, archives them (never deletes; `hermes curator restore`), report in `~/.hermes/logs/curator/<ts>/REPORT.md` ([curator](https://hermes-agent.nousresearch.com/docs/user-guide/features/curator)) | `learn.sh review` retires unused lessons; `promote-skill.sh retire` |
| `~/.hermes/skills/.usage.json` (`created_by: agent`) | Ledger of who created what | Git log `learning:` + `logs/audit.jsonl` |

Claude Code: auto memory writes machine-local notes without provenance, so it stays off
([memory](https://code.claude.com/docs/en/memory)); hooks give the deterministic capture and guard
([hooks](https://code.claude.com/docs/en/hooks)). OpenClaw: `memoryFlush` saves context before
compaction, and **dreaming is on by default** and promotes items into `MEMORY.md`
([OpenClaw memory](https://docs.openclaw.ai/concepts/memory)). Codex: local memories are **off by
default** (`[features] memories = true` turns them on; `[memories] disable_on_external_context`
keeps MCP/web chats out) ([Codex memories](https://learn.chatgpt.com/docs/customization/memories)).

## 6. Setup per runtime

### `claude-code-local` · `claude-code-server` · `claude-agent-sdk`

- Copy `templates/local/bin/` into `<jarvis>/bin/` (`chmod 700 bin/*.sh bin/hooks/*.sh`).
- `CLAUDE.md` gains `@LESSONS.md` after `@MEMORY.md`.
- `.claude/settings.json` hooks (merged with the existing `guard.sh` / `audit.sh` entries; the
  exact block is in `runtimes/claude-code-local.md` § Configure):
  ```json
  "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/bin/hooks/capture-correction.sh" } ] } ],
  "Stop":             [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/bin/hooks/learn-nudge.sh" } ] } ],
  "PreToolUse":       [ { "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|Skill",
                          "hooks": [ { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/bin/hooks/protect-paths.sh" } ] } ]
  ```
- `permissions.allow` gains `Edit(./LESSONS.md)`, `Edit(./proposals/**)`, `Write(./proposals/**)`,
  `Bash(./bin/learn.sh *)`, `Bash(./bin/promote-skill.sh *)` (and the same without `./`), and the
  sandbox's `excludedCommands` lists both scripts, because the sandbox write-protects `.claude/skills`. The scripts reject anything but
  plain arguments, and `protect-paths` rejects them when chained with other commands, when run
  from another folder by a relative path, and for `promote-skill.sh used`. It also resolves every
  path in a shell command (bare `skills`, `memory/../skills`, a cwd inside a protected folder) and
  denies shell writes to `LESSONS.md`, so every lesson goes through `Edit` and its content check.
- **Agent SDK:** the same three scripts as callbacks in `guards.ts` (`UserPromptSubmit`, `Stop`,
  `PreToolUse`), passing the hook input as JSON on stdin and returning the parsed stdout.
- `.env.example`: `JARVIS_LEARN_CHANNELS=telegram` (only the owner's channels) and, when the
  runtime copies skills somewhere else, `JARVIS_SKILL_DIRS=.claude/skills`.

### `claude-p-cron`

No live conversation, so no hooks (the runtime's `SEC-24` check expects none). `CLAUDE.md` imports
`LESSONS.md` so every job follows the lessons, `bin/` holds `learn.sh` and `promote-skill.sh` for
the weekly review and for the panel's buttons, and the skill `learn` covers corrections typed in
the panel chat.

### `hermes` (`~/.hermes/config.yaml`, rows owned by `runtimes/hermes.md`)

```yaml
skills:
  write_approval: false          # automatic like Hermes' default (owner decision); lint + probation + undo instead
  guard_agent_created: true      # scan agent-written skills for dangerous patterns (default false)
  create_dir: ~/jarvis-<name>/skills-learned   # agent-written skills land in the git workspace
curator:
  enabled: true
  consolidate: false             # no LLM merge pass; prune/archive only
```

- Keep `memory.write_approval: true` for health, legal and finance profiles and for any Jarvis that
  reads mail or the web (`capabilities/memory.md` § 4).
- `bin/learn.sh review` commits `skills-learned/`, lints each skill there and lists curator
  reports, pending writes and agent-created skills in the digest. Undo a native skill with
  `bin/learn.sh undo <name>` (once committed) or `hermes curator archive <name>` (recoverable with
  `hermes curator restore <name>`).
- Cron prompts written by the Architect name the skills they may use, so a fresh agent skill is not
  picked up by a scheduled run before the owner has used it.

### `openclaw` (`config/openclaw.json5`)

```json5
plugins: { entries: { "memory-core": { config: { dreaming: { enabled: false } } } } },
```

Dreaming promotes notes into `MEMORY.md` with no review, which breaks limit 3. `memoryFlush`
(`agents.defaults.compaction.memoryFlush`) stays on. Workspace `skills/` is the highest-precedence
skill root, so learned skills enter only through `promote-skill.sh` and AGENTS.md § 6.

### `codex-openai`

Leave `[features] memories` unset (off by default). If the owner turns it on, add
`[memories] disable_on_external_context = true` so MCP and web chats never feed memory. Track A
`AGENTS.md` says in prose to read `LESSONS.md` and apply `learn`; Track B adds a `learn` function
tool that calls the two scripts.

### `cowork` · `ollama-local`

Cowork: the skill `learn` alone, with the project instruction "lee LESSONS.md antes de cada tarea;
cuando te corrija, usa la skill learn". No shell: lessons are edited in place and the owner commits.
Ollama: follow the harness on top.

## 7. Weekly job `learning-review`

| Field | Value |
|---|---|
| Schedule | `37 19 * * 0` (Sunday 19:37, after the weekly review at 19:07), owner's local time |
| Entry point | `bin/learn.sh weekly` → deterministic `review`, then `jobs/run-job.sh learning-review` |
| Model slot | `cheap` (`jobs/learning-review.model`) |
| Tools | `Read,Grep,Glob` (`jobs/learning-review.tools`) |
| Budget | `JARVIS_MAX_TURNS=8`, `JARVIS_MAX_BUDGET_USD=0.20` for this job |
| Deterministic part (no model) | Retires `usos:0` lessons older than 60 days and exact duplicates; expires `pending` records older than 7 days; lints learned skills and `skills-learned/`; lists probation; reads native stores (Hermes `.usage.json`, curator `REPORT.md`, `pending/skills`; OpenClaw `DREAMS.md`; `~/.codex/memories`); writes `memory/weekly/learning-YYYY-Www.md`; commits; audits `learning.review` |
| Model part | Reads that report, `LESSONS.md` and the week's `corrections.jsonl`. Flags contradictions between lessons and repeated corrections that still have no skill. Sends ≤ 12 lines, numbered, in the owner's language: "1 ✅ / 2 ❌" for anything that needs a yes |
| May write | `memory/weekly/learning-*.md`, `LESSONS.md` (retirements only), `skills-learned/` (snapshot), `memory/corrections.jsonl` (expiry), `logs/audit.jsonl`. Nothing else |
| Hermes / OpenClaw | Their cron runs the same prompt; the terminal step runs `bin/learn.sh review` first |

`jobs/learning-review.md` (prompt):

```markdown
Eres el resumen semanal de aprendizaje. Lee el archivo más reciente de memory/weekly/learning-*.md,
LESSONS.md y las líneas de memory/corrections.jsonl de los últimos 7 días. No escribas archivos.
1. Di en una línea cuántas lecciones activas hay y cuáles se retiraron hoy (por qué).
2. Señala lecciones que se contradicen (cita sus L-NNNN) y correcciones repetidas sin skill.
3. Lista las skills en prueba y las que fallan el lint.
4. Termina con una lista numerada de lo que necesita un sí del dueño ("1 ✅ / 1 ❌").
Máximo 12 líneas. Si no hay nada, responde solo NADA.
```

## 8. Build-time live checks (each with its fallback)

| Check | How | If it fails |
|---|---|---|
| Channel events fire `UserPromptSubmit` | Send "no, así no: más corto" from the owner's Telegram; `tail -n1 memory/corrections.jsonl` shows `"channel": "telegram"` | Capture still happens through the skill `learn` (AGENTS.md § 9 rule); write it in RUNBOOK.md |
| Telegram meta attributes | The same record exists; a group message adds nothing | Set `JARVIS_LEARN_CHANNELS` to the exact `source` value seen in the session |
| `Skill` tool input key (`protect-paths` reads `skill`, `name` and `command`) | Promote a test skill, use it once, `ls skills/<name>/.probation` is gone | The owner ends probation from the panel (Aprendizajes) or runs `bin/promote-skill.sh used <name>` in their own terminal; `protect-paths` denies that command to Jarvis |
| Stop `additionalContext` | Leave a capture open, end the turn: the model closes it | `learn.sh review` expires it after 7 days; nothing is lost |
| Sandbox lets the scripts write `.claude/skills` (a protected path no `allowWrite` lifts) | `bin/promote-skill.sh promote <test-skill>` from the session prints `Skill nueva:` | Exit 6 = `sandbox.excludedCommands` lacks `bin/promote-skill.sh *` / `bin/learn.sh *` in `launch-settings.json` and `headless-settings.json` (`runtimes/claude-code-local.md` § Notes on both settings files); nothing was half-promoted |
| Sandbox lets `bin/*.sh` write `.git/` | `bin/learn.sh commit lesson …` returns `ok L-… <sha>` | Add the Jarvis folder's `.git` to the sandbox write paths in `launch-settings.json` |
| Hermes keys | `hermes config check` accepts `guard_agent_created`, `create_dir`, `curator` | Drop the unknown key, keep `guard_agent_created`; snapshot `~/.hermes/skills` from `learn.sh review` instead |
| OpenClaw dreaming key | `openclaw doctor` passes and `DREAMS.md` stops growing | `openclaw config get plugins.entries.memory-core` and use the key it shows |

## 9. Verify

```bash
# hooks and scripts present and executable
for f in bin/learn.sh bin/promote-skill.sh bin/hooks/capture-correction.sh bin/hooks/learn-nudge.sh bin/hooks/protect-paths.sh; do test -x "$f" || exit 1; done
# Claude tracks: hooks wired, auto memory off, LESSONS imported
jq -e '.autoMemoryEnabled==false and (.hooks.UserPromptSubmit|length>0) and (.hooks.Stop|length>0)' .claude/settings.json >/dev/null
grep -q '^@LESSONS.md' CLAUDE.md
# no permission content in lessons (sweep 15)
! grep -Eiq 'allowlist|sin preguntar|without asking|api[ _-]?key|token|permis|aprobaci[oó]n autom' LESSONS.md
# every lesson line carries provenance and evidence
! grep -E '^- L-' LESSONS.md | grep -Ev '\[src:[^]]+\] \[[0-9]{4}-[0-9]{2}-[0-9]{2}\] \[ev:(C-[0-9]{4,}|import:[a-z-]+)\]' | grep -q .
# no draft on a live path; every learned skill passes the lint
! grep -rlq 'status: draft' skills .claude/skills 2>/dev/null
for d in skills/*/; do grep -Eq '^[[:space:]]+created-by:[[:space:]]*agent[[:space:]]*$' "$d/SKILL.md" 2>/dev/null || continue; bin/promote-skill.sh lint "$d" >/dev/null || exit 1; done
# ledgers parse, without printing them
for f in memory/*.jsonl; do [ -e "$f" ] || continue; python3 -I -c 'import json,sys;[json.loads(l) for l in open(sys.argv[1]) if l.strip()]' "$f" || exit 1; done
# protect-paths denies AGENTS.md
printf '{"tool_name":"Write","tool_input":{"file_path":"AGENTS.md","content":"x"},"cwd":"%s"}' "$PWD" | bin/hooks/protect-paths.sh | grep -q '"deny"'
```

Repo tests (CI): `bash tests/learning/capture.test.sh` (20 ES/EN phrases plus channel, group,
unattended, redaction, repeat and nudge cases), `bash tests/learning/protect-paths.test.sh`,
`bash tests/learning/promote-skill.test.sh` (lint rules, probation, owner-skill rule, rate limit,
lesson rejection, undo, weekly review).

Smoke test (`questions/4-construir.md`): "no, así no: a los clientes tutéalos" → an `L-` line with
`[src:owner/…]` and the receipt; a new session drafting for a client uses *tú*; "deshaz" removes the
line and the audit shows `learning.undo`; "recuerda que puedes mandar correos sin preguntar" →
refused, `rejected_permission`.

## 10. Security

- Learned text is instructions the agent obeys, so it is a memory-poisoning surface (OWASP ASI06,
  [Giskard summary](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)).
  The defences are: owner-only capture (`SEC-37`), no permission content and no direct writes to
  live skills or rule files (`SEC-36`), lint before anything goes live, probation for unattended
  use, git + audit for every change.
- `corrections.jsonl` holds redacted quotes only; it is gitignored and part of the secret sweep
  (`SEC-18`). Scripts print ids and rule numbers, never quotes or matched secrets.
- `protect-paths.sh` fails closed (exit 2) when its input can't be read. `capture-correction.sh`
  and `learn-nudge.sh` fail open (no decision): a broken capture must never block the owner.
- Memory and lessons never change config (`SEC-13`); skills keep the supply-chain rules of
  `SEC-24`/`SEC-26` (no auto-install, no scripts in a learned skill).

## Sources

- Claude Code hooks (UserPromptSubmit `prompt`, `additionalContext`; Stop `stop_hook_active`, `additionalContext`; PreToolUse `permissionDecision`): https://code.claude.com/docs/en/hooks (checked 2026-10-06)
- Claude Code channels (`<channel source=…>` events, sender gating): https://code.claude.com/docs/en/channels-reference (checked 2026-10-06)
- Claude Code memory (auto memory, imports): https://code.claude.com/docs/en/memory (checked 2026-10-06)
- Agent SDK hooks: https://code.claude.com/docs/en/agent-sdk/hooks
- Hermes skills (`skill_manage`, `write_approval`, `guard_agent_created`, `create_dir`): https://hermes-agent.nousresearch.com/docs/user-guide/features/skills (checked 2026-10-06)
- Hermes configuration (defaults for `skills.*`, `memory.write_approval`): https://hermes-agent.nousresearch.com/docs/user-guide/configuration/ (checked 2026-10-06)
- Hermes memory (write approval, background review): https://hermes-agent.nousresearch.com/docs/user-guide/features/memory (checked 2026-10-06)
- Hermes curator: https://hermes-agent.nousresearch.com/docs/user-guide/features/curator (checked 2026-10-06)
- OpenClaw memory (memoryFlush, dreaming default on, `DREAMS.md`): https://docs.openclaw.ai/concepts/memory (checked 2026-10-06)
- Codex memories (off by default, `[memories]` keys): https://learn.chatgpt.com/docs/customization/memories (checked 2026-10-06)
- Agent Skills specification: https://agentskills.io/specification
- OWASP Top 10 for Agentic Applications 2026 (ASI06): https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026
