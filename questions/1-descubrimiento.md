# Phase 1 — Discovery

> Understand the person, not the technology. By the end you know who they are, what their Jarvis
> must do for them, and the constraints that decide everything else.

Last verified: 2026-10-06

The viral version of this flow is five bare choices — where it lives, the model, the harness, the
tools, the skills — and "the harness is where most people get lost". You ask about **their life and
work**; *you* translate that into those five choices.

## Q1 — Who are you and what do you want Jarvis for? (always first, open text)

> ¿A qué te dedicas y qué te gustaría que tu Jarvis hiciera por ti? Cuéntame como se lo contarías
> a un asistente nuevo en su primer día.

If their first message already answered it, skip Q1 and reflect it back in one line.

## Q2–Q7 — ask only what Q1 and preflight did not answer (max 3 per message)

Use `AskUserQuestion`. Suggested options are a starting point — adapt labels to what they said.

| # | Question | Options (first = default when unsure) | Decides |
|---|---|---|---|
| Q2 | ¿Dónde quieres hablar con tu Jarvis? (multi) | Telegram · WhatsApp · Desde la terminal / Claude app · Discord/Slack · Por voz | channels |
| Q3 | ¿Tiene que estar encendido 24/7 aunque tu computadora esté apagada? | Sí, siempre (nube) · Solo cuando mi computadora está encendida · Tengo una computadora que siempre está encendida (Mac mini, PC vieja) | host |
| Q4 | ¿Ya pagas alguna de estas? (multi) | Claude Pro/Max · ChatGPT Plus/Pro · Ya tengo una llave de API (Anthropic/OpenAI) · Ninguna, prefiero pagar por uso · Ninguna y quiero gastar lo mínimo | runtime + credential |
| Q5 | ¿Cuánto quieres gastar al mes **además de lo que ya pagas** (tu plan de Claude o ChatGPT no cuenta)? | $0, nada extra · Hasta $10 USD · $10–30 · $30–100 · Lo que haga falta | model slots + host tier |
| Q6 | ¿Qué tan delicada es la información que va a manejar? | Normal · Datos de clientes · Muy sensible (salud, legal, finanzas de terceros) · Nada sale de mi computadora | privacy → local / compliance |
| Q7 | ¿Cuánto te manejas con lo técnico? | Nada, guíame paso a paso · Me defiendo con la terminal · Soy dev | runtime + verbosity |
| Q8 | ¿Quieres un panel web para ver a tu Jarvis (chat, lo que recuerda, tus pendientes, lo que aprendió, lo que espera tu aprobación)? | Sí, con panel (Recomendado si no eres dev) · No, me basta el chat | UI slot |

Also capture, from conversation (not as a quiz):

- **Country** (MX, CO, AR, ES, other) → `knowledge/countries/<cc>.md`. Ask once if not obvious.
- **Tools they already use**: email (Gmail/Outlook), calendar, CRM (HubSpot, Pipedrive, Kommo),
  invoicing (Facturapi, Alegra, Siigo, CONTPAQi), storage (Drive, Notion), commerce (Mercado Libre,
  Shopify, Stripe, Mercado Pago), social. These become MCP tasks.
- **Three concrete jobs** Jarvis should do in week one ("cada mañana dime mis pendientes",
  "contesta dudas de clientes", "recuérdame dar seguimiento a prospectos"). Ask for examples if
  they're vague — concrete jobs become skills and scheduled tasks.
- **A name and personality** for their Jarvis (optional, fun, last). Default: "Jarvis", calm and
  direct.

## Signals → profession pack

Read the matching file in full from `knowledge/professions/`. Pick one primary pack; at most one
secondary.

| What they say | Pack |
|---|---|
| contenido, reels, YouTube, redes, marca personal, audiencia | `creator.md` |
| código, repos, deploy, PRs, bugs | `developer.md` |
| mi empresa, socios, inversionistas, equipo, KPIs | `founder.md` |
| prospectos, cierres, pipeline, seguimiento, comisiones | `sales.md` |
| escuela, tareas, exámenes, tesis | `student.md` |
| clientes, expedientes, contratos, declaraciones, contabilidad | `lawyer-accountant.md` |
| pacientes, consultorio, citas, expedientes clínicos | `health.md` |
| propiedades, inmuebles, visitas, rentas | `real-estate.md` |
| restaurante, local, tienda física, proveedores, punto de venta | `smb-restaurant.md` |
| tienda en línea, Mercado Libre, Shopify, envíos | `ecommerce.md` |
| sesiones, coaching, consultoría, alumnos 1:1 | `coach.md` |
| agencia, clientes, campañas, reportes | `agency.md` |
| maestro, clases, alumnos, planeaciones | `teacher.md` |

**Anti-signals** (do not change the pack on their own): "quiero que use IA", "que sea inteligente",
"que tenga memoria" — those are capabilities every Jarvis has.

**Capability signals** (they never pick a pack; note them in `profile.signals[]` and use them in
the combined defaults question of `questions/2-ramas.md`):

| What they say | Signal | Read |
|---|---|---|
| "que sea autónomo", "que avance solo", "que lleve mis pendientes", "que me recuerde lo que prometí" | `autonomy` (default L1; never more on its own) | `knowledge/capabilities/autonomy.md` |
| "solo recuérdame", "no quiero que haga nada solo" | `autonomy: L0` (no autopilot job) | same |
| "que aprenda de mí", "que no le tenga que repetir las cosas", "como Hermes" | `learning` (on by default anyway; confirms it) | `knowledge/capabilities/learning.md` |
| "que entienda audios / notas de voz", "que vea videos", "le mando fotos o PDFs", "que transcriba mis reuniones" | `multimodal` (local first) | `knowledge/capabilities/multimodal.md` |

None of these change the gate: anything that sends, pays, posts or deletes still needs the owner's
live "sí", whatever they said here.

Ambiguous between two packs? Name both, say which you'd pick and why, ask one deciding question.

## Gate — profile locked

Restate in ≤8 lines and get a "sí":

```
Perfil
- Quién: <profesión>, <país>
- Para qué: <3 trabajos concretos>
- Dónde le hablas: <canales>
- Cuándo: <24/7 nube | cuando la computadora está encendida | computadora siempre encendida>
- Ya pagas: <suscripciones> · Presupuesto: <rango>
- Sensibilidad: <nivel> · Nivel técnico: <nivel>
- Panel: <sí | no>
- Herramientas que usa: <lista>
```

Then write it to `.jarvis/state.json → profile`, update the RUNNING BRIEF, and transition:
"Perfecto. Ahora decido la arquitectura de tu Jarvis."
