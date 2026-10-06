# Phase 0 — Preflight

> Look before you ask. Detect what the person's machine already has, silently and read-only, so the
> interview never asks something a command could have answered.

Last verified: 2026-10-06

## Opening message (before any command)

One short message in their language. Example (ES):

> Hola, soy Jarvis Architect. Voy a ayudarte a armar tu propio Jarvis: un asistente con IA que
> trabaja para ti, con tus herramientas, en tu computadora o en la nube. Primero reviso rápido qué
> tienes instalado (solo lectura, no cambio nada) y luego te hago unas preguntas.

Then run the checks. Every command below is read-only and allowlisted in `.claude/settings.json`
(type them exactly as written; a different spelling may prompt). Never run anything not on this
list during preflight.

## Checks

| What | macOS | Linux / WSL | Windows (PowerShell) |
|---|---|---|---|
| OS + version | `sw_vers` | `cat /etc/os-release` · WSL: `grep -i microsoft /proc/version` | `Get-CimInstance Win32_OperatingSystem` · `wsl -l -v` |
| CPU arch | `uname -m` | `uname -m` | `$env:PROCESSOR_ARCHITECTURE` |
| RAM | `sysctl -n hw.memsize` | `free -b` | `(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory` |
| GPU / VRAM | Apple Silicon → unified memory = RAM | `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv` | same `nvidia-smi` (never `Win32_VideoController.AdapterRAM`, it caps at 4 GB) |
| Disk free | `df -h ~` | `df -h ~` | `Get-PSDrive C` |
| Package manager | `brew --version` | `apt --version` / `dnf --version` | `winget --version` / `scoop --version` |
| Tools | `node --version` · `npm --version` · `python3 --version` · `uv --version` · `bun --version` · `git --version` · `docker --version` | same, plus `docker info --format '{{.ServerVersion}}'` (daemon works without sudo?) · `nvidia-ctk --version` · `zstd --version` · `loginctl show-user $USER -p Linger` | same (`python --version` instead of `python3`) |
| Agents already installed | `claude --version` · `hermes --version` · `openclaw --version` · `codex --version` · `ollama --version` · `ollama list` · `railway --version` | same | same |
| Claude login type | `claude auth status` → read only `authMethod` (`claude.ai` = subscription, `api_key` = Console) | same | same |
| Keys present (never values) | `[ -n "$ANTHROPIC_API_KEY" ] && echo set` — same for `OPENAI_API_KEY`, `OPENROUTER_API_KEY` | same | `if ($env:ANTHROPIC_API_KEY) { 'set' }` |
| Railway session | `railway whoami` (only if `railway` exists) | same | same |

A command that is missing is a **result** ("not installed"), not an error. Never install anything
in this phase.

## Write `./.jarvis/preflight.json`

```json
{
  "checked_at": "<ISO date>",
  "os": "macos|linux|wsl|windows", "os_version": "", "arch": "arm64|x86_64",
  "ram_gb": 0, "gpu": {"name": "", "vram_gb": 0, "driver_version": ""},
  "disk_free_gb": 0,
  "pkg_manager": "brew|apt|dnf|winget|scoop|none",
  "tools": {"node": "", "python": "", "uv": "", "bun": "", "git": "", "docker": "", "docker_daemon_no_sudo": false, "nvidia_ctk": "", "zstd": "", "linger": false},
  "agents": {"claude": "", "claude_auth": "claude.ai|api_key|none", "hermes": "", "openclaw": "", "codex": "", "ollama": "", "ollama_models": [], "railway": ""},
  "keys_present": {"ANTHROPIC_API_KEY": false, "OPENAI_API_KEY": false, "OPENROUTER_API_KEY": false},
  "railway_logged_in": false
}
```

Also create `./.jarvis/state.json` with `{"state": "DISCOVERY", "brief": "", "started_at": "<ISO>"}`
and make sure `.jarvis/` is git-ignored if the cwd is a git repo (append to `.gitignore` only after
saying so in one line).

## Derived facts to carry into DISCOVERY (state them, don't ask them)

| Fact | Rule |
|---|---|
| Local models viable? | Hardware class from `knowledge/models.json` → `providers.local.hardware_classes` (the one table): `HW-strong` (≥24 GB VRAM / Apple Silicon ≥32 GB) comfortable; `HW-small` (12–23 GB VRAM / Apple Silicon 16–31 GB) small models only; `HW-weak` → say plainly local-only will be weak, offer hybrid. PC system RAM doesn't raise the class |
| Windows without Git/Node | `winget install --id Git.Git -e` / `OpenJS.NodeJS.LTS` become the first `user_action` tasks (`templates/tasks-schema.md` § Windows native) |
| Linux prerequisites missing (Docker without sudo, NVIDIA toolkit, linger, git, zstd) | Each becomes a `user_action` from `knowledge/capabilities/deploy-local.md` § Linux prerequisites |
| Claude subscription present | `claude_auth = claude.ai` → Claude Code local tracks are free to them (already paying) |
| Windows native | Recommend WSL2 for anything always-on or sandboxed (Claude Code sandbox needs WSL2) |
| Node version | OpenClaw needs Node ≥ the floor in `knowledge/runtimes/openclaw.md`; Claude Code npm path needs Node ≥22 |
| No package manager on macOS | Homebrew becomes task #1 of the build (the person runs its installer themselves) |

Summarise preflight to the person in ≤5 lines, in plain words:

> Tienes una Mac con chip M2 y 16 GB. Ya tienes Claude Code con tu suscripción y Node 24. No tienes
> Docker ni Ollama. Todo bien para empezar.

Then: transition to DISCOVERY.
