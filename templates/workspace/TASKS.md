<!--
TEMPLATE — templates/workspace/TASKS.md (filled by .claude/agents/workspace-writer.md)
Delete THIS comment block when writing the Jarvis's TASKS.md. Keep the "Formato" comment below:
the pending and autopilot skills read it. No {{...}} may survive.
Rules: knowledge/capabilities/autonomy.md. Parser: tests/autonomy/parse_tasks.py (same grammar as
templates/local/jobs/apply-ops.sh). Keep the five "## " headings exactly; apply-ops.sh moves task
lines between them by state. The task list starts EMPTY: never invent example tasks.

Variables:
  {{owner_first_name}}  Owner's first name.
  {{jarvis_name}}       Assistant's name.
-->
# Pendientes

Lo que {{owner_first_name}} y {{jarvis_name}} tienen por hacer. Una línea por tarea. Los detalles
largos van en `tasks/T-NNNN.md`, los borradores en `drafts/T-NNNN.md` y lo terminado de meses
pasados en `tasks/archive/AAAA-MM.md`.

<!--
Formato (una sola línea por tarea; los campos entre [ ] son opcionales, separados por " · "):
- [ ] T-0042 · título de 80 caracteres o menos · state:todo · who:jarvis · lvl:L1 [· due:AAAA-MM-DD[THH:MM]] [· next:AAAA-MM-DD] [· prio:1-3] [· src:owner/telegram/AAAA-MM-DD] [· tries:N] [· dep:T-0041] [· conf:0.8]
state: inbox · todo · doing · waiting · needs_ok · blocked · done · dropped  ([x] solo con done o dropped)
who:   jarvis (lo prepara Jarvis) · owner (lo hace la dueña o el dueño) · other (esperamos a alguien más)
lvl:   L0 solo recordar · L1 preparar borradores · L2 acción irreversible con vista previa y "sí" en vivo
       · L3 acción reversible de la lista de AGENTS.md § 10 (vacía salvo que se haya llenado a mano)
src:   owner/<canal> entra directo a todo; email:sent, email:untrusted, calendar, meeting, media
       y agent entran a la Bandeja y esperan confirmación.
El título nunca lleva "·". Las fechas relativas ("mañana") se resuelven con la zona horaria de USER.md.
-->

## Hoy

## Próximos

## Esperando a otros

## Bandeja (capturado, sin confirmar)

## Hecho
