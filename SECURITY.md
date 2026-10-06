# Security Policy / Política de seguridad

## Qué es este repo y por qué eso importa

Jarvis Architect no publica un servidor ni una app. Publica **texto que entra al contexto de un
agente** (Claude Code) y que ese agente usa para **instalar software, escribir archivos, conectar
cuentas y dejar corriendo un asistente 24/7** en la compu o en el Railway de otra persona — muchas
veces alguien no técnico que no va a revisar cada comando.

Eso define el modelo de amenazas: un error o una instrucción maliciosa en `knowledge/`,
`questions/`, `templates/` o `.claude/` no es un "bug de documentación". Es algo que se va a
ejecutar con permisos reales.

**EN — What this repo is and why it matters.** Jarvis Architect ships no server and no app. It ships
**text that goes into an agent's context** (Claude Code), which the agent uses to **install
software, write files, connect accounts and leave an assistant running 24/7** on someone else's
machine or Railway project — often a non-technical person who will not review every command. A
mistake or a malicious instruction in `knowledge/`, `questions/`, `templates/` or `.claude/` is not a
documentation bug; it is something that will run with real permissions.

## Versiones soportadas / Supported versions

| Versión | Soporte |
|---|---|
| 1.x | Sí / Yes |

Los arreglos salen en el release más reciente. No hay backports.
*Fixes ship on the latest release. No backports.*

---

## Cómo reportar una vulnerabilidad / How to report

**No abras un issue público.** Un payload de prompt injection funcional es un exploit vivo en cuanto
se publica.

**Ruta preferida — GitHub private vulnerability reporting.** Ve a la pestaña
[Security del repo](https://github.com/Hainrixz/jarvis-architect/security) → **Report a
vulnerability**, o directo a
[security/advisories/new](https://github.com/Hainrixz/jarvis-architect/security/advisories/new).
Solo el maintainer lo ve, y el arreglo se prepara en un fork privado antes de hacerse público.
*(Nota para el maintainer: GitHub no la activa por defecto; se enciende en Settings → Security →
Private vulnerability reporting —
[doc](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository).)*

**Si esa opción no te aparece**, contacta al maintainer en privado por
[@Hainrixz](https://github.com/Hainrixz) o [tododeia.com](https://tododeia.com): primero un aviso
sin detalles, luego los detalles por el canal privado que acuerden. Nunca pegues el payload en un
mensaje público.

**EN — Do not open a public issue.** Use GitHub private vulnerability reporting: the repo's
[Security tab](https://github.com/Hainrixz/jarvis-architect/security) → **Report a vulnerability**
([direct link](https://github.com/Hainrixz/jarvis-architect/security/advisories/new)). If it is not
available to you, contact the maintainer privately via [@Hainrixz](https://github.com/Hainrixz) or
[tododeia.com](https://tododeia.com) — a heads-up first, details only over the agreed private
channel.

### Qué incluir / What to include

- Archivo y texto exacto (número de línea o párrafo citado). *File and exact text.*
- Qué haría un agente que lo lee. *What an agent reading it would be induced to do.*
- Si ya está en `main` o solo en un PR abierto. *Merged, or only in an open PR.*
- Reproducción mínima: la persona simulada que usaste y lo que salió. **Sin tus keys ni datos
  reales.** *Minimal repro with a simulated persona — no real keys or data.*

### Qué esperar / What to expect

| Etapa / Stage | Tiempo / Timeline |
|---|---|
| Acuse de recibo / Acknowledgement | 3 días hábiles / 3 business days |
| Evaluación inicial / Initial assessment | 7 días / 7 days |
| Arreglo / Fix | Según severidad; una inyección ya fusionada o un pin con CVE es urgente / By severity; a merged injection or a pin with a CVE is urgent |
| Divulgación / Disclosure | Coordinada contigo, después del arreglo / Coordinated with you, after the fix |

Lo mantiene una persona. Si en una semana no hay respuesta, insiste: es un mensaje perdido, no una
política. Damos crédito en [CHANGELOG.md](CHANGELOG.md) salvo que prefieras que no.

*Maintained by one person. If you hear nothing in a week, ping again. Reporters are credited in the
CHANGELOG unless they prefer not to be.*

---

## Modelo de amenazas / Threat model

### 1. Prompt injection a través de los archivos de conocimiento

**El riesgo principal.** Todo lo que está en `knowledge/`, `questions/`, `templates/` y `.claude/`
(skills y agentes) se lee como instrucción. Un PR que agrega un pack de profesión "razonable" también
agrega texto al contexto de cada sesión futura.

Una inyección aquí no parece ataque; parece consejo:

- Un *guardrail* que "por comodidad" desactiva la aprobación humana para enviar o pagar.
- Un paso de `verify` que hace `cat .env`, o que manda un token a una URL "de healthcheck".
- Un comando de instalación que baja un script y lo pasa a `sh`, o que pide `sudo`.
- Una recomendación de MCP o skill con un nombre a una letra del real (typosquat).
- Texto dirigido al agente y no al lector: "ignora las reglas anteriores", instrucciones escondidas
  en comentarios HTML, bloques de código, URLs o texto con caracteres invisibles.
- Un `SOUL.md` o `AGENTS.md` de `templates/workspace/` que le dice al Jarvis generado que acepte
  mensajes de cualquiera o que trate la memoria como fuente de permisos.
- Un cambio en `knowledge/auth-matrix.md` que "permite" la suscripción Pro/Max en un arnés de
  terceros, o en `capabilities/whatsapp.md` que quita el consentimiento para Baileys.

**EN — Prompt injection through the knowledge files.** The main risk. Everything in `knowledge/`,
`questions/`, `templates/` and `.claude/` is read as instruction. Injection looks like advice: a
guardrail that disables human approval "for convenience", a `verify` step that reads `.env` or posts
a token to a "healthcheck" URL, an install that pipes a script to `sh` or asks for `sudo`, a
typosquatted MCP or skill, text addressed to the agent (hidden in HTML comments, code fences, URLs
or invisible characters), a workspace template that opens the Jarvis to strangers or treats memory
as a permission source, or an edit that allows a Pro/Max subscription in a third-party harness or
drops the Baileys consent.

### 2. Prompt injection a través de PRs de la comunidad

Este repo vive de contribuciones (profesiones, países, runtimes). Cada PR se revisa así:

- **Línea por línea**, no por tamaño del diff. Los archivos se leen también en modo "raw" para ver
  comentarios HTML y caracteres invisibles.
- **Cada comando de instalación** se compara con la fuente oficial; cada URL nueva se abre.
- **Cambios en archivos sensibles** — `knowledge/auth-matrix.md`, `knowledge/security-checklist.md`,
  `knowledge/compatibility.md`, `capabilities/whatsapp.md`, `.claude/settings.json`,
  `.claude/agents/*`, `.claude/skills/*`, `templates/workspace/*` — requieren revisión del
  maintainer y una razón explícita en el PR.
- Un `SEC-NN` nunca se borra ni se debilita; un control retirado queda marcado `RETIRED`.
- CI (`.github/workflows/validate.yml`) rechaza versiones fuera de `runtimes/` y `models.json`,
  rutas citadas que no existen y strings con forma de secreto. Los patrones `| sh`, `| bash`, `iex`
  y `sudo` los busca la revisión humana; en tiempo de ejecución, `.claude/settings.json` los niega
  (ver [CONTRIBUTING.md](CONTRIBUTING.md)).

**EN — Prompt injection through community PRs.** Every PR is read line by line (also in raw view, to
catch HTML comments and invisible characters); every install command is checked against the official
source and every new URL opened. Changes to `auth-matrix.md`, `security-checklist.md`,
`compatibility.md`, `capabilities/whatsapp.md`, `.claude/settings.json`, `.claude/agents/*`,
`.claude/skills/*` and `templates/workspace/*` need maintainer review and an explicit reason. A
`SEC-NN` is never deleted or weakened (retired controls stay as `RETIRED`). CI
(`.github/workflows/validate.yml`) rejects versions outside `runtimes/`/`models.json`, dead paths and
secret-shaped strings; `| sh`, `| bash`, `iex` and `sudo` are caught in human review and denied at
runtime by `.claude/settings.json`.

### 3. Cadena de suministro: MCPs, skills y runtimes recomendados

El Architect le recomienda a la gente instalar software de terceros: runtimes (Hermes, OpenClaw,
Ollama…), servidores MCP y skills. Esa es la línea de mayor consecuencia del repo.

Hay antecedentes reales: registros comunitarios de skills con cientos de paquetes maliciosos cuyo
README pedía "descargar un helper" o "correr este comando" (campaña ClawHavoc en ClawHub, 2026), y
CVEs de ejecución remota en runtimes populares. Fuentes:
[Securonix](https://connect.securonix.com/threat-research-intelligence-62/openclaw-threat-intelligence-report-clawdbot-moltbot-and-openclaw-208),
[The Hacker News](https://thehackernews.com/2026/02/openclaw-bug-enables-one-click-remote.html).
Los números exactos y las versiones mínimas seguras viven en `knowledge/runtimes/<id>.md`.

Reglas que existen por eso (ver `knowledge/security-checklist.md`):

- **SEC-24** — nada se instala automáticamente desde ClawHub ni desde ningún registro comunitario.
  Todo va fijado, el Architect lee el código fuente completo antes de instalar, y las descripciones
  de tools se comparan en cada actualización (protección contra *rug pull*).
- **SEC-25** — cada runtime va en o por encima de su *security floor*; imágenes fijadas por tag y
  digest; dependencias con lockfile.
- **SEC-26** — solo métodos de instalación seguros: gestor de paquetes con versión fijada; un script
  del vendor solo se descarga a `.jarvis/cache/`, se muestra su SHA-256 y lo corre la persona.
- **SEC-22** — las integraciones empiezan en solo lectura.

Si el repo upstream de un MCP, skill o runtime recomendado cambia de dueño, desaparece o se ve
comprometido, **repórtalo en privado**: la entrada sale de inmediato.

**EN — Supply chain of recommended runtimes, MCPs and skills.** The Architect tells people to install
third-party software, the highest-consequence line in the repo. There is real precedent (hundreds of
malicious skills on a community registry whose READMEs asked users to "download a helper" — the
ClawHavoc campaign on ClawHub, 2026 — and RCE CVEs in popular runtimes; sources above; exact floors
live in `knowledge/runtimes/<id>.md`). Controls: SEC-24 (no auto-install from community registries;
pinned; full source read before install; tool descriptions diffed on update), SEC-25 (at or above
the security floor; images pinned by tag and digest; lockfiles), SEC-26 (safe installs only), SEC-22
(integrations start read-only). If a recommended upstream is transferred, deleted or compromised,
report it privately so the entry comes out immediately.

### 4. Secretos / Secrets

El Jarvis maneja tokens de bots, API keys, sesiones de WhatsApp y OAuth de correo y calendario.
Lo que el Architect hace cumplir:

- **Nunca pide, lee, imprime ni copia** una key, un token, un `.env`, `auth.json` o un llavero.
  Solo comprueba si una variable *existe* (`[ -n "$X" ] && echo set`). `.claude/settings.json`
  niega `Read` sobre `.env`, `~/.ssh`, `~/.aws` y los archivos de credenciales de los runtimes.
- **No usa credenciales que ya estén en el entorno** para su propio trabajo.
- **SEC-17/18/20** — los secretos viven solo en `.env` (modo 600, en `.gitignore`), el llavero del
  sistema o las variables selladas de Railway; nunca en un prompt, memoria, log, chat ni salida de
  `verify`; los logs se redactan.
- **SEC-21** — cada credencial tiene un runbook de rotación.
- Si alguien pega un secreto en el chat: no se repite, se le dice dónde va y se recomienda rotarlo.

Si un secreto real terminó en un issue, PR o commit de este repo: **rótalo primero**, después
avísanos para borrar el contenido. Editar el archivo no basta; queda en el historial de git.

**EN — Secrets.** The Architect never asks for, reads, prints or copies a key, token, `.env`,
`auth.json` or keychain entry; it only checks whether a variable is set, and `.claude/settings.json`
denies `Read` on `.env`, `~/.ssh`, `~/.aws` and runtime credential files. It never uses credentials
already in the environment for its own work. SEC-17/18/20/21: secrets only in `.env` (mode 600,
gitignored), the OS keychain or Railway sealed variables; never in a prompt, memory, log, chat or
verify output; logs redacted; a rotation runbook per credential. If a real secret lands in an
issue, PR or commit here: rotate it first, then tell us — editing the file does not remove it from
git history.

### 5. El Jarvis generado / The generated Jarvis

Un Jarvis es un agente con herramientas, expuesto a mensajes de afuera. Lo que el Architect hace
cumplir en **cada** Jarvis (completo en `knowledge/security-checklist.md`, `SEC-01`…`SEC-33`;
`jarvis-validator` tiene que dar PASS antes de darlo por terminado):

| Riesgo | Controles |
|---|---|
| Un desconocido le escribe a tu bot | SEC-01 allowlist del dueño por ID numérico · SEC-02 grupos apagados · SEC-04 cambios de allowlist solo desde terminal local |
| El panel de control queda expuesto | SEC-05 loopback + Tailscale/SSH · SEC-06 en Railway solo el webhook es público |
| Un mensaje o correo con instrucciones escondidas | SEC-12 contenido externo cercado como datos · SEC-13 la memoria nunca da permisos |
| Hace algo irreversible solo | SEC-11 clasificación [A]/[B]/[C] · SEC-14 aprobación con vista previa exacta · SEC-15 los cron no ejecutan acciones irreversibles · SEC-16 aprobaciones que expiran |
| Ejecuta algo peligroso | SEC-07 sandbox · SEC-09 egress con allowlist · SEC-10 sin flags de bypass fuera de un contenedor desechable |
| Gasta de más | SEC-27 spend cap en el proveedor y en Railway antes del primer uso · SEC-28 límites de turnos, rate limit y kill switch |
| Credencial que viola términos | SEC-30 la credencial coincide con `knowledge/auth-matrix.md` |
| WhatsApp no oficial | SEC-31 solo con consentimiento registrado y número secundario |
| Nadie sabe qué hacer si algo sale mal | SEC-29 log de auditoría · SEC-33 `SECURITY.md` + `RUNBOOK.md` con botón de pánico |

Ninguno se salta "porque hay prisa". `/jarvis-quick` acorta la entrevista, no los controles.

**EN — The generated Jarvis.** A Jarvis is a tool-using agent exposed to outside messages. Every one
ships with the controls in `knowledge/security-checklist.md` (`SEC-01`…`SEC-33`) and needs a
`jarvis-validator` PASS: owner-only allowlists, private control plane, untrusted content fenced as
data, human approval with an exact preview for irreversible actions (denied in unattended runs),
sandboxing and egress allowlists, spend caps before first use, credentials that match the auth
matrix, logged consent for unofficial WhatsApp, an audit log, and a panic-button `SECURITY.md` +
`RUNBOOK.md`. None is skipped for speed; `/jarvis-quick` shortens the interview, not the controls.

---

## Fuera de alcance / Out of scope

Repórtalo upstream, no aquí (pero avísanos si un proyecto recomendado está comprometido):

- Vulnerabilidades en Hermes, OpenClaw, Ollama, Codex, un MCP o una skill de terceros → su repo.
- Vulnerabilidades en Claude Code → Anthropic.
- Problemas de tu Jarvis ya instalado que no vienen de nuestras instrucciones → usa `/jarvis-doctor`
  y su `SECURITY.md` local.
- Un pin viejo **sin** CVE conocido → issue normal *Conocimiento viejo*. **Con** CVE conocido →
  reporte privado, lo tratamos como arreglo de seguridad.

**EN:** Report upstream: vulnerabilities in Hermes, OpenClaw, Ollama, Codex or a third-party MCP or
skill (their repo), in Claude Code (Anthropic), or in your installed Jarvis that do not stem from our
instructions (run `/jarvis-doctor`, see its local `SECURITY.md`). A stale pin without a known CVE is
a normal *Stale knowledge* issue; with a known CVE, report it privately.

---

## Ver también / See also

- [CONTRIBUTING.md](CONTRIBUTING.md) — la barra que cada archivo tiene que pasar
- [VERSIONING.md](VERSIONING.md) — cómo se versiona un arreglo de seguridad
- [CHANGELOG.md](CHANGELOG.md) — arreglos y créditos
- [`knowledge/security-checklist.md`](knowledge/security-checklist.md) — los controles `SEC-NN`
