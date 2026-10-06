# Country: Colombia (co)

> What changes for a Jarvis built for someone in Colombia: WhatsApp is near-universal and its templates are the cheapest in the region, invoicing goes through a DIAN-authorised provider such as Siigo or Alegra, and Ley 1581 plus the SIC's AI circular apply once customer data is involved.

Last verified: 2026-10-06

No versions are pinned here. Runtimes: `knowledge/runtimes/<id>.md`. Models: `knowledge/models.json`. WhatsApp mechanics and policy: `knowledge/capabilities/whatsapp.md`. Voice engines: `knowledge/capabilities/voice.md`. Tool trust tiers: `knowledge/capabilities/tools-mcp.md`.

## Channels reality

- WhatsApp reaches about **94%** of internet users in Colombia, the highest of the three LATAM markets measured; Telegram is secondary ([Infobip 2026](https://infobip.com/blog/whatsapp-statistics), secondary source).
- Defaults the Architect uses:

| Use | Channel | Why |
|---|---|---|
| Personal Jarvis, wants zero risk | **Telegram** | Free, official bot API, no ban risk |
| Personal Jarvis, insists on WhatsApp | **WhatsApp Cloud API** on a **new number** | Grey zone under Meta's AI-provider clause; low practical risk at personal volume |
| Business answering its own customers | **WhatsApp Cloud API** or a BSP | Allowed: AI is ancillary to the business |
| Wants WhatsApp without a Meta account | Baileys only after the consent gate in `knowledge/capabilities/whatsapp.md`, **secondary SIM** | Breaks WhatsApp ToS; number can be banned |

- BSPs active in LATAM including Colombia: YCloud, Twilio, Gupshup, Zenvia, Leadsales, Kommo, Wati, respond.io, Infobip ([YCloud LATAM list](https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america)). Colombian presence of each is UNVERIFIED; check Spanish support and COP billing before recommending one.

## WhatsApp rates & policy notes

**Policy.** Meta's AI-provider clause (last updated 2026-09-23) applies **in full** in Colombia; **no regulator exception** for +57 ([Meta terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform), [Meta AI-providers page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers)). Allowed / grey / forbidden classes: `knowledge/capabilities/whatsapp.md`.

**Template rates (USD per delivered template, Meta platform fee, before BSP markup and taxes):**

| Category | Rate |
|---|---|
| Marketing | **$0.0125** |
| Utility / Authentication | **$0.0008** (utility free inside an open 24 h service window; authentication figure from the [flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing) table as checked 2026-09-28, UNVERIFIED in the re-check) |

Source: [flowcall rate table](https://www.flowcall.co/blog/whatsapp-business-api-pricing) (secondary, mirrors Meta's rate card; re-fetched 2026-10-06). Authoritative rate card: download from Meta's [pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing); `stack-researcher` re-checks before quoting.

**Service-message CONFLICT.** Meta's official pricing doc (re-fetched 2026-10-06) still says all non-template messages are free and in-window utility templates are free. flowcall and [respond.io](https://respond.io/blog/whatsapp-pricing-change-2026.md) say service messages are charged from 2026-10-01 after 1,000 free per number per month. The official doc wins until Meta changes it; a personal Jarvis stays well under 1,000 replies either way.

**What a personal Jarvis costs on WhatsApp in Colombia.** Replies: $0. A daily briefing sent first by Jarvis: 30 × $0.0008 ≈ **$0.02 USD/month** as utility, 30 × $0.0125 ≈ $0.38 as marketing. Colombia is the cheapest of the four packs.

**Billing currency.** Meta's pricing doc lists **COP** among eight billing currencies introduced **2026-04-01** (confirmed in the official doc on 2026-10-06; this resolves the earlier UNVERIFIED note).

## Fiscal / invoicing tools

Colombia uses DIAN electronic invoicing: each invoice is validated by DIAN before it reaches the customer and gets a **CUFE**. The current framework is Resolution 000165 of 2023 (technical annex 1.9, electronic equivalent document) amended by Resolution 000202 of 2025-03-31, which limits the buyer data a seller may ask for to name, ID number and email ([El Tiempo](https://www.eltiempo.com/economia/finanzas-personales/resolucion-de-la-dian-introduce-cambios-en-la-factura-electronica-hay-datos-que-no-se-deben-pedir-evite-sanciones-3456589), [DIAN normatividad](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/normatividad/)) ([actualicese](https://actualicese.com/dian-emite-proyecto-sobre-sistema-de-facturacion-electronica/), [Valora Analitik](https://www.valoraanalitik.com/dian-hizo-oficial-cambio-en-facturacion-electronica-tendra-estos-beneficios/), secondary). DIAN offers a free invoicing service; businesses with volume use an authorised technology provider.

| Tool | Default? | Integration | Trust tier |
|---|---|---|---|
| **Alegra** (CO) | **Default when starting from zero** (official MCP, simplest setup) | **OFFICIAL MCP** (launched 2026-06-08), one-click authorisation, no API key; dev docs list bills, items, contacts, invoices, payments, journals, reports, banking. Endpoint, write scope and plan gating UNVERIFIED ([PR Newswire](https://www.prnewswire.com/mx/comunicados-de-prensa/alegra-revoluciona-la-gestion-contable-en-mexico-contadores-y-empresarios-ya-pueden-consultar-sus-finanzas-en-tiempo-real-usando-su-ia-favorita-302794164.html), [developer.alegra.com/llms.txt](https://developer.alegra.com/llms.txt)) | 1 |
| **Siigo** | **Default when they already use it** (very common; described as a leading DIAN-authorised provider by [Alegra's own comparison](https://blog.alegra.com/colombia/alegra-vs-siigo-colombia/), a competitor source) | **No official MCP.** COMMUNITY: `jdlar1/siigo-mcp` (npx, 40+ tools, **read-only by default**), `dsfaccini/siigo-mcp`, `codespar/mcp-siigo`. Needs `SIIGO_USERNAME`, `SIIGO_ACCESS_KEY`, `SIIGO_PARTNER_ID` from Siigo Nube → Alianzas → "Mi credencial API" ([glama jdlar1](https://glama.ai/mcp/servers/jdlar1/siigo-mcp), [glama dsfaccini](https://glama.ai/mcp/servers/dsfaccini/siigo-mcp)) | 2, **keep read-only** |
| **DIAN free service** | Very small volume | No API for agents | Jarvis prepares the data; the person issues it in the DIAN portal |
| Anything else | — | Zapier MCP fallback | 4 |

Prices for Alegra and Siigo plans: not verified in this pass (UNVERIFIED); have `stack-researcher` check the person's plan includes API/MCP access.

**Guardrails:**
- **Issuing an electronic invoice is irreversible once DIAN validates it**; correcting it needs a credit note (nota crédito) (UNVERIFIED in this pass; standard practice). Always preview (NIT, items, IVA, totals) and wait for an explicit "sí".
- Under Res. 000202/2025, Jarvis must not ask the buyer for more than name, ID number and email to issue an invoice (less personal data to store, too).
- Keep Siigo in **read-only** mode unless the person explicitly asks for writes, and then behind human approval.
- Never store the company's digital signature certificate or portal passwords in the workspace or memory.
- Electronic payroll and support documents exist (Res. 000013/2021 referenced by secondary sources); out of scope for a week-one Jarvis.

## Fiscal calendar

DIAN publishes the national tax calendar once a year by decree; due dates depend on the **last
one or two digits of the NIT** and on the obligation. `stack-researcher` fetches the current
year's calendar from the official source at build time and **every January** (a `/jarvis-doctor`
check), and the build writes it to `memory/reference/calendario-dian-<año>.md` with the source URL
and fetch date. Never type dates from memory.

- Source: DIAN's "Calendario tributario" page on https://www.dian.gov.co (the year's decree number
  and exact URL: **UNVERIFIED** here, fetched live).
- Obligations an accountant's Jarvis tracks per client: IVA (bimestral or cuatrimestral, per the
  client's regime), retención en la fuente (monthly), renta (personas jurídicas in instalments;
  personas naturales by NIT digits), información exógena, and Régimen Simple advance payments where
  they apply. Which one applies to which client is the accountant's input, stored per alias.
- **What may be stored:** per client alias, only the last 1–2 NIT digits the calendar needs and
  the list of obligations (e.g. `A-017: dígitos 47 · IVA bimestral · retención mensual`). Two
  digits don't identify anyone, so this doesn't break SEC-13; the full NIT never goes into memory.
- Reminder jobs read this file; when a date isn't in it, the job says "no tengo esa fecha en el
  calendario cargado" instead of guessing.

## CRM & commerce

| Tool | Status | Tier |
|---|---|---|
| **HubSpot** | OFFICIAL remote MCP `https://mcp.hubspot.com`, OAuth 2.1 ([changelog](https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available)) | 1 |
| **Pipedrive** | OFFICIAL MCP (2026-06-30), OAuth; endpoint UNVERIFIED ([newsroom](https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants)) | 1 |
| **Kommo** | WhatsApp-native CRM popular in LATAM; community MCPs only (UNVERIFIED that no official one exists) | 2 |
| **Mercado Libre** | OFFICIAL remote MCP `https://mcp.mercadolibre.com/mcp` ([GitHub](https://github.com/mercadolibre/mercadolibre-mcp-server)); Colombia site coverage UNVERIFIED | 1 |
| **Mercado Pago** | OFFICIAL MCP; official overview lists **developer tools only** (CONFLICT with directories claiming payment links/refunds) ([MP dev docs](https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview)) | 1 (dev scope) |
| **Stripe** | Availability for businesses in Colombia UNVERIFIED (check stripe.com/global before suggesting it) | — |
| **Shopify** | Official Dev/Storefront MCPs; Admin is community only | 2 |
| Local gateways (Wompi, Bold, ePayco, PSE) | No MCP verified (UNVERIFIED); Zapier fallback or generated wrapper | 3–4 |

Irreversible actions (always human approval): issuing invoices, refunds, payouts, outbound marketing templates, CRM deletes, marketplace price changes.

## Data-protection law

**Law.** **Ley 1581 de 2012** (habeas data), enforced by the **Superintendencia de Industria y Comercio (SIC)**.
- **Circular Externa 002/2024** (DO 52,856, 2024-08-22) on AI: transparency, precautionary principle, risk management, and a **privacy impact assessment** when fundamental rights may be affected ([SIC 002/2024](https://normograma.mintic.gov.co/mintic/compilacion/docs/circular_superindustria_0002_2024.htm)).
- **Circular Externa 003/2025**: model contract clauses for international **transfers and transmissions** ([SIC 003/2025](https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20003%20de%202025.pdf)).

**What the Architect must warn (and do):**
1. **Personal-only Jarvis:** say plainly the obligations mostly start when other people's data is processed.
2. **Customer data sent to Anthropic/OpenAI (US)** is an international transmission or transfer: use the SIC model clauses or the provider's DPA, and name processors (LLM, BSP, Railway) in the **política de tratamiento de datos** and the authorisation text. Draft from template, marked "revísalo con un abogado".
3. **Customer-facing bot:** run the impact assessment the circular asks for, and disclose AI in the first message ("Soy un asistente con IA de <negocio>").
4. **RNBD** (national database registry): required above size thresholds; the 2026 thresholds are UNVERIFIED, so tell the person to check with their accountant.
5. Minimise: no cédula numbers, health or card data in long-term memory; redact before embedding. Record processors in `compliance.md`.

**Draft templates (Spanish, always marked "Borrador — revísalo con un abogado").** The build fills
`<…>` from the spec and writes them to the Jarvis folder as `privacidad/`.

*Política de tratamiento de datos (extracto que el Architect agrega a la política existente o crea):*

> **Responsable:** <nombre o razón social>, <ciudad>, <correo de contacto>.
> **Finalidad:** prestar los servicios contratados (<contabilidad / asesoría>), recordar
> obligaciones y organizar documentos, con ayuda de un asistente de inteligencia artificial
> supervisado por <nombre>.
> **Encargados y transmisión internacional:** los datos pueden ser tratados por <proveedor del
> modelo> (Estados Unidos), <Railway, región> y <Telegram/Meta/Siigo, según el diseño> como
> encargados, bajo contratos que incluyen las cláusulas de la Circular Externa 003 de 2025 de la
> SIC o el acuerdo de tratamiento del proveedor.
> **Derechos:** conocer, actualizar, rectificar y suprimir sus datos, y revocar la autorización,
> escribiendo a <correo>. Respuesta en los plazos de la Ley 1581 de 2012.
> **Datos que no tratamos con IA:** números de identificación completos, datos bancarios y
> firmas electrónicas.

*Autorización (casilla o mensaje que el cliente acepta antes de enviar documentos):*

> Autorizo a <responsable> a tratar mis datos personales para <finalidad>, incluida su
> transmisión a los encargados indicados en la política de tratamiento (<link>), algunos fuera de
> Colombia. Conozco mis derechos y cómo ejercerlos.

## Voice accent defaults

| Tier | STT | TTS | Notes |
|---|---|---|---|
| Premium | Deepgram Nova-3 multilingual | ElevenLabs Flash v2.5 or v4 Turbo with a **Colombian or neutral LatAm** library voice | v4 Turbo is described as "Spanish, LatAm" ([ElevenLabs models](https://elevenlabs.io/docs/overview/models)); Colombian voice availability in the library UNVERIFIED, let the person listen |
| Budget cloud | Deepgram Nova-3 | Deepgram Aura-2: one of the ten Spanish voices covers a Colombian accent; which one is undocumented ([Deepgram TTS](https://developers.deepgram.com/docs/tts-models-languages-overview)) | Play samples |
| Fully local | whisper.cpp (`medium`/`large`) | Piper: no Colombian voice verified (UNVERIFIED); fall back to `es_MX-claude-high` (closest neutral LatAm) | |
| Avoid | — | Kokoro | Weak Spanish |

Text register: Colombian Spanish. Default **tú** for a personal Jarvis; for customer-facing business bots ask once whether the business uses **usted** (very common in Colombian service contexts). Money `$1.234.567 COP` (dot thousands separator; always write "COP" next to USD prices).

## Timezones & currency

- **`America/Bogota`**, UTC−5, **no DST**, one zone for the whole country ([IANA tz database](https://www.iana.org/time-zones)).
- **Currency:** COP (peso). LLM, Railway and SaaS bill in **USD**; show both using a live rate from `stack-researcher`. Meta can bill WhatsApp in COP since 2026-04-01.

## Sources

- https://infobip.com/blog/whatsapp-statistics
- https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america
- https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (re-fetched 2026-10-06)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers
- https://www.flowcall.co/blog/whatsapp-business-api-pricing (re-fetched 2026-10-06)
- https://respond.io/blog/whatsapp-pricing-change-2026.md
- https://actualicese.com/dian-emite-proyecto-sobre-sistema-de-facturacion-electronica/
- https://www.valoraanalitik.com/dian-hizo-oficial-cambio-en-facturacion-electronica-tendra-estos-beneficios/
- https://www.eltiempo.com/economia/finanzas-personales/resolucion-de-la-dian-introduce-cambios-en-la-factura-electronica-hay-datos-que-no-se-deben-pedir-evite-sanciones-3456589
- https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/normatividad/
- https://blog.alegra.com/colombia/alegra-vs-siigo-colombia/
- https://www.prnewswire.com/mx/comunicados-de-prensa/alegra-revoluciona-la-gestion-contable-en-mexico-contadores-y-empresarios-ya-pueden-consultar-sus-finanzas-en-tiempo-real-usando-su-ia-favorita-302794164.html
- https://developer.alegra.com/llms.txt
- https://glama.ai/mcp/servers/jdlar1/siigo-mcp
- https://glama.ai/mcp/servers/dsfaccini/siigo-mcp
- https://github.com/codespar/mcp-dev-latam
- https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- https://github.com/mercadolibre/mercadolibre-mcp-server
- https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview
- https://normograma.mintic.gov.co/mintic/compilacion/docs/circular_superindustria_0002_2024.htm
- https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20003%20de%202025.pdf
- https://elevenlabs.io/docs/overview/models
- https://developers.deepgram.com/docs/tts-models-languages-overview
- https://www.iana.org/time-zones
