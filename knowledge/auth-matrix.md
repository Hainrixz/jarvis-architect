# Auth matrix: runtime × host → the only allowed credential

> Which login or key each runtime may use on each host, with the exact policy sentence behind every rule. If this file and your instinct disagree, this file wins; if a live source disagrees with this file, the live source wins and the file gets fixed.

Last verified: 2026-10-06

All quotes below were re-fetched from the primary source on 2026-10-06. GitHub issues are
secondary evidence of behaviour, not policy. Anything without a primary source carries a
**check live** note: `stack-researcher` confirms it at install time and the matrix default applies until it does. Versions are not repeated here; see the matching `knowledge/runtimes/<id>.md`.

## How to read it

| Code | Host | Who uses it |
|---|---|---|
| **L** | The person's own computer | Only the owner |
| **S** | The person's own VPS or Railway service, always on | Only the owner (one person, one account) |
| **P** | Someone (including Jarvis Architect or an agency) hosting a Jarvis **for other people** | Many end users |

Jarvis Architect builds **L** and **S** only. **P** appears so the Architect can recognise it and
stop (see § Refuse).

**The three-line version:**

1. A Claude Pro/Max subscription may only be used inside the **unmodified `claude` binary**
   (or a native Anthropic app such as Cowork), **by its owner**.
2. Every other harness that talks to Claude models (Agent SDK custom code, Hermes, OpenClaw,
   NanoClaw) uses an **Anthropic API key** (`ANTHROPIC_API_KEY`) with a spend cap.
3. A ChatGPT plan goes inside **Codex** (`codex login`, `--device-auth` on servers). Inside
   third-party agents a ChatGPT plan is only allowed through **Sign in with ChatGPT (SIWC)**;
   otherwise use `OPENAI_API_KEY`.

## The matrix

`Default` is what the Architect writes into the spec. `Alt` is allowed only when the person asks
for it and the listed conditions are met. Rule numbers refer to § Rules for the decision engine;
quote numbers refer to § Policy quotes.

| Runtime (`runtimes/<id>.md`) | L — own computer | S — own VPS / Railway, single owner | P — hosted for others |
|---|---|---|---|
| **Claude Code, interactive + `--channels`** (`claude-code-local`) | **Default:** `/login` with the person's Pro/Max account. **Alt:** `ANTHROPIC_API_KEY`. [Q1, Q4] | n/a — on a server this is `claude-code-server` | n/a |
| **Claude Code on a server, 24/7** (`claude-code-server`) | n/a | **Default:** `ANTHROPIC_API_KEY` (channels "permitted by default" with a Console key) [Q4]. **Alt (flagged, consent required):** the owner's subscription — either `/login` (paste-code flow) persisted on the volume, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` [Q1, Q2, Q3]. Rule 2. | Each end user signs in with their **own** credential; unmodified binary; Commercial Terms; no paying for or intermediating usage [Q1]. **Architect refuses to build.** |
| **Remote Control** (any Claude Code track) | `/login` only (Pro/Max/Team/Ent). API key and setup-token **do not work** [Q5]. | `/login` only, kept alive in tmux/screen; stops when the login expires [Q5, Q6] | End user's own `/login` only [Q1] |
| **`claude -p` + cron/launchd** (`claude-p-cron`) | **Default:** the existing `/login`. **Alt:** `CLAUDE_CODE_OAUTH_TOKEN` from the owner's `claude setup-token`, only when the scheduler can't reach the stored login, or `ANTHROPIC_API_KEY` [Q2] | `CLAUDE_CODE_OAUTH_TOKEN` ("CI pipelines and scripts") **or** `ANTHROPIC_API_KEY`. `--bare` needs an API key [Q2]. Usage draws from subscription limits [Q8]. | End user's own credential [Q1] |
| **Claude Agent SDK, custom code** (`claude-agent-sdk`) | **Default:** `ANTHROPIC_API_KEY`. Own subscription tolerated for a personal project the owner alone uses [Q8] — Architect does not set this up. | `ANTHROPIC_API_KEY` [Q1, Q9] | **API key only** [Q9] |
| **Hermes Agent with Claude models** (`hermes`) | `ANTHROPIC_API_KEY` only. Hermes "Anthropic OAuth" **forbidden** [Q10, Q11] | `ANTHROPIC_API_KEY` only [Q10] | API key per user [Q1] |
| **OpenClaw with Claude models** (`openclaw`) | `ANTHROPIC_API_KEY` only [Q10] | `ANTHROPIC_API_KEY` only [Q10] | API key per user [Q1] |
| **NanoClaw** (built on the Agent SDK; no runtime file — see `runtimes/claude-agent-sdk.md`) | `ANTHROPIC_API_KEY` only [Q9, Q10] | `ANTHROPIC_API_KEY` only | API key per user |
| **Codex CLI** (`codex-openai`) | **Default:** ChatGPT sign-in (`codex login`). **Alt:** `OPENAI_API_KEY` [Q12] | `codex login --device-auth` (device code must first be enabled in ChatGPT security settings) or a copied `~/.codex/auth.json` on the volume. API key recommended for programmatic/cron use [Q12] | API key per user; plan usage only via SIWC after OpenAI's interest form [Q13] |
| **OpenClaw with OpenAI models** (`openclaw`) | **Default:** SIWC (Beta) or Codex login. **Alt:** `OPENAI_API_KEY` [Q13, Q14] | **Default:** `OPENAI_API_KEY`. **Alt:** SIWC with a persisted host ID [Q13]. Reusing a Codex login inside OpenClaw on a server: not sanctioned in OpenAI docs, so use the default | API key per user; plan usage only after OpenAI approval [Q13] |
| **Hermes with OpenAI models** (`hermes`) | **Default:** `OPENAI_API_KEY`. Hermes `openai-codex` device-code OAuth works technically, but OpenAI does not document a third party reusing the Codex token, so use the API key [Q11] | `OPENAI_API_KEY` only | API key per user |
| **Hermes with Nous Portal** (`hermes`) | Nous Portal OAuth (vendor-recommended) [Q11] | Same. Check live: read Nous Portal's terms before offering it on a server | Refuse (no documented multi-user terms) |
| **Hermes/OpenClaw via OpenRouter** | `OPENROUTER_API_KEY` (API key; no subscription involved). Check live: read OpenRouter's terms and the provider's data-retention policy before sending private data | Same | API key per user |
| **Ollama, local models** (`ollama-local`) | No credential. Server binds `127.0.0.1:11434` by default [Q15] | n/a — never Railway (no GPUs). On an own always-on box: no credential, but the endpoint must stay on localhost/Tailscale | n/a |
| **Ollama Cloud models** | `ollama signin` or an Ollama key; prompts leave the machine [Q15] | Same | n/a |
| **Claude Cowork / Desktop** (`cowork`) | The person's own claude.ai login in Anthropic's app. Draws from subscription limits [Q8]. Nothing to configure. | n/a — no self-hosting | n/a |

### Row names used by other files

Other knowledge files point to rows by these names; they map to the rows above.

| Name used elsewhere | Row(s) here |
|---|---|
| "Claude Code CLI interactive + `--channels`", column S (`runtimes/claude-code-server.md`) | **Claude Code on a server, 24/7** |
| "Claude Code CLI interactive + `--channels`", column L | **Claude Code, interactive + `--channels`** |
| "Claude Code headless (`claude -p`, cron/scheduled)" (`runtimes/claude-p-cron.md`) | **`claude -p` + cron/launchd** |
| "OpenClaw / Hermes with Claude models" (`runtimes/hermes.md`) | **Hermes Agent with Claude models** and **OpenClaw with Claude models** |
| "Codex CLI" and "OpenAI" (`runtimes/codex-openai.md`) | **Codex CLI**, **OpenClaw with OpenAI models**, **Hermes with OpenAI models** |
| "Ollama / local models" (`runtimes/ollama-local.md`) | **Ollama, local models** |
| "Claude Cowork / Desktop" (`runtimes/cowork.md`) | **Claude Cowork / Desktop** |

## Rules for the decision engine

1. **Server + Claude harness → write `ANTHROPIC_API_KEY` by default.** It is the only server
   credential documented for channels ("permitted by default"), it works with `--bare`, it has no
   refresh/expiry bugs, and it bills per use under a spend cap. [Q4, Q2]
2. **Subscription on a server is the flagged alternative, never the default.** Offer it only to a
   Pro/Max individual, only for `claude-code-server` or `claude-p-cron`, labelled "programa
   oficial sin modificar, uso personal, sin garantía". Before BUILD, log a dated consent line in
   spec §7 that names all four risks: (a) channels with `CLAUDE_CODE_OAUTH_TOKEN` are not
   documented by Anthropic; (b) known bugs (stale stored login overriding the env token, broken
   OAuth refresh in long `--channels` sessions, 401s with `claude -p`) [I1–I3]; (c) Pro/Max limits
   "assume ordinary, individual usage" [Q1]; (d) Anthropic "may do so without prior notice" [Q1].
   Technical conditions: the container has **no** `~/.claude/.credentials.json` when the env token
   is used, never passes `--bare`, has **no** `ANTHROPIC_API_KEY` set alongside it (the key
   outranks the token and would silently bill the API instead) [Q2], and the allowlist is the
   owner only. Handling: the **owner** runs `claude setup-token` in their own terminal (it prints
   the token on screen), copies it straight into the Railway variable or their local `.env`, and
   closes the terminal; it never goes into the chat and the Architect never reads it back [Q1].
   The token lasts one year [Q2]: add a renewal reminder (a scheduled job ~2 weeks before expiry, and the date in spec §7). Missing
   consent → `jarvis-validator` MAJOR.
3. **Remote Control needs a real `/login`.** Never plan Remote Control on a host that only has an
   API key or a setup-token; it will not start. [Q5]
4. **Never put Claude subscription credentials into a third-party harness.** No
   `CLAUDE_CODE_OAUTH_TOKEN`, no `~/.claude` credentials, no "Claude login" option inside Hermes,
   OpenClaw, NanoClaw or Agent SDK code. Hermes "Anthropic OAuth … routes as Claude Code" is
   identity misrepresentation and is forbidden even with extra usage credits. → `jarvis-validator`
   BLOCKER. [Q9, Q10, Q11]
5. **The channel allowlist contains only the owner.** A subscription (and a personal API key) may
   not be shared or made available to anyone else; a family member or employee who wants to use
   Jarvis gets their own build with their own credential. [Q7, Q1]
6. **Anything built for other people (P) uses each end user's own credential.** Jarvis Architect
   does not build P; if the person describes it, stop and explain (§ Refuse). [Q1, Q9]
7. **Codex on a server → `codex login --device-auth` or `OPENAI_API_KEY`;** for unattended cron
   jobs prefer the API key. [Q12]
8. **ChatGPT plan inside a third-party agent → only via SIWC** (OpenClaw "Sign in with ChatGPT").
   Hermes `openai-codex` OAuth is not SIWC; default Hermes to `OPENAI_API_KEY`. [Q13, Q11]
9. **Every API key gets a spend cap before anything goes live** (provider console limit, plus the
   harness's own budget setting where it has one). See `capabilities/costs.md` and
   `security-checklist.md`.
10. **Ask which plan they pay; don't detect it.** Preflight can show the login *type*, never read
    a credential file. Never read, print or copy `.env`, `auth.json` or `.credentials.json`.
11. **Ollama needs no key, but its port is a credential.** Never bind `0.0.0.0` on a reachable
    host and never expose it through a public Railway domain. [Q15]
12. **Live check before quoting.** These policies move. `stack-researcher` re-fetches the quoted
    URL before ARCHITECTURE; if the wording changed, the live text wins and you say so in one line.

## Policy quotes (exact text, fetched 2026-10-06)

**Q1 — Claude Code Legal and compliance** — https://code.claude.com/docs/en/legal-and-compliance
- "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."
- "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users."
- "Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude account must complete through Anthropic's own flow." (This is why the Architect never handles a setup-token itself: the owner generates it and pastes it straight into their own secret store. See Rule 2 and Refuse 6.)
- "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code as described under *Can customers offer Claude Code in their products?* above."
- "The Claude Code binary must not be modified." / "Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf. Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential"
- "Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK."
- "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."

**Q2 — Authentication (setup-token, precedence, bare mode)** — https://code.claude.com/docs/en/authentication
- "`CLAUDE_CODE_OAUTH_TOKEN` environment variable. A long-lived OAuth token generated by `claude setup-token`. Use this for CI pipelines and scripts where browser login isn't available."
- "This token authenticates with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan. It can only make model requests, so it can't establish Remote Control sessions or fetch claude.ai connectors. MCP servers you configure locally still work."
- "For CI pipelines, scripts, or other environments where interactive browser login isn't available, generate a one-year OAuth token with `claude setup-token`" / "the token prints to the terminal after you approve access in the browser. It does not save the token anywhere"
- "Bare mode does not read `CLAUDE_CODE_OAUTH_TOKEN`. If your script passes `--bare`, authenticate with `ANTHROPIC_API_KEY` or an `apiKeyHelper` instead."
- "In non-interactive mode (`-p`), the key is always used when present." (about `ANTHROPIC_API_KEY`, which outranks `CLAUDE_CODE_OAUTH_TOKEN` and `/login` in the precedence list)

**Q3 — Authentication (headless `/login`)** — https://code.claude.com/docs/en/authentication
- "If your browser shows a login code instead of redirecting back after you sign in, paste it into the terminal at the `Paste code here if prompted` prompt. This happens when the browser can't reach Claude Code's local callback server, which is common in WSL2, SSH sessions, and containers."

**Q4 — Channels** — https://code.claude.com/docs/en/channels
- "They require Anthropic authentication through claude.ai or a Console API key, and are not available on Amazon Bedrock, Google Cloud's Agent Platform, or Microsoft Foundry."
- "Anthropic Console with API key authentication: channels are permitted by default."
- "Pro and Max users without an organization skip these checks entirely: channels are available and users opt in per session with `--channels`."
- Note: the page does not mention `CLAUDE_CODE_OAUTH_TOKEN`. Channels with the setup-token are **undocumented** (the token keeps locally configured MCP servers working, Q2, and a channel is one — inference, not policy).

**Q5 — Remote Control** — https://code.claude.com/docs/en/remote-control
- "Subscription: available on Pro, Max, Team, and Enterprise plans. API keys are not supported."
- "You're authenticated with a long-lived token from `claude setup-token` or the `CLAUDE_CODE_OAUTH_TOKEN` environment variable. These tokens can only make model requests, so they can't establish Remote Control sessions."

**Q6 — Login expiry** — https://code.claude.com/docs/en/authentication#renew-an-expiring-login
- "A background session in agent view or a Remote Control session that outlives the login stops making progress once the credential expires and can't recover until you sign in again."

**Q7 — Consumer Terms (effective 2025-10-08)** — https://www.anthropic.com/legal/consumer-terms
- "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise." (Q2's "CI pipelines and scripts" is that explicit permission for the setup-token.)
- "You may not share your Account login information, Anthropic API key, or Account credentials with anyone else. You also may not make your Account available to anyone else."

**Q8 — Agent SDK credit change, paused (support 15036540, updated 2026-06-16)** — https://support.claude.com/en/articles/15036540
- "We're pausing the changes to Claude Agent SDK usage described below. For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits."
- The paused change targeted "Claude Agent SDK usage in your own projects (Python or TypeScript)". Interactive Claude Code and Claude Cowork keep using subscription limits.

**Q9 — Agent SDK overview** — https://code.claude.com/docs/en/agent-sdk/overview
- "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."

**Q10 — Third-party tools (support 13189465, updated 2026-05-19)** — https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
- "The preferred way to access Anthropic services using third-party software, tools, or services ("third-party tools"), including open-source projects, is through API key authentication through Claude Console or a supported cloud provider."
- "Anthropic may at its discretion allow paid subscribers who have enabled usage credits to use certain third-party tools to access Anthropic services included in paid subscription plans, but reserves the right to draw use of such third-party tools from usage credits rather than subscription limits."
- "Use of third-party tools that misrepresent their identity to Anthropic's servers, attempt to route third-party traffic against subscription limits, or otherwise violate applicable terms or policies is prohibited and such use may be enforced against."

**Q11 — Hermes provider docs** — https://hermes-agent.nousresearch.com/docs/integrations/providers
- Anthropic OAuth: "Hermes routes as Claude Code against your Anthropic account. It only works if you're on a Claude Max plan and have purchased extra usage credits." → matches Q10's "misrepresent their identity" → **forbidden** in Jarvis Architect.
- OpenAI Codex provider: "authenticates via device code by default"; can import `~/.codex/auth.json`; "plan-quota semantics are not yet documented".
- Nous Portal: described as "the recommended way to run Hermes Agent".

**Q12 — Codex authentication** — https://learn.chatgpt.com/docs/auth (redirect from developers.openai.com/codex/auth)
- Headless: enable device code login in ChatGPT security settings, then `codex login --device-auth`; or copy `~/.codex/auth.json` ("Treat this file like a password since it contains access tokens").
- API key authentication is recommended "for programmatic Codex CLI workflows, such as CI/CD jobs".

**Q13 — Sign in with ChatGPT (SIWC), preview** — https://developers.openai.com/siwc/token-sharing-open-source
- "your open-source app can request permission to use the user's ChatGPT plan for eligible Responses API requests"
- "If you're interested in offering it in a paid or remotely hosted app, complete the interest form."
- Self-hosted VMs: "generate and persist a stable `ext_agent_host_id` for each host separately" before the first sign-in.
- Preview limits (store:false, stream:true, no image generation, file search, Code Interpreter, hosted MCP/connectors or audio): https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations (`stack-researcher` re-fetches this page before quoting the limits).

**Q14 — OpenClaw OpenAI auth** — https://docs.openclaw.ai/providers/openai/authentication
- Codex login: "use your ChatGPT account for Codex models. Choose browser OAuth locally or device code on a remote machine."
- Sign in with ChatGPT (Beta): "authorize OpenClaw as an app to use your Codex allowance for eligible Responses API calls."
- API key: "use OpenAI Platform models with your project's permissions and API billing."

**Q15 — Ollama FAQ** — https://docs.ollama.com/faq
- "Ollama binds 127.0.0.1 port 11434 by default." Exposure is changed with `OLLAMA_HOST`.
- "Ollama runs locally. We don't see your prompts or data when you run locally." Cloud models need `ollama signin` or a key from ollama.com/settings/keys.

**Known issues (secondary evidence, behaviour not policy)**
- **I1** — anthropics/claude-code#80091: in `--channels` mode the CLI used a stored, expired Keychain login instead of a valid `CLAUDE_CODE_OAUTH_TOKEN`; deleting the stored login restored service. Closed as not planned. https://github.com/anthropics/claude-code/issues/80091
- **I2** — anthropics/claude-code#44945: OAuth auto-refresh broken in long-running `--channels` sessions. https://github.com/anthropics/claude-code/issues/44945
- **I3** — anthropics/claude-code#65320: setup-token returned 401 with `claude -p`. Closed. If `claude -p` returns 401 with a setup-token, run `claude update` and `claude setup-token` again; if it persists, use `/login` (local) or an API key. https://github.com/anthropics/claude-code/issues/65320

## How to say it (one sentence each, Spanish, for non-technical people)

| Case | Say this |
|---|---|
| `claude-code-local` with Pro/Max | "Usas tu suscripción de Claude tal cual, en el programa oficial y en tu computadora: no pagas nada extra." |
| `claude-code-server` default (API key) | "En un servidor usamos una llave de API de Anthropic: pagas solo lo que Jarvis consume, con un tope mensual que tú fijas, y es la vía que Anthropic documenta para esto." |
| `claude-code-server` with subscription token (flagged) | "Se puede usar tu suscripción en tu propio servidor porque es el programa oficial y solo lo usas tú, pero Anthropic no documenta este uso con Telegram, tiene fallas conocidas y puede cortarlo sin aviso; si aceptas ese riesgo, lo anoto." |
| Remote Control | "Para manejar tu sesión desde la app de Claude en el celular necesitas iniciar sesión con tu cuenta de Claude; con una llave de API no funciona." |
| `claude-p-cron` | "Tus tareas programadas usan tu misma cuenta de Claude y cuentan contra el límite de tu plan, como si las hicieras tú a mano." |
| `claude-agent-sdk` | "Como esto es código propio y no el programa oficial de Claude, Anthropic pide usar una llave de API, no tu suscripción." |
| Hermes / OpenClaw / NanoClaw with Claude | "Estos programas no son de Anthropic, así que con modelos de Claude usan una llave de API; meter tu suscripción ahí va contra las reglas y te pueden suspender la cuenta." |
| Hermes "Anthropic OAuth" asked for | "Esa opción hace que Hermes se haga pasar por Claude Code ante Anthropic, y eso está prohibido; vamos con llave de API, que es lo seguro." |
| `codex-openai` | "Codex es el programa oficial de OpenAI, así que puede usar tu plan de ChatGPT; en un servidor entras con un código desde tu celular." |
| OpenClaw with ChatGPT plan | "OpenClaw puede usar tu plan de ChatGPT con 'Sign in with ChatGPT', la vía oficial de OpenAI para apps de terceros, que todavía está en prueba." |
| Hermes with OpenAI | "Con Hermes usamos una llave de API de OpenAI, porque OpenAI no ha aclarado si permite reutilizar el inicio de sesión de Codex en otros programas." |
| `ollama-local` | "El modelo corre en tu computadora: no hay cuenta, no hay llave y nada sale de tu equipo." |
| `cowork` | "Claude Cowork ya viene con tu plan: solo inicias sesión en la app de Claude, no hay nada que instalar ni llaves que guardar." |
| Allowlist owner-only | "Tu Jarvis solo te responde a ti, porque tu cuenta y tu llave no se pueden compartir con nadie más." |

## Refuse — what the Architect must not do

Say no in one line, give the compliant alternative, move on. These are not negotiable even if
the person insists or says "it's only for testing".

1. Putting a Claude Pro/Max login, `CLAUDE_CODE_OAUTH_TOKEN` or `~/.claude` credentials into
   Hermes, OpenClaw, NanoClaw, Agent SDK code, n8n, Letta or any other non-Anthropic program.
   → Alternative: `ANTHROPIC_API_KEY` with a spend cap.
2. Enabling Hermes "Anthropic OAuth" (routes as Claude Code), even on Max with extra usage
   credits. → Alternative: API key, or Nous Portal / OpenRouter.
3. Any modified, patched or wrapped `claude` binary, or a proxy that turns a subscription into an
   API endpoint for other programs.
4. Sharing one subscription or one API key between people: adding a partner, employee, client or
   family member to the allowlist, or building "one Jarvis for the whole team" on the owner's
   account. → Alternative: each person gets their own build and their own credential.
5. Building P: hosting Jarvis for clients/customers on the person's credential, or reselling
   Claude/ChatGPT usage. → Explain that each end user must bring their own credential under the
   provider's commercial terms, and stop.
6. Asking the person to paste a key or token into the chat, or reading/printing `.env`,
   `auth.json`, `.credentials.json` or a keychain entry. Only check *whether* a variable is set
   (e.g. `test -n "$ANTHROPIC_API_KEY"`). Anthropic forbids developers to "collect, store, or
   intermediate Claude.ai credentials or session tokens" [Q1].
7. Planning Remote Control on an API-key or setup-token host (it cannot work).
8. Using the subscription token on a server without the logged consent of Rule 2.
9. Recommending third-party "no API key needed" Claude Code templates whose auth method is not
   documented (e.g. the Railway "Tarsee" template, auth not documented). → Alternative: our own
   `claude-code-server` build where the owner signs in themselves.
10. Exposing an Ollama, gateway or admin port publicly as a "no credential needed" shortcut.

## How `jarvis-validator` uses this file

| Finding | Grade |
|---|---|
| Claude subscription credential referenced in a Hermes/OpenClaw/NanoClaw/Agent SDK config | BLOCKER |
| Hermes `provider: anthropic` with OAuth instead of an API key | BLOCKER |
| Allowlist with anyone other than the owner, or a wildcard | BLOCKER |
| Subscription token on a server without the dated consent line in spec §7 | MAJOR |
| `--bare` combined with `CLAUDE_CODE_OAUTH_TOKEN` | MAJOR (it will not authenticate) |
| `ANTHROPIC_API_KEY` and `CLAUDE_CODE_OAUTH_TOKEN` both set for the same service | MAJOR (the key wins and bills the API, Q2) |
| Remote Control planned with only an API key or setup-token | MAJOR |
| API key without a documented spend cap | MAJOR |

## Check live before relying on

`stack-researcher` re-checks each item below at install time; until it confirms one, the matrix default in that row applies.

- Channels running on `CLAUDE_CODE_OAUTH_TOKEN`: works per community reports (I1). If the bot stops answering, remove any stored `/login` credential (I1) and restart the channel.
- Setup-token 401 with `claude -p` (I3): fallback is in I3 above.
- Whether OpenAI sanctions third parties (Hermes, OpenClaw's Codex-login path) reusing a Codex
  client token on a server.
- Nous Portal and OpenRouter terms of service and data-retention policies.
- SIWC preview limitations: re-fetch the page before quoting them.
- Cowork plan availability details (secondary sources; see `runtimes/cowork.md`).
- Railway "Tarsee" template's authentication method.

## Sources

- https://code.claude.com/docs/en/legal-and-compliance
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/channels
- https://code.claude.com/docs/en/remote-control
- https://code.claude.com/docs/en/agent-sdk/overview
- https://www.anthropic.com/legal/consumer-terms
- https://support.claude.com/en/articles/15036540
- https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
- https://hermes-agent.nousresearch.com/docs/integrations/providers
- https://learn.chatgpt.com/docs/auth
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://docs.openclaw.ai/providers/openai/authentication
- https://docs.ollama.com/faq
- https://github.com/anthropics/claude-code/issues/80091
- https://github.com/anthropics/claude-code/issues/44945
- https://github.com/anthropics/claude-code/issues/65320
