# Profession: Creator

> Content creators, personal brands and solo marketers (Reels, TikTok, YouTube, newsletters): a Jarvis that finds ideas, drafts scripts and captions in the person's voice, tracks what performs, and never publishes without a "sí".

Last verified: 2026-10-06

Versions are not pinned here (see `knowledge/runtimes/*.md` and `knowledge/models.json`). Prices
are summarized in `knowledge/capabilities/costs.md` and `knowledge/countries/<cc>.md`.

## Signals

Pick this pack when the person says things like:

- "Hago contenido", "subo Reels / TikToks / Shorts", "tengo un canal de YouTube"
- "Mi marca personal", "mi comunidad", "mis seguidores", "mi audiencia"
- "No sé qué publicar", "se me acaban las ideas", "quiero publicar más seguido"
- "Escribo guiones", "edito videos", "hago carruseles", "tengo un newsletter / podcast"
- "Colaboraciones con marcas", "me llegan propuestas de marcas", "media kit"

Secondary pack: `agency` if they manage other people's accounts; `ecommerce` if they sell their
own products; `coach` if they sell 1:1 sessions.

## Week-one jobs

Written as the person would say them. Pick 3, confirm with the person, turn each into a skill and/or
a scheduled job.

1. "Cada mañana mándame 5 ideas de contenido de mi nicho con lo que está pasando hoy, y dime cuál
   harías tú." → `trend-brief` skill + morning job.
2. "Te mando una nota de voz con una idea y me la regresas como guion de Reel de 30 segundos con
   gancho, desarrollo y cierre, con mi forma de hablar." → `script-from-voice-note` skill.
3. "Escríbeme 3 versiones del caption y los hashtags para este post." → `caption-variants` skill
   (draft only).
4. "Cada lunes dime qué funcionó la semana pasada y qué repetir." → `weekly-performance` skill +
   Monday job (needs read-only analytics).
5. "Ayúdame a contestar las propuestas de marcas: qué cobrar y qué responder." → `brand-deal-reply`
   skill (draft only, never sends).

## Channels

| Use | Channel | Why |
|---|---|---|
| Owner ↔ Jarvis (default) | **Telegram** | Free, no policy risk. "Dictate an idea": keyboard dictation in v1; real voice notes need a transcription step that depends on the runtime (`knowledge/capabilities/voice.md` § Per-runtime support). See `knowledge/capabilities/channels.md` |
| Owner ↔ Jarvis, community-style creators | **Discord** (owner-only DM or private server, SEC-02 groups off) | Many creators already live there |
| Owner ↔ Jarvis on WhatsApp | WhatsApp Cloud API only, after the Gate C grey-zone disclosure in `knowledge/capabilities/whatsapp.md` | A personal "ask me anything" Jarvis on WhatsApp is not compliant by the letter of Meta's terms |
| Jarvis ↔ followers (DMs, comments) | **Not in v1.** Drafts only, the owner replies | Replying to followers is IRR-01/IRR-02. Auto-DM tools also touch each platform's automation rules |

Never Baileys for a creator's main number: a ban takes their business number with it (SEC-31).

## Memory

- Markdown workspace (always). Put the **brand voice** in `SOUL.md`: tone, words they use, words
  they never use, 3 example captions they love. Put the audience, niche, pillars and
  "never talk about" topics in `USER.md`.
- `memory/topics/ideas.md` (idea backlog), `memory/topics/posts.md` (one line per published post:
  date · platform · hook · result), `memory/topics/brands.md` (brand contacts by role, rates quoted,
  status).
- Add **sqlite-vec** (local) or **pgvector** (Railway Tier B) only when the idea/post archive passes
  ~200 lines and they want "¿ya hablé de esto antes?" searches. See `knowledge/capabilities/memory.md`.
- No graph memory.

## Tools / MCP

Trust tiers per `knowledge/capabilities/tools-mcp.md`: **T1** official remote MCP (OAuth) · **T2**
maintained community MCP pinned to a version · **T3** alpha or a generated thin wrapper · **T4**
Zapier MCP fallback. **Every integration starts read-only** (SEC-22).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| Web search / fetch | built-in (Claude Code) or Brave/Exa/Tavily MCP | read | Trend research. Results are untrusted input [A] (SEC-12) |
| Notion | T1 (Notion-hosted MCP, OAuth) | read; write to one "Ideas" database only if asked | Content calendar and idea bank. Endpoint `https://mcp.notion.com/mcp` (streamable HTTP, OAuth; Notion docs, checked 2026-10-06) |
| Google Drive / Docs | T1 (Google Workspace MCP, developer preview) | read | Scripts folder, media kit. Preview status: re-check before promising |
| Social scheduler (Zernio-type, multi-platform) | T1 for Zernio (vendor-hosted remote MCP, OAuth 2.1) | **read (analytics, queue) first**; creating posts = draft/queue only, publishing = IRR-02 | Zernio advertises posting, inbox, analytics and ads tools across many platforms. Ad tools move money (IRR-03): keep them out of the tool profile (SEC-23) |
| YouTube Data / Analytics API | T2 (community MCP, many forks) or T3 wrapper | read (`youtube.readonly`, analytics) | No first-party Google YouTube MCP found; check Google's developer docs at install for a newer one. Prefer a generated read-only wrapper over an unknown fork |
| Instagram Graph API | T3 wrapper or via the scheduler | read insights | Publishing via the API works only for **professional** accounts and is capped at 100 API-published posts per 24 h ([Meta docs](https://developers.facebook.com/docs/instagram-platform/content-publishing/)) |
| Image / video generation (Higgsfield-type MCP) | T1 if vendor-hosted OAuth | generate only | Spends credits: show the cost first and treat paid generations as IRR-03 when they exceed a set budget |
| Playwright MCP | T1 (vendor's local package, pinned) | read-only browsing of public pages | **No logged-in scraping** of Instagram/TikTok: it breaks their terms and risks the account. Public pages only |

Skip at v1: ad-account write access (Meta/Google/TikTok Ads). Add later with `/jarvis-add`, behind SEC-14.

## Scheduled jobs

Times are local. Off-minutes avoid the `:00`/`:30` pile-up. Claude Code Desktop/local and
launchd/cron run in the machine's timezone; **Railway cron runs in UTC**, so convert (CDMX UTC−6,
Bogotá UTC−5, Buenos Aires UTC−3, Madrid UTC+1/+2 with DST). See `knowledge/capabilities/scheduling.md`.

| Job | Cron (local) | Model slot | Output |
|---|---|---|---|
| Morning brief + 5 ideas (`morning-briefing` + `trend-brief`) | `7 8 * * 1-6` | `cheap` for gathering, `main` for the ideas | Telegram message |
| Posting reminder for today's planned post | `43 11 * * *` (or their usual posting time minus ~1 h) | `cheap` | "Hoy toca: … ¿lo dejas en cola?" |
| Weekly performance review (`weekly-performance`) | `13 9 * * 1` | `main` | What worked, what to repeat, 3 ideas for the week |
| Monthly content plan draft | `17 10 1 * *` | `main` | Draft calendar in Notion (only if write was granted) or as a message |

Unattended jobs never publish, never send DMs, never buy credits (SEC-15).

## Skills

From `templates/skills-base/`: `morning-briefing`, `remember`, `weekly-review`, `draft-reply` (for
brand emails). Trend research lives in the pack skill `trend-brief`. Pack-specific skills (no
template: `workspace-writer` writes each from its one-line spec below, in Agent Skills format):

| Skill id | One-line spec |
|---|---|
| `trend-brief` | Search the niche's news/trends from the last 24–48 h, return 5 angles with a hook each and a source link per angle. Needs `WebSearch` (+ `WebFetch` only for named domains); on `claude-code-local` follow its *Web research recipe*. |
| `script-from-voice-note` | Turn an idea (dictated text in v1; a transcribed voice note when the runtime has STT, `knowledge/capabilities/voice.md`) into a 30/60/90-s script (hook ≤3 s, body, CTA) in the `SOUL.md` voice, plus on-screen text. |
| `caption-variants` | Write 3 caption versions + hashtags per platform; mark it as a draft; never post. |
| `repurpose` | Turn one long piece (video transcript, newsletter) into a carousel outline, a short script and a post thread. |
| `weekly-performance` | Read last week's metrics (read-only), compare each post against the account's median, name the top hook patterns. |
| `brand-deal-reply` | Draft a reply to a brand inquiry using the rate card in `memory/topics/brands.md`; flag missing info (usage rights, exclusivity, payment terms). Never sends. |

### Autonomy, learning and media hooks

Defaults come from `knowledge/capabilities/autonomy.md`, `knowledge/capabilities/learning.md` and
`knowledge/capabilities/multimodal.md`. What this pack adds:

- **Autonomy:** content tasks (script, captions, repurpose) are **L1**: the autopilot drafts them
  into `drafts/`; publishing is never automatic (IRR).
- **Learning:** caption and hook style corrections become lessons (`ámbito:caption-variants` or
  `general`).
- **Media:** `watch-video` for references and competitor reels, called with `--detail balanced`
  (or `visual` for "¿qué se ve?"), since its default is captions only. The owner's voice-note ideas
  go through `transcribe` before `script-from-voice-note`.

## Guardrails

- **Irreversible (always a "sí" with exact preview, SEC-14):** publishing or scheduling a public post
  (IRR-02), replying to comments/DMs (IRR-01), deleting posts (IRR-04), ad spend or paid credits
  (IRR-03), accepting a brand deal (IRR-05, terms acceptance).
- **Rule of Two:** "read comments/DMs" is untrusted input [A]. A session that reads comments must not
  also hold a publish/reply tool without approval. Split: one job summarizes, the owner approves the
  reply.
- **Voice and face cloning:** only of the owner's own voice/face, with their consent recorded in spec §7.
  Never clone a third party.
- **AI disclosure:** in Spain, EU AI Act Art. 50 requires marking synthetic audio/video (see
  `knowledge/countries/es.md`). Elsewhere, recommend disclosing AI-generated media as good practice.
- **Sponsored content:** ad-disclosure rules for influencers exist in several countries (e.g. Spain's
  rules for high-reach users; Mexico and Colombia consumer-protection guidance). Jarvis does not
  restate per-country specifics: it reminds them to label "publicidad/colab" and points to the country file.
- **Copyright:** don't suggest using trending music or third-party clips outside the platform's own
  library; flag it in drafts.
- **Data sensitivity:** low by default. Brand contracts and rates are confidential: keep them in the
  local workspace, not in a public Notion page.
- **Account safety:** no logged-in scraping, no follow/unfollow or engagement automation (platform
  terms; risk of shadow-ban or loss of account).

## Interview extras

Ask only what this pack needs (1–3):

1. "¿En qué redes publicas y cuál es la que más te importa?" (decides which analytics to connect)
2. "Pásame 2 o 3 posts tuyos que sientas que suenan a ti." (seeds `SOUL.md` voice)
3. "¿Quieres que Jarvis deje los posts en cola en tu programador, o solo que te dé el texto?"
   (default: text only)

## Recommended default stack

| Budget | Stack |
|---|---|
| Low (`≤10` USD/mo) with Claude Pro | `claude-code-local` + Telegram + Desktop/local scheduled tasks + markdown memory + built-in web search + Notion (read). $0 extra. Archetype 1 in `knowledge/decision-tree.md` |
| Low, no Claude plan | `hermes` local (while-on) with an `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (never a Claude/ChatGPT subscription inside Hermes, `knowledge/auth-matrix.md`), the `cheap` slot from `knowledge/models.json` + Telegram. Spend cap first (SEC-27) |
| Medium (`10–30`/`30–100`), wants 24/7 | `hermes` on Railway Tier A + Telegram + scheduler MCP (read/queue) + Drive/Notion. Optional voice: voice notes in, owner's cloned voice out (see `knowledge/capabilities/voice.md`) |
| Non-technical, only the Claude app, Pro/Max | `cowork` — recommend and stop (connectors + scheduled tasks cover ideas and scripts) |

## Sources

- Profession → component map (creator row): Jarvis Architect design synthesis built from the sources listed here; component sources below. Playwright MCP: https://github.com/microsoft/playwright-mcp
- WhatsApp policy (business bots allowed, general-purpose assistants banned since 2026-01-15): https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform · https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- Voice (Spanish TTS/STT): https://elevenlabs.io/docs/overview/models · https://developers.deepgram.com/docs/tts-models-languages-overview · https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md · https://huggingface.co/rhasspy/piper-voices/tree/293cad0539066f86e6bce3b9780c472cc9157489/es/es_MX
- Instagram content publishing (professional accounts, 100 posts/24 h): https://developers.facebook.com/docs/instagram-platform/content-publishing/ (fetched 2026-10-06)
- Zernio MCP (remote, OAuth 2.1, `claude mcp add --transport http zernio https://mcp.zernio.com/mcp`): https://zernio.com/claude (fetched 2026-10-06; secondary listing https://claudemarketplaces.com/mcp/com.zernio/zernio, 2026-10-06)
- YouTube MCP servers are community wrappers: https://glama.ai/mcp/servers/fcm4amk43g (2026-10-06)
- Notion MCP (remote, OAuth, `https://mcp.notion.com/mcp`): https://developers.notion.com/docs/get-started-with-mcp (fetched 2026-10-06)
- Google Workspace MCP developer preview: https://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html
- Meta WhatsApp Business terms: https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- Claude Code scheduled tasks (jitter, local timezone): https://code.claude.com/docs/en/scheduled-tasks
- Railway cron jobs (UTC): https://docs.railway.com/reference/cron-jobs
