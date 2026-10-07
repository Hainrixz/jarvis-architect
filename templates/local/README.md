# Local supervisor templates

> Four ways to keep a Jarvis running on the person's own machine (launchd, systemd user unit, Docker Compose, pm2), what each is for, and how the Architect fills them in.

Last verified: 2026-10-06

The decision rules, admin steps (auto-login, `pmset`, linger, WSL2), Tailscale and log rotation are
in `knowledge/capabilities/deploy-local.md`. Start commands, data paths, ports and health commands
come from `knowledge/runtimes/<id>.md`. This folder holds no versions, prices or secrets.

## Which one

| Situation | Template | Rendered to |
|---|---|---|
| macOS, custom Jarvis (Agent SDK app, Codex track B, Claude Code + Channels wrapper) | `com.jarvis.agent.plist.tmpl` | `~/Library/LaunchAgents/<label>.plist` |
| Linux, or Windows through WSL2 with `systemd=true` | `jarvis.service.tmpl` | `~/.config/systemd/user/<unit>.service` |
| Runtime has an official image (Hermes, OpenClaw) **and** the person wants isolation or may move to Railway later | `docker-compose.yml.tmpl` | `<jarvis_dir>/compose.yaml` |
| Person already uses Node/pm2 on macOS or Linux | `ecosystem.config.cjs.tmpl` | `<jarvis_dir>/ecosystem.config.cjs` |
| Hermes or OpenClaw **native** install | **None.** Use `hermes gateway install` / `openclaw onboard --install-daemon` (see their runtime files) | — |
| `claude-p-cron`, `codex-openai` track A | **None.** Those use scheduled timers, not a long-running process (`runtimes/claude-p-cron.md`) | — |
| `cowork` | **None.** Nothing to supervise | — |

**Exactly one supervisor per Jarvis.** Before installing any of these, check that nothing else
(tmux, a runtime's own daemon, pm2, a container) already runs the same gateway. Two copies on one
data directory corrupt state (CMP-11).

## Shared contract: `bin/run.sh`

The plist, the systemd unit and pm2 all start `bin/run.sh` in the Jarvis folder, never the runtime
directly. That keeps the supervisor files free of secrets and lets one wrapper do the runtime-specific
work. `workspace-writer` writes it (mode 700) from the runtime file. Minimum shape:

```bash
#!/usr/bin/env bash
# bin/run.sh — load secrets, trim logs, exec the runtime (no secrets in this file)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
for f in logs/out.log logs/err.log; do               # launchd does not rotate logs
  [ -f "$f" ] && [ "$(wc -c < "$f")" -gt 20000000 ] && : > "$f"
done
if [ -f .env ]; then set -a; . ./.env; set +a; fi   # systemd also loads it via EnvironmentFile=
[ -e STOP ] && { echo "STOP file present, not starting"; exit 0; }   # kill switch
exec <runtime start command from knowledge/runtimes/<id>.md>
```

Exiting 0 from the kill switch matters: launchd (`SuccessfulExit=false`) and systemd
(`Restart=on-failure`) leave a clean exit stopped.

## How the Architect renders a template

1. Copy the template to its target path (table above).
2. **Conditional blocks.** Lines between `@if:<flag>` and `@end:<flag>` comment markers (`#` in YAML
   and systemd, `//` in JS, `<!-- -->` in the plist) are kept only when the flag is true. The marker lines are always removed.
3. **Placeholders.** Replace every `{{name}}` with the value from the tables below. Values come from
   `.jarvis/jarvis-spec.md`, `.jarvis/preflight.json` and `knowledge/`, never from memory. Escape for
   the target format (`&` → `&amp;` in the plist).
4. **Leftover check.** The task's verify must exit 0: `! grep -nE '\{\{|@if:|@end:' <rendered file>`.
5. **Syntax check**, then start. Each start that changes the person's machine is shown first and
   approved:

| Template | Syntax check | Start | Healthy when |
|---|---|---|---|
| plist | `plutil -lint <file>` | `launchctl bootstrap gui/$(id -u) <file>` | `launchctl print gui/$(id -u)/<label> \| grep -q 'state = running'` |
| systemd | `systemd-analyze --user verify <file>` | `systemctl --user daemon-reload && systemctl --user enable --now <unit>` | `systemctl --user is-active --quiet <unit>` |
| compose | `docker compose -f compose.yaml config -q` | `docker compose up -d` | `docker compose ps --status running --quiet \| grep -q .` |
| pm2 | `node -e "require('./ecosystem.config.cjs')"` | `pm2 start ecosystem.config.cjs && pm2 save` | `pm2 jlist \| grep -q '"status":"online"'` (or `pm2 describe <name>`) |

Admin steps are `user_action` tasks. The person runs them with `! <command>`: `loginctl enable-linger
"$USER"` (systemd), the `sudo …` line printed by `pm2 startup`, and auto-login or `pmset` on a Mac mini.

## Placeholders

### Shared

| Placeholder | Value | Source |
|---|---|---|
| `{{jarvis_dir}}` | Absolute path, e.g. `/Users/ana/jarvis-ana` or `/home/ana/jarvis-ana`. No `~`: supervisors don't expand it | spec `jarvis_dir` |
| `{{jarvis_name}}` | Display name | spec |
| `{{timezone}}` | IANA zone, e.g. `America/Bogota` | `knowledge/countries/<cc>.md` |
| `{{path}}` | Absolute `PATH`. macOS Apple silicon: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`. Intel: `/usr/local/bin:/usr/bin:/bin`. macOS: prepend the directory of `which claude` when it is outside these (native installer: `/Users/USER/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`, `USER` = `id -un`; same convention as `knowledge/capabilities/scheduling.md` and `knowledge/runtimes/claude-p-cron.md`). Linux: add `%h/.local/bin` only in systemd, or the real node/uv path | `preflight.json` (`which node`, `brew --prefix`) |

### `com.jarvis.agent.plist.tmpl`

| Placeholder | Value |
|---|---|
| `{{launchd_label}}` | `com.jarvis.agent`, or `com.jarvis.<name>` if the person has more than one Jarvis; the panel is `<label>.panel`. The file name must equal the label + `.plist` |
| `{{program_args}}` | `<string>` lines. Default `<string>/bin/bash</string><string>{{jarvis_dir}}/bin/run.sh</string>`. `claude-code-local`: `…/bin/jarvis-up.sh`. Panel: `<string>/opt/homebrew/bin/node</string><string>src/server.js</string>` (real node path from preflight) |
| `{{working_dir}}` | `{{jarvis_dir}}`; the panel uses `{{jarvis_dir}}/panel` |
| flag `service` / flag `watchdog` / flag `calendar` | Exactly one on. `service` (default, and the panel): `KeepAlive` restarts a long-running process. `watchdog` (`claude-code-local`): `StartInterval` 300 + `AbandonProcessGroup`, because `jarvis-up.sh` starts tmux and exits. `calendar` (`claude-code-local` nightly restart, label `<label>.restart`, program `bin/jarvis-restart.sh`): `StartCalendarInterval` at `{{calendar_hour}}`:`{{calendar_minute}}` (e.g. `4` and `17`) + `AbandonProcessGroup` |
| `{{calendar_hour}}`, `{{calendar_minute}}` | Only with flag `calendar`: plain integers, local time (e.g. `4`, `17`) |

Notes: `KeepAlive` → `SuccessfulExit=false` restarts on crash only. `ThrottleInterval` 30 s stops a
crash loop from spinning. `Umask` 63 (= 077) makes logs and state owner-only. A LaunchAgent starts
only after login, so an always-on Mac needs auto-login, and FileVault blocks auto-login after a power
cut (`deploy-local.md` §6). launchd has no dependable memory cap. For `claude-code-local`, add the
daily-restart LaunchAgent described in `deploy-local.md` §1 (CMP-22). Keys checked against
`man launchd.plist` on macOS (2026-10-06).

### `jarvis.service.tmpl`

| Placeholder | Value |
|---|---|
| `{{unit_name}}` | `jarvis` (or `jarvis-<name>`) |
| `{{memory_max}}` | e.g. `1G` for a lean worker, `2G` for a gateway or Claude Code. RAM figures: `knowledge/capabilities/costs.md` |
| `{{cpu_quota}}` | `100%` (one core) or `200%` |

Notes: `EnvironmentFile=` reads `.env` directly. The unit fails to start if `.env` is missing, on
purpose. `MemoryMax=` needs the memory controller delegated to the user manager. Most systemd
distros do this by default; confirm it before relying on the cap: `cat
/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/cgroup.controllers` must list
`memory` (`/jarvis-doctor` also checks `systemctl --user show <unit> -p MemoryMax`). If `memory` is
missing, keep the unit, tell the person the cap is not enforced on their distro, and record it in
`SECURITY.md`. `PrivateTmp=` in a user unit needs unprivileged user namespaces: if start fails
with `226/NAMESPACE`, drop that line and record it in `SECURITY.md`.
WSL2 shuts down when idle unless kept alive (`deploy-local.md` §3).

### `docker-compose.yml.tmpl`

| Placeholder / flag | Value |
|---|---|
| `{{compose_project}}` | `jarvis-<name>` |
| `{{service_name}}` | Runtime id, e.g. `hermes`, `openclaw`, `jarvis` |
| `{{image}}` | `<registry>/<image>:<tag>@sha256:<digest>`, **only** from `runtimes/<id>.md` § Pinned versions. Never `:latest` |
| flag `command`, `{{command}}` | The runtime's command if the image's default is not right (Hermes: `gateway run`) |
| flag `init` | On for plain Node/Python images. Off for images whose entrypoint must be PID 1 (Hermes uses s6, and s6-overlay refuses to run when it is not PID 1). After `docker compose up -d`, check `docker compose logs --tail 50`: if it mentions PID 1 or s6, turn `init` off and start again |
| flag `ports`, `{{host_port}}`, `{{container_port}}` | Only for a local API/dashboard. Always rendered as `127.0.0.1:…`. Off for outbound-only workers |
| `{{data_mount}}` | Data path inside the container (Hermes `/opt/data`; OpenClaw per its runtime file) |
| flag `user`, `{{uid}}`, `{{gid}}` | On by default with the person's `id -u` / `id -g` (or the image's documented non-root UID). Off **only** for images that must start as root to drop privileges themselves (Hermes: s6 drops to UID 10000; see `runtimes/hermes.md`). Write the reason in `SECURITY.md` |
| flag `cap_add`, `{{cap_add}}` | Off by default. With `user` off, the image may need e.g. `CHOWN, SETUID, SETGID` to drop privileges. Start with none; if the logs show a permission error on start, add only the capability named there, start again, and record the final set in `SECURITY.md` |
| flag `read_only` | On by default. Turn it off if the image writes outside `/tmp` and `{{data_mount}}` (the logs show `Read-only file system` on start). Images with s6-overlay (Hermes) write to `/run` at start, so turn it off for them; for any image, if `docker compose logs` shows `Read-only file system`, turn it off, start again and record it in `SECURITY.md` |
| `{{mem_limit}}`, `{{cpus}}` | e.g. `2g` / `1.0` for Hermes or OpenClaw, `512m` / `0.5` for a lean worker |
| flag `healthcheck`, `{{health_cmd}}` | The runtime's health command from its *Verify* section, if the image contains it |

Always on, never removed: `cap_drop: [ALL]`, `no-new-privileges:true`, `pids_limit: 256`, a memory
limit, `restart: unless-stopped`, bounded logs, `.env` via `env_file`, no `docker.sock` mount.
Published ports bypass `ufw`, which is why every port is bound to `127.0.0.1`
([Docker port publishing](https://docs.docker.com/engine/network/port-publishing/)). Docker Desktop
on macOS and Windows starts only after login.

### `ecosystem.config.cjs.tmpl`

| Placeholder / flag | Value |
|---|---|
| `{{pm2_name}}` | `jarvis` (or `jarvis-<name>`) |
| `{{max_memory_restart}}` | e.g. `1500M` (CMP-22) |
| flag `cron_restart`, `{{cron_restart}}` | On for long-running Claude Code (`0 4 * * *`, local time). Optional otherwise |

Notes: install pm2 with npm at the version the runtime file or `stack-researcher` gives. Never run it
unpinned. Add `pm2-logrotate` for log rotation. pm2 has no native Windows startup, so on Windows use
WSL2 + systemd instead. Attributes checked against the
[pm2 ecosystem reference](https://pm2.keymetrics.io/docs/usage/application-declaration/) on 2026-10-06.

## Security notes (map to `knowledge/security-checklist.md`)

- No secret ever goes in a plist, unit, `compose.yaml` or `ecosystem.config.cjs`. Secrets live in
  `<jarvis_dir>/.env` (chmod 600, gitignored) or the OS keychain.
- Nothing listens on a public interface. Remote access goes through `tailscale serve`, or `funnel`
  only for a webhook (`deploy-local.md`).
- Every supervisor has a restart policy and a crash-loop brake. systemd (`MemoryMax=`) and Docker
  (`mem_limit`) enforce a hard memory cap; pm2 (`max_memory_restart`) restarts the process after it
  passes the threshold, which is a soft cap; launchd has none.
- The person runs every admin step (`sudo`, linger, `pm2 startup`) themselves. The agent never uses
  `sudo` and never pipes a download into a shell.

## Sources

- https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html
- `man launchd.plist` (macOS, checked 2026-10-06)
- https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
- https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
- https://man7.org/linux/man-pages/man1/loginctl.1.html
- https://docs.docker.com/engine/network/port-publishing/
- https://docs.docker.com/reference/compose-file/services/
- https://pm2.keymetrics.io/docs/usage/application-declaration/
- https://pm2.keymetrics.io/docs/usage/startup/
