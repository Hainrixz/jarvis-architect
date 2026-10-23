# Capability: Voice

> How a Jarvis hears and speaks Spanish: voice notes in Telegram/WhatsApp by default (speech-to-text in, text or an audio reply out), fully local for private or $0 setups, and realtime calls only as an advanced add-on.

Last verified: 2026-10-06

Versions are not pinned here. Runtime versions live in `knowledge/runtimes/<id>.md`; LLM model IDs and token prices live in `knowledge/models.json`. Vendor model names below (Deepgram Nova-3 and Aura-2, ElevenLabs Flash and v4 Turbo, OpenAI's transcribe and realtime families) are product names, not pins: `stack-researcher` re-checks the exact API model ID and price before anything is written to a config.

**Incoming media lives in `knowledge/capabilities/multimodal.md`:** the local Whisper pipeline, the `transcribe` and `watch-video` skills, size and duration limits, photos, PDFs, video and the per-runtime matrix. This file keeps the voice choices: which STT vendor, TTS voices, cloning and realtime calls.

## Decision rule

Ask one question (from `questions/2-ramas.md`): *"¿Quieres que te hable con voz o te basta con texto y notas de voz?"* Then:

| Situation | Voice in (STT) | Voice out (TTS) | Notes |
|---|---|---|---|
| **Default.** Personal Jarvis on Telegram or WhatsApp, normal data | Voice notes → **Deepgram Nova-3 multilingual** (handles Spanglish) or **OpenAI transcription** if the runtime only speaks OpenAI | **Text reply.** Audio reply only if they ask for it | Cheapest and most useful. Most people want to *talk* to Jarvis and *read* the answer |
| They want Jarvis to answer with a nice voice | Same as default | **ElevenLabs Flash** or **v4 Turbo** with a Mexican/LatAm voice from the library | Best Spanish quality |
| Low budget, but wants audio replies | Deepgram Nova-3 multilingual | **Deepgram Aura-2** Spanish voice | One vendor, one key, $200 signup credit |
| Sensitive data (health, legal, third-party finances) or "nada sale de mi compu" | **Local whisper.cpp** (Mac: Metal) or faster-whisper | **Piper** `es_MX-claude-high` (local) or no audio | $0 per minute, nothing leaves the machine. Robotic but clear voice |
| Student / $0 budget | Local whisper.cpp | Text only, or Piper | Kokoro only if an English voice is fine (weak Spanish, no Mexican accent) |
| Runtime is stock Claude Code (`claude-code-local`, `claude-code-server`) on the official Telegram plugin | v1 default for non-technical owners: **phone keyboard dictation** (Gboard / iOS dictation), zero install. Add-on: voice notes **do** arrive (as an attachment Claude fetches with `download_attachment`), so a local **whisper.cpp** skill can transcribe them | Text | See § Per-runtime support. Don't patch the official plugin |
| Wants to *call* Jarvis and talk in real time (phone or web) | **Advanced tier.** OpenAI Realtime (speech-to-speech) or a Pipecat / LiveKit cascade | Same pipeline | Costs 10–50x more than voice notes, needs a server and a public endpoint. Never in week one |
| Wants Jarvis to speak in **their own cloned voice** | — | ElevenLabs voice cloning, owner's own voice only | Consent rule in § Security |

Hard lines:
- **Voice notes first, realtime later.** A non-technical person on day one gets voice notes in and text out. Offer audio replies as a toggle. Realtime calls only after the Jarvis has run for a week and they still want it.
- **Voice is never an authentication factor.** A voice note or call can't approve a payment, a send or a delete on its own; the approval gate stays in text with an exact preview (SEC-14 in `knowledge/security-checklist.md`).
- Local STT/TTS runs on the person's hardware. On Railway use a cloud STT/TTS; don't run whisper large models on a small Railway service (same reasoning as `knowledge/compatibility.md` CMP-01 and CMP-21).

## How voice notes work (the default pipeline)

```
Telegram / WhatsApp voice note (.ogg Opus)
  → runtime downloads the file
  → STT (cloud or local) → transcript (text)
  → the LLM answers as with any text message
  → reply as text  (optional: TTS → .ogg Opus voice note / .mp3 attachment)
```

- Telegram and WhatsApp send voice notes as OGG/Opus. Telegram bots can download files up to 20 MB through `getFile` ([Telegram Bot API](https://core.telegram.org/bots/api#getfile)), far more than any voice note.
- To send a native voice bubble back, the audio must be OGG/Opus; most runtimes convert with `ffmpeg`. Without ffmpeg the reply arrives as an MP3 attachment (documented for Hermes, [Hermes WhatsApp Cloud docs](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud)).
- The local path (ffmpeg → whisper.cpp → tagged transcript → audio deleted) is the `transcribe` skill; its steps, limits and tests are in `knowledge/capabilities/multimodal.md` § Audio.
- Tell the person in one line: *"Le mandas audios como a cualquier contacto; Jarvis los transcribe y te contesta por escrito. Si quieres, también te contesta con voz."*

## Options and tradeoffs

### Speech-to-text (voice in)

| Option | Price (pay-as-you-go) | Spanish / LatAm | Where it runs | Verdict |
|---|---|---|---|---|
| **Deepgram Nova-3 multilingual** | $0.0052/min pre-recorded; streaming $0.0058/min promo (regular $0.0092); $200 free credit at signup ([deepgram.com/pricing](https://deepgram.com/pricing), fetched 2026-10-06) | Real-time code-switching across 10 languages incl. Spanish ([Deepgram](https://deepgram.com/learn/nova-3-multilingual-major-wer-improvements-across-languages)). No published WER for LatAm accents | Cloud | **Cloud default** where the runtime supports Deepgram (OpenClaw, custom code) |
| **OpenAI transcription** (Whisper / `gpt-4o-transcribe` / `gpt-4o-mini-transcribe` families) | Whisper and `gpt-4o-transcribe` $0.006/min; `gpt-4o-mini-transcribe` $0.003/min; `gpt-transcribe` $0.0045/min (estimated per-minute figures on the [OpenAI pricing](https://developers.openai.com/api/docs/pricing), fetched 2026-10-06) | Good multilingual coverage | Cloud | Default when the runtime only supports OpenAI STT (Hermes `openai` provider) or the person already has an OpenAI key |
| **ElevenLabs Scribe** | $0.22/hour batch, $0.39/hour realtime ([elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api), fetched 2026-10-06) | Multilingual | Cloud | Fine if they already use ElevenLabs for TTS (one key) |
| **Groq Whisper** | Free tier mentioned in Hermes docs; paid price re-checked live by `stack-researcher` at [groq.com/pricing](https://groq.com/pricing) before quoting | Whisper-family | Cloud | Hermes option. Before sending private audio, read Groq's current data-use terms; if they allow training on inputs, use local whisper.cpp (CMP-35) |
| **whisper.cpp** (local) | $0 | Whisper-family, multilingual. Default model `ggml-large-v3-turbo-q5_0` (≈574 MB; file, SHA-256 and pinned commit in the runtime file's § Pinned versions); `tiny`/`base` miss accents. During setup, transcribe one 20-second voice note from the owner; if names or accents come out wrong, move up one model size | Person's Mac/PC. Apple Silicon uses Metal, roughly 10x real time with large-v3 on M-series (secondary: promptquorum.com 2026) | **Local default.** Homebrew formula `whisper.cpp` (formerly `whisper-cpp`, MIT) ships `whisper-cli`; models are separate GGML downloads from Hugging Face ([formulae.brew.sh/formula/whisper.cpp](https://formulae.brew.sh/formula/whisper.cpp)) |
| **faster-whisper** (local) | $0 | Same Whisper models | Linux/NVIDIA or CPU | Hermes' `local` STT provider uses it ([Hermes WhatsApp docs](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp)) |

### Text-to-speech (voice out)

| Option | Price | Spanish voices | Latency | Verdict |
|---|---|---|---|---|
| **ElevenLabs Flash** | $0.04 per 1K characters ([elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api)) | Library has many Mexican-accent voices; Multilingual v2 lists "Spanish (Spain, Mexico)" ([ElevenLabs models](https://elevenlabs.io/docs/overview/models)) | ~75 ms | **Premium default** |
| **ElevenLabs v4 Turbo** | $0.011 per 1K chars **promo until Oct 12**, then $0.04; v4 $0.022 promo → $0.08. A pay-as-you-go free-character allowance was reported by secondary sources but is not stated on the pricing page, so quote only what [elevenlabs.io/pricing](https://elevenlabs.io/pricing) shows at install | Listed as "Spanish, LatAm" ([ElevenLabs models](https://elevenlabs.io/docs/overview/models); confirm on the models page at install) | ~100 ms | Use it when the person prefers its voices; quote the **post-promo** price, not the promo |
| **Deepgram Aura-2** | $0.030 per 1K characters ([deepgram.com/pricing](https://deepgram.com/pricing)) | 10 Spanish voices (aquila, sirio, nestor, carina, celeste, alvaro, diana, selena, estrella, javier) covering Mexican, Peninsular, Colombian, Argentine and LatAm accents; which voice is which accent isn't documented on the overview page. Aquila, Carina, Diana, Javier and Selena switch English↔Spanish mid-sentence ([Deepgram TTS languages](https://developers.deepgram.com/docs/tts-models-languages-overview)) | ~200 ms | **Budget cloud default**; same key as Nova-3 |
| **OpenAI TTS** (`gpt-4o-mini-tts`, `tts-1`) | `tts-1` $15 per 1M chars; `gpt-4o-mini-tts` $12 per 1M audio-output tokens ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)) | Multilingual; play one sample reply in the owner's language and let them approve the accent before choosing it | ~200 ms (secondary) | Cheapest cloud; fine for OpenAI-only setups |
| **Piper** (local) | $0 | Mexican voices `es_MX-ald-medium` and `es_MX-claude-high` ([HF rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/293cad0539066f86e6bce3b9780c472cc9157489/es/es_MX)). Each voice has its own license on its model card — check it | Real time on CPU, even a Raspberry Pi | **Local default for Spanish.** Robotic but intelligible. Package `piper-tts` on PyPI, GPL-3.0-or-later, repo moved to OHF-Voice/piper1-gpl ([PyPI](https://pypi.org/project/piper-tts/), fetched 2026-10-06) |
| **Kokoro-82M** (local) | $0 | Only `ef_dora`, `em_alex`, `em_santa`; grade C for dora/alex; VOICES.md warns non-English may be "absent or thin due to weak G2P"; **no Mexican accent** ([HF VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)) | Fast on CPU | **Not for Spanish speakers.** Only when an English voice is acceptable |
| **Edge TTS** (Hermes `edge` provider; elsewhere the `edge-tts` package, LGPLv3, [PyPI](https://pypi.org/project/edge-tts/), checked 2026-10-23) | $0 | 322 voices / 74 languages per Hermes docs; Mexican neural voices such as `es-MX-JorgeNeural` | Cloud | Uses Microsoft's Edge read-aloud service; it has no published terms for bot use, so offer it only as a free option the person chooses after hearing that; never a default. **Consent first:** read them the sentence "el texto que Jarvis te dice en voz alta se manda a Microsoft; no hay términos publicados para este uso y puede dejar de funcionar sin aviso", then log a dated spec §7 row naming the provider. Never with a sensitive pack (CMP-39). Keep Piper installed as the fallback and an off switch that is one file (`voices/engine`), so "que no salga nada de mi compu" is one step |

### Realtime voice (advanced tier)

| Option | What it is | Cost | Verdict |
|---|---|---|---|
| **OpenAI Realtime API** (`gpt-realtime*` family) | Speech-to-speech, ~300 ms. The brain is an OpenAI model, **not Claude** | Audio tokens $32 in / $64 out per 1M for the full model, $10 / $20 for the mini ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)); realistic ~$0.06–0.11 per minute for the full model (secondary: forasoft.com, qz.com 2026; `stack-researcher` re-checks live before quoting) | Best latency. Via OpenAI Agents SDK realtime agents (+ Twilio for phone). Only when the person accepts a non-Claude voice brain |
| **Pipecat** (BSD-2) | Open-source cascade orchestrator: STT → any LLM (Claude) → TTS, pick your transport/telephony | STT + LLM + TTS per-minute costs added up | Keeps Claude as the brain; adds 300–800 ms vs speech-to-speech (secondary). Best for phone or a custom pipeline |
| **LiveKit Agents** (Apache-2.0) | WebRTC rooms + agent framework | Same cascade costs (+ LiveKit Cloud if used; price re-checked live at [livekit.io/pricing](https://livekit.io/pricing) before quoting) | Best for a web or app call UI |

Realtime needs: an always-on server (Railway, see `knowledge/capabilities/deploy-railway.md`), a public HTTPS/WebSocket endpoint, a phone number (Twilio or similar; `stack-researcher` checks the per-country number and minute price on the vendor's pricing page before quoting) or a web page, and a stricter spend cap. Claude has no realtime speech-to-speech API in its docs as of 2026-10-06, so a Claude-brained call is a cascade; `stack-researcher` re-checks the Claude docs before designing a call and switches to the native API if one has shipped.

## Recommended stacks

| Profile | STT | TTS | Approx. monthly voice cost* |
|---|---|---|---|
| Default cloud | Deepgram Nova-3 multi (or OpenAI mini-transcribe) | Text, optional ElevenLabs Flash | ~$1–2 STT; +~$5 if every reply is audio |
| Budget cloud | Deepgram Nova-3 multi | Deepgram Aura-2 | ~$1.50 + ~$3.60 (covered by the $200 credit for a long time) |
| Fully local / private | whisper.cpp | Piper `es_MX-claude-high` or text | $0 (electricity, CPU time) |
| Premium creator | Deepgram Nova-3 multi | ElevenLabs, cloned own voice | ~$2 + ElevenLabs usage |
| Realtime calls | OpenAI Realtime or Pipecat cascade | (included) | ~$4–7 for 1 h/month; ~$18–33 for 10 min/day (per-minute estimate from secondary sources; re-checked live before quoting) |

\*Worked example, not a quote: 10 voice notes a day × 1 minute = 300 min/month → Deepgram multi pre-recorded 300 × $0.0052 = $1.56; OpenAI Whisper 300 × $0.006 = $1.80; mini-transcribe $0.90. Audio replies: 300 replies × ~400 characters = 120K chars → ElevenLabs Flash $4.80, Aura-2 $3.60, Piper $0. LLM tokens for the transcript are extra (see `knowledge/capabilities/costs.md` and `knowledge/models.json`). `stack-researcher` re-checks every price before the cost quote at the ARCHITECTURE gate.

## Per-runtime support

| Runtime | Voice notes in | Voice replies out | Setup notes |
|---|---|---|---|
| `claude-code-local` / `claude-code-server` (official Telegram/Discord channel plugins) | **Voice notes arrive as attachments.** The Telegram plugin handles `message:voice` and passes `attachment_kind: voice` + a `file_id`; Claude fetches the audio with the `download_attachment` tool ([plugin source](https://github.com/anthropics/claude-plugins-official/blob/main/external_plugins/telegram/server.ts), re-checked 2026-10-06). There is no built-in transcription: add the `transcribe` skill (`templates/skills-base/transcribe/`, pipeline in `knowledge/capabilities/multimodal.md`) that runs `whisper-cli` (Homebrew `whisper.cpp` + the default GGML model from the runtime file's § Pinned versions, a `user_action` download) on the file and allowlist only that command. Discord: send one voice message during setup; if it arrives as an attachment, the same skill handles it, otherwise ask for dictated text | Can send files (documents up to 50 MB per the README), so an MP3 made by a script can be sent; it shows as an audio file, not a voice bubble | v1 default for non-technical owners: the phone keyboard's dictation button (free, Spanish, no install). The whisper.cpp skill is the add-on when they want real voice notes. Don't fork or patch the official plugin. **Spoken replies on the PC itself:** the unsandboxed speaker in § Speaker |
| `claude-p-cron` | No inbound channel | Optional: a scheduled job generates the morning brief as audio (TTS script) and sends it with the Telegram Bot API `sendVoice` | One cloud TTS key, or Piper locally |
| `claude-agent-sdk` | You build it: Bot API `getFile` / WhatsApp media download → STT → agent | You build it: TTS → ffmpeg to OGG/Opus → `sendVoice` / WhatsApp audio | Full control; any STT/TTS above. Keys in `.env` |
| `hermes` | **Native.** STT providers `local` (faster-whisper: tiny…large-v3), `groq`, `openai` (`whisper-1`, `gpt-4o-transcribe`), `mistral`, `xai`. Voice notes transcribed on Telegram, WhatsApp Cloud API and Baileys ([Hermes voice mode](https://hermes-agent.nousresearch.com/docs/user-guide/features/voice-mode), [WhatsApp Cloud](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud)) | **Native.** TTS providers incl. `edge`, `elevenlabs`, `openai`, `piper`, `neutts`, `gemini`, others. Telegram voice bubble (Opus/OGG); WhatsApp Cloud native voice note via ffmpeg (MP3 fallback); Baileys sends MP3 attachments | Configure `stt` / `tts` / `voice` blocks in Hermes `config.yaml`; keys `GROQ_API_KEY`, `VOICE_TOOLS_OPENAI_KEY`, `ELEVENLABS_API_KEY`. Hermes' STT list does **not** include Deepgram: default to `openai` (cloud) or `local` (private). Spanish TTS: `elevenlabs` or `piper` with an es_MX voice |
| `openclaw` | **Native.** Auto-detects in order: the reply model if it accepts audio → configured provider keys (Groq, OpenAI, xAI, Deepgram, Google, SenseAudio, ElevenLabs, Mistral) → local CLIs (`whisper-cli`, `sherpa-onnx-offline`, `parakeet-mlx`, `whisper`). 20 MB cap; `tools.media.audio.*` keys ([OpenClaw audio](https://docs.openclaw.ai/nodes/audio)) | **Native** voice notes on Telegram and WhatsApp; `tts.enabled`, `tts.provider`, `tts.auto`; providers incl. ElevenLabs, OpenAI, Azure, Gemini, local CLI engines ([OpenClaw TTS](https://docs.openclaw.ai/tools/tts)). For Piper as the local engine, check the current list on the OpenClaw TTS page at install; if Piper isn't listed, use a cloud provider or reply in text | Set `DEEPGRAM_API_KEY` and `provider: "deepgram"` explicitly: auto-detect tries Groq and OpenAI keys before Deepgram, so an existing OpenAI key would win. Set `tools.media.audio.language` to Spanish instead of autodetect. For local, `brew install whisper.cpp` puts `whisper-cli` on PATH. Stay above the floor in `knowledge/runtimes/openclaw.md` |
| `codex-openai` | Codex CLI has no channels. Voice comes from Hermes/OpenClaw on top, or the OpenAI Agents SDK | Same | The OpenAI Agents SDK has realtime/voice agents: the natural home for the realtime tier |
| `ollama-local` | Pair with whisper.cpp (or Hermes `local` STT) | Piper | The fully local stack. Runs on the person's hardware only (CMP-01) |
| `cowork` | No messaging channel (CMP-17); voice input is the OS dictation key in the desktop app | — | Not a voice runtime |

## Setup notes

- **Install rules** (`.claude/skills/jarvis-start/SKILL.md` rule 9): local engines via package manager — `brew install whisper.cpp` on macOS; `pip install piper-tts` inside the Jarvis's own virtualenv (or `uv`); `ffmpeg` via `brew` / `winget`, or on Linux `apt` typed by the person themselves (it needs admin rights, so the agent shows the command and never runs it). Pin versions at install time with `stack-researcher`; never `curl | sh`, never `sudo` from the agent.
- **Models are separate downloads.** whisper.cpp GGML models and Piper `.onnx` voices come from Hugging Face. Download into the Jarvis folder (not `~`), show the file size first (the default `ggml-large-v3-turbo-q5_0` is ≈574 MB; full `large` models are ~1.5–3 GB; read the exact size from the Hugging Face file page before downloading), verify the SHA-256 from the runtime file, and record the source URL and hash in `RUNBOOK.md`.
- **Env vars** (add only those used to `.env.example`, fake values):
  `DEEPGRAM_API_KEY=dg-...` · `ELEVENLABS_API_KEY=sk_...` · `OPENAI_API_KEY=sk-...` (or Hermes' `VOICE_TOOLS_OPENAI_KEY`) · `GROQ_API_KEY=gsk_...` · `ELEVENLABS_VOICE_ID=...`
- **Pick the voice with them.** Play 2–3 samples (ElevenLabs library filtered to Spanish/Mexico, Aura-2 Spanish voices, or Piper es_MX) and let the person choose; store the voice ID in the runtime config and the choice in `USER.md`. Accent defaults per country: `knowledge/countries/<cc>.md`.
- **Language hint.** Set STT language to Spanish (or multilingual for Spanglish speakers) instead of auto-detect when the provider allows; short notes are often misdetected.
- **Long audio.** Trim transcripts (OpenClaw `tools.media.audio.maxChars`) and tell the person a 10-minute voice note costs tokens like a long text.
- **Older Piper voice files.** Some voices in the pinned `rhasspy/piper-voices` commit (for example `es_MX-ald-medium`) carry `"phoneme_type": "PhonemeType.ESPEAK"` in their `.onnx.json`, which the current `piper-tts` refuses to load (seen on a real build, 2026-10-22). Fix: change that value to `"espeak"` in the downloaded `.onnx.json` (the `.onnx` and its SHA-256 are untouched) and write the change in RUNBOOK.md § Medios. For a LatAm accent on a Spain voice (`es_ES-davefx-medium`), a copy of its `.onnx.json` with `espeak.voice` set to `es-419` works; record that copy the same way.
- **Verify:** send a 5-second Spanish voice note from the owner account → Jarvis replies to its content; send one from a non-allowlisted account → silently dropped; if audio replies are on, the reply plays as a voice bubble on the phone.

## Speaker: spoken replies on the owner's own computer

For `claude-code-local` when the owner wants Jarvis to **talk out loud on the PC** (not a voice bubble on the phone). The Claude Code sandbox has no network and no audio device, so TTS can't run inside it, and taking the TTS script out of the sandbox (`excludedCommands`) would run code from the workspace outside it. The pattern that passed `jarvis-validator` on a real WSL2 build instead splits it in three:

| Part | Where it lives | Runs | Can Jarvis write it? |
|---|---|---|---|
| `bin/speak.sh` (template written by the build) | Jarvis folder | Inside the sandbox | No (`bin/` is protected; only running it is exempt in `protect-paths.sh`) |
| Queue `~/.local/state/jarvis/voz-cola/` | Outside the project, the only `sandbox.filesystem.allowWrite` entry | — | Yes: one text file per reply, nothing else |
| Engine (`speak-engine.sh`, `voice-daemon.sh`, `take-text.py`, the TTS virtualenvs and voices) | `~/.local/share/jarvis-voice/` | Outside the sandbox, as a systemd user service (macOS: a LaunchAgent, UNVERIFIED) | No: `permissions.deny` Edit/Write and `protect-paths.sh` `OUTSIDE` |

Rules for each part:

- **`speak.sh`** strips control characters, caps the text at 1500 characters, writes it to `<queue>/<ns>-<pid>.txt.tmp` and renames it into place. It refuses when the queue folder is a symlink, and fails fast with a clear message when the daemon's `.alive` heartbeat is older than 10 s. It never synthesizes or plays anything itself.
- **The daemon** executes only files inside the engine folder, runs `umask 077`, refuses a queue that is a symlink, speaks at most **6 texts per minute**, keeps at most **50** queued (the rest are deleted), and passes the text as one argument after `--`. It never executes, `source`s or `eval`s queue content.
- **`take-text.py`** (run as `python3 -I`) reads each queue file with a single descriptor and deletes the name whatever happens:

  ```python
  fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)  # no symlink, no FIFO block
  st = os.fstat(fd)                                                               # check the open file, not the name
  ok = stat.S_ISREG(st.st_mode) and st.st_uid == os.getuid() and st.st_nlink == 1 and st.st_size <= 6000
  data = os.read(fd, 6001) if ok else b""
  os.close(fd); os.unlink(path)                                                   # print data only if ok
  ```

  Checking the name first (`os.path.islink`, then `open`) is a race: the file can be swapped for a link or a FIFO in between.
- **The service unit** hardens what the engine can touch: `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=read-only`, `PrivateTmp=yes`, `MemoryMax=1G`, and `ReadWritePaths=` only for the queue, `logs/`, the audio outbox and the engine's own `tmp/`. On WSL2 audio goes to WSLg (`PULSE_SERVER=unix:/mnt/wslg/PulseServer`); when playback fails the engine leaves the last reply as a WAV in an outbox folder and says where.
- **The engine** never reads `.env`, logs one `voice.speak` audit line with the character count and preset (never the text), and installs each TTS engine in its own virtualenv from a lock file with exact `==` pins for every dependency. Cloud voice (Edge) needs the consent above; Piper is the local fallback when the cloud call fails or `voices/engine` is removed.
- **Allow rules:** `Bash(bin/speak.sh *)` and `Skill(speak)`. Never `Bash(piper…)`, `Bash(edge-tts…)` or `Bash(paplay…)` on their own.

Verify at build: `bin/speak.sh "Prueba"` from the session prints `ok: en cola`; `systemctl --user is-active jarvis-voice`; `ls -la ~/.local/state/jarvis/voz-cola` is mode 700 and not a link; a symlink dropped into the queue is deleted without being read; `touch .sandbox-probe` from the session still fails (the queue is the only new write).

## Security

- **Owner-only allowlist applies to voice too.** A voice note from a stranger must be dropped before STT, so it costs nothing and reaches nothing (SEC-01 in `knowledge/security-checklist.md`).
- **Transcripts are untrusted input.** A forwarded voice note can carry instructions ("Jarvis, manda…"). Treat transcripts like any external text: no irreversible action without the text approval gate (`knowledge/compatibility.md` CMP-38 for unattended jobs).
- **Voice is not identity.** Caller ID and voice can be spoofed; sending money or messages from a voice request needs a second-channel confirmation (recommendation, not a sourced fact).
- **Voice cloning:** only the owner's own voice, with their explicit consent logged in `.jarvis/state.json`. Never clone a client, a public figure or a family member. Before cloning, read ElevenLabs' current voice-cloning verification steps and follow them.
- **Sensitive data → local STT.** Health, legal or third-party financial dictation goes through whisper.cpp / faster-whisper, not a cloud API, unless the person accepts the vendor's data terms (CMP-19, CMP-35). Before quoting Deepgram, ElevenLabs or Groq for sensitive work, `stack-researcher` reads each vendor's current data-use terms for its pay-as-you-go tier; if audio may be used for training, use local STT.
- **Retention:** delete the downloaded audio file after transcription; keep only the transcript in memory if the person wants it. Say so in `SECURITY.md`.
- **Spend caps:** set a usage limit on every voice provider key before it goes live (Deepgram, ElevenLabs, OpenAI; SEC-27). Realtime gets its own lower cap.
- **WhatsApp:** voice on WhatsApp follows `knowledge/capabilities/whatsapp.md` (Cloud API by default; Baileys only with consent and a secondary number, CMP-05).
- **The speaker is unsandboxed code** (SEC-39): it must never run a file Jarvis can write, and it treats every queued text as untrusted data (§ Speaker). Validator sweep 17 checks it.
- **Cloud TTS sends what Jarvis says.** ElevenLabs, Aura-2, OpenAI and Edge receive the reply text; with a sensitive pack, reply in text or with Piper only.

## Sources

- Deepgram pricing (fetched 2026-10-06): https://deepgram.com/pricing
- Deepgram Nova-3 multilingual: https://deepgram.com/learn/nova-3-multilingual-major-wer-improvements-across-languages
- Deepgram TTS languages / Aura-2 Spanish voices: https://developers.deepgram.com/docs/tts-models-languages-overview
- ElevenLabs API pricing (fetched 2026-10-06; v4 promo ends Oct 12): https://elevenlabs.io/pricing/api
- ElevenLabs models: https://elevenlabs.io/docs/overview/models
- OpenAI API pricing, audio and realtime (fetched 2026-10-06): https://developers.openai.com/api/docs/pricing
- whisper.cpp Homebrew formula (fetched 2026-10-06): https://formulae.brew.sh/formula/whisper.cpp
- piper-tts on PyPI (fetched 2026-10-06): https://pypi.org/project/piper-tts/
- edge-tts on PyPI (license LGPLv3, checked 2026-10-23): https://pypi.org/project/edge-tts/ · https://github.com/rany2/edge-tts
- Python `os.open` flags and `fstat` (speaker reader): https://docs.python.org/3/library/os.html#os.O_NOFOLLOW
- systemd sandboxing options (speaker unit): https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html
- Speaker pattern, Piper `phoneme_type` fix and the Edge consent wording: a real WSL2 build that passed `jarvis-validator` on 2026-10-23 (no public source; re-test on the next build)
- Piper es_MX voices: https://huggingface.co/rhasspy/piper-voices/tree/293cad0539066f86e6bce3b9780c472cc9157489/es/es_MX
- Kokoro VOICES.md: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- Hermes voice mode (fetched 2026-10-06): https://hermes-agent.nousresearch.com/docs/user-guide/features/voice-mode
- Hermes WhatsApp (Baileys) and Cloud API: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp · https://hermes-agent.nousresearch.com/docs/user-guide/messaging/whatsapp-cloud
- OpenClaw audio transcription and TTS (fetched 2026-10-06): https://docs.openclaw.ai/nodes/audio · https://docs.openclaw.ai/tools/tts
- Claude Code channels and Telegram plugin (fetched 2026-10-06): https://code.claude.com/docs/en/channels · https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram
- Telegram Bot API `getFile` / `sendVoice`: https://core.telegram.org/bots/api
- OpenAI Agents SDK (realtime/voice agents): https://openai.github.io/openai-agents-python/
- Secondary (latency, realtime per-minute, local speed; not re-fetched): forasoft.com/blog/article/openai-realtime-api-pricing, forasoft.com/blog/article/pipecat-vs-livekit-agents, promptquorum.com/power-local-llm/local-whisper-stt-comparison-2026, promptquorum.com/power-local-llm/piper-vs-kokoro-tts, fast.io/resources/best-ai-text-to-speech-tools-2026
