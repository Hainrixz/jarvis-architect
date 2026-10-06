<!--
  Jarvis Architect — plantilla de pull request (pull request template).
  Deja los encabezados. Borra los comentarios. Marca lo que aplique.
-->

## Lee esto primero (Read this first)

- [ ] **Este PR NO incluye un Jarvis generado**: ni `.jarvis/`, ni `SOUL.md`/`USER.md`/`MEMORY.md`
      personales, ni `.env`, ni logs o capturas de mi bot. *(This PR does NOT contain a generated
      Jarvis, `.jarvis/`, personal workspace files, `.env`, logs or screenshots.)*
- [ ] **No hay keys, tokens, teléfonos ni datos reales de nadie.** Los ejemplos usan valores
      obviamente falsos (`123456789`, `sk-ant-...`). *(No secrets or real personal data.)*

¿Quieres mostrar tu Jarvis? → [Discussions](https://github.com/Hainrixz/jarvis-architect/discussions).
Los PRs con salida generada se cierran sin revisión. *(PRs with generated output are closed without
review.)*

---

## Qué cambia (What this changes)

<!-- Dos frases: qué faltaba o estaba mal, y qué hace este PR. -->

## Por qué (Why)

<!-- La persona o el caso que esto desbloquea, o el error que evita. Closes #123 -->

---

## Tipo de cambio (Type of change)

- [ ] **Pack de profesión** — `knowledge/professions/` (con issue *Nueva profesión* aceptado)
- [ ] **Pack de país** — `knowledge/countries/`
- [ ] **Runtime** — `knowledge/runtimes/` nuevo (con issue *Nuevo runtime* aceptado)
- [ ] **Refresh de pins** — versiones, precios, IDs de modelo (`/jarvis-refresh`)
- [ ] **Capability / decisión** — `knowledge/capabilities/`, `decision-tree.md`, `compatibility.md`
- [ ] **Seguridad o credenciales** — `security-checklist.md`, `auth-matrix.md`, `.claude/settings.json`
- [ ] **Entrevista o plantillas** — `questions/`, `templates/`
- [ ] **Comandos o agentes** — `.claude/skills/`, `.claude/agents/`, `.claude-plugin/`
- [ ] **Docs** — `README.md`, `CONTRIBUTING.md`, `.github/`

**SemVer según [VERSIONING.md](https://github.com/Hainrixz/jarvis-architect/blob/main/VERSIONING.md):**
<!-- MAJOR / MINOR / PATCH y por qué. Si no estás seguro/a, dilo. -->

---

## Checklist

### Siempre (Always)

- [ ] Versiones **solo** en `knowledge/runtimes/*.md` y `knowledge/models.json`.
- [ ] Cada dato que se puede volver viejo tiene URL oficial; lo no confirmado dice `UNVERIFIED`.
- [ ] Nada inventado: comandos de instalación, skills, MCPs, IDs de modelo, precios.
- [ ] Ningún `curl | sh`, `irm | iex` ni `sudo`.
- [ ] Credenciales coherentes con `knowledge/auth-matrix.md` (Pro/Max solo en el binario `claude`
      sin modificar; arneses de terceros con API key).
- [ ] Ningún control `SEC-NN` debilitado ni renumerado.
- [ ] `Last verified:` actualizado en cada archivo de `knowledge/` que toqué.
- [ ] Cada ruta que referencio existe.
- [ ] CI en verde.

### Si agrega un pack o un runtime (If it adds a pack or runtime)

- [ ] Sigue la plantilla de `knowledge/README.md` en el orden exacto de encabezados.
- [ ] Está registrado en `questions/1-descubrimiento.md`, `knowledge/decision-tree.md`,
      `knowledge/README.md` y los dropdowns de `.github/ISSUE_TEMPLATE/`.
- [ ] Runtime: fila en `auth-matrix.md`, security floor con CVEs, `Verify` que sale con 0 sin
      imprimir secretos, cada hardening mapeado a `SEC-NN`.

### Si refresca pins (If it refreshes pins)

- [ ] Reverifiqué **todos** los pins del archivo contra el registro o la fuente oficial, no la
      memoria ni un blog.
- [ ] Ningún security floor bajó. Ningún RC/beta como default.
- [ ] Entrada en `CHANGELOG.md` bajo `[Unreleased]` con la fuente.

---

## Cómo lo probé (How I verified this)

<!--
  Concreto. "Corrí /jarvis-start como la persona #6 de decision-tree.md § 4 y llegó a hermes + Railway
  Tier A." "Instalé desde cero en una VM Ubuntu siguiendo solo runtimes/<id>.md; todos los Verify
  salieron 0." "Revisé brew info / npm view para cada pin." "Lo revisé a ojo" no es verificación.
-->
