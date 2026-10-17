<!--
TEMPLATE — templates/workspace/USER.md (filled by .claude/agents/workspace-writer.md)
Delete this whole comment block when writing the Jarvis's USER.md. No {{...}} may survive.
Only what the owner said in the interview. NEVER write: surnames, phone numbers, emails,
addresses, Telegram/WhatsApp IDs, card or bank numbers, CURP/RFC/INE/DNI/NIE/cédula/NIT/CUIT,
passwords, health data (validator sweep 13, SEC-13). People go by role, never by contact data.

Variables:
  {{owner_first_name}}   First name only.
  {{profession}}         Plain-language description, e.g. "contadora independiente con 12 clientes".
  {{pack}}               Profession pack id from knowledge/README.md (e.g. lawyer-accountant).
  {{country}}            Country name (pack: knowledge/countries/<cc>.md).
  {{timezone}}           IANA timezone, e.g. America/Mexico_City, America/Bogota, Europe/Madrid.
                         The pending skill resolves "mañana"/"el jueves" in TASKS.md against it.
  {{currency}}           e.g. MXN, COP, ARS, EUR, USD.
  {{working_days}}       e.g. "lunes a viernes".
  {{working_hours}}      e.g. "9:00–18:00".
  {{quiet_hours}}        Hours with no interruptions except emergencies, e.g. "21:00–8:00".
                         The autopilot stays silent in them (knowledge/capabilities/autonomy.md).
  {{main_channel}}       e.g. Telegram.
  {{week_one_jobs}}      The 3 week-one jobs from spec §1, one bullet each.
  {{tools_in_use}}       Apps the owner uses daily (names only), one bullet each.
  {{preferences}}        Stated preferences (format, length, what bores them), one bullet each.
  {{key_people}}         People who matter BY ROLE ("mi socia", "cliente principal: una agencia
                         de viajes"), one bullet each. If none were mentioned, write
                         "Ninguna todavía." instead of bullets.
  {{urgent_definition}}  What counts as urgent in the owner's words.
-->
# Sobre {{owner_first_name}}

## Quién es
- Nombre: {{owner_first_name}}
- A qué se dedica: {{profession}} (perfil: `{{pack}}`)
- País: {{country}} · Zona horaria: {{timezone}} · Moneda: {{currency}}

## Cuándo trabaja
- Días: {{working_days}}
- Horario: {{working_hours}} ({{timezone}})
- Horas de silencio: {{quiet_hours}}. En ese horario solo interrumpo si es urgente de verdad.
- Canal principal: {{main_channel}}

## Para qué me quiere (semana uno)
{{week_one_jobs}}

## Herramientas que usa
{{tools_in_use}}

## Preferencias
{{preferences}}

## Personas importantes (por rol, sin datos de contacto)
{{key_people}}

## Qué es "urgente" para {{owner_first_name}}
{{urgent_definition}}

## Reglas de este archivo
1. Aquí va el perfil estable de {{owner_first_name}}. Los hechos sueltos van a MEMORY.md, lo que
   aprendo de sus correcciones a LESSONS.md y sus pendientes a TASKS.md.
2. Puedo proponer cambios a este archivo; {{owner_first_name}} los aprueba antes de guardarlos.
3. Nunca guardo aquí identificaciones oficiales, números de tarjeta o cuenta, contraseñas,
   direcciones, teléfonos ni datos de salud.
