# Jarvis Panel

Una página web chiquita, en tu propia computadora, para ver a tu Jarvis y hablar con él sin abrir
la terminal.

Desde el panel puedes:

- **Chatear** con tu Jarvis.
- **Ver y editar su memoria**: `MEMORY.md`, `USER.md`, `SOUL.md` y `HEARTBEAT.md`. `AGENTS.md` y
  `TOOLS.md` solo se pueden leer, porque ahí están sus permisos. `TASKS.md` y `LESSONS.md` también se
  ven aquí en solo lectura; se cambian desde Pendientes y Aprendizajes.
- **Ver sus tareas programadas** y ejecutar una al momento.
- **Aprobar o rechazar** lo que Jarvis quiere hacer y no tiene vuelta atrás: enviar un correo,
  pagar, borrar o publicar. Cada aprobación caduca a los 5 minutos.
- **Leer el registro** de todo lo que pasó (`logs/audit.jsonl`).
- **Pendientes**: ver `TASKS.md` (lo tuyo y lo que Jarvis prepara solo), cambiar el estado, posponer o
  marcar como hecha. Desde aquí un nivel de autonomía solo se puede bajar, y una tarea tuya no se le
  pasa a Jarvis. Si alguien más cambió el archivo mientras lo veías, el panel no pisa nada: recarga y
  te avisa. También pausas o reanudas el piloto automático (reanudar pide confirmación) y ves su
  última vuelta y el gasto de hoy (de `logs/audit.tsv`). El número rojo cuenta lo que necesita tu OK.
- **Aprendizajes**: las lecciones de `LESSONS.md` (activas, en revisión y retiradas) para retirarlas o
  activarlas, y las habilidades que Jarvis creó solo, con su periodo de prueba y un botón para
  quitarlas (corre `bin/promote-skill.sh retire <nombre>`; se recupera con `bin/learn.sh undo <nombre>`).
  Cada cambio de lección se guarda en git con `bin/learn.sh commit`, así que «deshaz» también lo
  revierte. Una lección que hable de permisos, llaves o de actuar sin preguntar nunca se activa.

Está en español, con botón para cambiar a inglés. No carga nada de internet, así que funciona sin
conexión.

## Arrancarlo en tu computadora

Necesitas Node 22 o más nuevo (`node -v`).

```bash
cd panel
npm ci
cp .env.example .env
chmod 600 .env
# abre .env y revisa PANEL_ADAPTER (el Architect ya lo dejó listo)
npm start
```

En Windows sin WSL (PowerShell), cambia la línea de `chmod` por
`icacls .env /inheritance:r /grant:r "$($env:USERNAME):(R,W)"`; lo demás es igual.

Luego abre **http://127.0.0.1:7878** en tu navegador.

Para comprobar que está vivo:

```bash
curl -fsS http://127.0.0.1:7878/api/health
```

El Architect lo deja corriendo solo, con el mismo sistema que mantiene vivo a tu Jarvis (launchd
en Mac, systemd en Linux o pm2). Si apagas la compu, vuelve a arrancar solo al prenderla.

### Usarlo desde el celular

No abras puertos en tu router. Usa Tailscale, que solo deja entrar a tus propios dispositivos:

```bash
tailscale serve --bg 7878
```

Luego agrega el nombre de tu compu en Tailscale a `PANEL_ALLOWED_HOSTS` (por ejemplo
`PANEL_ALLOWED_HOSTS=mi-mac.tailnet-xyz.ts.net`); si no, el panel responde "Host no permitido".
Pon de todas formas una contraseña en `PANEL_PASSWORD` (mínimo 12 caracteres). **Nunca uses `tailscale funnel` con el
panel**, porque lo publicaría en internet.

## En Railway

Solo con contraseña. Si `PANEL_HOST` no es `127.0.0.1` y `PANEL_PASSWORD` está vacío, el panel se
niega a arrancar.

- Es el servicio web del Tier B y el **único** con dominio público. Mejor todavía si no tiene
  dominio y entras por Tailscale.
- `PANEL_PASSWORD` va como variable sellada (*sealed*), igual que cualquier llave.
- Healthcheck: `/api/health`.
- Para ver la memoria, las tareas y las aprobaciones, el panel tiene que leer el volumen donde vive
  tu Jarvis. Los detalles están en `knowledge/capabilities/web-ui.md`.

## Qué adaptador usar

| Tu Jarvis corre con… | `PANEL_ADAPTER` | Variables extra |
|---|---|---|
| Claude Code en tu compu (`claude-code-local`, `claude-p-cron`) | `claude-cli` | `CLAUDE_BIN`, `CLAUDE_ALLOWED_TOOLS`, `CLAUDE_SETTINGS_FILE` (si no lo pones, usa `.claude/headless-settings.json` cuando existe: mismo sandbox que tu Jarvis y sin abrir un segundo bot de Telegram) |
| Claude Code en servidor (`claude-code-server`) | `claude-cli` | lo mismo, con `PANEL_PASSWORD` y Tailscale |
| Claude Agent SDK (`claude-agent-sdk`) | Mejor: las rutas `/api/*` montadas dentro del core (ver `knowledge/capabilities/web-ui.md`). `agent-sdk` solo para pruebas locales | `ANTHROPIC_API_KEY`, `AGENT_SDK_MODEL`, `JARVIS_MEMORY_DIR=workspace` |
| Hermes (`hermes`) | `openai-compatible` | `OPENAI_COMPAT_BASE_URL=http://127.0.0.1:8642/v1`, `OPENAI_COMPAT_API_KEY` = tu `API_SERVER_KEY` de Hermes (con `API_SERVER_ENABLED=true` en Hermes) |
| Ollama (`ollama-local`) | `openai-compatible` | `OPENAI_COMPAT_BASE_URL=http://127.0.0.1:11434/v1`, `OPENAI_COMPAT_MODEL` |
| Codex (`codex-openai`) | `codex-cli` | `CODEX_BIN`, `CODEX_SANDBOX` (`read-only` por defecto) |
| OpenClaw | — | No uses el panel. OpenClaw trae su propio Control UI (`http://127.0.0.1:18789/`). Déjalo solo en tu compu y nunca lo publiques en internet |
| Cowork | — | Tu interfaz ya es Claude Desktop |
| Pruebas | `mock` | Responde en eco. Solo para demos y tests (`NODE_ENV=test`) |

Todas las variables, cada una con su explicación, están en `.env.example`. Dos más:

- `JARVIS_MEMORY_DIR`: carpeta de SOUL/USER/MEMORY.md si no están en `JARVIS_HOME` (relativa a
  `JARVIS_HOME` o absoluta). Ej.: `workspace` en el Agent SDK.
- En `jobs.json` cada tarea lleva `prompt` (texto) o `prompt_file` (ruta dentro de `JARVIS_HOME`,
  p. ej. `jobs/briefing.md`).

## Seguridad

- Por defecto solo escucha en `127.0.0.1`, o sea que solo se abre desde tu propia computadora.
- Con `PANEL_PASSWORD`, todo pide iniciar sesión, menos `/api/health`. La cookie es `HttpOnly` y
  `SameSite=Strict`. Si fallas 5 veces en un minuto, te bloquea un rato.
- Los cambios exigen el encabezado `X-Jarvis-Panel: 1`, para que otra página no pueda hacer clic
  por ti.
- Ese encabezado frena a otras páginas web, no a programas de tu propia computadora. Sin
  `PANEL_PASSWORD`, cualquier programa local (también un Jarvis con Bash) puede llamar a
  `127.0.0.1:7878/api/…`. Por eso, si tu Jarvis tiene Bash, el Architect pone `PANEL_PASSWORD` o
  deja activo el hook `protect-paths.sh`, que le niega cualquier comando dirigido al puerto del panel.
  Pausar el piloto siempre se puede; reanudarlo pide sesión (con contraseña) y `{"confirm":true}`.
- Nunca muestra tus llaves ni el contenido de `.env`. Solo sirve archivos de `public/` y solo
  deja tocar los archivos de memoria permitidos.
- Nunca se salta los permisos de tu Jarvis: no usa `--dangerously-skip-permissions`,
  `bypassPermissions` ni `danger-full-access`.
- Con contraseña aparece un botón de candado arriba para cerrar sesión; al salir también se borra
  la conversación guardada en esa pestaña.
- Todo cambio queda anotado en `logs/audit.jsonl`, sin contraseñas ni textos privados.
- Guarda `.env` con permisos `600` y nunca lo subas a git.

Cómo decide el Architect si instalarlo y qué control cumple cada cosa:
`knowledge/capabilities/web-ui.md`.
