# Template: `.jarvis/tasks.json`

> The machine-readable build order for one Jarvis. It is what lets a build survive a closed
> terminal: `/jarvis-next` reads it and continues exactly where it stopped.

Last verified: 2026-10-06

> **Not a Jarvis's `TASKS.md`.** This file is the Architect's **build ledger**: the steps to build and
> verify one Jarvis. It has nothing to do with the owner's own task list inside the finished Jarvis
> (`templates/workspace/TASKS.md`, rules in `knowledge/capabilities/autonomy.md`). Never mix the two.

Adapted from The Architect's `tasks-schema.md`, with one addition: **`user_action` tasks**, because
setting up a personal assistant always needs the human (creating a bot, a key, a spend cap).

## Shape

A JSON object with the target folder and an array of tasks in build order.

```json
{
  "jarvis_dir": "/Users/ana/jarvis-ana",
  "runtime": "claude-code-local",
  "harness": null,
  "os": "macos",
  "tasks": [ { "id": "T01", "...": "..." } ]
}
```

`harness` is set only when the runtime is a model provider under a harness: `"runtime":
"ollama-local", "harness": "hermes"`. Then both runtime files are raw material and each `.env`
path in the tasks is the one the file that owns it names (Hermes: `~/.hermes/.env` or the
compose `.env`). `os` (from `preflight.json`) picks the verify dialect: `macos`/`linux`/`wsl` →
POSIX shell; `windows` → see § Windows native.

## Task fields

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | `T01`, `T02`… Never renumber. |
| `title` | string | yes | Imperative, ≤60 chars, in the person's language. |
| `kind` | string | yes | `agent` (you do it) or `user_action` (the person does it, you check). |
| `dependencies` | string[] | yes | Task ids that must be `done` first. `[]` for roots. Only real dependencies. |
| `instructions` | string[] | user_action only | Numbered, click-level steps with links, in their language. No jargon without a half-line explanation. |
| `acceptance` | string[] | yes | 1–4 EARS criteria: **WHEN** `<trigger>` **THE SYSTEM SHALL** `<observable response>`. Decidable by a command on this machine. |
| `verify` | string[] | yes | Shell commands run from `jarvis_dir`. **Each exits 0 when the task is correct.** An expected error is wrapped: `cmd; test $? -eq 2`. For `user_action`, this is the postcondition check. When nothing on this machine can see the result (a spend cap in a web dashboard), the only allowed value is `["person-confirmed"]`: the agent asks a yes/no question and logs the answer with the date in spec §7. Never use it for something a command could check. |
| `secrets_safe` | boolean | yes | `true` only if no verify command can print a secret value. Presence checks only: `grep -q '^KEY=.\+' .env`, never `cat .env` / `echo $KEY`. |
| `checkpoint` | string | yes | Git tag `step-NN-<slug>` in the Jarvis repo. |
| `files` | string[] | yes | Files this task creates or edits (relative to `jarvis_dir`; `~/…` for files the runtime keeps outside it, such as a channel token file). |
| `cost` | string | no | Any money this step commits ("Railway Hobby $5/mes"). Present → explicit yes required. |
| `status` | string | yes | `pending` · `in_progress` · `done` · `blocked`. Written immediately, before and after work. |

## Example

```json
{
  "id": "T05",
  "title": "Crea tu bot de Telegram",
  "kind": "user_action",
  "dependencies": ["T01"],
  "instructions": [
    "Abre Telegram y busca @BotFather (tiene palomita azul).",
    "Escríbele /newbot y ponle un nombre, por ejemplo: Jarvis de Ana.",
    "Elige un usuario que termine en 'bot', por ejemplo: jarvis_ana_bot.",
    "BotFather te da un token largo. NO lo pegues aquí en el chat.",
    "Te abro un archivo en TextEdit (está en una carpeta oculta, no lo busques en Finder). Escribe TELEGRAM_BOT_TOKEN= y pega el token justo después, sin espacios. Guarda con Cmd+S y cierra la ventana."
  ],
  "acceptance": ["WHEN the token is saved THE SYSTEM SHALL have a non-empty TELEGRAM_BOT_TOKEN line in the channel token file"],
  "verify": [
    "grep -q '^TELEGRAM_BOT_TOKEN=.\\+' ~/.claude/channels/telegram/.env",
    "( . ~/.claude/channels/telegram/.env; printf 'url = \"https://api.telegram.org/bot%s/getMe\"\\n' \"$TELEGRAM_BOT_TOKEN\" | curl -fsS -K - | grep -q '\"ok\":true' )"
  ],
  "secrets_safe": true,
  "checkpoint": "step-05-telegram-bot",
  "files": ["~/.claude/channels/telegram/.env"],
  "status": "pending"
}
```

## Rules that matter

- **Array order is the build order.** `/jarvis-next` picks the first `pending` task whose
  dependencies are all `done`. Never re-rank.
- **`in_progress` on resume = crash recovery.** Re-run its verify list: all pass → `done`;
  otherwise continue that task. Never skip it.
- **A verify command that reads a secret is a defect.** The validator fails the build on it.
- **Paths close over each other.** Every file a verify command reads is in some task's `files`.
- **Where the token lives is the runtime's call.** The example is `claude-code-local`, whose bot
  token lives only in `~/.claude/channels/telegram/.env` (never the Jarvis `.env`). Other runtimes:
  the path their file's *Configure* section names. The agent opens the file for the person
  (`open -e <file>` on macOS, `notepad <file>` on Windows, `nano <file>` on Linux) after creating
  it empty with mode 600; hidden dotfiles never have to be found in Finder/Explorer.
- **Network checks are allowed**, with the token kept out of argv: load the token file in a
  subshell and pass the URL to curl on stdin (`curl -K -`, as in the example), printing only
  `ok`/`fail`. Never `curl …/bot$TOKEN/…` on the command line (it shows in `ps`).
- **`blocked`** is for tasks waiting on something outside the session (a Meta Business
  verification, a phone number). Explain what unblocks it; continue with independent tasks.

## Windows native (no WSL)

Only for runtimes whose file allows native Windows (e.g. a cloud host like `hermes` on Railway,
where Windows is just the person's console). Verify commands run in PowerShell:

| POSIX | PowerShell |
|---|---|
| `test -s f` | `if ((Get-Item f -ErrorAction Stop).Length -gt 0) { exit 0 } else { exit 1 }` |
| `grep -q '^KEY=.\+' f` | `if (Select-String -Path f -Pattern '^KEY=.+' -Quiet) { exit 0 } else { exit 1 }` |
| `chmod 600 .env` | `icacls .env /inheritance:r /grant:r "$($env:USERNAME):(R,W)"` |
| `shasum -a 256 f` | `Get-FileHash f -Algorithm SHA256` |

Missing Git or Node becomes the first `user_action` tasks: `winget install --id Git.Git -e` and
`winget install --id OpenJS.NodeJS.LTS -e` (version from the runtime file / `stack-researcher`),
the person approves the UAC prompt, then reopens the terminal. Postcondition: `git --version` /
`node --version` exit 0.
