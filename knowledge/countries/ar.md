# Country: Argentina (ar)

> What changes for a Jarvis built for someone in Argentina: WhatsApp first, templates are pricey so Jarvis should reply rather than message first, ARCA (ex-AFIP) invoicing has no mature agent tooling, and Ley 25.326 still governs while a reform bill waits in Congress.

Last verified: 2026-10-06

No versions are pinned here. Runtimes: `knowledge/runtimes/<id>.md`. Models: `knowledge/models.json`. WhatsApp mechanics and policy: `knowledge/capabilities/whatsapp.md`. Voice engines: `knowledge/capabilities/voice.md`. Tool trust tiers: `knowledge/capabilities/tools-mcp.md`.

## Channels reality

- WhatsApp reaches about **90%** of internet users in Argentina; Telegram is secondary ([Infobip 2026](https://infobip.com/blog/whatsapp-statistics), secondary source).
- Defaults the Architect uses:

| Use | Channel | Why |
|---|---|---|
| Personal Jarvis, wants zero risk | **Telegram** | Free, official bot API, no ban risk; also avoids Argentina's high template rates |
| Personal Jarvis, insists on WhatsApp | **WhatsApp Cloud API** on a **new number** | Grey zone under Meta's AI-provider clause; low practical risk at personal volume |
| Business answering its own customers | **WhatsApp Cloud API** or a BSP | Allowed: AI is ancillary to the business |
| Wants WhatsApp without a Meta account | Baileys only after the consent gate in `knowledge/capabilities/whatsapp.md`, **secondary SIM** | Breaks WhatsApp ToS; number can be banned |

- BSPs active in LATAM including Argentina: Zenvia (office in AR), YCloud, Twilio, Gupshup, Leadsales, Kommo, Wati, respond.io, Infobip ([YCloud LATAM list](https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america)).

## WhatsApp rates & policy notes

**Policy.** Meta's AI-provider clause (last updated 2026-09-23) applies **in full**; **no regulator exception** for +54 ([Meta terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform), [Meta AI-providers page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers)). Classes: `knowledge/capabilities/whatsapp.md`.

**Template rates (USD per delivered template, Meta platform fee, before BSP markup and taxes):**

| Category | Rate |
|---|---|
| Marketing | **$0.0618** |
| Utility / Authentication | **$0.026** (utility free inside an open 24 h window; authentication figure from the [flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing) table as checked 2026-09-28, UNVERIFIED in the re-check) |

Source: [flowcall rate table](https://www.flowcall.co/blog/whatsapp-business-api-pricing) (secondary, mirrors Meta's rate card; re-fetched 2026-10-06). Authoritative: Meta's rate card download on the [pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing); `stack-researcher` re-checks before quoting.

**Service-message CONFLICT.** Meta's official doc (re-fetched 2026-10-06) says non-template messages and in-window utility templates are free; flowcall and [respond.io](https://respond.io/blog/whatsapp-pricing-change-2026.md) say service messages are charged from 2026-10-01 after 1,000 free per number per month. Official doc wins; a personal Jarvis stays far under 1,000 either way.

**What a personal Jarvis costs on WhatsApp in Argentina.** Replies: $0. A daily briefing sent first by Jarvis: 30 × $0.026 ≈ **$0.78 USD/month** as utility, 30 × $0.0618 ≈ $1.85 as marketing. Design the briefing so the person opens the window ("escribile 'buen día' a Jarvis y te manda el resumen gratis").

**Billing currency.** Meta's pricing doc lists **ARS** among the billing currencies introduced **2026-04-01** (confirmed 2026-10-06).

## Fiscal / invoicing tools

Electronic invoicing is run by **ARCA** (Agencia de Recaudación y Control Aduanero, formerly AFIP). Two routes: the **WSFE** web service or the "Comprobantes en línea" portal ([yo-facturo](https://yo-facturo.com/blog/arca-ex-afip-que-es-y-que-cambio/), secondary). Recent changes, all from secondary press (the ARCA resolutions themselves are not re-read in this pass, UNVERIFIED):
- **CAE** became the mandatory authorisation method from 1 August (2026); CAEA only for contingencies ([La Capital MdP](https://www.lacapitalmdp.com/arca-postero-hasta-agosto-los-cambios-en-la-facturacion-electronica-y-el-uso-del-c-a-e-a/)).
- From **2026-11-01** small taxpayers in the *Régimen de Inclusión Social y Promoción del Trabajo Independiente* must issue electronic vouchers as the normal method ([iProUP](https://www.iproup.com/coffee-break/71230-factura-electronica-de-arca-que-cambia-y-cuando-entra-en-vigencia.amp)).
- From **2026-12-01** ARCA rejects authorisation requests that omit the receiver's **IVA condition** ([SIAP blog del contador](https://siap.blogdelcontador.com.ar/?p=90212)). Any tool Jarvis uses must send that field.

| Tool | Default? | Integration | Trust tier |
|---|---|---|---|
| **Alegra** (AR) | **Default when they want invoicing through Jarvis** | OFFICIAL Alegra MCP; Argentina coverage of the MCP specifically is UNVERIFIED (the launch was Mexico-focused) ([developer.alegra.com/llms.txt](https://developer.alegra.com/llms.txt)) | 1 if AR is covered; else 4 |
| **ARCA WSFE via `codespar/mcp-afip`** | Not by default | COMMUNITY, **alpha** ("endpoint paths are best-guesses") ([codespar](https://github.com/codespar/mcp-dev-latam)) | 3: only read/test use; never production invoicing |
| **Comprobantes en línea** (portal) | Monotributistas with low volume | No API | Jarvis prepares the data and a checklist; the person issues it in the portal |
| Their existing invoicing SaaS | If they have one | Zapier MCP or generated wrapper | 3–4 |

**Guardrails:**
- **Issuing a voucher with CAE is irreversible**; corrections go through a credit note (UNVERIFIED in this pass; standard practice). Preview (CUIT, IVA condition, punto de venta, totals) and wait for an explicit "sí".
- **Never** put the ARCA digital certificate, its private key or the clave fiscal in the workspace, memory or chat. If a WSFE integration is ever built, the cert lives in the host's secret store and the integration starts against ARCA's homologation (test) environment.
- Fiscal deadlines move often: phrase reminders as "confirmalo con tu contador".

## CRM & commerce

| Tool | Status | Tier |
|---|---|---|
| **Mercado Libre** | OFFICIAL remote MCP `https://mcp.mercadolibre.com/mcp`, OAuth bearer; tool list UNVERIFIED ([GitHub](https://github.com/mercadolibre/mercadolibre-mcp-server)) | 1 |
| **Mercado Pago** (dominant wallet and payments) | OFFICIAL MCP; the official AR overview lists **developer tools only** (docs, credentials, webhooks, test users, quality checks). Live payment links/refunds UNVERIFIED (CONFLICT) ([MP dev docs AR](https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview)) | 1 (dev scope) |
| **HubSpot** | OFFICIAL remote MCP, OAuth 2.1 ([changelog](https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available)) | 1 |
| **Pipedrive** | OFFICIAL MCP, OAuth; endpoint UNVERIFIED ([newsroom](https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants)) | 1 |
| **Kommo** | Community MCPs only (UNVERIFIED that no official one exists) | 2 |
| **Tiendanube** | No MCP verified; Zapier fallback | 4 |
| **Stripe** | Availability for Argentine businesses UNVERIFIED; check stripe.com/global before suggesting it | — |

Irreversible actions (always human approval): issuing vouchers, refunds, payouts, outbound marketing templates, CRM deletes, marketplace price changes.

## Data-protection law

**Law.** **Ley 25.326** (Protección de Datos Personales) is still in force, enforced by the **AAIP** (Agencia de Acceso a la Información Pública). A comprehensive reform aligned with Convention 108+ and with extraterritorial scope was **reintroduced in Congress on 2026-07-16** and is **not enacted** ([Allende](https://allende.com/privacidad-y-ciberseguridad/se-reintroduce-en-el-congreso-el-proyecto-de-reforma-integral-del-regimen-argentino-de-proteccion-de-datos-personales-08-12-2026/), [Marval](https://www.marval.com/publicacion/nuevo-proyecto-de-ley-de-proteccion-de-datos-17691)).

**What the Architect must warn (and do):**
1. **Personal-only Jarvis:** obligations mostly start with third parties' data.
2. **Customer data:** current rules are consent, **database registration** with the AAIP, and adequacy or contractual clauses for **international transfers** (the LLM provider in the US). Use the provider's DPA; name LLM, BSP and Railway as processors in the privacy text; draft marked "revisalo con un abogado".
3. **AI disclosure** in the first message of a customer-facing bot ("Soy un asistente con IA de <negocio>"): good practice, not verified as a current Argentine legal requirement.
4. Minimise: no DNI, CUIT of individuals, card or health data in long-term memory; redact before embedding. Record processors in `compliance.md`.
5. Tell the person the reform may change these rules; `/jarvis-refresh` tracks it.

## Voice accent defaults

| Tier | STT | TTS | Notes |
|---|---|---|---|
| Premium | Deepgram Nova-3 multilingual | ElevenLabs Flash v2.5 or v4 Turbo with a **rioplatense** library voice | Argentine voice availability in the library UNVERIFIED; let the person listen. A Mexican accent sounds foreign here, so do not default to it |
| Budget cloud | Deepgram Nova-3 | Deepgram Aura-2: one of the ten Spanish voices covers an Argentine accent; which one is undocumented ([Deepgram TTS](https://developers.deepgram.com/docs/tts-models-languages-overview)) | Play samples |
| Fully local | whisper.cpp (`medium`/`large`) | Piper: no Argentine voice verified (UNVERIFIED); fall back to a neutral voice and say so | |
| Avoid | — | Kokoro | Weak Spanish |

Text register: **voseo** ("vos tenés", "fijate", "confirmalo") in the Jarvis's SOUL.md and all generated prose for Argentine users, unless they write to the Architect with tú. Money `$ 1.234,50 ARS` (dot thousands, comma decimals).

## Timezones & currency

- **`America/Argentina/Buenos_Aires`**, UTC−3, **no DST**. Other `America/Argentina/*` zones exist for historical differences but currently share UTC−3; use the one the OS reports ([IANA tz database](https://www.iana.org/time-zones)).
- **Currency:** ARS (peso). Because of inflation, **quote recurring costs in USD first**, ARS second, using a live rate from `stack-researcher` and noting which exchange rate (official vs. card) applies. USD card charges from Argentina can carry tax withholdings (percepciones) on top; current rates UNVERIFIED, so tell the person to check their bank statement after the first month and to set spend caps in USD.
- Meta can bill WhatsApp in ARS since 2026-04-01.

## Sources

- https://infobip.com/blog/whatsapp-statistics
- https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america
- https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (re-fetched 2026-10-06)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers
- https://www.flowcall.co/blog/whatsapp-business-api-pricing (re-fetched 2026-10-06)
- https://respond.io/blog/whatsapp-pricing-change-2026.md
- https://yo-facturo.com/blog/arca-ex-afip-que-es-y-que-cambio/
- https://www.lacapitalmdp.com/arca-postero-hasta-agosto-los-cambios-en-la-facturacion-electronica-y-el-uso-del-c-a-e-a/
- https://www.iproup.com/coffee-break/71230-factura-electronica-de-arca-que-cambia-y-cuando-entra-en-vigencia.amp
- https://siap.blogdelcontador.com.ar/?p=90212
- https://github.com/codespar/mcp-dev-latam
- https://developer.alegra.com/llms.txt
- https://github.com/mercadolibre/mercadolibre-mcp-server
- https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview
- https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- https://allende.com/privacidad-y-ciberseguridad/se-reintroduce-en-el-congreso-el-proyecto-de-reforma-integral-del-regimen-argentino-de-proteccion-de-datos-personales-08-12-2026/
- https://www.marval.com/publicacion/nuevo-proyecto-de-ley-de-proteccion-de-datos-17691
- https://developers.deepgram.com/docs/tts-models-languages-overview
- https://www.iana.org/time-zones
