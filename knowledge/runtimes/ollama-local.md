# Runtime: Ollama local (private model provider)

> Ollama (or LM Studio as the alternative) runs open-weight models on the person's own Mac/PC so that prompts, memory and files never leave the machine. It is the model provider **under** Hermes or OpenClaw, not a Jarvis by itself. For "nada sale de mi compu" profiles with enough RAM/VRAM.

Last verified: 2026-10-06

## Pick it when / Don't pick it when

**Pick it when** (the `ollama-local` row in `questions/2-ramas.md`):

- The person says "nada sale de mi compu", or the data is very sensitive (health, legal, third-party
  finances; see `knowledge/professions/health.md` and `knowledge/professions/lawyer-accountant.md`),
  **and**
- preflight shows enough memory (table below): **≥24 GB VRAM** (NVIDIA) or **Apple Silicon ≥32 GB**
  unified memory is comfortable. 16–24 GB is "small models only, slower and less reliable".
- The machine can stay on (a desktop, a Mac mini, an old PC with a GPU). The Jarvis lives where
  the GPU lives.
- Zero per-token budget is a hard constraint and the person accepts a lower quality ceiling.

**What the Architect actually builds:** Ollama + a pinned model + **one harness on the same
machine**:

| Harness on top | When | File |
|---|---|---|
| **Hermes Agent** (default) | Telegram/Signal/Email channels, built-in memory, cron, docker terminal sandbox. Talks to Ollama's OpenAI-compatible `/v1` | `knowledge/runtimes/hermes.md` |
| **OpenClaw** | Needs WhatsApp/iMessage/phone apps. Talks to Ollama's **native** API (never `/v1`) | `knowledge/runtimes/openclaw.md` |
| Claude Code via `ANTHROPIC_BASE_URL` | Developer who wants the Claude Code terminal UX on local models. **UNOFFICIAL**, not supported by Anthropic, no Channels plugins (see *Known issues*) | `knowledge/runtimes/claude-code-local.md` |

**Don't pick it when:**

| Situation | Pick instead |
|---|---|
| Host must be Railway or any cloud without a GPU | Never (`knowledge/compatibility.md` CMP-01). Railway has no GPUs; a 7B model on CPU needs ~8 GB / 2 vCPU ≈ $120/month and is still slow (`knowledge/capabilities/costs.md`). Use `hermes` on Railway with an API key |
| <16 GB RAM (Mac) or <12 GB VRAM and no fast GPU | Say plainly local-only will be weak. Offer **hybrid with consent**: local model for the sensitive skill, an API-key provider for the rest (`hermes` with two providers). Or `cowork` if they pay Claude |
| Laptop that sleeps and lives in a backpack | A local model can't answer while the lid is closed. `hermes` on Railway (API key) or `cowork` |
| They need best-in-class reasoning, long research, agentic coding | Claude/OpenAI via API (`knowledge/models.json`); local models are a tier below for long tool chains |
| Non-technical person with no always-on machine | `cowork` (zero install) |
| They want Ollama's `:cloud` models | That is **not** local: data goes to ollama.com. Treat it as a cloud provider and disclose it (SEC-32) |

## Auth

→ `knowledge/auth-matrix.md`, row *Ollama / local models*: **no credential**. Nothing to sign in,
no subscription involved, no ToS gate on the model side. The control that replaces auth is
**network isolation**: the Ollama API has **no authentication** of its own, so it must listen on
`127.0.0.1` only (SEC-05). Credentials still exist for the channels and tools (Telegram bot token,
OAuth for Gmail…) and follow the harness file.

- OpenClaw needs a marker value, not a secret: `OLLAMA_API_KEY=ollama-local` ([openclaw-ollama-setup]).
- Hermes: `api_key` empty for a keyless local server ([hermes-providers]).
- Claude Code (unofficial): `ANTHROPIC_AUTH_TOKEN=ollama` + `ANTHROPIC_API_KEY=""` in a **separate
  launcher**, never mixed with the person's claude.ai login session ([ollama-claude-code]).
- `ollama signin` (Ollama account, for `:cloud` models and push) is **not** used in a private Jarvis.

## Pinned versions

| Component | Version | Channel | Source | Checked |
|---|---|---|---|---|
| Ollama (GitHub release) | **v0.40.0** (released 2026-09-25; follows v0.35.1 per the compare link) | stable | https://github.com/ollama/ollama/releases/tag/v0.40.0 | 2026-10-06 |
| Homebrew formula `ollama` (CLI + server, has a `brew services` definition) | 0.40.0 | stable | https://formulae.brew.sh/api/formula/ollama.json | 2026-10-06 |
| Homebrew cask `ollama-app` (GUI app, macOS ≥14) | 0.40.0 | stable | https://formulae.brew.sh/api/cask/ollama-app.json | 2026-10-06 |
| winget `Ollama.Ollama` | 0.40.0 | stable | https://github.com/microsoft/winget-pkgs/tree/master/manifests/o/Ollama/Ollama | 2026-10-06 |
| Docker image | `ollama/ollama:0.40.0@sha256:1bef639749741b375e9a1eb2c1346fb57ce52f5432de1f74846e44ccc18e1687` (index digest from Docker Hub) | stable | https://hub.docker.com/r/ollama/ollama/tags | 2026-10-06 |
| Linux tarball amd64 | `ollama-linux-amd64.tar.zst` sha256 `c94aa4156b3d13e64ebc2efe5ea53f015384c882be776e6695cfb37fb180d5ad` | stable | https://github.com/ollama/ollama/releases/download/v0.40.0/sha256sum.txt | 2026-10-06 |
| Linux tarball arm64 | `ollama-linux-arm64.tar.zst` sha256 `4d27cb1d8f46176a3c0ce10aea2a16e4ad73dfe1599f2ed13468f29e5b8aba0d` | stable | same `sha256sum.txt` | 2026-10-06 |
| Windows installer | `OllamaSetup.exe` sha256 `135bf4d927b1de03e884cd2fe66729bdf4d6a2983c5a453b99eb403489e460e1` | stable | same `sha256sum.txt` | 2026-10-06 |
| LM Studio (alternative) | Homebrew cask `lm-studio` **0.4.25,1** · winget `ElementLabs.LMStudio` **0.4.25+1** | stable | https://formulae.brew.sh/api/cask/lm-studio.json · https://github.com/microsoft/winget-pkgs/tree/master/manifests/e/ElementLabs/LMStudio | 2026-10-06 |
| Harness on top | see `knowledge/runtimes/hermes.md` / `knowledge/runtimes/openclaw.md` | — | — | — |
| **Media** (whisper.cpp sidecar for audio; `watch-video` with local transcription; frames to a local vision model) | whisper.cpp 1.9.5, ffmpeg 9.0.2, yt-dlp latest and the Whisper model + SHA-256, exactly as in `knowledge/runtimes/claude-code-local.md` § Pinned versions. Fully local: no cloud STT row applies. Local vision models read frames less reliably than Claude; the Architect says so at the gate | Homebrew stable | `knowledge/capabilities/multimodal.md` | 2026-10-06 |

Release checksums **are** published as `sha256sum.txt` on every GitHub release (checked for
v0.40.0 on 2026-10-06; the docs pages don't mention them). Homebrew's local tap may lag: on 2026-10-06 a stale local `brew info`
showed 0.34.4 while the live API showed 0.40.0. Run `brew update` first.

**Security floor: Ollama ≥ 0.17.1.** Never install or keep anything below it.

| Issue | Impact | Fixed in | Source |
|---|---|---|---|
| CVE-2026-7482 "Bleeding Llama" | Unauthenticated heap read via a crafted GGUF on `/api/create`, exfiltrated via `/api/push`: leaks prompts, env vars, API keys. ~300k exposed servers | 0.17.1 (2026-02-25) | https://blog.gridinsoft.com/ollama-cve-2026-7482-memory-leak/ · https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/05/CSA_research_note_ollama-bleeding-llama-cve-2026-7482-ai-inference-exposure_20260511-csa-styled.pdf |
| CVE-2026-5757 (same quantization path) | Unauthenticated heap read; CERT/CC reported **no vendor fix** as of mid-2026 | Debian's tracker shows no fixed version; `stack-researcher` re-checks it before install. Until a fix is listed, keep Ollama bound to `127.0.0.1` and never pull untrusted GGUF files | https://security-tracker.debian.org/tracker/CVE-2026-5757 · https://cipherssecurity.com/cve-2026-5757-ollama-bleeding-llama-heap/ |

Both need network reach to the API, so the mitigation is the same and non-negotiable: loopback
bind, no `ollama create` from untrusted GGUF files, no public port (SEC-05, SEC-24, SEC-25).

## Prerequisites

Preflight (`questions/0-preflight.md`) must show:

| Check | Requirement | Source |
|---|---|---|
| macOS | macOS ≥14 (cask requires it), Apple Silicon strongly preferred. 0.40.0 runs MLX by default on Apple Silicon for supported models | cask `depends_on`; [release-0.40.0] |
| Linux GPU | NVIDIA compute capability ≥5.0, driver ≥550 (≥570 for CC 5.0–6.2). AMD via ROCm (exact ROCm version: see the GPU page) | https://docs.ollama.com/gpu |
| Windows | Windows 10 22H2+, NVIDIA driver ≥551.61. WSL2 harness → mirrored networking | https://docs.ollama.com/windows |
| Disk | ≥4 GB for Ollama + the model (16–25 GB for the recommended 24 GB tier) + 20% headroom | https://docs.ollama.com/windows; model sizes below |
| Memory | Use the tier table. Hermes **rejects** <64K context at startup, and context costs memory on top of the weights (`knowledge/compatibility.md` CMP-24) | [hermes-providers] |
| Always-on | Desktop, Mac mini or PC with sleep disabled on AC power (the person sets it in System Settings / Power options, or runs `pmset` themselves as a `user_action`; the Architect never runs `sudo`) | `knowledge/capabilities/deploy-local.md` |

### Model by hardware tier (verified on ollama.com/library 2026-10-06)

The model families per tier (`small` / `medium` / `large` / `embeddings`) live in
`knowledge/models.json` → `providers.local.tiers`, which deliberately pins no Ollama tag. This
table maps those tiers to the exact library tags that existed on 2026-10-06, and stack-researcher
re-checks them on https://ollama.com/library at install time. Sizes are the download size of the
default quantization. Context adds several GB more. Confirm on the person's machine with
`ollama show <tag>` and `ollama ps` (the fixed "8/16/32 GB" README rule no longer exists, so trust these two commands over
any GB-per-tier rule of thumb).

`models.json` names Qwen3.5 35B-A3B as the medium-tier default. On a **24 GB GPU** that model
(22–23 GB) leaves no room for the 64K context, so this file picks the 27B dense tag there. On a
32–36 GB Mac, `qwen3.6:35b-a3b` is fine and faster. `qwen3.8:27b` (18 GB) appeared with Ollama
v0.40.0. It is the same size as `qwen3.6:27b`, but Ollama's Hermes page still names `qwen3.6`, so default
to `qwen3.6:27b` and offer `qwen3.8:27b` only if the tool-use smoke test passes with it.

| Hardware | Recommended `main` tag | Size | Notes |
|---|---|---|---|
| `HW-weak`: <16 GB Mac / <12 GB VRAM | none | — | Local-only Jarvis will be weak. Offer hybrid (consent) or another runtime |
| `HW-small`: 16–31 GB Mac / 12–23 GB VRAM | `gemma4:12b` (or `qwen3.5:9b`) | 7.7 GB download (≈6.6 GB weights, the `models.json` figure) · 6.6 GB | 64K context is tight. Expect slower, shakier tool use. Say so before the gate. On **12 GB VRAM** if Verify #5 shows CPU spill: (1) switch to `qwen3.5:9b`, (2) keep 64K with `OLLAMA_KV_CACHE_TYPE=q8_0`, (3) close other GPU apps (games, browsers with GPU tabs). Never drop below 64K under Hermes: it refuses to start |
| `HW-strong`: 24 GB VRAM / 32–36 GB Mac (**default tier**) | `qwen3.6:27b` · alt `gemma4:26b` (MoE, faster) | 18 GB · 16 GB | Ollama docs list `qwen3.6` (~24 GB VRAM) and `gemma4` (~16 GB) as the local picks for Hermes ([ollama-hermes]) |
| 48 GB VRAM / 64 GB Mac | `qwen3.6:35b-a3b` | 23 GB | Room for 64K+ context without CPU offload |
| 96–128 GB Mac (Max/Ultra) | `gpt-oss:120b` | 65 GB | Slow (single-digit tok/s reported; measure it with `ollama run --verbose` before committing) |
| Embeddings (memory search) | `nomic-embed-text` (or `embeddinggemma-2`) | 274 MB (1.3 GB) | Only when sqlite-vec memory is in the spec |

Classes (`HW-strong` / `HW-small` / `HW-weak`) are the ones in `models.json` →
`providers.local.hardware_classes`, also used by `decision-tree.md` and preflight.

**Shared gaming GPU.** On a PC that also runs games, a warm model holds most of the VRAM, so games
stutter or Ollama spills to CPU. Use `OLLAMA_KEEP_ALIVE=10m` (not `-1`), and put a "pausar Jarvis"
line in RUNBOOK.md (`systemctl --user stop jarvis-ollama` / `start`). One line on electricity at
the gate: a GPU kept loaded but idle draws tens of watts; the cost depends on the local tariff and
is not quoted (`capabilities/costs.md`).

Use **one** chat model for all three slots on ≤36 GB machines. Two models loaded at once double
memory use. A model that does not fit spills to CPU (`ollama ps` → `PROCESSOR` shows a CPU %) and
becomes unusably slow.

## Install

Never `curl … | sh` and never `sudo` from the agent. Show each command, the person approves it.

### macOS (preferred: Homebrew formula, headless, supervised by our LaunchAgent)

```bash
brew update
brew install ollama                       # formula; must report 0.40.0
ollama --version                          # "ollama version is 0.40.0"
brew pin ollama                           # stop `brew upgrade` from drifting past the pin
```

Do **not** install both the `ollama` formula and the `ollama-app` cask: both bind port 11434.
Alternative for people who want the GUI (context slider, menu-bar icon): `brew install --cask
ollama-app`, then use the app's settings for context length and keep "expose to network" off.
The cask self-updates, so the pin is best-effort. The `.dmg` from the release page is the last
fallback: verify `shasum -a 256 Ollama.dmg` against `sha256sum.txt` first.

### Linux (preferred: pinned GitHub tarball, user-level, no sudo)

```bash
V=0.40.0; ARCH=amd64            # or arm64
mkdir -p ~/.jarvis-cache/ollama-$V && cd ~/.jarvis-cache/ollama-$V
curl -fLO https://github.com/ollama/ollama/releases/download/v$V/ollama-linux-$ARCH.tar.zst
curl -fLO https://github.com/ollama/ollama/releases/download/v$V/sha256sum.txt
sha256sum -c --ignore-missing sha256sum.txt          # must print "ollama-linux-…: OK"
mkdir -p ~/.local/ollama && tar --zstd -xf ollama-linux-$ARCH.tar.zst -C ~/.local/ollama
~/.local/ollama/bin/ollama --version
```

The official docs extract into `/usr` with `sudo`. If the person prefers that, *they* run it
themselves. The user-level layout (`bin/` + `lib/ollama/`) mirrors the documented `/usr` layout
([ollama-linux]). Needs `zstd`. GPU drivers (NVIDIA/ROCm) are the person's own install.
Homebrew on Linux (`brew install ollama`, 0.40.0 bottles for x86_64/arm64 Linux) is an equal
alternative when brew is already present. `install.sh` is a fallback only: download it into
`.jarvis/cache/`, show `sha256sum` (must equal `25f64b810b947145095956533e1bdf56eacea2673c55a7e586be4515fc882c9f`)
and its first 20 lines, then the person runs `! OLLAMA_VERSION=0.40.0 sh .jarvis/cache/install.sh`.

### Windows (preferred: winget)

```powershell
winget install --id Ollama.Ollama --version 0.40.0 --exact
ollama --version
```

Fallback: `OllamaSetup.exe` from the release page (no admin needed), with `Get-FileHash` checked
against `sha256sum.txt`. If the harness (Hermes/OpenClaw) runs in WSL2, either run Ollama inside
WSL2 too (Linux steps) or set `networkingMode=mirrored` in `%UserProfile%\.wslconfig`. **Never**
"fix" WSL connectivity with `OLLAMA_HOST=0.0.0.0` on a laptop that joins public Wi-Fi.

### Docker (Linux servers with NVIDIA only)

```bash
docker run -d --name jarvis-ollama --restart unless-stopped --gpus=all \
  -p 127.0.0.1:11434:11434 -v jarvis-ollama:/root/.ollama \
  -e OLLAMA_CONTEXT_LENGTH=65536 -e OLLAMA_NO_CLOUD=1 -e OLLAMA_KEEP_ALIVE=30m \
  --security-opt no-new-privileges --memory {{mem_limit}} --pids-limit 512 \
  ollama/ollama:0.40.0@sha256:1bef639749741b375e9a1eb2c1346fb57ce52f5432de1f74846e44ccc18e1687
```

`{{mem_limit}}`: about `preflight.ram_gb` − 6 GB (leave the desktop room), e.g. `24g` on a 32 GB
machine; never more than the machine has. Not on macOS: Docker Desktop has no Metal GPU access, so
it would run on CPU. `--gpus` needs the NVIDIA Container Toolkit (person installs it, apt repo with
NVIDIA's signing key, as a user_action). Verify for this layout: run the *Verify* commands through
`docker exec jarvis-ollama …` (#1, #4, #7), check `docker port jarvis-ollama` prints nothing when
the harness shares the private network (#3), and `docker inspect -f '{{.State.Running}}'
jarvis-ollama` (#8).

### LM Studio (alternative provider)

`brew install --cask lm-studio` / `winget install --id ElementLabs.LMStudio --version 0.4.25+1 --exact`.
Its headless `llmster` daemon installer is `curl|bash` / `irm|iex` only, so use the app's bundled
`lms` CLI instead. Find the `lms` path with `which lms` after the app's first launch (or run `lms bootstrap` from the app's install folder). Pick LM Studio only
when the person already uses it or wants its model browser. Ollama stays the default because
Hermes, OpenClaw and Claude Code all have documented Ollama paths. LM Studio is a proprietary app:
`stack-researcher` reads its current terms on its website before recommending it.

### Pull the model

```bash
ollama pull qwen3.6:27b          # tag from the tier table above, after the hardware check
```

Only pull from the official library namespace (`<model>:<tag>`). Never pull `user/model` community
uploads or `ollama create` from a downloaded GGUF without the Architect reading where it came from
(SEC-24).

## Configure

### Server environment

| Variable | Value | Why |
|---|---|---|
| `OLLAMA_HOST` | `127.0.0.1:11434` | Explicit loopback bind (also the default). The API has no auth ([ollama-faq]) |
| `OLLAMA_CONTEXT_LENGTH` | `65536` | Default is 4K below 24 GB VRAM. Hermes needs ≥64K, Ollama recommends ≥64K for agents ([ollama-ctx], [hermes-providers]) |
| `OLLAMA_NO_CLOUD` | `1` | Disables cloud features so a `:cloud` model can't silently send data out ([ollama-faq]) |
| `OLLAMA_KEEP_ALIVE` | `30m` (or `-1` on a dedicated box) | Avoids a cold reload on every Telegram message (default 5 min) |
| `OLLAMA_FLASH_ATTENTION` | `1` | Smaller KV cache, so 64K fits. Homebrew's service sets it ([brew-formula]) |
| `OLLAMA_KV_CACHE_TYPE` | `q8_0` | Same, also set by Homebrew's service |
| `OLLAMA_ORIGINS` | unset | Never add `*`. Browser pages must not reach the API |
| `OLLAMA_MODELS` | unset (default `~/.ollama/models`) | Set only to move models to a bigger disk |

How to set them per OS:
- **macOS formula:** in the LaunchAgent (*Run & supervise*). App: `launchctl setenv VAR value`, then
  restart the app. This does **not** survive a reboot, which is why the formula + LaunchAgent is preferred.
- **Linux:** in the systemd unit `Environment=` lines.
- **Windows:** user environment variables (`setx OLLAMA_CONTEXT_LENGTH 65536`, etc.), then quit and
  reopen Ollama from the tray.

### `.env.example` lines (Jarvis folder)

```dotenv
# --- ollama-local: model provider (Ollama has no API key; nothing here is secret) ---
OLLAMA_HOST=127.0.0.1:11434          # loopback only, never 0.0.0.0
OLLAMA_CONTEXT_LENGTH=65536          # agents need >=64K; default is 4K on small GPUs
OLLAMA_NO_CLOUD=1                    # private mode: no :cloud models
OLLAMA_KEEP_ALIVE=30m                # keep the model warm between messages
JARVIS_LOCAL_MODEL=qwen3.6:27b       # tier table in runtimes/ollama-local.md (models.json -> providers.local)
# OpenClaw only: marker value required by its Ollama provider (not a secret)
OLLAMA_API_KEY=ollama-local
# LM Studio alternative only, if "Require Authentication" is on (this one IS a secret):
# LM_API_TOKEN=
```

### Hermes → Ollama (`~/.hermes/config.yaml`, or `/opt/data/config.yaml` in Docker)

```yaml
model:
  default: qwen3.6:27b
  provider: custom
  base_url: http://127.0.0.1:11434/v1
  api_key: ""                 # keyless local server
  context_length: 65536       # Hermes rejects < 64,000 at startup
```

**One supported topology per OS** (the same rule is in `runtimes/hermes.md`):

| OS | Ollama | Hermes | `base_url` |
|---|---|---|---|
| macOS | native (Homebrew + our LaunchAgent) | native | `http://127.0.0.1:11434/v1` |
| Linux (desktop or home server) | **native** (tarball + `jarvis-ollama` user unit, loopback) | container with **`network_mode: host`** (`runtimes/hermes.md` compose) | `http://127.0.0.1:11434/v1` |
| Windows | inside WSL2 (as Linux) | inside WSL2 | `http://127.0.0.1:11434/v1` |

On Linux, never use `host.docker.internal` / `--add-host=…:host-gateway`: it points at the Docker
bridge, and Ollama bound to `127.0.0.1` (SEC-05) refuses it. Never widen Ollama's bind to make it
work. The all-containers layout (*Install § Docker*) is only for a GPU server whose owner has
installed the NVIDIA Container Toolkit; then both containers share a private network and
`base_url` is `http://jarvis-ollama:11434/v1`.

Equivalent interactive path: `hermes model` → custom endpoint ([hermes-providers]). Don't use
`ollama launch hermes` to *install* Hermes: it can run Hermes's vendor installer for you, which
breaks the download→hash→person-runs rule. Install Hermes per `knowledge/runtimes/hermes.md`, then
configure the provider as above. Using `ollama launch hermes` only to configure an already
installed Hermes is acceptable only if it doesn't offer to run an installer; if it does, stop and use `hermes model` instead.

### OpenClaw → Ollama (`~/.openclaw/openclaw.json`, JSON5)

```json5
{
  models: {
    providers: {
      ollama: {
        baseUrl: "http://127.0.0.1:11434",   // native API. NEVER append /v1: tool calling breaks
        apiKey: "OLLAMA_API_KEY",            // env ref; value is the marker "ollama-local"
        api: "ollama",
        timeoutSeconds: 300,
        models: [{ id: "qwen3.6:27b", contextWindow: 65536, maxTokens: 8192 }]
      }
    }
  },
  agents: { defaults: { model: { primary: "ollama/qwen3.6:27b" } } }
}
```

CLI equivalent: `openclaw onboard` → Ollama → **Local only**, then `openclaw models set
ollama/qwen3.6:27b` and `openclaw models list --provider ollama` ([openclaw-ollama-setup],
[openclaw-ollama-config]). Never choose "Cloud + Local" for a private Jarvis. The exact nesting of
`models: [...]` with `contextWindow` comes from a summarized docs page, so confirm the shape with `openclaw doctor` after writing;
if it complains, use the CLI path above instead.

### Claude Code → Ollama (UNOFFICIAL; developer profiles only)

Write a launcher, never global env, so the person's normal `claude` keeps its own login:

```bash
#!/usr/bin/env bash
# ~/jarvis-<slug>/bin/claude-local: Claude Code on a local model. Unofficial, unsupported by Anthropic.
export ANTHROPIC_BASE_URL=http://127.0.0.1:11434
export ANTHROPIC_AUTH_TOKEN=ollama
export ANTHROPIC_API_KEY=""
exec claude --model "${JARVIS_LOCAL_MODEL:-qwen3.6:27b}" "$@"
```

`ollama launch claude` does the same interactively ([ollama-claude-code]). The `/v1/messages`
compatibility has no prompt caching, no `tool_choice`, no `/v1/messages/count_tokens` endpoint,
and token counts are approximations. Tools and thinking blocks are supported ([ollama-anthropic]).
Ollama's Claude Code page also shows `--dangerously-skip-permissions` and a Telegram
`--channels` launch. **Do not copy either**: bypass flags are banned (SEC-10), and Anthropic's
Channels docs require claude.ai or Console auth (see *Known issues*).

## Workspace mapping

Ollama reads **no** workspace files. It only serves the model. The harness on top loads the
portable markdown workspace that `workspace-writer` generates:

| File | Under Hermes | Under OpenClaw | Under Claude Code (unofficial) |
|---|---|---|---|
| SOUL.md | Hermes persona file | Agent workspace `SOUL.md` | Imported from `CLAUDE.md` (`@SOUL.md`) |
| USER.md · MEMORY.md | Hermes memory files | Agent workspace files | `@USER.md` / `@MEMORY.md` in `CLAUDE.md` |
| HEARTBEAT.md | Hermes cron job prompt | OpenClaw heartbeat | not used (no scheduler without Channels; see *Scheduling*) |
| AGENTS.md · TOOLS.md | Project context | Workspace files | `CLAUDE.md` imports |
| Skills | Hermes skills dir | OpenClaw skills dir | `.claude/skills/` |

Exact paths: see *Workspace mapping* in `knowledge/runtimes/hermes.md` and `knowledge/runtimes/openclaw.md`.
**Local-model specific:** keep SOUL/USER/AGENTS short. Every token of workspace, tool schemas and
skills is paid for in context on every turn, and a 27B model degrades faster than Claude when the
prompt is long. Target <6K tokens of always-loaded context, and load skills on demand.

## Channels

Native channels come from the harness, not from Ollama: Telegram (default), Signal, Email, Discord
(Hermes); WhatsApp, iMessage, phone apps (OpenClaw). See `knowledge/capabilities/channels.md` and
`knowledge/capabilities/whatsapp.md`.

- **Owner allowlist** is configured in the harness: Hermes `TELEGRAM_ALLOWED_USERS=123456789`; OpenClaw
  `dmPolicy: "pairing"` then allowlist with the owner's numeric ID. Never a wildcard (SEC-01).
  Groups stay off (SEC-02). Allowlist changes only from the local terminal (SEC-04).
- **Long polling, not webhooks**: a home machine needs no inbound port. Telegram via polling keeps
  the box invisible from the internet (SEC-03).
- WhatsApp through OpenClaw: the Cloud API is the default. An unofficial (Baileys) bridge needs the
  person's logged consent and a **secondary number** (SEC-31, `knowledge/capabilities/whatsapp.md`).
- "Nothing leaves my computer" has a caveat the Architect must say in one line: **the chat channel
  itself is a cloud service.** Telegram/WhatsApp servers see the messages, even though the model
  and memory are local. For the strictest profiles, offer a local-only channel: terminal, or the
  Jarvis Panel on loopback pointed at the **harness** API (Hermes `:8642`, `capabilities/web-ui.md`),
  never straight at Ollama, so chat keeps memory, skills and jobs. Open WebUI is not used in v1.
  Reach it remotely only over Tailscale `serve`, never `funnel`.

## Memory · Scheduling · Tools/MCP

**Memory:** markdown files always (`knowledge/capabilities/memory.md`). Semantic memory past ~200
lines → sqlite-vec with local embeddings (`embeddinggemma-2` or `nomic-embed-text` via
`ollama pull`), so even the index stays on disk. Never a memory SaaS (Mem0/Zep cloud) for this
profile. Hermes built-in memory (FTS5 + summaries) works unchanged with a local model, and its
summarization calls also hit Ollama.

**Scheduling:** owned by the harness (Hermes cron, OpenClaw cron/heartbeat), see
`knowledge/capabilities/scheduling.md`. Local-specific rules:
- Ollama must be supervised with KeepAlive so a 07:03 briefing never finds it down. The first call
  after idle pays a cold load (seconds to a minute), so set `OLLAMA_KEEP_ALIVE` accordingly.
- Heartbeat every 45–60 min, working hours only. Every heartbeat is a full local inference that heats
  the GPU and drains a laptop.
- Unattended jobs default to deny for send/post/pay/delete (SEC-15).
- Claude Code (unofficial path): no Channels and no Desktop scheduled tasks against Ollama. Use
  `claude-p-cron` style jobs with the launcher (`bin/claude-local -p "…" --allowedTools "Read"`),
  never `--dangerously-skip-permissions`.

**Autonomy:** the autopilot runs through the harness on top (Hermes cron or OpenClaw automations,
see `knowledge/runtimes/hermes.md` / `knowledge/runtimes/openclaw.md` § Autonomy), rules in
`knowledge/capabilities/autonomy.md`. Local-specific rules:
- Small models (8–12B): the skill's `max_tasks` is **1** and the job is one step (CMP-25). The 27B+
  tier keeps 3.
- Through Claude Code against Ollama (unofficial path), use the `claude-p-cron` wiring: the job
  prints the ops block and `jobs/autopilot.post` → `apply-ops.sh` validates it, so a malformed
  answer from a small model is rejected whole instead of half-applied.
- Every run is a full local inference: keep the three weekday slots, not more.

**Tools/MCP:** through the harness's MCP client (`knowledge/capabilities/tools-mcp.md`). Ollama
supports tool calling natively for capable models (Ollama "built-in" per [hermes-providers]).
Local-specific rules:
- Fewer tools = better (SEC-23). Small models (8–12B): **≤5 tools and one-step jobs**
  (`knowledge/compatibility.md` CMP-25). 27B+ tier: ≤8–10 tools per agent profile (a field
  heuristic, not a hard limit). Small models pick the wrong tool as the list grows.
- Remote MCP servers (Gmail, Calendar) **send data to those services**. That is acceptable only if
  the person agreed in the data-flow disclosure (SEC-32). Fully private profiles use local MCP
  only (filesystem scoped to the Jarvis folder, local sqlite, local whisper.cpp for voice notes,
  see `knowledge/capabilities/voice.md`).
- Web search tools leave the machine by definition. Disclose it, or omit it.

## Run & supervise

**Never Railway** (no GPUs). Everything runs on the person's machine. Supervise **Ollama and the
harness separately**: the harness's own installer handles the harness (`hermes gateway install` /
`openclaw onboard --install-daemon`, see their files), and Ollama gets one of the units below.

### macOS: LaunchAgent (formula install)

`~/Library/LaunchAgents/com.jarvis.ollama.plist` (replace `/opt/homebrew` with `$(brew --prefix)`
on Intel Macs, and `{{home}}` with the person's absolute home path, since launchd does not expand `~`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.jarvis.ollama</string>
  <key>ProgramArguments</key><array>
    <string>/opt/homebrew/opt/ollama/bin/ollama</string><string>serve</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>OLLAMA_HOST</key><string>127.0.0.1:11434</string>
    <key>OLLAMA_CONTEXT_LENGTH</key><string>65536</string>
    <key>OLLAMA_NO_CLOUD</key><string>1</string>
    <key>OLLAMA_KEEP_ALIVE</key><string>30m</string>
    <key>OLLAMA_FLASH_ATTENTION</key><string>1</string>
    <key>OLLAMA_KV_CACHE_TYPE</key><string>q8_0</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>{{home}}/Library/Logs/jarvis-ollama.log</string>
  <key>StandardErrorPath</key><string>{{home}}/Library/Logs/jarvis-ollama.log</string>
</dict></plist>
```

```bash
plutil -lint ~/Library/LaunchAgents/com.jarvis.ollama.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jarvis.ollama.plist
launchctl kickstart -k gui/$(id -u)/com.jarvis.ollama      # restart after config changes
```

Use this **instead of** `brew services start ollama`, never both. A LaunchAgent starts only after
login: an always-on Mac mini needs auto-login, and FileVault blocks auto-login after a power cut
(see the FileVault caveat in `knowledge/capabilities/deploy-local.md`; to check it on this Mac, reboot
once and confirm Jarvis answers without anyone logging in).

### Linux: systemd user unit (tarball install)

`~/.config/systemd/user/jarvis-ollama.service`:

```ini
[Unit]
Description=Ollama for Jarvis (loopback only)
After=network-online.target

[Service]
ExecStart=%h/.local/ollama/bin/ollama serve
Environment=OLLAMA_HOST=127.0.0.1:11434
Environment=OLLAMA_CONTEXT_LENGTH=65536
Environment=OLLAMA_NO_CLOUD=1
Environment=OLLAMA_KEEP_ALIVE=30m
Environment=OLLAMA_FLASH_ATTENTION=1
Environment=OLLAMA_KV_CACHE_TYPE=q8_0
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now jarvis-ollama
journalctl --user -u jarvis-ollama -e
```

Keep it running without an open session: `loginctl enable-linger "$USER"`. This may need admin
rights, so it is a `user_action` task. The person runs it themselves (`! loginctl enable-linger "$USER"`)
and the agent never adds `sudo` (`knowledge/capabilities/deploy-local.md`).

```bash
loginctl show-user "$USER" --property=Linger | grep -q 'Linger=yes' && echo ok
```

If Ollama was installed system-wide with the official script, use `systemctl edit ollama.service`
with the same `Environment=` lines instead ([ollama-faq]), and the person runs the `sudo` steps.

### Windows

The installer runs Ollama as a tray app at login. After a reboot, check `curl -s http://127.0.0.1:11434/api/version` answers; if not, add Ollama to the Startup folder (`Win+R` → `shell:startup`).
Settings come from the user env vars above. For 24/7 use, keep the PC awake on AC power. If the
harness lives in WSL2, supervise the harness with WSL2 systemd (`knowledge/capabilities/deploy-local.md`).

### Docker

`--restart unless-stopped` (Install § Docker) is the supervisor. If the harness also runs in Docker
on the same host, put both on a private user-defined network and point the harness at
`http://jarvis-ollama:11434`. In that case, drop the `-p` publish entirely.

### Remote access to the Jarvis

Only Tailscale (`tailscale serve`) or an SSH tunnel. Never port-forward 11434 on the router, never
`tailscale funnel` for Ollama (SEC-05).

## Security hardening

IDs are the ones in `knowledge/security-checklist.md` (SEC-01…SEC-33). Controls not listed apply
exactly as the checklist states them for the harness on top (see `knowledge/runtimes/hermes.md` /
`knowledge/runtimes/openclaw.md`).

| Control | How, for ollama-local |
|---|---|
| SEC-01 Owner allowlist · SEC-02 Groups off · SEC-04 Allowlist changes from terminal | Set in the harness (Hermes `TELEGRAM_ALLOWED_USERS`, OpenClaw `dmPolicy` pairing → allowlist), numeric owner ID only, no wildcard. Proven with a rejection test from a second account |
| SEC-03 Webhooks / long polling | Home machine: long polling only, no inbound port |
| SEC-05 Control plane on loopback | `OLLAMA_HOST=127.0.0.1:11434`, Docker `-p 127.0.0.1:…` or no publish. No `0.0.0.0`, no router forward, no `tailscale funnel`, `OLLAMA_ORIGINS` never `*`. The API has **no auth**: exposure alone enables CVE-2026-7482/5757-class attacks. LM Studio: "Serve on Local Network" **off**, "Require Authentication" **on**. Verified by the listen check in *Verify* |
| SEC-06 Railway | Not applicable: Ollama never runs on Railway (CMP-01) |
| SEC-07 Sandbox · SEC-10 No bypass flags | Ollama itself runs unprivileged (user LaunchAgent / user systemd / container with `no-new-privileges`). The harness's shell tool runs sandboxed: Hermes `terminal.backend: docker`, OpenClaw `sandbox.mode` docker. Local models follow injected instructions **more** easily than frontier models, so the sandbox is never optional. Never `--dangerously-skip-permissions` on the Claude Code launcher, even though Ollama's docs suggest it |
| SEC-11 Rule of two · SEC-12 Untrusted content fenced | Same classification as every Jarvis: untrusted input [A] + private data [B] + external action [C] requires approval before C. Weaker models make this stricter: default to read-only + drafts |
| SEC-13 Memory hygiene | Memory files and the sqlite-vec index stay on local disk. Same provenance/purge rules as the checklist |
| SEC-14 Approval · SEC-15 Unattended deny · SEC-16 Expiry | Harness approvals on (Hermes `approvals`, OpenClaw exec approvals). Cron jobs deny irreversible actions. Exact preview + "sí", expiring ≤5 min |
| SEC-17 Secrets in `.env` · SEC-18 No secret in prompts/logs · SEC-08 Credential paths | Ollama has none. The harness `.env` (bot token, OAuth) is chmod 600 and gitignored. Ollama process memory can hold prompts and env vars (that's what Bleeding Llama leaked), so never put secrets in prompts/SOUL.md, and keep the API unreachable. Don't mount `~/.ssh`/`~/.aws` into the Ollama container |
| SEC-22 Read-only integrations · SEC-23 Minimal tools | Integrations start read-only. A remote MCP also means data leaves the machine, so add it only when the disclosure says so. Small models: ≤5 tools (CMP-25) |
| SEC-24 No auto-install · SEC-25 Floor + digest · SEC-26 Safe install | Ollama pinned (0.40.0, sha256 from `sha256sum.txt` or the image digest), `brew pin ollama`, floor ≥0.17.1. Models only from the official library namespace, pinned by tag; record the `ollama show --modelfile` output digest in RUNBOOK. No `ollama create` from untrusted GGUF (the CVE vector). No `ollama launch` as an installer. No `curl \| sh`; `install.sh` only download → hash → person runs it |
| SEC-27 Spend cap · SEC-28 App-side limits | $0/token, but cap abuse: harness max turns / max tool calls per task, loop breaker after N identical calls, inbound rate limit. If hybrid, the cloud provider gets a hard spend cap before the first call |
| SEC-29 Audit log · SEC-20 Log redaction | Harness audit log of tool calls. Ollama server log (`~/Library/Logs/jarvis-ollama.log` / `journalctl --user -u jarvis-ollama`) is rotated and never shipped anywhere. Don't enable `OLLAMA_DEBUG` in production (it can write prompts to the logs) |
| SEC-30 Auth matrix · SEC-31 WhatsApp | No model credential (`knowledge/auth-matrix.md`). Claude Code path: unofficial, uses no subscription, and runs in a separate launcher, never mixed with the claude.ai login. Unofficial WhatsApp only with logged consent + secondary number |
| SEC-32 Disclosure | Disclosure screen states truthfully: model + memory local; channel provider (Telegram/WhatsApp) sees messages; each remote MCP sees its data; `OLLAMA_NO_CLOUD=1` blocks `:cloud` |
| SEC-33 Updates & incident | Floor ≥0.17.1, pinned 0.40.0. Weekly `jarvis-doctor` check compares with the latest release and the advisory list (GitHub releases, NVD for "ollama"). Upgrade = new pin + checksum + `brew unpin/upgrade/pin`. SECURITY.md panic button: stop the LaunchAgent/unit/container, stop the harness, revoke the bot token, check `lsof`/`ss` for any non-loopback listener |

## Verify

All exit 0 when healthy. None prints a secret (there are none on the Ollama side).

```bash
# 1. Pinned version (and above the floor)
ollama --version | grep -q '0\.40\.0' && echo ok

# 2. Server answers on loopback
curl -fsS http://127.0.0.1:11434/api/version >/dev/null && echo ok

# 3. Listening on loopback ONLY (macOS)
lsof -nP -iTCP:11434 -sTCP:LISTEN | grep -q '127.0.0.1:11434' \
  && ! lsof -nP -iTCP:11434 -sTCP:LISTEN | grep -qE '\*:11434|0\.0\.0\.0:11434|\[::\]:11434' && echo ok
#    Linux:
ss -ltnH 'sport = :11434' | grep -q '127.0.0.1:11434' \
  && ! ss -ltnH 'sport = :11434' | grep -qE '0\.0\.0\.0:11434|\*:11434|\[::\]:11434' && echo ok

# 4. Model present (tag from models.json)
ollama list | grep -q "^${JARVIS_LOCAL_MODEL:-qwen3.6:27b}" && echo ok

# 5. Context is >= 64K once loaded, and the model is not spilling to CPU
ollama run "${JARVIS_LOCAL_MODEL:-qwen3.6:27b}" "Responde solo: OK" >/dev/null
curl -fsS http://127.0.0.1:11434/api/ps | python3 -c '
import json,sys; m=json.load(sys.stdin)["models"]
assert m and all(x.get("context_length",0)>=64000 for x in m), "context < 64K"
assert all(x["size_vram"]>=0.9*x["size"] for x in m), "spilling to CPU"' && echo ok

# 6. Tool calling works (native API)
curl -fsS http://127.0.0.1:11434/api/chat -d '{"model":"'"${JARVIS_LOCAL_MODEL:-qwen3.6:27b}"'","stream":false,
 "messages":[{"role":"user","content":"What time is it in Mexico City? Use the tool."}],
 "tools":[{"type":"function","function":{"name":"get_time","description":"Current time in a city",
 "parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}}}]}' \
 | python3 -c 'import json,sys; assert json.load(sys.stdin)["message"].get("tool_calls"), "no tool call"' && echo ok

# 7. No cloud models installed (private mode)
! ollama list | grep -q ':cloud' && echo ok

# 8. Supervisor is up
launchctl print gui/$(id -u)/com.jarvis.ollama >/dev/null && echo ok        # macOS
systemctl --user is-active --quiet jarvis-ollama && echo ok                  # Linux
```

On Apple Silicon, the 90% `size_vram` check reads unified memory and should pass. If it doesn't,
`ollama ps` shows the CPU/GPU split. The verify checks that `OLLAMA_NO_CLOUD` is set, not that it rejects a `:cloud`
pull. Don't test it by pulling.

**Smoke test (with the harness):** 1) owner sends "hola" on Telegram → answer in < 60 s on first load,
< 15 s warm; 2) a second account gets rejected (SEC-01); 3) "recuerda que mi contador se llama
Luis" → appears in MEMORY.md, recalled after a harness restart; 4) trigger the morning briefing job
once by hand; 5) turn Wi-Fi off and repeat step 1 over the local channel (terminal/web UI) to prove
the model really is local.

## Cost

→ `knowledge/capabilities/costs.md` (scenario "Hermes Agent with Ollama: local hardware ~$0").
$0 per token. The real costs are hardware (a GPU or a ≥32 GB Mac), electricity for an always-on
box, and the harness's channel costs (Telegram free; WhatsApp Cloud API per-template rates, see
`knowledge/countries/<cc>.md`). Hybrid setups add the cloud provider's metered cost with a hard cap.
Railway for Ollama is not an option (~$120/month for a CPU-only 7B and still too slow; `knowledge/capabilities/costs.md`, `knowledge/compatibility.md` CMP-01).

## Known issues & fallbacks

| Issue | Symptom | Fallback |
|---|---|---|
| Default 4K context | Tools ignored, agent "forgets" mid-task, Hermes refuses to start | `OLLAMA_CONTEXT_LENGTH=65536` in the supervisor env, restart, Verify #5 |
| OpenClaw pointed at `/v1` | Tool calls come back as text | `baseUrl` without `/v1`, `api: "ollama"` |
| Model too big for memory | Very slow replies, `ollama ps` shows CPU % | Drop one tier (e.g. `gemma4:26b` → `gemma4:12b`), lower context to the 64K floor, close other apps |
| Two models loaded (chat + embeddings + heartbeat) | Swapping, timeouts | One chat model for all slots. Use the small `nomic-embed-text` (274 MB) for embeddings, and only when sqlite-vec memory is in the spec |
| v0.40.0 runs MLX by default on Apple Silicon | Regression on a specific model | Fall back to the previous release `0.35.1` (the one before 0.40.0 per the release compare link). Homebrew can't install old versions easily, so use that release's `ollama-darwin.tgz` and check it against its own `sha256sum.txt`. Or switch to another model that is not on MLX. If a later release notes a switch to turn MLX off, prefer it over the downgrade |
| WSL2 harness can't reach Windows Ollama | `connection refused` | Mirrored networking in `.wslconfig`, or run Ollama inside WSL2. Never `0.0.0.0` |
| Mac sleeps / lid closed | Bot silent at night | The person disables sleep on AC power, or moves to a Mac mini. A laptop-only person goes to `hermes` on Railway + API key instead |
| Weak tool chains on ≤16 GB | Wrong tools, loops | Fewer tools, shorter SOUL, loop breaker (SEC-28). Offer hybrid with consent |
| Claude Code + Ollama: no Channels | Anthropic's Channels docs say the plugins need claude.ai or Console API auth (https://code.claude.com/docs/en/channels). Ollama's Claude Code page shows `ollama launch claude -- --channels plugin:telegram@…` anyway. It is unsupported by Anthropic | Use Hermes/OpenClaw for chat channels. Claude Code + Ollama stays a terminal tool. Anthropic doesn't support non-Claude backends, and features can break on any Claude Code update |
| Claude Code + Ollama: no prompt caching / `tool_choice` / `count_tokens` endpoint | Slower, some flows fail | Expected per [ollama-anthropic]. Not a bug to fix |
| CVE-2026-5757 has no listed fix | — | Keep the API loopback-only and never import untrusted GGUF. Re-check at each `jarvis-refresh` |
| `ollama launch <harness>` installs things | Vendor installer run without hash review | Install the harness per its runtime file. Use `launch` only for configuration, if at all |

## Sources

- [release-0.40.0] https://github.com/ollama/ollama/releases/tag/v0.40.0 (checksums: https://github.com/ollama/ollama/releases/download/v0.40.0/sha256sum.txt), checked 2026-10-06
- [brew-formula] https://formulae.brew.sh/api/formula/ollama.json · https://formulae.brew.sh/api/cask/ollama-app.json · https://formulae.brew.sh/api/cask/lm-studio.json
- winget: https://github.com/microsoft/winget-pkgs/tree/master/manifests/o/Ollama/Ollama · https://github.com/microsoft/winget-pkgs/tree/master/manifests/e/ElementLabs/LMStudio
- Docker: https://hub.docker.com/r/ollama/ollama/tags
- [ollama-faq] https://docs.ollama.com/faq (bind address, env per OS, `OLLAMA_NO_CLOUD`, `OLLAMA_KEEP_ALIVE`, `OLLAMA_ORIGINS`, model paths)
- [ollama-ctx] https://docs.ollama.com/context-length (4K <24 GB, 32K 24–48 GB, 256K ≥48 GB; ≥64K for agents)
- [ollama-linux] https://docs.ollama.com/linux · macOS/Windows: https://docs.ollama.com/macos · https://docs.ollama.com/windows
- `/api/ps` fields: https://docs.ollama.com/api/ps
- [ollama-anthropic] https://docs.ollama.com/api/anthropic-compatibility
- [ollama-claude-code] https://docs.ollama.com/integrations/claude-code
- [ollama-hermes] https://docs.ollama.com/integrations/hermes
- [hermes-providers] https://hermes-agent.nousresearch.com/docs/integrations/providers (custom provider, ≥64K context rule)
- [openclaw-ollama-setup] https://docs.openclaw.ai/providers/ollama/setup · [openclaw-ollama-config] https://docs.openclaw.ai/providers/ollama/configuration · index https://docs.openclaw.ai/providers/ollama
- LM Studio: https://lmstudio.ai/docs/developer · https://lmstudio.ai/docs/developer/core/server/settings
- Model tags and sizes: https://ollama.com/library/qwen3.6/tags · https://ollama.com/library/gemma4/tags · https://ollama.com/library/qwen3.5/tags · https://ollama.com/library/gpt-oss/tags · https://ollama.com/library/embeddinggemma-2
- CVE-2026-7482: https://blog.gridinsoft.com/ollama-cve-2026-7482-memory-leak/ · https://labs.cloudsecurityalliance.org/wp-content/uploads/2026/05/CSA_research_note_ollama-bleeding-llama-cve-2026-7482-ai-inference-exposure_20260511-csa-styled.pdf
- CVE-2026-5757: https://security-tracker.debian.org/tracker/CVE-2026-5757 · https://cipherssecurity.com/cve-2026-5757-ollama-bleeding-llama-heap/
- Railway sizing for Ollama: `knowledge/capabilities/costs.md` (Railway pricing https://railway.com/pricing)
- Hardware prerequisites: https://docs.ollama.com/gpu · https://docs.ollama.com/windows
- Claude Code Channels auth requirement: https://code.claude.com/docs/en/channels
- Newer tag noted in the tier table: https://ollama.com/library/qwen3.8/tags · https://ollama.com/library/nomic-embed-text
