# Contribuir / Contributing

Gracias por estar aquí. Jarvis Architect no es una app: es una librería de texto que entra al
contexto de un agente con permisos reales (instala cosas, escribe archivos, conecta cuentas en la
compu de alguien). Por eso cada contribución tiene que ser exacta, con fuente y sin sorpresas.

Cada sección es bilingüe: **español primero**, **EN** después.

*Thanks for being here. Jarvis Architect is not an app: it is a text library that goes into the
context of an agent with real permissions (it installs things, writes files and connects accounts
on someone's machine). So every contribution has to be exact, sourced and free of surprises.
Every section is bilingual: Spanish first, English after.*

---

## Lee esto primero: no subas tu Jarvis generado

**No abras un pull request con el Jarvis que el Architect armó contigo**, ni con tu `.jarvis/`
(`state.json`, `tasks.json`, `jarvis-spec.md`), ni con tu `SOUL.md`, `USER.md`, `MEMORY.md`,
`.env`, `.env.example` personalizado, logs o capturas de tu bot.

Entendemos por qué pasa: pasaste una hora con el Architect, tu Jarvis ya contesta en Telegram y
este es el repo que tenías abierto. Se siente como el lugar donde va el trabajo. No lo es:

- **Tu Jarvis es tuyo.** Tiene tu nombre, tu negocio, tus horarios, tus clientes, a veces tu número
  de teléfono o el ID de tu cuenta. Publicarlo expone datos personales tuyos y de terceros.
- **Nada en este repo lo lee.** Un Jarvis fusionado es peso muerto y un mal precedente.
- **Puede llevar secretos.** Un token pegado una vez queda en el historial de git para siempre.

El `.gitignore` de este repo ya excluye `.jarvis/`, `.env*` y `/jarvis-*/` para que no se suban por
accidente. No lo fuerces con `git add -f`.

**La contribución que sí vale oro** es lo que salió mal mientras lo armabas:

| Lo que notaste | Qué abrir |
|---|---|
| Te recomendó el runtime, host o credencial equivocada para tu caso | Issue `bug` con tu perfil (sin datos personales) y lo que debió elegir |
| Una versión, precio, ID de modelo o política estaba vieja | Issue `conocimiento-viejo` con la fuente oficial |
| Tu profesión no tiene pack, o el pack se queda corto | Issue `nueva-profesion` y luego PR |
| Tu país no tiene pack (o `other` no alcanza) | Un PR de país (ver abajo), o un issue en [Discussions](https://github.com/Hainrixz/jarvis-architect/discussions) si no sabes por dónde empezar |
| Falta un runtime o arnés que de verdad conviene | Issue `nuevo-runtime` |
| Un paso de `tasks.json` "pasó" pero no funcionaba | Issue `bug` citando el `verify` del paso |

Si quieres presumir tu Jarvis, cuéntalo en
[Discussions](https://github.com/Hainrixz/jarvis-architect/discussions), sin tokens ni datos de
clientes.

**EN — Read this first: do not upload your generated Jarvis.** Do not open a PR containing the
Jarvis the Architect built with you, your `.jarvis/` folder (`state.json`, `tasks.json`,
`jarvis-spec.md`), your `SOUL.md`/`USER.md`/`MEMORY.md`, `.env`, a personalised `.env.example`,
logs or screenshots of your bot. It is yours: it contains your name, business, clients and
sometimes phone numbers or account IDs. Nothing in this repo reads it, and it may carry secrets
that stay in git history forever. `.gitignore` already excludes `.jarvis/`, `.env*` and
`/jarvis-*/`; do not force-add them. What *is* valuable is what went wrong while building it — use
the table above. Show off your Jarvis in Discussions, without tokens or client data.

---

## Las reglas que gobiernan cada archivo

1. **Las versiones viven solo en `knowledge/runtimes/*.md` (§ Pinned versions) y en
   `knowledge/models.json`.** En ningún otro lado: ni en profesiones, ni en países, ni en
   capabilities, ni en `questions/`, ni en skills, ni en este archivo. Los demás dicen "ver
   `knowledge/runtimes/hermes.md`". CI lo revisa.
2. **Todo dato que se puede volver viejo lleva URL de fuente.** Versión, precio, ID de modelo,
   política de un proveedor, tarifa de WhatsApp, ley de datos. Lo que no pudiste confirmar se
   marca `UNVERIFIED`, nunca se afirma en silencio.
3. **Nunca inventes** un comando de instalación, un nombre de skill o MCP, un ID de modelo o un
   precio. Si no lo copiaste de la fuente oficial o no lo corriste tú, no entra.
4. **Instalaciones seguras.** Nada de `curl … | sh`, `irm … | iex` ni `sudo`. Primero el gestor de
   paquetes del sistema o el registro oficial con versión fijada; si el único camino es un script
   del vendor: descargar a `.jarvis/cache/` → mostrar SHA-256 → la persona lo corre.
5. **Credenciales según `knowledge/auth-matrix.md`.** La suscripción Claude Pro/Max solo dentro del
   binario `claude` sin modificar, usado por su dueño. Todo arnés de terceros (Hermes, OpenClaw,
   Agent SDK…) usa API keys. Ningún archivo puede sugerir lo contrario.
6. **WhatsApp no oficial (Baileys) solo con consentimiento explícito registrado y un número
   secundario.** El default es la Cloud API oficial o Telegram.
7. **Sin secretos ni datos personales reales en ejemplos.** Usa valores obviamente falsos
   (`123456789` como ID de Telegram, `sk-ant-...` truncado).
8. **Los IDs de `knowledge/README.md` son estables.** No renombres ni muevas un archivo con ID sin
   leer [VERSIONING.md](VERSIONING.md): es un cambio MAJOR.

**EN — The rules that govern every file.** (1) Versions live only in `knowledge/runtimes/*.md`
(§ Pinned versions) and `knowledge/models.json` — CI checks it. (2) Every stale-prone fact carries a
source URL; anything unconfirmed is marked `UNVERIFIED`. (3) Never invent an install command, skill
or MCP name, model ID or price. (4) Safe installs only: no `curl | sh`, no `irm | iex`, no `sudo`;
package manager with a pinned version first, vendor scripts only download → show SHA-256 → the
person runs it. (5) Credentials follow `knowledge/auth-matrix.md`: Claude Pro/Max only inside the
unmodified `claude` binary for its owner; every third-party harness uses API keys. (6) Unofficial
WhatsApp (Baileys) only with logged consent and a secondary number. (7) No secrets or real personal
data in examples. (8) The IDs in `knowledge/README.md` are stable; renaming one is MAJOR.

---

## Cómo está organizado el conocimiento

El contrato completo está en [`knowledge/README.md`](knowledge/README.md). Léelo antes de escribir.
Resumen:

| Carpeta | Responde | ¿Versiones? |
|---|---|---|
| `knowledge/runtimes/<id>.md` | ¿Qué arnés corre el Jarvis y cómo se instala? | **Sí, solo aquí** (§ Pinned versions) |
| `knowledge/models.json` | ¿Qué modelo va en los slots `cheap` / `main` / `max` y cuánto cuesta? | **Sí** (IDs, precios, `verified_at`) |
| `knowledge/capabilities/<id>.md` | ¿Cómo se resuelve un canal, memoria, voz, deploy…? | No |
| `knowledge/professions/<id>.md` | ¿Qué necesita alguien de esta profesión en su primera semana? | No |
| `knowledge/countries/<cc>.md` | ¿Qué cambia en este país (WhatsApp, facturación, ley de datos)? | No |
| `knowledge/decision-tree.md`, `auth-matrix.md`, `compatibility.md`, `security-checklist.md` | Cómo decide el Architect y qué nunca puede saltarse | No |

Los archivos de `knowledge/` se escriben **en inglés** (son material de prompt; el Architect
responde en el idioma de la persona). **Si prefieres escribir en español, hazlo**: un maintainer lo
traduce al revisar. Lo que no se negocia es la estructura, las fuentes y la regla de versiones.

**EN — How knowledge is organised.** The full contract is
[`knowledge/README.md`](knowledge/README.md); read it before writing. Runtimes and `models.json`
are the only places with versions; capabilities, professions and countries never carry one.
Knowledge files are written in English (they are prompt material; the Architect replies in the
person's language). Writing in Spanish is welcome — a maintainer translates during review. Structure,
sources and the version rule are not negotiable.

---

## Agregar un pack de profesión

Un pack de profesión le dice al Architect qué necesita, en su primera semana, alguien que se dedica
a eso. Agrega uno cuando una profesión real no encaja en los existentes (`creator` · `developer` ·
`founder` · `sales` · `student` · `lawyer-accountant` · `health` · `real-estate` · `smb-restaurant`
· `ecommerce` · `coach` · `agency` · `teacher`) — no cuando es una variante de uno que ya existe
(un "nutriólogo" probablemente es `health`; un "community manager" probablemente es `agency`).

Abre primero un issue con el formulario **Nueva profesión**. Cuando haya acuerdo:

1. Crea `knowledge/professions/<id>.md` (kebab-case, inglés) con este orden exacto:
   `# Title` · `>` resumen de una línea · `Last verified: YYYY-MM-DD` · **Signals** ·
   **Week-one jobs** (3–5 concretos) · **Channels** · **Memory** · **Tools/MCP** (con trust tier de
   `knowledge/capabilities/tools-mcp.md`) · **Scheduled jobs** (cron + nota de zona horaria) ·
   **Skills** · **Guardrails** (acciones irreversibles y sensibilidad de datos) ·
   **Interview extras** (1–3 preguntas que solo este pack necesita) · **Sources**.
2. **Week-one jobs concretos.** "Cada lunes 8:00 me manda las citas de la semana y quién no ha
   confirmado" sí. "Ayuda con la productividad" no.
3. **Tools/MCP con fuente y trust tier.** Solo servidores que existan, con su repo o doc oficial.
   Integraciones empiezan en solo lectura (SEC-22).
4. **Guardrails honestos.** Si la profesión maneja datos de pacientes, clientes o menores, dilo y
   apunta a la ley de datos del pack de país. Si algo no está confirmado (p. ej. cumplimiento de
   una norma), `UNVERIFIED`.
5. **Regístralo** o nadie llegará a él:
   - `questions/1-descubrimiento.md` — la tabla de señales (las palabras que dice la gente).
   - `knowledge/decision-tree.md` — la fila *Profession pack* de § 1 y, si aplica, § 3 *nudges*.
   - `knowledge/README.md` — la lista de IDs de profesiones.
   - `.github/ISSUE_TEMPLATE/bug.yml` y `nueva-profesion.yml` — el dropdown de profesiones.
6. Prueba con una persona simulada de esa profesión (ver *Cómo probar localmente*).

**EN — Adding a profession pack.** Add one only when a real profession does not fit any existing
pack (a nutritionist is probably `health`; a community manager is probably `agency`). Open a
**New profession** issue first. Then create `knowledge/professions/<id>.md` with the headings in the
exact order above, concrete week-one jobs, only real Tools/MCP with a source and a trust tier,
read-only first, and honest guardrails. Register it in `questions/1-descubrimiento.md`,
`knowledge/decision-tree.md`, `knowledge/README.md` and the issue-form dropdowns, then test it with
a simulated persona.

---

## Agregar un pack de país

Hoy existen `mx` · `co` · `ar` · `es` · `other`. Un país nuevo se agrega cuando su realidad cambia
decisiones: otra herramienta de facturación electrónica, otra ley de datos, otra tarifa de WhatsApp,
otro canal dominante. Si solo cambia la moneda, mejora `other.md`.

1. Crea `knowledge/countries/<cc>.md` (código ISO 3166-1 alfa-2 en minúsculas) con:
   **Channels reality** · **WhatsApp rates & policy notes** · **Fiscal / invoicing tools** ·
   **CRM & commerce** · **Data-protection law** (lo que el Architect *debe* advertir) ·
   **Voice accent defaults** · **Timezones & currency** · **Sources**.
2. **Tarifas de WhatsApp:** del rate card oficial de Meta, con fecha. Si las fuentes chocan, dilo
   (`CONFLICT`) en vez de elegir una.
3. **Ley de datos:** nombre oficial de la ley y de la autoridad, con URL oficial (diario oficial,
   sitio del regulador). Nada de "según un blog".
4. **Herramientas fiscales/CRM:** solo productos que existan, con su sitio oficial; si tienen MCP o
   API, la URL de la doc. Sin precios inventados.
5. Regístralo en `questions/1-descubrimiento.md` (la línea *Country*), `knowledge/decision-tree.md`
   (fila *Country* y § 3) y `knowledge/README.md`.

**EN — Adding a country pack.** Today: `mx` · `co` · `ar` · `es` · `other`. Add a country when its
reality changes decisions (e-invoicing tool, data law, WhatsApp rate, dominant channel); if only the
currency differs, improve `other.md`. Use `knowledge/countries/<cc>.md` (lowercase ISO 3166-1
alpha-2) with the headings above. WhatsApp rates come from Meta's official rate card, dated; flag
`CONFLICT` when sources disagree. Data law needs the official law and authority name with an
official URL. Fiscal/CRM tools must exist and link their official site. Register it in
`questions/1-descubrimiento.md`, `knowledge/decision-tree.md` and `knowledge/README.md`.

---

## Agregar un runtime (arnés)

Es la contribución más pesada. Un runtime nuevo agrega una opción que el Architect puede
*instalar en la compu de alguien*, así que la barra es alta. Abre primero el issue
**Nuevo runtime** y espera acuerdo.

1. Crea `knowledge/runtimes/<id>.md` con la plantilla exacta de `knowledge/README.md`
   (*Pick it when* … *Sources*). Puntos que se revisan con lupa:
   - **Auth:** la fila de `knowledge/auth-matrix.md` en una línea. Si es arnés de terceros, usa
     API key. Cita los términos del proveedor.
   - **Pinned versions:** componente · versión · canal (stable/LTS) · URL · fecha de chequeo, más el
     **security floor** (versión mínima segura y los CVE que la justifican).
   - **Install:** gestor de paquetes por SO, con versión fijada. Nunca `curl | sh` ni `sudo`.
   - **Security hardening:** cada control mapeado a su `SEC-NN` de
     `knowledge/security-checklist.md`.
   - **Verify:** comandos de shell que salen con 0 cuando está sano. Ninguno imprime un secreto.
2. Agrega su fila a `knowledge/auth-matrix.md` (con política citada), sus combinaciones malas a
   `knowledge/compatibility.md` (`CMP-NN` nuevo, nunca renumeres) y su lugar en
   `knowledge/decision-tree.md` (cuándo gana, y tie-breaks).
3. Si trae modelos o proveedores nuevos, actualiza `knowledge/models.json` con `verified_at`.
4. Regístralo en `knowledge/README.md` (lista de IDs), en `.claude/settings.json` si el preflight
   necesita un `--version` de solo lectura, y en los dropdowns de `.github/ISSUE_TEMPLATE/`.
5. Prueba una instalación real desde cero en al menos un SO, siguiendo solo lo que escribiste.

**EN — Adding a runtime (harness).** The heaviest contribution: it adds something the Architect
will *install on someone's machine*. Open a **New runtime** issue first. Then write
`knowledge/runtimes/<id>.md` from the exact template in `knowledge/README.md`, with: an Auth line
matching `auth-matrix.md` (third-party harness → API key, provider terms cited); a Pinned versions
table with source URLs, dates and a security floor with its CVEs; package-manager installs only;
every hardening step mapped to a `SEC-NN`; and verify commands that exit 0 and never print a
secret. Add its row to `auth-matrix.md`, any known-bad combos to `compatibility.md` (new `CMP-NN`,
never renumber), its place in `decision-tree.md`, any new models to `models.json`, and register the
ID in `knowledge/README.md`, `.claude/settings.json` (read-only preflight check) and the issue
forms. Do a real install from scratch on at least one OS using only what you wrote.

---

## Refrescar pins (`/jarvis-refresh`)

Las versiones, precios, IDs de modelo y políticas se pudren solos. Refrescarlos es la contribución
recurrente más valiosa y normalmente es un **PATCH** (ver [VERSIONING.md](VERSIONING.md)).

1. Abre Claude Code en tu clon y corre `/jarvis-refresh` (o `/jarvis-refresh hermes`,
   `/jarvis-refresh models`, `/jarvis-refresh policies`). Despacha `stack-researcher` contra fuentes
   vivas y te devuelve una tabla: ítem · fijado · en vivo · fuente · fecha · acción.
2. **Revisa cada fila tú.** El reporte es un borrador, no una verdad. Orden de autoridad:
   (1) el registro o paquete publicado (`npm view <pkg> version`, `brew info <formula>`,
   `pip index versions <pkg>`, la página de releases del repo oficial); (2) la doc o el changelog
   del vendor; (3) nada más — ni blogs, ni resultados de búsqueda, **ni la memoria del modelo**.
3. **Reverifica todos los pins del archivo, no solo los que sospechas.** Un archivo con la mitad
   fresca y la mitad de hace seis meses es peor que uno uniformemente viejo, porque la fecha nueva
   hace que todo parezca confiable.
4. Actualiza `Last verified:` del archivo y `verified_at` en `models.json`.
5. **Nunca bajes un security floor.** Subirlo por un CVE nuevo es urgente: avísalo también por
   [SECURITY.md](SECURITY.md) si la versión fijada es vulnerable.
6. No fijes RCs, betas ni "latest" como default. Si una fuente oficial no lo confirma, déjalo
   marcado `UNVERIFIED` en vez de adivinar.
7. Agrega la entrada en `CHANGELOG.md` bajo `[Unreleased]` → *Changed*, con la fuente.

**EN — Refreshing pins (`/jarvis-refresh`).** Versions, prices, model IDs and policies rot. Refreshing
them is the most valuable recurring contribution and is usually a PATCH. Run `/jarvis-refresh`
(optionally scoped: a runtime ID, `models`, `policies`); it dispatches `stack-researcher` and returns
item · pinned · live · source · date · action. Check every row yourself, in this order of authority:
(1) the published registry or package, (2) the vendor's docs or changelog, (3) nothing else — not
blogs, not search results, not the model's memory. Re-verify every pin in a file, not only the
suspicious ones. Bump `Last verified:` and `models.json → verified_at`. Never lower a security floor;
raising one for a new CVE is urgent and also goes through SECURITY.md if the pinned version is
vulnerable. Never pin an RC, beta or "latest" as the default. Add a CHANGELOG line under
`[Unreleased]` with the source.

---

## Fuentes: qué cuenta

| Dato | Fuente aceptable | No aceptable |
|---|---|---|
| Versión | Registro (npm, Homebrew, PyPI), releases del repo oficial | Blog, video, foro, memoria |
| Precio de modelo / ID | Página oficial de precios y de modelos del proveedor | Tablas de terceros, agregadores |
| Costo de Railway | `railway.com/pricing` y la doc oficial | Estimaciones de un tutorial |
| Política / términos (suscripciones, WhatsApp) | Términos o doc oficial del proveedor, citada textual | "Todo el mundo lo hace" |
| Ley de datos | Diario oficial o sitio del regulador | Resúmenes de despachos sin enlace oficial |
| CVE | NVD, GitHub Security Advisories, aviso del vendor | Hilos de redes sociales |

Una fuente secundaria sirve solo si se marca `UNVERIFIED` y se dice por qué.

**EN — Sources: what counts.** Versions from the registry or official releases; model prices/IDs
from the provider's official pages; Railway cost from its pricing page and docs; policies and
terms from the provider's official text, quoted; data law from the official gazette or regulator;
CVEs from NVD, GitHub advisories or the vendor. A secondary source is acceptable only marked
`UNVERIFIED`, with the reason.

---

## Cómo probar localmente

No hay suite de tests para el comportamiento: **la prueba es una sesión real**. Además,
`.github/workflows/validate.yml` revisa en cada PR: versiones fuera de lugar, `Last verified:` en
cada archivo de `knowledge/`, que cada ruta citada exista, que los IDs de `knowledge/README.md`
coincidan con los archivos, `models.json` válido, strings con forma de secreto y el manifest del
plugin. El orden de encabezados, `curl | sh` y `sudo` **no** los revisa CI: los revisa la persona
que revisa tu PR.

1. Clona tu fork y abre Claude Code adentro:

   ```
   git clone https://github.com/<tu-usuario>/jarvis-architect.git
   cd jarvis-architect
   claude
   ```

   El agente `jarvis-architect` arranca `/jarvis-start` solo. También puedes probar el modo plugin
   sin marketplace: desde otra carpeta vacía, `claude --plugin-dir /ruta/a/tu/jarvis-architect`
   ([doc](https://code.claude.com/docs/en/plugins/create#develop-without-a-marketplace)).
2. **Personas simuladas.** Responde como uno de los perfiles de `knowledge/decision-tree.md`
   § 4 *Archetype profiles* (por ejemplo "restaurante en Guadalajara, sin plan de IA, clientes por
   WhatsApp, no técnica") o como la persona que tu cambio debería atender. Inventa todo: nombre,
   negocio, números. **Nunca uses tus datos reales ni los de un cliente.**
3. Verifica que la entrevista **llega** a tu cambio (pack, país o runtime correcto), que la
   decisión del gate de ARCHITECTURE es la esperada y que respeta las reglas (máx. 3 preguntas por
   mensaje, recomienda UNA opción, cotiza el costo, pide el sí).
4. **No hace falta instalar ni gastar nada** para probar la decisión: detente en el gate de
   ARCHITECTURE y di que no. Si tu cambio toca BUILD (un runtime, un `verify`), prueba la
   instalación en una máquina o VM desechable, con tus propias keys de prueba y spend cap bajo.
5. Prueba `/jarvis-quick` con la misma persona: debe llegar a una decisión compatible.
6. Al terminar, borra `.jarvis/` del clon. No lo subas.

**EN — How to test locally.** There is no behavioural test suite; the test is a real session (CI —
`.github/workflows/validate.yml` — covers misplaced versions, `Last verified:` dates, dead paths, the
ID lists, `models.json`, secret-shaped strings and the plugin manifest; heading order, `curl | sh` and
`sudo` are checked in human review). Clone your fork, `cd` into it and run
`claude` — the `jarvis-architect` agent starts `/jarvis-start` automatically. (Plugin mode can be
tried without a marketplace: from an empty folder, `claude --plugin-dir /path/to/jarvis-architect` —
see https://code.claude.com/docs/en/plugins/create#develop-without-a-marketplace.) Answer
as one of the simulated personas in `knowledge/decision-tree.md` § 4 *Archetype profiles*, or as the
person your change targets; invent every detail, never use your own or a client's real data. Check
that the interview reaches your change, the ARCHITECTURE decision is the expected one, and the rules
hold. You do not need to install or spend anything to test a decision: stop at the gate and say no.
If your change touches BUILD, test on a disposable machine or VM with your own test keys and a low
spend cap. Try `/jarvis-quick` with the same persona. Delete `.jarvis/` afterwards; never commit it.

---

## Estilo

- **Opinionado.** Recomienda UNA opción y di por qué. Nunca "puedes usar A, B, C o D".
- **Tablas y viñetas antes que párrafos.** Concreto antes que vago.
- **Para gente no técnica.** Si un término aparece en `questions/` o en instrucciones de
  `user_action`, explícalo en media línea ("MCP: la forma estándar de conectar a Jarvis con tus
  apps").
- **Español neutro LATAM, de tú**, en todo lo que la persona lee. Sin modismos de un solo país
  salvo en su pack.
- **Sin emoji** en `knowledge/`.
- Cada `.md` de `knowledge/` empieza con `# Title`, un `>` resumen y `Last verified:`.

**EN — Style.** Opinionated (recommend ONE option, say why); tables and bullets over prose; concrete
over vague; written for non-technical people (explain jargon in half a line); neutral LATAM Spanish,
informal "tú", in anything the person reads; no emoji in `knowledge/`; every knowledge `.md` starts
with `# Title`, a `>` summary and `Last verified:`.

---

## Antes de abrir el PR

- [ ] No incluye un Jarvis generado, `.jarvis/`, `.env` ni datos personales reales.
- [ ] Ninguna versión fuera de `knowledge/runtimes/*.md` y `knowledge/models.json`.
- [ ] Cada dato que se puede volver viejo tiene URL; lo no confirmado dice `UNVERIFIED`.
- [ ] Ningún comando de instalación, skill, MCP, ID de modelo o precio inventado.
- [ ] Ningún `curl | sh`, `irm | iex` ni `sudo`.
- [ ] Credenciales coherentes con `knowledge/auth-matrix.md`.
- [ ] Cada ruta que referencias existe. Ábrelas.
- [ ] `Last verified:` actualizado en cada archivo de `knowledge/` que tocaste.
- [ ] Pack o runtime nuevo registrado en todos los lugares listados arriba.
- [ ] Probaste con una persona simulada de punta a punta (al menos hasta el gate).
- [ ] Dijiste en el PR si es MAJOR, MINOR o PATCH según [VERSIONING.md](VERSIONING.md), y por qué.

**EN — Before you open the PR:** no generated Jarvis, `.jarvis/`, `.env` or real personal data;
no version outside `runtimes/` and `models.json`; every stale-prone fact sourced or `UNVERIFIED`;
nothing invented; no `curl | sh`, `irm | iex` or `sudo`; credentials consistent with
`auth-matrix.md`; every path exists; `Last verified:` updated; new packs/runtimes registered
everywhere; tested end to end with a simulated persona; SemVer category stated with a reason.

---

## Reportar un problema de seguridad

No abras un issue público. Ver [SECURITY.md](SECURITY.md).

**EN:** Do not open a public issue. See [SECURITY.md](SECURITY.md).

---

## Licencia / License

Al contribuir aceptas que tu contribución se licencia bajo MIT, igual que el resto del repo. Ver
[LICENSE](LICENSE).

**EN:** By contributing you agree your contribution is licensed under the MIT License, like the rest
of the repo. See [LICENSE](LICENSE).
