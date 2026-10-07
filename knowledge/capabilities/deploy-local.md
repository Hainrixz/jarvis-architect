# Capability: Deploy local (your own Mac, PC or home server)

> How to keep a Jarvis running on the person's own machine: one supervisor per OS (launchd, systemd, WSL2 + systemd, pm2 or Docker Compose), everything bound to 127.0.0.1, remote access and webhooks only through Tailscale, and secrets in a chmod 600 `.env` or the OS keychain.

Last verified: 2026-10-06

## Decision rule

Apply the first matching row. "Supervisor" means the thing that starts Jarvis at boot or login and restarts it when it crashes.

| If… | Then… | Why (one line for the person) |
|---|---|---|
| Runtime is `cowork` | **Nothing to deploy.** No supervisor, no ports (`runtimes/cowork.md`) | Cowork lives inside the Claude app |
| Machine is not on most of the day (a laptop that sleeps) and the person wants 24/7 | **Not local.** Go to `knowledge/capabilities/deploy-railway.md`, or run only scheduled `claude -p` jobs (`runtimes/claude-p-cron.md`) and accept they skip while asleep | A laptop that sleeps is a Jarvis that doesn't answer |
| macOS, runtime ships its own installer (`hermes gateway install`, `openclaw onboard --install-daemon`) | **Use the runtime's own LaunchAgent.** Don't hand-write a second one | It is tested by the vendor and updates with it |
| macOS, anything else (Claude Code + Channels, Agent SDK app, custom bot) | **launchd LaunchAgent** in `~/Library/LaunchAgents/` (§1) | Native, no extra software, restarts on crash |
| Linux (desktop, mini PC, Raspberry Pi-class box) | **systemd user unit** + `loginctl enable-linger` (§2) | Starts at boot even with nobody logged in; journal keeps the logs |
| Windows | **WSL2 with `systemd=true`**, then the Linux path (§3); Hermes on Windows prefers Docker Desktop (`runtimes/hermes.md`). Native Windows + Task Scheduler only where the runtime file names a native Windows service as a supported path (e.g. Ollama's own app) | Claude Code's sandbox only works on WSL2 (`CMP-36`), and OpenClaw's always-on path is WSL2 |
| Person already uses Node/pm2, or wants one command for several processes | **pm2** (§4), with `pm2 startup` run by the person | Familiar, cross-platform on macOS/Linux; no Windows startup support |
| Runtime has an official image (Hermes, OpenClaw) **and** the person may move to Railway later, **or** wants isolation | **Docker Compose**, ports bound to `127.0.0.1`, `restart: unless-stopped`, image pinned to tag + digest from the runtime file (§5) | Same image runs on Railway later; container isolation |
| The machine is a dedicated always-on Mac (Mac mini) | launchd (above) **plus** the Mac mini checklist (§6) | Power-cut recovery, no sleep, UPS |
| Needs remote access to a dashboard or API | **`tailscale serve`** (tailnet-only) (§7). Never a router port-forward | Only your own devices can reach it |
| Needs an inbound public webhook at home (WhatsApp Cloud API, Telegram webhook, Twilio) | **`tailscale funnel`** on one path, with the runtime's secret check, **or** prefer long polling / move to Railway (§7) | Polling needs no inbound port at all |

Defaults to say out loud in `/jarvis-quick` (local host): *"Corre en tu compu con el arrancador del sistema (launchd en Mac, systemd en Linux/WSL): si se cae, se levanta solo. Nada queda expuesto a internet; si quieres verlo desde el celular, usamos Tailscale."*

Hard constraints the Architect checks before choosing local (see `knowledge/compatibility.md`):

- `CMP-04`: an OpenClaw gateway or Control UI is never reachable from the internet. Loopback + token, remote only via Tailscale/SSH.
- `CMP-14`: Claude Code Channels on Windows run inside WSL2 (the supported sandboxed path).
- `CMP-22`: Claude Code kept alive 24/7 needs a memory cap **and** a restart policy **and** a supervisor.
- `CMP-01`: local models (`runtimes/ollama-local.md`) are the main reason to stay local; privacy + 24/7 = always-on home machine + Tailscale.

---

## 0. Common layout (every option)

```
{{jarvis_dir}}/             # the Jarvis folder, e.g. ~/jarvis-ana (git repo, workspace files, code)
  .env                      # chmod 600, gitignored — the person fills it
  .env.example              # every variable, one-line comment, no values
  logs/                     # out.log, err.log (gitignored), rotated
  bin/run.sh                # the one start command the supervisor calls
```

- **One entry point.** The supervisor runs `bin/run.sh` (or the runtime's own binary). `run.sh` loads secrets (§8), honours a `STOP` kill-switch file, trims logs, `cd`s into the folder and `exec`s the runtime, so signals reach it. Minimum shape and the rendering rules for every supervisor file: `templates/local/README.md`.
- **Absolute paths only.** launchd and systemd don't read your shell profile. `PATH` must be set in the unit/plist and must contain the folder of every binary the job calls: run `dirname "$(command -v claude)"` (the native installer uses `~/.local/bin`, written as an absolute path), plus Homebrew (`/opt/homebrew/bin` on Apple silicon, `/usr/local/bin` on Intel).
- **Never `sudo` from the agent** (rule 9). The few steps that need admin rights (`pmset`, `loginctl enable-linger`, `/etc/wsl.conf`, `pm2 startup`) are `user_action` tasks: the Architect shows the exact command and the person runs it with `! <command>`.
- **One instance only.** Two copies of the same gateway on one data directory corrupt state (`CMP-11`). Before installing a supervisor, check nothing else (tmux, a runtime's own daemon, pm2) already runs it.

---

## 1. macOS — launchd

### LaunchAgent vs LaunchDaemon

| | LaunchAgent (**default**) | LaunchDaemon |
|---|---|---|
| Lives in | `~/Library/LaunchAgents/` | `/Library/LaunchDaemons/` (admin) |
| Runs as | the logged-in user | root, or a `UserName` you set |
| Starts | after **that user logs in** | at boot, before anyone logs in |
| Can use | login Keychain, the user's files, GUI-session things (iMessage, Apple automations) | no login Keychain, no GUI session |
| Use for Jarvis | **Always**, plus auto-login on a dedicated Mac (§6) | Not recommended: needs root to install, runs outside the user's Keychain and session |

The runtimes' own installers also write LaunchAgents: Hermes `~/Library/LaunchAgents/ai.hermes.gateway.plist`, OpenClaw `~/Library/LaunchAgents/ai.openclaw.gateway.plist` (after the runtime's installer runs, confirm the exact file with `ls ~/Library/LaunchAgents | grep -Ei 'hermes|openclaw'` and use that name; `runtimes/hermes.md` and `runtimes/openclaw.md` have the details). A LaunchAgent only starts after a login, so a headless Mac needs auto-login (source: [stackharbor](https://stackharbor.com/en/knowledge-base/openclaw-as-launchd-service/)).

### Plist template (custom Jarvis, Agent SDK app, Claude Code wrapper)

Full template: `templates/local/com.jarvis.agent.plist.tmpl` (`workspace-writer` fills the `{{vars}}`; `{{jarvis_dir}}` must be an absolute path such as `/Users/ana/jarvis-ana`, because launchd does not expand `~`). Label is reverse-DNS. No secrets in the plist — files in `~/Library/LaunchAgents` are readable by other local users by default. Condensed:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{{launchd_label}}</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>{{jarvis_dir}}/bin/run.sh</string>
  </array>
  <key>WorkingDirectory</key><string>{{jarvis_dir}}</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>{{path}}</string>      <!-- e.g. /Users/ana/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -->
    <key>TZ</key><string>{{timezone}}</string>    <!-- e.g. America/Mexico_City -->
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>{{jarvis_dir}}/logs/out.log</string>
  <key>StandardErrorPath</key><string>{{jarvis_dir}}/logs/err.log</string>
</dict></plist>
```

- `KeepAlive` → `SuccessfulExit=false` restarts on crash but lets a clean stop stay stopped. Use `<true/>` only if the runtime exits 0 on network loss and must come back anyway.
- `ThrottleInterval` keeps a crash loop from spinning the CPU. `ThrottleInterval` and `ProcessType` are standard `launchd.plist(5)` keys (`man launchd.plist` on the Mac); not re-fetched from Apple's site on 2026-10-06.

### Commands

```bash
plutil -lint ~/Library/LaunchAgents/com.jarvis.agent.plist                 # syntax check
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jarvis.agent.plist   # load + start
launchctl print gui/$(id -u)/com.jarvis.agent | grep -E 'state|last exit'  # status
launchctl kickstart -k gui/$(id -u)/com.jarvis.agent                       # restart
launchctl bootout gui/$(id -u)/com.jarvis.agent                            # stop + unload
```

`launchctl load/unload` are the legacy verbs; prefer `bootstrap/bootout` (source: [Apple — Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html), [ss64 launchctl](https://ss64.com/mac/launchctl.html)).

### Claude Code + Channels under launchd (`claude-code-local`)

Channels only deliver events while the session runs (`knowledge/capabilities/channels.md`), and an interactive `claude` session needs a terminal, so launchd supervises a **tmux session**, not `claude` directly. **The exact scripts live in `runtimes/claude-code-local.md` § Run & supervise — use those, don't improvise.** Their shape:

- `bin/jarvis-up.sh` is an idempotent watchdog: if the tmux session `jarvis` is missing it starts `claude --channels plugin:telegram@claude-plugins-official …` inside it; if the `claude` process is above an RSS cap it kills the session first (the `CMP-22` memory cap); otherwise it exits 0.
- The LaunchAgent runs that watchdog with `RunAtLoad` + `StartInterval` 300 + `AbandonProcessGroup` (so tmux survives the script exiting) instead of `KeepAlive`.
- The script **unsets `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`**: this runtime authenticates only with the owner's own `/login` inside the unmodified `claude` binary (`knowledge/auth-matrix.md`). A stray API key in `.env` would silently switch it to API billing. Never put a subscription token in the plist.
- **Memory cap (`CMP-22`):** launchd has no dependable hard RSS limit on current macOS (`HardResourceLimits`/`ResidentSetSize` is not documented as enforced), so the cap is the watchdog's RSS check plus a nightly restart (`bin/jarvis-restart.sh` from a second LaunchAgent with `StartCalendarInterval`, e.g. 04:00), and `/jarvis-doctor` re-checks RSS (`ps -o rss= -p <pid>`).
- The tmux + launchd wrapper is a community pattern, not an Anthropic-documented setup. The build proves it on the person's Mac: `launchctl kickstart -k gui/$(id -u)/com.jarvis.agent`, then `tmux has-session -t jarvis` exits 0 and the owner gets a reply on the channel; after the first reboot, `/jarvis-doctor` repeats the check.

---

## 2. Linux — systemd user unit

User units run as the person, need no root to install, and with **lingering** they start at boot and survive logout ("a user manager is spawned for the user at boot and kept around after logouts" — [loginctl(1)](https://man7.org/linux/man-pages/man1/loginctl.1.html)).

`~/.config/systemd/user/jarvis.service` (full template with crash-loop guard and `UMask`: `templates/local/jarvis.service.tmpl`). Condensed:

```ini
[Unit]
Description=Jarvis personal assistant
# network-online.target is a system unit; in a user unit this ordering is best-effort only,
# so run.sh / the runtime must retry its first connection anyway.
After=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=10

[Service]
Type=simple
WorkingDirectory={{jarvis_dir}}
EnvironmentFile={{jarvis_dir}}/.env
Environment=TZ={{timezone}}
Environment=PATH={{path}}
ExecStart=/bin/bash {{jarvis_dir}}/bin/run.sh
Restart=on-failure
RestartSec=10
# CMP-22: hard memory cap + no runaway CPU
MemoryMax={{memory_max}}     # e.g. 2G
CPUQuota={{cpu_quota}}       # e.g. 200%
TasksMax=256
# light hardening; MemoryMax/CPUQuota need the memory/cpu controllers delegated to the user manager,
# PrivateTmp in a user unit needs unprivileged user namespaces. Check after start:
# `systemctl --user show jarvis -p MemoryMax` must show the value; if a line fails on this distro, drop it
# and rely on the watchdog RSS check (record it in SECURITY.md)
NoNewPrivileges=yes
UMask=0077

[Install]
WantedBy=default.target
```

```bash
systemd-analyze --user verify ~/.config/systemd/user/jarvis.service
systemctl --user daemon-reload
systemctl --user enable --now jarvis.service
systemctl --user status jarvis.service          # status
systemctl --user restart jarvis.service         # restart
journalctl --user -u jarvis.service -n 100 -f   # logs
# once, run by the person as a user_action (may ask for their password):
#   ! loginctl enable-linger "$USER"
loginctl show-user "$USER" --property=Linger | grep -qx 'Linger=yes'   # verify (exit 0)
```

- `EnvironmentFile=` reads `.env` directly; the file stays chmod 600 and the unit file holds no secrets.
- Scheduled restart for long-running Claude Code: a `jarvis-restart.timer` with `OnCalendar=*-*-* 04:00:00` that runs `systemctl --user restart jarvis.service`.
- Runtimes with their own installer (`hermes gateway install` writes a systemd user unit; find it with `systemctl --user list-unit-files | grep -i hermes`): use theirs, then add `MemoryMax=` via `systemctl --user edit <unit>` (drop-in).
- Sources: [systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html), [systemd.resource-control](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html).

---

### Linux prerequisites (Ubuntu/Debian; each is a `user_action` the person runs)

The agent never runs `sudo`. It shows the exact commands, the person runs them in their own
terminal, and a postcondition checks the result. Versions come from the runtime files and
`stack-researcher`, never from here.

| Need | Safe route | Postcondition |
|---|---|---|
| git | `sudo apt install git` | `git --version` |
| zstd (Ollama tarball) | `sudo apt install zstd` | `zstd --version` |
| Docker Engine | Docker's official apt repo: download the key to `/etc/apt/keyrings/docker.asc`, check its fingerprint against Docker's install page, add the `signed-by` source, `sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin`. Never the `get.docker.com` script piped to a shell | `docker info --format '{{.ServerVersion}}'` without sudo |
| Docker without sudo | **Rootless Docker** (`dockerd-rootless-setuptool.sh install`, Docker's docs) preferred. The `docker` group works too but is root-equivalent: say so in one line and get a yes | same |
| NVIDIA Container Toolkit (only for GPU containers) | NVIDIA's apt repo with its signing key (fingerprint shown), `sudo apt install nvidia-container-toolkit`, `sudo nvidia-ctk runtime configure --runtime=docker`, restart Docker | `nvidia-ctk --version` |
| Node ≥ 22 (panel, Agent SDK) | Ubuntu 24.04's apt Node is older, so use Node's **official tarball** (`node-v<ver>-linux-x64.tar.xz`), checked with `sha256sum` against the release's `SHASUMS256.txt`, extracted under `~/.local/node`, added to `PATH`. Never the NodeSource `curl \| bash` setup script | `~/.local/node/bin/node --version` |
| Lingering (start at boot) | `loginctl enable-linger "$USER"` (may ask for the password) | `loginctl show-user "$USER" -p Linger` prints `Linger=yes` |

## 3. Windows — WSL2 + systemd (recommended), Task Scheduler (fallback)

### Why WSL2

Claude Code on native Windows has **no sandbox**; WSL2 supports it, WSL1 does not ([code.claude.com/docs/en/sandboxing](https://code.claude.com/docs/en/sandboxing)). Channels are Bun-based plugins and the sandbox needs WSL2 (`CMP-14`). So any always-on Jarvis on Windows runs inside WSL2 and uses §2.

### Setup (person runs the admin steps)

1. Admin PowerShell, run by the person: `wsl --install` (installs Ubuntu by default). Then `wsl --version` must work: if it is "not recognized", the inbox WSL is too old for systemd and must be updated from the Microsoft Store (minimum version: [Microsoft Learn — systemd](https://learn.microsoft.com/en-us/windows/wsl/systemd)).
2. In Ubuntu, `/etc/wsl.conf` (editing it needs admin rights → `user_action`; current Ubuntu from `wsl --install` may already default to systemd — check first with step 2's verify):
   ```ini
   [boot]
   systemd=true
   ```
   Then `wsl.exe --shutdown` in PowerShell and reopen. Verify: `ps -p 1 -o comm=` prints `systemd`.
3. Keep the Jarvis folder under `~` in Linux, **not** `/mnt/c` (much slower — [Hermes WSL2 quickstart](https://hermes-agent.nousresearch.com/docs/user-guide/windows-wsl-quickstart)).
4. Follow §2 (user unit + linger).

### Keeping WSL alive (the trap)

"systemd services will NOT keep your WSL instance alive" ([Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/systemd)). WSL shuts a distro down when idle (`instanceIdleTimeout`, default 15 s; `-1` disables auto-shutdown) and the VM after `vmIdleTimeout` (default 60 s, Windows 11 only) ([wsl-config](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)). For a 24/7 Jarvis:

- `%UserProfile%\.wslconfig`:
  ```ini
  [general]
  instanceIdleTimeout=-1
  ```
- A **Task Scheduler** task "At log on" (or "At startup" with "Run whether user is logged on or not") that runs `wsl.exe -d Ubuntu --exec /bin/true` so the distro boots and systemd starts the unit. After setup, close every terminal, wait 10 minutes and message the Jarvis: it must answer. If it doesn't, change the task's action to `wsl.exe -d Ubuntu --exec sleep infinity` so the distro stays up. `/jarvis-doctor` repeats the check.
- Windows power settings: never sleep while plugged in (Settings › System › Power), and a UPS if it's a dedicated box.
- Webhooks/dashboards into WSL from other devices: use Tailscale **inside** WSL (§7), not Windows port proxies.

### Native Windows + Task Scheduler (only when)

Use only for runtimes whose `runtimes/*.md` names a native Windows service as a supported always-on path and that need no sandbox (e.g. Ollama's own Windows app). Not for OpenClaw (its native Windows companion app is not the Jarvis path — `runtimes/openclaw.md`) and not for Claude Code (`CMP-36`). Task: trigger "At log on", action = the runtime's start command, *Settings* → "If the task fails, restart every 1 minute", "Stop the task if it runs longer than" **unchecked**. Logs go to a file the runtime writes. Source: [Task Scheduler — schtasks create](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create). pm2 has no native Windows startup ([pm2 startup](https://pm2.keymetrics.io/docs/usage/startup/)).

---

## 4. pm2 (macOS / Linux, Node users)

```bash
pm2 start ecosystem.config.cjs      # see below
pm2 save                            # remember the process list
pm2 startup                         # PRINTS a sudo command — the person runs it, not the agent
pm2 logs jarvis --lines 100         # logs
pm2 restart jarvis                  # restart
pm2 unstartup                       # remove boot hook
```

```js
// ecosystem.config.cjs — full template: templates/local/ecosystem.config.cjs.tmpl
// .cjs so module.exports works even in an ESM ("type": "module") project. No secrets here.
module.exports = { apps: [{
  name: "jarvis", script: "bin/run.sh", interpreter: "bash", cwd: __dirname,
  autorestart: true, max_restarts: 20, restart_delay: 10000,
  max_memory_restart: "1500M",   // CMP-22 memory cap
  cron_restart: "0 4 * * *",     // daily fresh start
  env: { TZ: "{{timezone}}" },        // e.g. America/Argentina/Buenos_Aires
}]};
```

- `pm2 startup` generates a launchd entry on macOS and systemd on Linux and asks for a `sudo env PATH=… pm2 startup …` command ([pm2 startup docs](https://pm2.keymetrics.io/docs/usage/startup/)). That is a `user_action`.
- Install pm2 with npm at an exact version (`npm install -g pm2@<exact>`), the version checked live by `stack-researcher` and recorded in `.jarvis/state.json` (this file pins none). Log rotation needs the `pm2-logrotate` module (or `run.sh` trims logs, §9).

---

## 5. Docker Compose (bound to 127.0.0.1)

"Publishing container ports is insecure by default… it becomes available not only to the Docker host, but to the outside world as well"; prefixing `127.0.0.1` restricts it to the host ([Docker — port publishing](https://docs.docker.com/engine/network/port-publishing/)). Published ports also bypass `ufw` rules ([Docker — packet filtering](https://docs.docker.com/engine/network/packet-filtering-firewalls/)).

Full template with conditional blocks: `templates/local/docker-compose.yml.tmpl`. Condensed:

```yaml
# compose.yaml — image = tag + digest from runtimes/<id>.md § Pinned versions, never :latest
services:
  jarvis:
    image: {{image}}                        # e.g. <repo>:<pinned-tag>@sha256:<digest>
    command: {{command}}                    # runtime start command, from the runtime file
    restart: unless-stopped
    init: true
    env_file: .env                          # chmod 600, gitignored
    environment: { TZ: "{{timezone}}" }
    # ports: only if the runtime serves a local API/dashboard, and always loopback:
    #   - "127.0.0.1:{{host_port}}:{{container_port}}"
    volumes:
      - ./data:{{data_mount}}
    user: "{{uid}}:{{gid}}"                 # non-root; drop ONLY for images that drop privileges themselves
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    read_only: true                         # loosen per image if it must write outside the volume
    tmpfs: [/tmp]
    mem_limit: {{mem_limit}}                # e.g. 2g
    cpus: {{cpus}}
    pids_limit: 256
    logging: { driver: local, options: { max-size: "10m", max-file: "5" } }
```

- **Hermes specifically** (`runtimes/hermes.md` § Run & supervise is authoritative): the image starts as root only to fix ownership of `/opt/data` and then drops to its own user, so **leave out `user:`** and add only the minimum `cap_add` it needs: start with none, read `docker compose logs` for permission errors, add one capability at a time (usually `CHOWN`, `SETUID`, `SETGID`, `DAC_OVERRIDE`) and record each in `SECURITY.md`; data at `/opt/data`; command `gateway run`; **no `ports:`** for Telegram polling. Ports 8642 (OpenAI-compatible API) and 9119 (dashboard) only if the person enables them, and then `127.0.0.1:` only ([Hermes Docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker)). Never mount `/var/run/docker.sock`.
- `read_only` / `user` / `cap_drop` may need loosening per image: run `docker compose up` and read the logs; if the image fails writing a path, add that path as a `tmpfs` or volume before dropping `read_only`, and record every loosening in `SECURITY.md`.
- A worker that only makes outbound connections (Telegram polling) needs **no `ports:` at all**. That is the safest form.
- `restart: unless-stopped` restarts on crash and after the Docker daemon starts. Docker Desktop on Mac/Windows only starts after a user logs in (pair with auto-login, §6). With Colima or OrbStack, enable their start-at-login option and do one reboot test: the Jarvis must answer without anyone opening a terminal.
- Commands: `docker compose config -q` (syntax check), `docker compose up -d`, `docker compose ps`, `docker compose logs -f --tail 100`, `docker compose restart`, `docker compose pull && docker compose up -d` (update after bumping the tag + digest).
- Same image later on Railway with `image()` in `.railway/railway.ts` (`knowledge/capabilities/deploy-railway.md`).

---

## 6. Mac mini (or any always-on Mac) as home server

All steps are `user_action` with a clear explanation; the agent never runs `sudo`.

| Step | How | Check |
|---|---|---|
| Never sleep, restart after power cut | `sudo pmset -a sleep 0 disksleep 0 autorestart 1` (or System Settings › Energy › "Start up automatically after a power failure") — [ss64 pmset](https://ss64.com/mac/pmset.html) | `pmset -g \| grep -E 'sleep\|autorestart'` |
| Wake for network | `sudo pmset -a womp 1` | `pmset -g \| grep womp` |
| Auto-login (so the LaunchAgent starts) | System Settings › Users & Groups › Automatically log in as… | Reboot test: Jarvis answers without touching the Mac |
| Lock the screen anyway | Require password after screen saver; screen saver on | — |
| Updates | macOS updates manual, scheduled by the person; runtime updates per `runtimes/<id>.md` | `/jarvis-doctor` |
| UPS | Small UPS on the Mac mini **and** the router/modem | Pull-the-plug test |
| Ethernet | Prefer wired over Wi-Fi | — |

**FileVault caveat.** With FileVault on, macOS disables automatic login, so after a reboot the Mac waits at the unlock screen and **no LaunchAgent starts** until someone types the password ([Apple Support — log in automatically](https://support.apple.com/guide/mac-help/mchlp1158/mac)). Options, in order:

1. **Keep FileVault on** (recommended when the Mac holds client, health or legal data) and accept that after a power cut someone unlocks it. The UPS makes that rare; the owner gets "Jarvis is down" from the heartbeat/uptime check.
2. FileVault off + auto-login: Jarvis survives reboots, but anyone with physical access gets the account. Only for a Mac in a locked place with no sensitive data, and the person says yes explicitly (log it in the spec).
3. For a *planned* restart (updates), `sudo fdesetup authrestart` reboots once without the unlock screen. After an unplanned power loss someone types the password; that is why option 1 pairs with a UPS and the down alert.

**Home-hosting reality:** power cuts and ISP drops happen at home far more than in a data center. That is why the UPS and an outside liveness signal (heartbeat message to the owner, or an external uptime check through Tailscale Funnel on a `/health` path) are part of the default local plan, not extras.

---

## 7. Remote access and webhooks — Tailscale

| Need | Use | Exposure |
|---|---|---|
| See the dashboard / API from your phone or laptop | `tailscale serve --bg --https=443 localhost:9119` | **Only your tailnet** ([Tailscale Serve](https://tailscale.com/kb/1242/tailscale-serve)) |
| SSH into the home machine | Tailscale SSH or plain SSH over the tailnet | Tailnet only |
| A provider must call you (WhatsApp Cloud API, Telegram webhook, Twilio voice) | `tailscale funnel --bg --https=443 --set-path=/{{webhook_path}} localhost:{{webhook_port}}` (only that path is public) | **Public internet** on that port ([Tailscale Funnel](https://tailscale.com/kb/1223/funnel), [CLI](https://tailscale.com/kb/1311/tailscale-funnel)) |

- Funnel only listens on **443, 8443 or 10000**, and needs MagicDNS, HTTPS certificates and the `funnel` node attribute in the tailnet policy file ([kb/1223](https://tailscale.com/kb/1223/funnel)). Telegram webhooks accept 443/80/88/8443, so 443 or 8443 both work ([setWebhook](https://core.telegram.org/bots/api#setwebhook)).
- Status / undo: `tailscale serve status`, `tailscale funnel status`, `tailscale funnel reset` (clears the whole Funnel config), or append `off` to the original command ([kb/1311](https://tailscale.com/kb/1311/tailscale-funnel), re-checked 2026-10-06). `--bg` configs persist across reboots until turned off.
- **Funnel only the webhook path**, never a dashboard, Control UI or gateway (`CMP-04`). The handler must verify the provider's secret on every request (Telegram `X-Telegram-Bot-Api-Secret-Token`, Meta's `X-Hub-Signature-256` — see `knowledge/security-checklist.md` and `knowledge/capabilities/whatsapp.md`).
- **Prefer no inbound at all:** Telegram long polling, Discord gateway and Hermes/OpenClaw outbound gateways need no Funnel. Use Funnel only when the channel requires a webhook.
- Never port-forward on the home router, never `0.0.0.0` binds, never ngrok-style tunnels without auth for the control plane.
- Install Tailscale from the package manager or the vendor app per OS (Homebrew cask/App Store on macOS, Tailscale's signed package repository added by the person with apt/dnf on Linux/WSL — a `user_action` because it needs admin rights — winget on Windows). Version pinning, if needed, belongs in the runtime file. Tailscale's own Linux one-liner is a `curl | sh` and is **not** used (rule 9).

---

## 8. Secrets: `.env` chmod 600 or the OS keychain

Order of preference for a local Jarvis:

1. **Runtime's own secret file** if it has one (e.g. `~/.hermes/.env`). Check it with `stat -f %Lp ~/.hermes/.env` (macOS) or `stat -c %a` (Linux); if it isn't `600`, run `chmod 600` on it. Don't duplicate keys elsewhere.
2. **`.env` in the Jarvis folder**, `chmod 600`, owned by the person, in `.gitignore`, never committed (pre-commit secret scan, see `SEC-17`). The person types the values; the Architect only checks presence:
   ```bash
   [ "$(stat -c '%a' .env 2>/dev/null || stat -f '%Lp' .env)" = 600 ]   # exit 0 = mode 600 (GNU, then BSD stat)
   grep -qE '^ANTHROPIC_API_KEY=.+' .env                                # exit 0 = present; never prints the value
   git check-ignore -q .env                                             # exit 0 = ignored
   ```
3. **macOS Keychain** (best for LaunchAgents on a shared Mac). The person stores it once — `security add-generic-password -a "$USER" -s jarvis-anthropic -w` prompts for the value, so it never lands in shell history — and `run.sh` reads it at start:
   ```bash
   export ANTHROPIC_API_KEY="$(security find-generic-password -a "$USER" -s jarvis-anthropic -w)"
   ```
   Works from a LaunchAgent (user's login Keychain is unlocked after login); does **not** work from a LaunchDaemon. If macOS shows a Keychain access prompt on first start, the person clicks *Always Allow* once. **Not for `claude-code-local`**: that runtime uses `/login` and its watchdog unsets `ANTHROPIC_API_KEY` (§1). Source: `man security` ([ss64 security](https://ss64.com/mac/security.html)).
4. **Linux:** `.env` + `EnvironmentFile=` is the default. `systemd-creds` / `LoadCredential=` or `secret-tool` (GNOME keyring) are optional upgrades; a lingering user service with nobody logged in usually can't unlock the keyring, so use them only if a reboot test with nobody logged in still answers.
5. **Windows native:** Credential Manager is out of scope for v1; use WSL2 + `.env`.

Never: secrets in the plist, unit file, `ecosystem.config.cjs`, `compose.yaml`, `CLAUDE.md`, `SOUL.md`, memory files, logs or the chat (rule 7, `SEC-17`, `SEC-18`). Credentials allowed per runtime come only from `knowledge/auth-matrix.md` — a third-party harness on the person's machine still uses an API key, never their Claude Pro/Max login (`CMP-02`).

---

## 9. Logs and restarts

| Supervisor | Logs | Restart | Crash policy |
|---|---|---|---|
| launchd | `logs/out.log`, `logs/err.log` (from the plist) | `launchctl kickstart -k gui/$(id -u)/<label>` | `KeepAlive` + `ThrottleInterval` |
| systemd (Linux/WSL) | `journalctl --user -u jarvis -f` | `systemctl --user restart jarvis` | `Restart=on-failure`, `RestartSec=10`, `MemoryMax=` |
| pm2 | `pm2 logs jarvis` (`~/.pm2/logs/`) | `pm2 restart jarvis` | `autorestart`, `max_memory_restart` |
| Docker Compose | `docker compose logs -f` | `docker compose restart` | `restart: unless-stopped`, `mem_limit` |
| Task Scheduler | runtime's own log file | End task → Run | "Restart every 1 minute" |

- **Rotate logs.** launchd does not rotate `StandardOutPath`; add `/etc/newsyslog.d/` (admin, person runs) or have `run.sh` truncate files over ~20 MB at start. journald, pm2-logrotate and Docker's `local` driver rotate on their own.
- **Logs never contain secrets or full message bodies by default** (`SEC-20`, `SEC-29`): log sender ID, channel, action, allow/deny, cost — not the content.
- **Liveness ≠ "the process exists".** A weekly or daily heartbeat message to the owner (`knowledge/capabilities/scheduling.md`) is the real signal; `/jarvis-doctor` also checks the supervisor status and RSS.

---

## Setup notes per runtime

| Runtime | Local supervisor | Notes |
|---|---|---|
| `claude-code-local` | launchd / systemd running the watchdog `bin/jarvis-up.sh` → tmux → `claude --channels …` (`runtimes/claude-code-local.md`) | `/login` auth; scheduled daily restart + memory check (`CMP-22`); Remote Control server mode exits after ~10 min offline and must be restarted by the supervisor (`knowledge/capabilities/channels.md`) |
| `claude-p-cron` | launchd `StartCalendarInterval` / systemd `.timer` / cron — no long-running process | Owned by `knowledge/capabilities/scheduling.md` and `runtimes/claude-p-cron.md`; while the machine sleeps, launchd runs one coalesced catch-up on wake, systemd catches up once with `Persistent=true`, plain cron skips |
| `claude-agent-sdk` | launchd / systemd / pm2 / Compose | `ANTHROPIC_API_KEY` only (`CMP-02`); no public port unless a webhook needs Funnel |
| `hermes` | **Its own** `hermes gateway install` (LaunchAgent / systemd user unit), or Compose with the pinned image | Outbound gateway → no inbound port needed; one gateway per data dir (`CMP-11`) |
| `openclaw` | **Its own** `openclaw onboard --install-daemon` LaunchAgent, or Compose | Gateway on loopback with token (`CMP-04`); version at or above the floor in `runtimes/openclaw.md` (`CMP-03`); run `openclaw security audit` |
| `codex-openai` | launchd / systemd around the person's bot wrapper | `OPENAI_API_KEY` for any third-party harness (`knowledge/auth-matrix.md`) |
| `ollama-local` | **Our own** `jarvis-ollama` LaunchAgent (macOS, instead of `brew services`, never both) / `jarvis-ollama` systemd user unit over the pinned user-level tarball (Linux, no system package) / inside WSL2 (Windows), per `runtimes/ollama-local.md` § Run & supervise | API stays on `127.0.0.1:11434`; never expose it. Context length per `CMP-24` |
| `cowork` | none | — |

Exact commands, unit names and versions: the runtime file. This file never pins a version.

---

## Security

| Control | Local implementation | Check (exit 0 = pass) |
|---|---|---|
| `SEC-01` Owner allowlist | Unchanged by hosting: every channel allowlisted to the owner | Rejection test from a second account |
| `SEC-03` Webhooks verify origin | Local default is long polling (no inbound); a Funnel webhook verifies the provider's secret/signature | Per checklist grep; `tailscale funnel status` lists only the webhook path |
| `SEC-05` Control plane on loopback | Every listener on `127.0.0.1`; remote via `tailscale serve`; no router port-forward, no `0.0.0.0` | `lsof -nP -iTCP -sTCP:LISTEN \| grep -vE '127\.0\.0\.1\|\[::1\]'` shows no Jarvis port (Linux/WSL: `ss -ltnp`); Compose `ports:` all prefixed `127.0.0.1:` |
| `SEC-07` Sandbox / container | Claude Code sandbox (WSL2 on Windows); container non-root, `cap_drop: [ALL]`, `no-new-privileges`, mem/cpu/pids limits | `docker inspect` shows `CapDrop` = `ALL`; sandbox per runtime file |
| `SEC-17` / `SEC-18` Secrets | `.env` chmod 600 + gitignored, or Keychain; none in plist/unit/compose/ecosystem file | `stat` = 600; `git check-ignore -q .env`; `grep -RIlqE 'sk-ant-\|sk-proj-' ~/Library/LaunchAgents ~/.config/systemd/user compose.yaml ecosystem.config.cjs` exits 1 (`-l -q`: never prints a value) |
| `SEC-20` / `SEC-29` Logs | Rotated, redacted, no full message bodies; audit log of tool calls | Log dir under its size cap; the same `-lq` secret grep on `logs/` exits 1 |
| `SEC-25` / `SEC-26` Versions and installs | Pinned versions; images pinned by tag **and** digest (never `:latest`); package manager installs; `sudo` steps run by the person | Runtime `--version` ≥ floor in `runtimes/<id>.md`; no `curl \| sh` in `RUNBOOK.md` |
| `SEC-27` / `SEC-28` Cost and runaway | Provider spend cap before the first call; memory cap + scheduled restart stop runaway local loops (`CMP-22`) | Person confirms cap; `MemoryMax`/`mem_limit`/`max_memory_restart`/scheduled restart present |
| `SEC-30` Credential | Matches `knowledge/auth-matrix.md` for runtime × local host | Per checklist |
| Physical | FileVault decision recorded; screen lock; UPS | Spec records the choice |

Full control text and checks: `knowledge/security-checklist.md`.

---

## Sources

- Apple — Creating Launch Daemons and Agents: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html
- launchctl reference: https://ss64.com/mac/launchctl.html · pmset: https://ss64.com/mac/pmset.html · security: https://ss64.com/mac/security.html
- Apple Support — automatic login is disabled when FileVault is on: https://support.apple.com/guide/mac-help/mchlp1158/mac (checked 2026-10-06 via search; older-version pages state the same)
- OpenClaw as a launchd service (LaunchAgent needs login): https://stackharbor.com/en/knowledge-base/openclaw-as-launchd-service/
- loginctl enable-linger: https://man7.org/linux/man-pages/man1/loginctl.1.html
- systemd.service / resource-control: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html · https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
- WSL systemd (does not keep WSL alive): https://learn.microsoft.com/en-us/windows/wsl/systemd (checked 2026-10-06)
- WSL config (`instanceIdleTimeout`, `vmIdleTimeout`): https://learn.microsoft.com/en-us/windows/wsl/wsl-config (checked 2026-10-06)
- schtasks: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-create
- Claude Code sandboxing (no sandbox on native Windows): https://code.claude.com/docs/en/sandboxing
- pm2 startup (init systems, sudo command, no Windows): https://pm2.keymetrics.io/docs/usage/startup/ (checked 2026-10-06)
- Docker port publishing (insecure by default, 127.0.0.1 bind): https://docs.docker.com/engine/network/port-publishing/ (checked 2026-10-06)
- Docker and ufw: https://docs.docker.com/engine/network/packet-filtering-firewalls/
- Hermes Docker: https://hermes-agent.nousresearch.com/docs/user-guide/docker
- Tailscale Serve: https://tailscale.com/kb/1242/tailscale-serve · Funnel: https://tailscale.com/kb/1223/funnel · Funnel CLI: https://tailscale.com/kb/1311/tailscale-funnel (checked 2026-10-06)
- Telegram setWebhook ports: https://core.telegram.org/bots/api#setwebhook
- Hermes on Windows / WSL2 (keep projects under `~`, not `/mnt/c`): https://hermes-agent.nousresearch.com/docs/user-guide/windows-wsl-quickstart
