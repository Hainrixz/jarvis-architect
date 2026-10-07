# knowledge/ — how the Architect knows things

Everything Jarvis Architect decides comes from these files plus a live check by
`stack-researcher`. They are written in English (prompt material); the Architect answers in the
person's language. Contributions in Spanish are welcome — see `CONTRIBUTING.md`.

Last verified: 2026-10-06

## Layout and IDs (stable — other files link to these exact names)

| Folder / file | What it holds | IDs |
|---|---|---|
| `decision-tree.md` | Profile → runtime + host + credential + defaults, incl. § *Quick defaults* | — |
| `auth-matrix.md` | Runtime × host → the only allowed credential, with quoted policy sources | — |
| `security-checklist.md` | Non-negotiable controls, IDs `SEC-01`…, each with an automated check | `SEC-NN` |
| `compatibility.md` | Known-bad combinations and what to do instead | `CMP-NN` |
| `models.json` | Model slots per provider + prices + `verified_at` | — |
| `runtimes/<id>.md` | One harness each. **The only markdown place where versions are pinned.** | `claude-code-local` · `claude-code-server` · `claude-p-cron` · `claude-agent-sdk` · `hermes` · `openclaw` · `codex-openai` · `ollama-local` · `cowork` |
| `capabilities/<id>.md` | One capability each | `channels` · `whatsapp` · `memory` · `tools-mcp` · `scheduling` · `voice` · `skills` · `deploy-local` · `deploy-railway` · `costs` · `web-ui` |
| `professions/<id>.md` | Profession packs | `creator` · `developer` · `founder` · `sales` · `student` · `lawyer-accountant` · `health` · `real-estate` · `smb-restaurant` · `ecommerce` · `coach` · `agency` · `teacher` |
| `countries/<cc>.md` | Country packs | `mx` · `co` · `ar` · `es` · `other` |

## Conventions (CI checks these)

1. Every `.md` starts with `# Title`, a one-line `>` summary, and `Last verified: YYYY-MM-DD`.
2. **Version numbers live only in `runtimes/*.md` (§ Pinned versions) and `models.json`.** Other
   files say "see `runtimes/hermes.md`" instead of repeating a version.
3. Every factual claim that can go stale carries a source URL. Claims resting on a secondary
   source carry a **check live** note (what `stack-researcher` re-checks at install time, plus
   the fallback) — never silently stated as fact.
4. Every cross-reference uses the paths above and must resolve.
5. No secrets, no real tokens, no personal data in examples. Use obviously fake values
   (`123456789` for a Telegram user ID, `sk-ant-...` truncated).

## Runtime file template (`runtimes/<id>.md`)

```
# Runtime: <Name>
> one line: what it is and who it's for
Last verified: YYYY-MM-DD

## Pick it when / Don't pick it when
## Auth  (→ the auth-matrix.md row, restated in one line)
## Pinned versions   (table: component · version · channel (stable/LTS) · source URL · checked date) + security floor
## Prerequisites     (what preflight must show; per OS)
## Install           (preferred per OS → fallback; never curl|sh, never sudo from the agent)
## Configure         (files, env vars → .env.example lines, config snippets)
## Workspace mapping (which files/folders this runtime reads: SOUL/USER/MEMORY/HEARTBEAT/AGENTS/TOOLS, skills dir)
## Channels          (which are native, how to set allowlists)
## Memory · Scheduling · Tools/MCP
## Run & supervise   (local: launchd/systemd/pm2/Docker · Railway: image/start cmd/volume/port)
## Security hardening (map each control to SEC-NN)
## Verify            (shell commands that exit 0 when healthy; smoke test steps)
## Cost              (→ capabilities/costs.md, plus runtime-specific notes)
## Known issues & fallbacks
## Sources
```

## Capability / profession / country files

Capabilities: *Decision rule* first (a short table), then options with tradeoffs, then setup notes
per runtime, then Security, then Sources.

Professions: *Signals* · *Week-one jobs* (3–5 concrete) · *Channels* · *Memory* · *Tools/MCP*
(with trust tier) · *Scheduled jobs* (cron + timezone note) · *Skills* · *Guardrails* (incl.
irreversible actions and data sensitivity) · *Interview extras* (1–3 questions only this pack
needs) · Sources.

Countries: *Channels reality* · *WhatsApp rates & policy notes* · *Fiscal / invoicing tools* ·
*Fiscal calendar* (official source + what may be stored per client; may say "not tracked yet") ·
*CRM & commerce* · *Data-protection law* (what the Architect must warn) · *Voice accent defaults*
· *Timezones & currency* · Sources.
