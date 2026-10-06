# Capability: Memory

> How a Jarvis remembers: a plain-markdown workspace is the source of truth on every runtime. Vector or graph stores are optional indexes built from it, added only when the profile needs them.

Last verified: 2026-10-06

## Decision rule

Apply the rows top to bottom. Each row adds to the ones above it and replaces none of them.

| If… | Then the memory slot is… | Why (one line for the person) |
|---|---|---|
| Always, every runtime | **Markdown workspace**: `SOUL.md` · `USER.md` · `MEMORY.md` · `HEARTBEAT.md` · `AGENTS.md` · `TOOLS.md` + `memory/` | You can read it, edit it and take it with you if you switch runtimes later |
| Runtime is `claude-code-local`, `claude-code-server` or `claude-p-cron` | + `CLAUDE.md` that imports the workspace files, and Claude Code **auto memory** pointed into the workspace | Claude Code loads these files every session without extra setup |
| Runtime is `claude-agent-sdk` | + the same `CLAUDE.md` (the SDK loads it by default); the **memory tool** (`memory_20250818`) only for a custom app that calls the Messages API directly | Same files as Claude Code, no database needed |
| Runtime is `hermes` or `openclaw` | + the runtime's **built-in memory**, seeded from the workspace and synced back into it every week | Their own memory works well, and the workspace keeps it portable |
| `MEMORY.md` passes ~200 lines, **or** more than one channel, **or** it has to search **across many** of the person's documents (reading one PDF the person names is a plain file read, no index), and the host is local | + **sqlite-vec** index (one file, derived from the markdown) | Search by meaning without running a server |
| Same trigger, but host is Railway | + **Postgres + pgvector from Railway's pgvector template** (Tier B). Never the default Postgres image | It survives redeploys and is shared by every channel |
| Pack is `sales`, `real-estate` or `lawyer-accountant` (optionally `agency`, `founder`), with many people ↔ deals/properties/cases changing over time | + **Graphiti** temporal graph via MCP (flag it: experimental) | Answers "who was the contact for this case before March?" |
| The person asks for Mem0 or Letta by name, or says memory matters more than anything else | Mem0 (as an add-on) or Letta (as its **own runtime**, out of scope for v1). Never the default | Both are capable but add another vendor or another runtime |
| Health data, lawyer/accountant secrecy, or the person asks for privacy-first | Local markdown + local sqlite-vec only. **No memory SaaS**, and no cloud embeddings unless the person consents | Sensitive data stays on their machine |

Defaults to say out loud in `/jarvis-quick`: *"Memoria: archivos markdown que puedes leer y editar; si crece, le agrego búsqueda por significado."*

The ~200-line threshold has a source: Claude Code loads only the first 200 lines or 25 KB of the auto-memory index at session start ([code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)). Hermes caps its built-in memory even tighter (see below). Past that size, plain files stop fitting in context and an index starts to pay off.

---

## 1. The workspace (source of truth)

`workspace-writer` generates these files in the Jarvis folder for **every** runtime. The pattern comes from OpenClaw and Hermes and is now the community convention: plain markdown is the truth, and any vector index is derived from it ([docs.openclaw.ai/concepts/memory](https://docs.openclaw.ai/concepts/memory)).

| File | Holds | Who writes it | Loaded |
|---|---|---|---|
| `SOUL.md` | Name, voice, tone, values, language, what it never does | Owner (Architect drafts it) | Every session |
| `USER.md` | Who the owner is: role, timezone, country, preferences, people who matter (by role, no IDs) | Owner + Jarvis (proposals) | Every session |
| `MEMORY.md` | Curated long-term facts and decisions, **one line per fact, with provenance** (§3) | Jarvis, reviewed by the owner | Every session, so keep it under ~200 lines |
| `HEARTBEAT.md` | 3–8 check questions for the proactive loop | Owner | On each heartbeat (→ `capabilities/scheduling.md`) |
| `AGENTS.md` | Operating rules: approval gates, what needs a "yes", how to use memory | Owner/Architect only | Every session |
| `TOOLS.md` | Which tools and MCP servers exist, their trust tier, what each may do | Owner/Architect only | Every session |
| `memory/YYYY-MM-DD.md` | Daily log, append-only | Jarvis | Today + yesterday |
| `memory/inbox.md` | **Quarantine**: facts learned from untrusted sources, waiting for owner approval | Jarvis | Only during review |
| `memory/topics/*.md` | Detail moved out of `MEMORY.md` (one topic per file) | Jarvis | On demand |
| `memory/index.sqlite` | sqlite-vec index, if enabled. **Derived** and rebuildable | Indexer | Through a search tool |

Rules:

- **Instruction files (`SOUL`, `AGENTS`, `TOOLS`, `HEARTBEAT`) are never written by Jarvis on its own.** It can propose a diff, and the owner applies it. Memory must never change permissions, allowlists or config, and `SOUL.md` says so in one line (OWASP ASI06; `SEC-13` in `knowledge/security-checklist.md`).
- Keep the workspace in a private git repo or on a backed-up volume. `.env`, `memory/index.sqlite` and any DB dumps stay out of git.
- The person's language is used for prose in these files. File names stay in English, because runtimes look for them by name.

## 2. Options and tradeoffs

| Option | What it is | Pros | Cons | Use when |
|---|---|---|---|---|
| **Markdown workspace** | Files above | No dependencies, human-editable, portable, works with git | No semantic search at scale; needs curation | **Always** |
| **Claude Code `CLAUDE.md` + auto memory** | `CLAUDE.md` = instructions you write; auto memory = notes Claude writes in `<dir>/MEMORY.md` (an index) plus topic files, typed `user`/`feedback`/`project`/`reference` ([docs](https://code.claude.com/docs/en/memory)) | Built in. `@path` imports. `/memory` lets you browse and edit | Auto memory is machine-local. First 200 lines / 25 KB of the index load. `CLAUDE.md` is context, not enforcement (use hooks for hard blocks) | Claude Code runtimes and the Agent SDK |
| **Claude memory tool** `memory_20250818` | Client-side tool. Claude asks to `view/create/str_replace/insert/delete/rename` under `/memories`, and **your code** executes it on storage you choose ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)) | You control storage (files, DB, encrypted). Python/TS ship `BetaLocalFilesystemMemoryTool` | You implement the handler and **must** block path traversal (`/memories/../..`) | A custom app on the raw Messages API (not needed when the Agent SDK already gives Claude Code's tools) |
| **sqlite-vec** | Vector-search SQLite extension in C with no dependencies; installed from PyPI or npm at an exact version (never unpinned): the runtime files don't pin one yet, so `stack-researcher` pins it at build time and `/jarvis-refresh` adds it to `runtimes/<id>.md` § Pinned versions; Apache-2.0/MIT ([GitHub](https://github.com/asg017/sqlite-vec)) | One file that fits on a laptop or a Railway volume | **Pre-v1: "expect breaking changes"**, so pin it in the runtime file. You write the chunk/embed/search glue (or use the runtime's built-in) | Local upgrade past ~200 lines / multi-channel |
| **Postgres + pgvector (Railway)** | Railway's standard Postgres image **does not include pgvector**. Use the pgvector template ([guide](https://docs.railway.com/guides/rag-pipeline-pgvector)), e.g. `pgvector-pg18` (image `pgvector/pgvector:pg18`, community-maintained) ([template](https://railway.com/deploy/pgvector-pg18)) | Survives redeploys. Relational + vector together. Several channels share one memory | An extra service and its cost (Tier B, → `capabilities/costs.md`). Needs backups. Community template (check the maintainer) | Railway Jarvis that needs semantic memory or document search |
| **Graphiti (Zep)** | Temporal knowledge graph exposed as an MCP server. FalkorDB (default) or Neo4j. Needs LLM **and** embedding credentials. Stdio or streamable HTTP. `group_id` isolates graphs ([docs](https://help.getzep.com/graphiti/getting-started/mcp-server)) | Facts that change over time; relationships | **"Experimental… APIs may change"**. Every write costs LLM extraction. Needs a graph DB | Relationship-heavy packs only |
| **Mem0** | Fact-extraction memory layer, hosted or self-hosted ([docs.mem0.ai](https://docs.mem0.ai)). Also a Hermes memory provider | Large ecosystem; drop-in | Hosted = personal data goes to another vendor. Benchmark claims are contested (secondary sources, UNVERIFIED) | Only when asked |
| **Letta** | Stateful agent runtime with self-editing memory blocks ([GitHub](https://github.com/letta-ai/letta), active work in [letta-code](https://github.com/letta-ai/letta-code)) | Strongest built-in long-term memory | It is a **runtime**, not an add-on, so it competes with the harness. Project is in transition; current release UNVERIFIED | Only if memory is the top requirement. Not a v1 runtime ID |

**Embeddings (needed for sqlite-vec, pgvector and Graphiti).** Anthropic does not sell an embedding model. Its docs point to third-party providers such as Voyage AI ([docs.claude.com embeddings](https://docs.claude.com/en/docs/build-with-claude/embeddings), UNVERIFIED re-check). Embeddings therefore mean one more provider and key, which must appear in the data-flow disclosure. For privacy-first setups, use a local embedding model served by Ollama. Model choice and prices go only in `knowledge/models.json` / `capabilities/costs.md`.

## 3. Memory hygiene (every Jarvis, every runtime)

### Never store

The `remember` skill and `AGENTS.md` must refuse and redact these:

- Secrets: API keys, tokens, passwords, recovery codes, `.env` contents. Example of what gets refused: `sk-ant-...`.
- Payment data: card numbers, CVV, bank account / CLABE / IBAN numbers.
- Government IDs: CURP, RFC, INE, cédula, NIT, DNI/NIE, CUIT/CUIL, passport numbers. Also never e.firma / CSD files or passwords (→ `countries/*.md`).
- Health data, except in the `health` pack with local-only memory and explicit consent.
- Third parties' sensitive data (clients, patients, minors) beyond what the job needs.

Store the **pointer**, not the value: "Factura de Acme: ver Drive › Clientes › Acme", never the RFC itself. Redact before embedding, because a vector index is a copy of the data too. Data-minimization duties per country are in `countries/*.md`.

### Provenance on every line

Each `MEMORY.md` line ends with a source tag and a date. This `[src:…]` tag is the provenance format that `SEC-13` (`knowledge/security-checklist.md`) asks for; templates and the `remember` skill use it everywhere:

```markdown
- Prefiere reuniones después de las 10:00 (America/Mexico_City). [src:owner/telegram] [2026-10-06]
- Cliente "Acme" pide factura antes del día 25. [src:email:untrusted → approved] [2026-10-06]
- Probablemente viaja a Bogotá en noviembre. [src:agent-inferred] [2026-10-06]
```

| Tag | Meaning | Where it goes |
|---|---|---|
| `src:owner/<channel>` | The owner said it on an allowlisted channel | Straight into `MEMORY.md` |
| `src:agent-inferred` | Jarvis deduced it | `MEMORY.md`, shown at the next review |
| `src:email:untrusted`, `src:web:untrusted`, `src:doc:untrusted`, `src:group:untrusted` | Came from content anyone could have written | **`memory/inbox.md` first.** Promoted only after the owner approves (`→ approved`) |

Text from untrusted sources is stored as **data**: quoted, never as an instruction. A memory line that reads like a command ("ignore previous rules", "send X to Y") is dropped and reported to the owner (OWASP ASI06 memory poisoning, `SEC-12`; [Giskard summary](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)).

### Owner review, export and purge

- **Weekly review** (a `weekly-review` job → `capabilities/scheduling.md`). Jarvis sends the week's new lines and the inbox. The owner answers *ok / corrige / borra*.
- **Purge on request.** "Olvida X" deletes the line from `MEMORY.md`, topic files and daily logs, then **re-indexes** (deletes vectors in sqlite-vec/pgvector, deletes episodes in Graphiti with the right `group_id`), then confirms what was deleted. Any third-party copy (Mem0, Honcho) is purged through its own API.
- **Retention default.** Daily logs older than 90 days are summarized into `MEMORY.md`/topics and then deleted. The owner can change this, and it is written in `SECURITY.md`.
- **Export.** The workspace folder *is* the export (zip it). `RUNBOOK.md` documents export and purge (`questions/4-construir.md` §Handoff).
- **Isolation.** For `agency` (many clients) use one memory namespace per client: a separate folder, `group_id` or schema. Never mix them.
- **Law.** Once memory holds customers' data, country rules apply: Mexico LFPDPPP 2025, Colombia Ley 1581 + SIC circulars, Spain GDPR (household use exempt, business use not). See `countries/mx.md`, `countries/co.md`, `countries/es.md`, `countries/ar.md`.

## 4. Setup per runtime

Versions and exact install steps live in `runtimes/<id>.md`. This section covers only **how memory maps** onto each runtime.

### `claude-code-local` · `claude-code-server` · `claude-p-cron`

- `CLAUDE.md` in the Jarvis folder imports the workspace. Imports expand at launch:
  ```markdown
  @SOUL.md
  @USER.md
  @AGENTS.md
  @TOOLS.md
  @MEMORY.md
  ```
  Import `AGENTS.md` explicitly. When a `CLAUDE.md` exists, Claude Code by default reads **only** the `CLAUDE.md` files and not `AGENTS.md` ([docs §AGENTS.md](https://code.claude.com/docs/en/memory)). Keep `CLAUDE.md` itself short (docs target < 200 lines per file). Imports do not reduce context cost.
- **Auto memory** is on by default in local sessions. Its default location is `~/.claude/projects/<project>/memory/` and it is machine-local. Point it into the workspace so it is backed up and portable. In the Jarvis folder's `.claude/settings.json`:
  ```json
  { "autoMemoryDirectory": "~/jarvis/memory/auto" }
  ```
  The value must be absolute or start with `~/`. On Railway, use a path on the volume (`/data/memory/auto`, since the workspace lives under `JARVIS_HOME=/data`, → `capabilities/deploy-railway.md`). Otherwise memory is lost on redeploy. Project-level values are honored only after workspace trust, and are ignored while `permissions.blockReadsOutsideWorkingDirectories` is on.
- Off switches: `autoMemoryEnabled: false` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Sessions in self-hosted environments, background sessions and sessions started by another Claude Code session may run with auto memory **off** ([docs](https://code.claude.com/docs/en/memory)). On a server, check the toggle in `/memory`, and don't assume it is on.
- Policy: auto memory holds Claude's working notes. **Durable facts about the owner go to the workspace `MEMORY.md`** through the `remember` skill. By default, "recuerda que…" makes Claude Code save to auto memory, so `AGENTS.md` must say: *"Cuando el dueño diga 'recuerda…', usa la skill `remember` y escribe en `MEMORY.md`"*. Without that line the smoke test in §5 fails. The weekly review promotes useful auto-memory lines into `MEMORY.md`.
- `claude-p-cron`: each `claude -p` run starts fresh and gets the workspace through `CLAUDE.md`. Whether auto memory loads and saves in `-p` mode is UNVERIFIED. Have jobs write results explicitly to `memory/YYYY-MM-DD.md`.
- Optional hard guard: a `PreToolUse` hook on `Write|Edit` targeting `memory/**` and `MEMORY.md` that rejects lines matching secret / card / ID patterns. `CLAUDE.md` alone is guidance, not enforcement.

### `claude-agent-sdk`

- Leaving out `settingSources` loads user, project and local settings plus `CLAUDE.md`, exactly like the CLI ([docs](https://code.claude.com/docs/en/agent-sdk/claude-code-features)). Set `cwd` to the workspace and use the same `CLAUDE.md` as above.
- Auto memory loads regardless of `settingSources`. Claude saves to it with `Write`/`Edit`, so those tools must be allowed. On Railway, either point `autoMemoryDirectory` at the volume or set `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` and rely on workspace files. For several users, run each in its own filesystem with `settingSources: []` + auto memory disabled (docs warning).
- **Memory tool** (`{"type": "memory_20250818", "name": "memory"}`): use it only when the app calls the Messages API directly. Map `/memories` → `<workspace>/memory/`, resolve every path and reject anything outside it, cap file sizes, and expire stale files. As of 2026-10-06 the docs say the tool **needs no beta header**, although the SDK helpers live in the beta namespace ([docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)). This supersedes earlier UNVERIFIED guidance.
- Semantic layer on Railway: pgvector (template) through the private network, reached as `${{<service>.DATABASE_URL_PRIVATE}}` (in the pgvector template `DATABASE_URL` is the public TCP-proxy URL). Remove the template's TCP proxy; never expose it.

### `hermes`

- Built-in memory: `~/.hermes/memories/MEMORY.md` (≈2,200 chars) and `USER.md` (≈1,375 chars), injected as a frozen snapshot at session start, plus `session_search` over SQLite FTS5 (`~/.hermes/state.db`) ([docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)).
- Hermes scans memory writes for injection and exfiltration patterns. **Turn on write approval** (`memory.write_approval: true` in `config.yaml`; review with `/memory pending`, `/memory approve <id>`, `/memory reject <id>`) for health, legal or finance profiles (as `runtimes/hermes.md` sets) **and** for any Jarvis that reads email or the web.
- Mapping: seed Hermes `USER.md` from a digest of workspace `USER.md`. Keep the full history in workspace `MEMORY.md`/topics. A weekly job copies Hermes memory back into the workspace with `[src:hermes]` tags. This sync is the Architect's own pattern, not a Hermes feature.
- External providers (Honcho, Mem0, Hindsight, Supermemory…) are opt-in plugins. Each one is a new data processor and needs consent. On Railway, everything sits on the single volume (`/opt/data`). Never run two gateways on the same data dir (→ `runtimes/hermes.md`).

### `openclaw`

- Native match: the workspace (default `~/.openclaw/workspace`) holds `USER.md`, `MEMORY.md` and `memory/YYYY-MM-DD.md`. Tools are `memory_search` and `memory_get`. Search is hybrid (vector + keyword) on SQLite, accelerated by sqlite-vec when available. A silent "save to memory" turn runs before compaction ([docs](https://docs.openclaw.ai/concepts/memory)).
- `MEMORY.md` should load only in the main private session, **never in group contexts**. This comes from a docs mirror and is UNVERIFIED on the live page, so the Architect checks it in `runtimes/openclaw.md` and keeps the Jarvis out of groups otherwise.
- Memory search needs an embedding provider. The docs default is OpenAI embeddings, with Gemini, Voyage, Mistral or a local model as alternatives. **With only an Anthropic key, semantic search stays off until one is configured; keyword search on SQLite still works.** Decide this explicitly and disclose it.
- Optional consolidation ("dreaming", `DREAMS.md`) promotes notes into `MEMORY.md`. Leave it on only if the weekly review is also on.

### `codex-openai`

- Codex reads `AGENTS.md` (project plus global `~/.codex/AGENTS.md`). Put the "read SOUL/USER/MEMORY at start, write facts via `remember`" rules in it. Whether Codex expands `@path` imports is UNVERIFIED, so tell it in prose to read the files.
- Codex's generated memories in `~/.codex/memories/` are reported by secondary sources only (UNVERIFIED). Treat them like auto memory: promote into the workspace at review.

### `ollama-local`

- Ollama serves models. It has no memory of its own. Memory comes from the harness on top (Hermes, OpenClaw or a custom app) following that harness's section above. For full privacy, use a local embedding model through Ollama and local sqlite-vec. Never pair it with Railway (no GPUs → `compatibility.md`).

### `cowork`

- Cowork projects have project-scoped memory plus instructions and a linked local folder ([support.claude.com/en/articles/14116274](https://support.claude.com/en/articles/14116274); details partly UNVERIFIED). Use the Jarvis workspace folder as the project folder. Paste a short instruction: "lee SOUL.md, USER.md y MEMORY.md antes de cada tarea; guarda hechos nuevos en MEMORY.md". Built-in Cowork memory is not a file the person can export (UNVERIFIED), so `MEMORY.md` stays the portable copy.

## 5. Verify

Run these from the Jarvis folder. Each must exit 0. Run the lines marked *Claude Code* or *pgvector* only for those setups. No check prints a matching value: secret and ID checks list file names only (`-l`).

```bash
# workspace exists
for f in SOUL.md USER.md MEMORY.md HEARTBEAT.md AGENTS.md TOOLS.md; do test -s "$f" || exit 1; done
# MEMORY.md within the load budget
test "$(wc -l < MEMORY.md)" -le 200
# no obvious secrets / cards in memory (gitleaks is the stronger check)
! grep -rEl 'sk-(ant|proj)-[A-Za-z0-9_-]{8,}|\b[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}\b' MEMORY.md USER.md memory/ 2>/dev/null || exit 1
# no RFC / CURP / DNI-NIE-style IDs (patterns from SEC-13)
! grep -rEl '\b[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}\b|\b[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]\b|\b[0-9]{8}[A-Z]\b' MEMORY.md USER.md memory/ 2>/dev/null || exit 1
# every MEMORY.md fact line carries provenance
! grep -E '^- ' MEMORY.md | grep -v '\[src:' | grep -q . || exit 1
# Claude Code runtimes only: CLAUDE.md imports the workspace
grep -q '^@MEMORY.md' CLAUDE.md
# pgvector only (Railway Tier B), without printing the URL
psql "$DATABASE_URL" -tAc "select 1 from pg_extension where extname='vector'" | grep -q 1
```

Smoke test (`questions/4-construir.md`): "Recuerda que mi color favorito es el verde" → new session → it answers correctly **and** the line appears in `MEMORY.md` with `[src:owner/...]`. Then "olvida mi color favorito" → the line is gone and, if indexed, a search no longer returns it.

## 6. Security

- Memory is an injection surface (OWASP ASI06). Keep untrusted content quarantined in `memory/inbox.md`, tag provenance, never let memory change permissions, allowlists or config, and let the owner review and purge. These map to `SEC-13` (memory hygiene), `SEC-12` (untrusted content fenced as data) and `SEC-32` (data flows disclosed) in `knowledge/security-checklist.md`.
- Secrets never go in memory, `CLAUDE.md`, `SOUL.md` or logs (`SEC-18`). They live only in `.env` (chmod 600), the keychain, or Railway Sealed variables.
- Disclose the data flow at the gate (`questions/3-confirmacion.md`): where memory lives, which embedding/graph/memory vendors see it, and how to purge it.
- Databases (pgvector, FalkorDB/Neo4j) stay on private networking with no public port. Turn on volume backups on Railway (→ `capabilities/deploy-railway.md`).
- Memory tool / custom handlers: path-traversal protection is mandatory.

## Sources

- Claude Code memory (CLAUDE.md, imports, AGENTS.md, auto memory, limits, `autoMemoryDirectory`): https://code.claude.com/docs/en/memory (checked 2026-10-06)
- Agent SDK `settingSources`, auto memory in the SDK: https://code.claude.com/docs/en/agent-sdk/claude-code-features (checked 2026-10-06)
- Claude memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool (checked 2026-10-06)
- Claude embeddings guidance: https://docs.claude.com/en/docs/build-with-claude/embeddings (UNVERIFIED re-check)
- sqlite-vec: https://github.com/asg017/sqlite-vec (checked 2026-10-06)
- Railway pgvector: https://docs.railway.com/guides/rag-pipeline-pgvector · https://railway.com/deploy/pgvector-pg18 (checked 2026-10-06)
- Graphiti MCP server: https://help.getzep.com/graphiti/getting-started/mcp-server (checked 2026-10-06)
- Mem0: https://docs.mem0.ai · Letta: https://github.com/letta-ai/letta · https://github.com/letta-ai/letta-code
- OpenClaw memory: https://docs.openclaw.ai/concepts/memory (checked 2026-10-06)
- Hermes memory: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory · providers: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers (checked 2026-10-06)
- Codex memory (secondary): https://mem0.ai/blog/how-memory-works-in-codex-cli (UNVERIFIED)
- Cowork projects: https://support.claude.com/en/articles/14116274 (via search summary; partly UNVERIFIED)
- OWASP Top 10 for Agentic Applications 2026 (ASI06): https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026
