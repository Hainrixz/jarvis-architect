# Versioning / Versionado

Jarvis Architect sigue [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). SemVer
solo tiene sentido frente a una **API pública**, y este repo no exporta funciones: exporta comandos,
archivos de conocimiento con IDs estables y el formato de los archivos que deja en `.jarvis/`. Este
documento declara esa API para que MAJOR / MINOR / PATCH no sean una moneda al aire.

*Jarvis Architect follows SemVer 2.0.0. SemVer only means something relative to a public API, and
this repo exports no functions: it exports commands, knowledge files with stable IDs, and the format
of what it writes to `.jarvis/`. This document declares that API.*

---

## Quién se rompe y cómo / Who breaks, and how

| Quién | Depende de | Se rompe cuando |
|---|---|---|
| **Usuarios del plugin** | Nombres del marketplace, plugin y comandos | Un comando que escribían ayer ya no existe, o `/plugin install` no resuelve |
| **Usuarios del clon** | `CLAUDE.md` y cada ruta que lee el Architect | Un archivo de `knowledge/` se movió y el Architect lee algo que no está |
| **Gente a medio build** | `.jarvis/state.json` y `.jarvis/tasks.json` | Actualizan el repo y `/jarvis-next` ya no entiende su build guardado |
| **Forks y herramientas** | IDs de `knowledge/README.md`, esquema de `tasks.json` | Un ID se renombra o un campo cambia de significado |

Un cambio invisible para los cuatro no es breaking, sin importar el tamaño del diff.

**EN:** Plugin users depend on marketplace, plugin and command names; clone users on `CLAUDE.md` and
every path the Architect reads; people mid-build on `.jarvis/state.json` and `.jarvis/tasks.json`
(updating the repo must not orphan a saved build); forks and tooling on the IDs in
`knowledge/README.md` and the `tasks.json` schema. A change invisible to all four is not breaking.

---

## La API pública, declarada / The public API, declared

Todo lo que no está en esta lista es interno y puede cambiar en un PATCH.
*Anything not on this list is internal and may change in a PATCH.*

1. **Nombres de comandos.** `/jarvis-start`, `/jarvis-quick`, `/jarvis-next`, `/jarvis-doctor`,
   `/jarvis-add`, `/jarvis-refresh` — y sus formas con namespace en modo plugin
   (`/jarvis-architect:jarvis-start`, …). Incluye lo que hace cada uno a grandes rasgos.
2. **Nombres del plugin y marketplace.** Plugin `jarvis-architect`, marketplace `jarvis-architect`
   (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`):

   ```
   /plugin marketplace add Hainrixz/jarvis-architect
   /plugin install jarvis-architect@jarvis-architect
   ```

3. **Los IDs y rutas de [`knowledge/README.md`](knowledge/README.md)** — la tabla *Layout and IDs*:
   - archivos raíz: `decision-tree.md`, `auth-matrix.md`, `security-checklist.md`,
     `compatibility.md`, `models.json`;
   - `runtimes/<id>.md`: `claude-code-local` · `claude-code-server` · `claude-p-cron` ·
     `claude-agent-sdk` · `hermes` · `openclaw` · `codex-openai` · `ollama-local` · `cowork`;
   - `capabilities/<id>.md`: `channels` · `whatsapp` · `memory` · `tools-mcp` · `scheduling` ·
     `voice` · `skills` · `deploy-local` · `deploy-railway` · `costs` · `web-ui`;
   - `professions/<id>.md`: `creator` · `developer` · `founder` · `sales` · `student` ·
     `lawyer-accountant` · `health` · `real-estate` · `smb-restaurant` · `ecommerce` · `coach` ·
     `agency` · `teacher`;
   - `countries/<cc>.md`: `mx` · `co` · `ar` · `es` · `other`;
   - los IDs de control `SEC-NN` y `CMP-NN` (nunca se renumeran; uno retirado queda `RETIRED`);
   - los slots de modelo `cheap` / `main` / `max` en `models.json`.
4. **El esquema de `.jarvis/tasks.json`** definido en
   [`templates/tasks-schema.md`](templates/tasks-schema.md): `jarvis_dir`, `runtime`, `tasks[]`, y
   por tarea `id`, `title`, `kind` (`agent` / `user_action`), `dependencies`, `instructions`,
   `acceptance`, `verify`, `secrets_safe`, `checkpoint`, `files`, `cost`, `status`
   (`pending` · `in_progress` · `done` · `blocked`), más la regla de que el orden del arreglo es el
   orden de build.
5. **La forma de `.jarvis/state.json`**: `state` (uno de los estados de abajo), `brief` (RUNNING
   BRIEF), `started_at`, `profile`, `decision`, `consents[]` (un arreglo de objetos
   `{ "id", "accepted_at", "text_version", … }`, ver `knowledge/capabilities/whatsapp.md`). Campos
   nuevos opcionales están permitidos; renombrar o cambiar el significado de uno existente no.
6. **La máquina de estados y su gate.** `RESUME? → PREFLIGHT → DISCOVERY → DEEP DIVE → ARCHITECTURE
   →(sí explícito)→ BUILD → VERIFY → (DEPLOY) → HANDOFF`, los nombres de los estados (se guardan en
   `state.json`) y que BUILD no se alcanza sin el sí explícito.
7. **Nombres de los subagentes** en `.claude/agents/`: `stack-researcher`, `workspace-writer`,
   `jarvis-validator` (un fork o una skill puede despacharlos por nombre).

**EN — summary.** (1) Command names, including plugin-mode namespaced forms. (2) Plugin and
marketplace names and the install pair. (3) Every ID and path in `knowledge/README.md`, plus
`SEC-NN`/`CMP-NN` IDs (never renumbered) and the `cheap`/`main`/`max` model slots. (4) The
`tasks.json` schema in `templates/tasks-schema.md`. (5) The `state.json` shape: `state`, `brief`,
`started_at`, `profile`, `decision`, `consents[]` — new optional fields are fine, renaming or
redefining one is not. (6) The state machine, its state names and the explicit-yes gate.
(7) Subagent names.

---

## Las reglas / The rules

### MAJOR — algo que alguien usa deja de funcionar

- Renombrar, mover o borrar un **comando**, o cambiar lo que hace de forma que sorprenda.
- Renombrar el **plugin o el marketplace**.
- Renombrar, mover o borrar **cualquier ID o ruta** de `knowledge/README.md` (p. ej.
  `professions/smb-restaurant.md` → `professions/restaurant.md`), o renumerar un `SEC-NN`/`CMP-NN`.
- Cambiar el **esquema de `tasks.json`** o la **forma de `state.json`**: quitar o renombrar un
  campo, cambiar su tipo o sus valores válidos, volver obligatorio uno opcional.
- Cambiar la **máquina de estados**: agregar, quitar, renombrar o reordenar estados, o quitar el
  gate de confirmación.
- Quitar un **control de seguridad** del default (eso además casi nunca se acepta).

**EN — MAJOR:** removing/renaming a command, the plugin or the marketplace; renaming, moving or
deleting any ID or path in `knowledge/README.md`, or renumbering a `SEC-NN`/`CMP-NN`; changing the
`tasks.json` schema or `state.json` shape (removing/renaming a field, changing its type or valid
values, making an optional field required); changing the state machine or removing the gate;
dropping a default security control.

### MINOR — algo nuevo, nada se mueve

- Un **pack de profesión**, **pack de país**, **runtime** o **capability** nuevo (archivo + ID
  nuevo en `knowledge/README.md`).
- Un **comando** o **subagente** nuevo.
- Un **campo opcional** nuevo en `tasks.json` o `state.json`.
- Un **`SEC-NN` o `CMP-NN` nuevo** (más estricto, nada se rompe).
- Nuevas opciones, filas de decisión, señales de entrevista, jobs o guardrails que hacen decidir
  mejor sin mover una ruta.
- Un runtime que gana una capa entera nueva (otro host soportado, otro canal nativo).

**EN — MINOR:** a new profession, country, runtime or capability; a new command or subagent; a new
optional field in `tasks.json`/`state.json`; a new `SEC-NN`/`CMP-NN`; new options, decision rows,
interview signals, jobs or guardrails; a runtime gaining a whole new layer.

### PATCH — el comportamiento no cambia

- **Refrescar pins** en `knowledge/runtimes/*.md` y `knowledge/models.json` (versiones, precios,
  IDs de modelo que reemplazan a uno existente en el mismo slot) con `/jarvis-refresh`, y subir
  `Last verified:` / `verified_at`.
- **Subir un security floor** por un CVE nuevo (se publica rápido; ver [SECURITY.md](SECURITY.md)).
- Corregir una política, tarifa o fuente que estaba mal.
- Typos, enlaces rotos, redacción más clara, traducciones.

**EN — PATCH:** pin refreshes in `knowledge/runtimes/*.md` and `knowledge/models.json` (versions,
prices, a model ID replacing an existing one in the same slot) with updated `Last verified:` /
`verified_at`; raising a security floor for a new CVE (shipped fast); correcting a policy, rate or
source; typos, broken links, clearer wording, translations.

---

## Refrescar pins es PATCH, y se espera / Refreshing pins is PATCH, and expected

Las versiones están mal desde el día después de escribirlas. Si refrescar costara un MINOR, se
acumularía y el conocimiento se pudriría — justo lo que este repo quiere evitar. Por eso un refresh
es PATCH y debe ser barato.

Dos consecuencias:

- **`knowledge/` es un caché, no la verdad.** En una sesión real, el chequeo en vivo de
  `stack-researcher` gana sobre lo escrito. Un archivo viejo nunca contradice un chequeo vivo.
- **Cambiar de proveedor o de slot** (p. ej. que `main` pase de un proveedor a otro por defecto) es
  una decisión nueva → MINOR, no un refresh.

**EN:** Pins are wrong the day after they are written; if refreshing cost a MINOR it would be
batched and the knowledge would rot. So a refresh is a PATCH. `knowledge/` is a cache: in a live
session `stack-researcher` wins. Changing a slot's default provider is a new decision → MINOR.

---

## Los campos de versión deben coincidir / Version fields must stay in sync

| Dónde | Campo |
|---|---|
| `.claude-plugin/plugin.json` | `"version"` |
| `.claude-plugin/marketplace.json` | `plugins[0].version` |
| `CHANGELOG.md` | el encabezado `## [X.Y.Z] — YYYY-MM-DD` |
| Git | el tag `vX.Y.Z` |

**Nunca quites el campo `version`.** Claude Code lo usa para saber si un plugin instalado está
desactualizado; sin él, cada commit parecería una versión nueva para quien lo instaló.

### Checklist de release

1. Fusionar los cambios.
2. Subir `version` en `plugin.json` y `marketplace.json` — mismo valor.
3. Mover las entradas de `[Unreleased]` en `CHANGELOG.md` a `## [X.Y.Z] — fecha` y actualizar los
   enlaces del final.
4. Commit de la subida y el changelog juntos; tag `vX.Y.Z`.
5. Crear el release en GitHub desde el tag (las categorías salen de `.github/release.yml`).

**EN — Release checklist:** land changes; bump `version` in both manifests (same value); move
`[Unreleased]` into a dated heading and update the link block; commit together and tag `vX.Y.Z`;
cut the GitHub release from the tag (categories come from `.github/release.yml`).

---

## Lo que no se versiona / What is not versioned

**Tu Jarvis.** El Jarvis que el Architect armó contigo es tuyo y no sigue a este repo. Actualizar
Jarvis Architect nunca cambia un Jarvis que ya corre. Para traerlo al día a propósito:
`/jarvis-doctor` (revisa versión contra el security floor) y `/jarvis-add`.

Un `tasks.json` a medio build hecho con una versión MAJOR anterior puede no ser legible por
`/jarvis-next` nuevo; el CHANGELOG de ese MAJOR dice cómo migrarlo.

**EN:** Your Jarvis is yours and does not track this repo; updating Jarvis Architect never changes a
running Jarvis. Use `/jarvis-doctor` and `/jarvis-add` to bring it forward on purpose. A mid-build
`tasks.json` from an older MAJOR may need the migration notes in that MAJOR's CHANGELOG entry.

## Ver también / See also

- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [`knowledge/README.md`](knowledge/README.md)
- [`templates/tasks-schema.md`](templates/tasks-schema.md)
