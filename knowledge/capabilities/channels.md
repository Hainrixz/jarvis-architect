# Capability: Channels

> Where the person talks to their Jarvis (Telegram, WhatsApp, Discord, Slack, iMessage, email, web UI, Remote Control), which runtime supports each one natively, and how to lock every channel to its owner.

Last verified: 2026-10-06

No versions live here. Minimum versions for channel features are in the runtime files
(`knowledge/runtimes/claude-code-local.md`, `knowledge/runtimes/hermes.md`,
`knowledge/runtimes/openclaw.md`, …). WhatsApp has its own file: `knowledge/capabilities/whatsapp.md`.

## Decision rule

Pick **one main channel** first. Add a second channel only when the person explains a concrete need.

| Situation (from the interview) | Main channel | Why (say this in one line) |
|---|---|---|
| Personal Jarvis, any runtime that supports it | **Telegram** (default) | Free official bot API, no ban risk, voice notes, works from the phone, no public URL needed (long polling) |
| "Everyone I know is on WhatsApp" / business answering its own customers | **WhatsApp** → `knowledge/capabilities/whatsapp.md` | Official Cloud API by default; unofficial bridges (Baileys) only with logged consent and a secondary number |
| Developer already living in Claude Code, wants to steer work from the phone | **Remote Control** (Claude app / claude.ai/code) + optionally Telegram | Zero setup beyond `/login`; it is steering a session, not a chat bot |
| Creator or community already on Discord | **Discord** (DMs only) | Free bot API, same pairing flow as Telegram in Claude Code |
| Team works in Slack (founder, agency, sales team) | **Slack in Socket Mode** | No public endpoint; needs workspace admin approval |
| Mac user, runs locally, lives in iMessage | **iMessage** (Claude Code plugin or OpenClaw) | No token or external service; Mac must stay on; macOS only |
| Delegation by email (lawyer, accountant, sales follow-ups) | **Agent-owned inbox** (AgentMail or a dedicated mailbox) | Jarvis gets its own address; it never gets write access to the person's personal mail |
| "Nothing leaves my computer" / Ollama path | **Terminal** + the **Jarvis Panel** on localhost through the harness API (`capabilities/web-ui.md`) | No messaging platform involved; chat keeps the harness's memory, skills and jobs |
| Low-tech Pro/Max user, no messaging needs (`cowork`) | **Claude app (Dispatch / Cowork)** | Nothing to build; Telegram/WhatsApp are not available there |
| Only scheduled reports, no conversation (`claude-p-cron`) | **Telegram, send-only** (or email) | The job pushes its result; there is nothing to receive |

Rules that apply to every row:

1. **Owner-only.** Every channel's allowlist contains only the owner's numeric/stable ID. Never a
   wildcard, never `open`, never `*_ALLOW_ALL_USERS=true`. (`knowledge/security-checklist.md` SEC-01)
2. **DMs only by default.** Groups stay disabled unless the person asks; see § Groups policy (SEC-02).
3. **Prefer polling / outbound sockets over webhooks** for local installs. A webhook needs a
   public HTTPS URL and a verified secret (§ Polling vs webhook, SEC-03).
4. **LATAM reality:** WhatsApp reaches ~90–94% of internet users in MX/CO/AR and Telegram is
   secondary ([Infobip 2026](https://infobip.com/blog/whatsapp-statistics)). Do not pretend
   Telegram is what they use daily. Say it plainly, e.g. *"Te recomiendo Telegram para hablar tú
   con tu Jarvis: es gratis y no hay riesgo de que te bloqueen el número. Si lo quieres en
   WhatsApp, se puede, pero te explico las reglas de Meta primero."*

## Runtime × channel support matrix

`N` = native/official in the runtime · `P` = official plugin · `B` = you build an adapter ·
`—` = not available · `via X` = put another runtime/UI in front.

| Channel | `claude-code-local` | `claude-code-server` | `claude-p-cron` | `claude-agent-sdk` | `hermes` | `openclaw` | `codex-openai` | `ollama-local` | `cowork` |
|---|---|---|---|---|---|---|---|---|---|
| Telegram | P (research preview) | P (research preview) | send-only (Bot API `sendMessage`) | B (grammY / python-telegram-bot) | N | N (bundled) | — (via Hermes/OpenClaw) | via Hermes/OpenClaw | — |
| WhatsApp | — (no official channel) | — | — | B (Cloud API webhook) | N (Baileys default; Cloud API option) | P (**Baileys only**) | — | via Hermes | — |
| Discord | P (research preview) | P (research preview) | send-only (webhook URL) | B | N | P | — | via Hermes/OpenClaw | — |
| Slack | — (Claude in Slack is a separate product, see below) | — | send-only (incoming webhook) | B (Bolt, Socket Mode) | N (Socket Mode) | P (Socket Mode default) | — | via Hermes/OpenClaw | — |
| iMessage | P (macOS only) | — | — | — | — UNVERIFIED | P (`imsg`, macOS host) | — | via OpenClaw | — |
| Email | — (Gmail MCP is a tool, not a channel) | — | send-only | B (AgentMail API) | N (IMAP/SMTP) | — (not in channel docs) | — | via Hermes | — |
| Web UI | fakechat demo (localhost) | — | — | B (your own UI) | dashboard templates (community) UNVERIFIED | N (WebChat, bundled) | — | **Jarvis Panel via the harness** | Claude app |
| Remote Control | N (needs claude.ai `/login`) | only with `/login` on the server; never with API key or setup-token | — | — | — | — | — | — | Dispatch (Claude app) |
| Signal / Teams / Matrix / others | — | — | — | B | N | P | — | via Hermes/OpenClaw | — |

Sources: [Claude Code channels](https://code.claude.com/docs/en/channels),
[Remote Control](https://code.claude.com/docs/en/remote-control),
[Hermes messaging](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/),
[OpenClaw channels](https://docs.openclaw.ai/channels),
[Hermes WhatsApp](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp),
[OpenClaw WhatsApp](https://docs.openclaw.ai/channels/whatsapp). Codex has no built-in chat
channels (UNVERIFIED); Cowork has no Telegram/WhatsApp ([Claude release notes](https://support.claude.com/en/articles/12138966),
secondary sources, partly UNVERIFIED).

Matrix consequences the Architect must apply:

- **WhatsApp + no consent to Baileys ⇒ not OpenClaw** (and not NanoClaw). Use Hermes with the Cloud
  API, the Agent SDK, or n8n. Details in `knowledge/capabilities/whatsapp.md`.
- **Claude Code channels exist only while the session runs** ("Events only arrive while the session
  is open"). Local → supervisor (launchd/systemd/tmux); see `knowledge/capabilities/deploy-local.md`.
- **Claude Code channels need Bun** and claude.ai or Console API-key auth; not available on
  Bedrock/Vertex/Foundry. Team/Enterprise owners must enable `channelsEnabled`.
  Pro/Max users without an organization skip that check. ([channels](https://code.claude.com/docs/en/channels))
- **Remote Control never works with an API key or a setup-token** ("API keys are not supported").
  On a server with `ANTHROPIC_API_KEY`, offer Telegram instead. ([remote-control](https://code.claude.com/docs/en/remote-control), `knowledge/auth-matrix.md`)
- Native Windows + Claude Code channels: UNVERIFIED (Bun-based plugins). Prefer WSL2.

## Options and tradeoffs

### Telegram — the default

- Bot created with [@BotFather](https://t.me/BotFather) → `/newbot` → token. Token goes into the
  runtime's `.env` **by the person**, never through the chat (`knowledge/security-checklist.md` SEC-17, SEC-18).
- Free, official, voice notes in and out (voice pipeline: `knowledge/capabilities/voice.md`).
- Bot API: <https://core.telegram.org/bots/api>.
- Limitation: the person may not have Telegram installed. Installing it is a 2-minute step; say so.

### WhatsApp

Read `knowledge/capabilities/whatsapp.md` and `knowledge/countries/<cc>.md`. Summary only:
official Cloud API is the default path (needs a public HTTPS webhook — fits Railway); Meta's
Business Solution Terms ban AI providers whose primary functionality is a general assistant, and a
personal "ask me anything" Jarvis is a grey zone (UNVERIFIED legal reading); Baileys-type bridges
break WhatsApp ToS and risk a number ban → explicit logged consent + secondary number only.

### Discord

- Developer Portal → New Application → Bot → token. **Enable Message Content Intent** (Privileged
  Gateway Intents), invite with `bot` scope and minimal permissions (View Channels, Send Messages,
  Send Messages in Threads, Read Message History, Attach Files, Add Reactions).
  ([channels](https://code.claude.com/docs/en/channels))
- Good for creators who already run a community server. Use **DMs** with the bot for the owner;
  a bot sitting in a public server is a group (§ Groups policy).

### Slack — Socket Mode only

- Socket Mode uses an outbound WebSocket, so "your instance doesn't need to be publicly accessible"
  ([Hermes Slack](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack),
  [Slack Socket Mode](https://api.slack.com/socket-mode)). OpenClaw's default transport is also
  Socket Mode ([OpenClaw Slack](https://docs.openclaw.ai/channels/slack)).
- Two tokens: bot token `xoxb-…` and app-level token `xapp-…`. Allowlist by **Member ID**
  (`U01ABC2DEF3` format; profile → ⋯ → *Copy member ID*).
- Needs a workspace admin to approve the app. In a company workspace, ask whether they are allowed
  to install it; company data then flows to the model provider.
- **Claude in Slack** (official, `@Claude` mention spawns a *cloud* session) is a different thing:
  it does not reach the person's local Jarvis, files or memory. Docs: <https://code.claude.com/docs/en/slack>.
  Plan requirements: UNVERIFIED — check the page before recommending.

### iMessage (macOS only)

- **Claude Code plugin:** reads `~/Library/Messages/chat.db` (needs **Full Disk Access** for the
  terminal that launches Bun) and replies through AppleScript (macOS Automation prompt on first
  reply). **Self-chat bypasses the allowlist**; other contacts are added by handle with
  `/imessage:access allow +15551234567`. ([channels](https://code.claude.com/docs/en/channels))
- **OpenClaw:** native via `imsg` (JSON-RPC over stdio) on a macOS host ([OpenClaw channels](https://docs.openclaw.ai/channels)).
- Full Disk Access is a large grant. Say so, and only do it on the person's own Mac.
- Never add other contacts to the allowlist for a personal Jarvis (Consumer Terms: an account
  must not be made available to anyone else — `knowledge/auth-matrix.md`).

### Email — prefer an agent-owned inbox

Two different things; do not mix them up:

| | Email as a **channel** (Jarvis receives orders by email) | Email as a **tool** (Jarvis reads the person's inbox) |
|---|---|---|
| What | Jarvis has **its own address**; the owner writes/forwards to it | Gmail/Outlook MCP on the owner's mailbox |
| Options | **AgentMail** (inboxes for agents via API; free tier 3 inboxes / 3,000 emails per month per [docs.agentmail.to](https://docs.agentmail.to), re-check before quoting) · or a dedicated mailbox via Hermes Email (IMAP/SMTP, polls every 15 s by default) | `knowledge/capabilities/tools-mcp.md` — read-only first, sending always behind approval |
| Allowlist | Hermes: `EMAIL_ALLOWED_USERS`; unknown senders ignored unless `EMAIL_ALLOW_ALL_USERS=true` (never set it). Set `EMAIL_AUTHSERV_ID` so sender authentication headers are checked — a `From:` address alone is trivially spoofed. ([Hermes Email](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/email)) | n/a |

- Hermes docs: "Don't use your personal email — the agent stores the password in `.env` and has
  full inbox access via IMAP." Use an app password, file mode 0600.
- AgentMail MCP / inbound webhooks / sender allowlists: UNVERIFIED (not shown on the docs index
  fetched 2026-10-06). If it uses webhooks, verify their signature (§ Polling vs webhook).
- Every email body and attachment is **untrusted input** (prompt injection); wrap it as data
  (`knowledge/security-checklist.md` SEC-12).

### Web UI — Open WebUI (not a v1 default)

- The local-only UI is the Jarvis Panel through the harness (`capabilities/web-ui.md`): Open WebUI
  talks to Ollama directly, so it has none of the harness's memory, skills or cron. Use it only
  when the person explicitly wants model management or multi-user chat, as a `/jarvis-add` item;
  `stack-researcher` pins its image then (no pin lives in `knowledge/` today). Docs:
  <https://docs.openwebui.com>.
- Bind to `127.0.0.1` only. For phone access use Tailscale, never a public port.
- **The first account created becomes admin.** Create it immediately after first start; keep
  `ENABLE_SIGNUP=False` (or set `WEBUI_ADMIN_EMAIL` + `WEBUI_ADMIN_PASSWORD`, which creates the
  admin on first start and disables signup). Settings persist in the DB/volume, so changing the
  env var later may not take effect. ([env reference](https://docs.openwebui.com/reference/env-configuration))
- LibreChat is the heavier multi-provider alternative; only for Tier B on Railway with a reason.
- OpenClaw ships its own WebChat; Claude Code's `fakechat` (localhost:8787) is a demo, not a product.

### Remote Control (Claude Code users)

- `claude --remote-control` (interactive) or `claude remote-control` (server mode), or `/remote-control`
  inside a session; open the session from the Claude app (Code tab) or claude.ai/code.
- Pro/Max/Team/Enterprise **`/login` only** — "API keys are not supported", and a `claude setup-token` /
  `CLAUDE_CODE_OAUTH_TOKEN` token "can't establish Remote Control sessions". On Team/Enterprise an
  Owner must first enable the Remote Control toggle in Claude Code admin settings.
- Outbound HTTPS only, no inbound port. Server mode exits after ~10 min without network; the
  supervisor must restart it. ([remote-control](https://code.claude.com/docs/en/remote-control))
- It is the person driving their own session, so there is no third-party sender to allowlist.
  Protect the claude.ai account (2FA) instead.

## Allowlist setup — by stable numeric ID, never by username

Usernames and display names can be changed or impersonated; IDs cannot. Telegram user IDs fit in
a 64-bit integer ("at most 52 significant bits", [Bot API](https://core.telegram.org/bots/api)) —
store them as numbers or strings, never as 32-bit ints.

### How to get the owner's ID (safest first)

| Platform | Preferred | Fallback |
|---|---|---|
| Telegram | **Pairing**: DM the bot, it replies with a code (Claude Code, Hermes) or "Your Telegram user id" (OpenClaw) | Read `senderUserId` in local logs (`openclaw logs --follow`) or the official Bot API `getUpdates` ([OpenClaw access control](https://docs.openclaw.ai/channels/telegram/access-control)); third-party bots like @userinfobot work but are a third party — mention, don't default |
| Discord | Pairing (Claude Code) | Discord Settings → Advanced → Developer Mode → right-click yourself → *Copy User ID* (UNVERIFIED menu path) |
| Slack | Profile → ⋯ → *Copy member ID* | — |
| iMessage | Self-chat (no setup) | Handle in `+<country><number>` or Apple ID email |
| Email | The owner's address + sender authentication check | — |

**Never approve a pairing request that arrived through the bot itself** — approvals happen in the
local terminal only ([channels](https://code.claude.com/docs/en/channels); SEC-04).

### Per runtime

| Runtime | Telegram | Discord / Slack | Check |
|---|---|---|---|
| `claude-code-local` / `claude-code-server` | Token file `~/.claude/channels/telegram/.env` written by the person in an editor (never `/telegram:configure <token>`: it puts the token in the transcript) → `claude --channels plugin:telegram@claude-plugins-official` → DM bot → `/telegram:access pair <code>` typed in the local terminal → **`/telegram:access policy allowlist`** | `/discord:access pair <code>` → `/discord:access policy allowlist` | Rejection test (below). Access file: `~/.claude/channels/<plugin>/access.json` (per the plugin's ACCESS.md; `runtimes/claude-code-local.md` § Channels) |
| `hermes` | `TELEGRAM_ALLOWED_USERS=123456789` in `~/.hermes/.env` (0600) | `DISCORD_ALLOWED_USERS`, `SLACK_ALLOWED_USERS=U01ABC2DEF3`; `GATEWAY_ALLOWED_USERS` as catch-all. Pairing: `hermes pairing approve <platform> <code>`, `hermes pairing list`, `hermes pairing revoke` | Default denies anyone not allowlisted or paired ([Hermes messaging](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/)). **Never** `GATEWAY_ALLOW_ALL_USERS=true` |
| `openclaw` | `channels.telegram.dmPolicy: "allowlist"` + `allowFrom: [123456789]` (numeric; `tg:` prefix normalised). Start with `pairing` (default) to learn the ID, then switch to `allowlist` | Same keys per channel (`dmPolicy`, `allowFrom`, `groupPolicy`, `requireMention`) | `openclaw doctor --fix` converts old `@username` entries to numeric IDs; `openclaw security audit`. **Never** `dmPolicy: "open"` or `allowFrom: ["*"]` ([access control](https://docs.openclaw.ai/channels/telegram/access-control)) |
| `claude-agent-sdk` (own adapter) | Hard-coded check on `message.from.id` against `OWNER_TELEGRAM_ID` env var **before** any model call; drop silently and log the denial | Same for Discord user ID / Slack member ID | Unit test with a fake update from another ID |
| `claude-p-cron` (send-only) | Send to `chat_id = OWNER_TELEGRAM_ID` only; the bot ignores inbound messages | — | No inbound handler exists |

OpenClaw example (fake IDs):

```json5
{
  channels: {
    telegram: {
      enabled: true,
      // botToken comes from the environment / secret store, never committed
      dmPolicy: "allowlist",
      allowFrom: [123456789],
      groupPolicy: "disabled"
    }
  }
}
```

Hermes `.env.example` lines (no values):

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USERS=123456789
# GATEWAY_ALLOW_ALL_USERS must never be set
```

### Rejection test (required by `questions/4-construir.md` § Smoke test)

1. Owner sends "hola" → reply within 60 s.
2. A message from a non-allowlisted account (a friend's phone, or the runtime's simulated-sender
   test) → **no reply**, and a denial line appears in the log.
3. Config grep fails the build on wildcards, e.g.
   `! grep -RInE 'ALLOW_ALL_USERS=true|allowFrom: *\[ *"\*"|dmPolicy: *"open"|groupPolicy: *"open"' <jarvis-config-dir>`
   (point it at config files, never at `.env` contents shown in chat).

## Polling vs webhook

| | Long polling / outbound socket (default) | Webhook |
|---|---|---|
| Public URL needed | No | Yes (HTTPS) |
| Fits | Local installs, Railway Tier A without a domain | Railway/server with a public domain; required by WhatsApp Cloud API |
| Who uses it | Claude Code Telegram plugin ("begins polling"), Hermes Telegram (default), OpenClaw Telegram (default), Slack Socket Mode, Discord gateway | Hermes `TELEGRAM_WEBHOOK_URL`, OpenClaw `webhookUrl`, any Agent SDK service |

Webhook rules (non-negotiable):

- **Telegram:** call `setWebhook` with `secret_token` (1–256 chars, only `A-Z a-z 0-9 _ -`).
  Telegram sends it in the `X-Telegram-Bot-Api-Secret-Token` header on every request; reject any
  request where it does not match, with a constant-time compare. ([Bot API](https://core.telegram.org/bots/api#setwebhook))
  - Hermes: `TELEGRAM_WEBHOOK_SECRET` is required — "the gateway refuses to start without it"
    ([Hermes Telegram](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram)).
    Generate it locally (`openssl rand -hex 32`), the person puts it in the secret store.
  - OpenClaw: `webhookSecret` alongside `webhookUrl` / `webhookPath` ([OpenClaw Telegram](https://docs.openclaw.ai/channels/telegram)).
- **WhatsApp Cloud API:** verify `X-Hub-Signature-256` (HMAC with the app secret) → `whatsapp.md`.
- **Slack HTTP mode** (only if Socket Mode is impossible): verify with the signing secret.
- **Anything else:** HMAC signature + timestamp window.
- Only the webhook service gets a public Railway domain; everything else on `*.railway.internal`
  (`knowledge/capabilities/deploy-railway.md`).
- Polling and webhook are exclusive on Telegram: "You will not be able to receive updates using
  getUpdates for as long as an outgoing webhook is set up." A forgotten webhook is the #1 reason a
  polling bot "doesn't answer".

Verify (reads the token from env, prints only the URL field):

```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | grep -o '"url":"[^"]*"'
# polling expected → "url":""   ·   webhook expected → "url":"https://<your-domain>/telegram"
```

## Groups policy

Default: **groups disabled** (SEC-02). A group is the easiest prompt-injection path (anyone in it can
write to Jarvis) and, with permission relay, anyone who can reply through the channel can approve
tool use ([channels](https://code.claude.com/docs/en/channels)).

If the person explicitly wants Jarvis in a group:

1. Allowlist the **group ID** (Telegram groups/supergroups have negative IDs) *and* the members
   allowed to trigger it. OpenClaw: group IDs under `channels.telegram.groups`, user IDs under
   `groupAllowFrom` — "`groupAllowFrom` is not a group allowlist"; `groupPolicy` default is
   `allowlist` (all groups blocked until listed). Hermes: `TELEGRAM_GROUP_ALLOWED_CHATS`,
   `TELEGRAM_GROUP_ALLOWED_USERS`.
2. **Mention-gated:** OpenClaw `requireMention` (default true per group); Hermes
   `require_mention: true`. Keep Telegram **privacy mode ON** so the bot only sees commands,
   replies and mentions (turning it off requires removing and re-adding the bot).
3. **Read-only tool profile** in groups: no sending, no file writes, no payments, no memory writes
   that change behaviour.
4. Never put a personal Jarvis in a group with clients or the public. A customer-facing bot is a
   different product (and on WhatsApp, a different policy — `whatsapp.md`).
5. Claude Code channel plugins: group/server-channel behaviour is not documented on the channels
   page (UNVERIFIED) → use DMs only.

## Setup notes per runtime

- **`claude-code-local`:** `runtimes/claude-code-local.md` is authoritative. In short: preflight
  must show `bun --version`; install the plugin at **project scope** in the Jarvis folder (user
  scope makes every other session steal the bot); token file written by the person in an editor;
  launch under the supervisor with `--channels plugin:telegram@claude-plugins-official
  --permission-mode auto` (several plugins space-separated); narrow allow rules plus the permission
  relay to the owner. **Never** `--dangerously-skip-permissions` (SEC-10). The terminal shows the
  inbound message but not the reply text — that is normal. Channel flags are research preview and
  hidden from `claude --help`.
- **`claude-code-server`:** same plugins, `ANTHROPIC_API_KEY` by default (channels are "permitted by
  default" with Console auth). `CLAUDE_CODE_OAUTH_TOKEN` + channels is undocumented and has known
  bugs (anthropics/claude-code#80091, #44945) → secondary option only (`knowledge/auth-matrix.md`).
  No Remote Control with either.
- **`claude-p-cron`:** output-only. The job script posts to the Bot API `sendMessage` with
  `chat_id=$OWNER_TELEGRAM_ID` (token from env). No listener, so no allowlist surface. See
  `knowledge/capabilities/scheduling.md`.
- **`claude-agent-sdk`:** build the adapter (grammY for TS, python-telegram-bot for Python). Owner
  check first, then model call. On Railway, webhook + `secret_token`; locally, polling.
- **`hermes`:** `hermes gateway setup` walks through each platform; allowlist env vars above.
  Polling by default; webhook mode only on a platform with a public URL and the secret set.
- **`openclaw`:** Telegram is bundled and the fastest first channel; others are official plugins.
  Gateway stays on loopback with auth (never public) — see `knowledge/runtimes/openclaw.md` for the
  version floor. Run `openclaw security audit` after every channel change.
- **`codex-openai`:** no chat channels. If the person needs a phone channel, the design is Hermes or
  OpenClaw with the OpenAI credential from `knowledge/auth-matrix.md`.
- **`ollama-local`:** the harness on top (Hermes/OpenClaw) provides channels; for "nothing leaves my
  machine", the terminal plus the Jarvis Panel through the harness API (no Open WebUI in v1). Note: Telegram/WhatsApp/Slack messages *do* pass through those
  platforms' servers even when the model is local — say so to privacy-first users.
- **`cowork`:** recommend the Claude app and stop; nothing to configure here.

## Security

All of these map to `knowledge/security-checklist.md`; `jarvis-validator` checks them.

- Owner-only allowlist on every channel, numeric/stable IDs, proven by the rejection test (SEC-01).
- No wildcards: `*_ALLOW_ALL_USERS`, `dmPolicy: "open"`, `allowFrom: ["*"]`, `groupPolicy: "open"`
  fail the build (SEC-01, validator sweep 2).
- Groups disabled by default; if enabled: allowlisted, mention-gated, read-only tools (SEC-02).
- Webhooks verify origin (Telegram `secret_token`, Meta `X-Hub-Signature-256`, Slack signing
  secret, HMAC otherwise). Prefer polling locally (SEC-03; public domain only for the webhook, SEC-06).
- Pairing approved only from the local terminal / admin channel, never from the bot (SEC-04).
- Bot tokens, app tokens and email app passwords live in `.env` (0600) or Railway sealed variables;
  never in git, never pasted into the chat. If one leaks: revoke in BotFather / Developer Portal /
  Slack app settings and rotate (SEC-17, SEC-18, SEC-21).
- Inbound messages from anyone but the owner, email bodies and group content are untrusted data (SEC-12).
- Every sensitive action requested over a channel (send to third parties, pay, delete, change
  allowlists/config) needs explicit approval with a preview. Changing an allowlist **from a chat
  message** is always refused (SEC-14, SEC-15, SEC-04).
- Log denied senders (ID, channel, timestamp) and alert the owner (SEC-29).
- Unofficial WhatsApp bridges only with logged consent + secondary number (SEC-31, `whatsapp.md`).

## Sources

- Claude Code channels (Telegram/Discord/iMessage/fakechat, pairing, allowlist, enterprise controls, research preview) — https://code.claude.com/docs/en/channels (fetched 2026-10-06)
- Claude Code Remote Control — https://code.claude.com/docs/en/remote-control (fetched 2026-10-06)
- Claude in Slack — https://code.claude.com/docs/en/slack (not fetched; plan requirements UNVERIFIED)
- Claude Code auth / setup-token limits — https://code.claude.com/docs/en/authentication
- Channels + OAuth token issues — https://github.com/anthropics/claude-code/issues/80091 · https://github.com/anthropics/claude-code/issues/44945
- Telegram Bot API (`setWebhook` `secret_token`, getUpdates conflict, user ID size) — https://core.telegram.org/bots/api#setwebhook (fetched 2026-10-06)
- Hermes messaging overview, pairing, allowlist vars — https://hermes-agent.nousresearch.com/docs/user-guide/messaging/ (fetched 2026-10-06)
- Hermes Telegram (polling/webhook, secret required, groups) — https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram (fetched 2026-10-06)
- Hermes Slack (Socket Mode) — https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack (fetched 2026-10-06)
- Hermes Email — https://hermes-agent.nousresearch.com/docs/user-guide/messaging/email (fetched 2026-10-06)
- Hermes WhatsApp — https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp
- OpenClaw channels list — https://docs.openclaw.ai/channels (fetched 2026-10-06)
- OpenClaw Telegram + access control — https://docs.openclaw.ai/channels/telegram · https://docs.openclaw.ai/channels/telegram/access-control (fetched 2026-10-06)
- OpenClaw Slack — https://docs.openclaw.ai/channels/slack (fetched 2026-10-06)
- OpenClaw WhatsApp (Baileys only) — https://docs.openclaw.ai/channels/whatsapp
- OpenClaw gateway security — https://docs.openclaw.ai/gateway/security
- Slack Socket Mode — https://api.slack.com/socket-mode
- AgentMail — https://docs.agentmail.to (fetched 2026-10-06)
- Open WebUI env reference — https://docs.openwebui.com/reference/env-configuration
- WhatsApp usage in LATAM — https://infobip.com/blog/whatsapp-statistics
