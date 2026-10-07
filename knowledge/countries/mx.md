# Country: Mexico (mx)

> What changes for a Jarvis built for someone in Mexico: WhatsApp is the default expectation, Facturapi is the default way to issue CFDIs, and the 2025 LFPDPPP applies the moment Jarvis touches customer data.

Last verified: 2026-10-06

No versions are pinned here. Runtimes: `knowledge/runtimes/<id>.md`. Models and prices per token: `knowledge/models.json`. WhatsApp mechanics and policy: `knowledge/capabilities/whatsapp.md`. Voice engines: `knowledge/capabilities/voice.md`. Tool trust tiers: `knowledge/capabilities/tools-mcp.md`.

## Channels reality

- WhatsApp reaches about **93%** of internet users in Mexico; Telegram is secondary ([Infobip 2026](https://infobip.com/blog/whatsapp-statistics), secondary source). Expect "todos mis clientes y mi familia están en WhatsApp".
- Defaults the Architect uses:

| Use | Channel | Why |
|---|---|---|
| Personal Jarvis, wants zero risk | **Telegram** | Free, official bot API, no ban risk. Say it in one line: "Telegram no tiene el riesgo de WhatsApp y es gratis." |
| Personal Jarvis, insists on WhatsApp | **WhatsApp Cloud API** on a **new number** | Grey zone under Meta's AI-provider clause (see below); low practical risk at personal volume |
| Business answering its own customers (citas, pedidos, cotizaciones) | **WhatsApp Cloud API** or a BSP | Allowed: AI is ancillary to the business |
| Wants WhatsApp without a Meta account | Baileys only after the consent gate in `knowledge/capabilities/whatsapp.md`, **secondary SIM** | Breaks WhatsApp ToS; number can be banned |

- BSPs active in Mexico: YCloud, Twilio, Gupshup, Zenvia (office in MX), Leadsales (Meta-appointed LATAM SME partner), Kommo, Wati, respond.io, Infobip ([YCloud LATAM list](https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america), [Contxto](https://www.contxto.com/en/news/meta-chooses-leadsales-as-whatsapp-solution-partner-for-latin-america/)). Markups vary; check each one.

## WhatsApp rates & policy notes

**Policy.** Meta's AI-provider clause (Meta Terms for WhatsApp Business Platform, last updated 2026-09-23) applies **in full** in Mexico. There is **no regulator exception** for +52 (exceptions exist only for Italy, Brazil and the EEA) ([Meta terms](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform), [Meta AI-providers page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers)). Classification (allowed / grey / forbidden) lives in `knowledge/capabilities/whatsapp.md`.

**Template rates (USD per delivered template, Meta platform fee, before BSP markup and taxes):**

| Category | Rate | Note |
|---|---|---|
| Marketing | **$0.0397** | flowcall says this rose from $0.0305 on 2026-10-01; Meta's own update log (re-fetched 2026-10-06) lists no Mexico change for that date, so `stack-researcher` re-checks [Meta's pricing page](https://developers.facebook.com/docs/whatsapp/pricing) live before quoting; if it differs, quote Meta's figure |
| Utility / Authentication | **$0.0085** | Utility is free when delivered inside an open 24 h service window. The authentication figure comes from the [flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing) table as checked 2026-09-28; re-checked live by `stack-researcher` on Meta's pricing page before quoting |

Source: [flowcall rate table](https://www.flowcall.co/blog/whatsapp-business-api-pricing) (secondary, says it mirrors Meta's rate card; re-fetched 2026-10-06). Meta publishes the authoritative rate card as a download from its [pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing); `stack-researcher` re-checks it before quoting.

**Service messages: sources disagree; `stack-researcher` re-checks Meta's pricing page live before quoting.** Meta's official pricing doc, re-fetched 2026-10-06, still says "All non-template messages are free" and "Utility templates delivered within an open customer service window are free"; its 2026-10-01 updates list only other markets. flowcall and [respond.io](https://respond.io/blog/whatsapp-pricing-change-2026.md) claim service messages are charged from 2026-10-01 after 1,000 free per number per month. **The official doc wins until Meta says otherwise.** Either way a personal Jarvis stays far under 1,000 replies a month, so replies cost about $0.

**What a personal Jarvis really costs on WhatsApp in Mexico.** Replies to the owner inside the 24 h window: $0. A daily morning briefing sent **first** by Jarvis is a template: 30 × $0.0085 ≈ **$0.26 USD/month** if Meta classifies it as utility, 30 × $0.0397 ≈ $1.19 if it classifies it as marketing (Meta decides the category). Tip for the person: "Si tú le escribes primero a Jarvis cada mañana, el resumen sale gratis."

**Billing currency.** MXN billing exists (Meta's note gives 2025-04-01 as the start; a secondary source says 2026-01-01). Minor; the Architect only needs "Meta puede cobrarte en pesos".

## Fiscal / invoicing tools

Mexico's CFDI 4.0 is stamped by a PAC (authorised certification provider), not by SAT directly. SAT has no consumer API. Annex 20 was updated 2026-01-01 with new catalog codes and stricter validation ([siemprealdia](https://siemprealdia.co/mexico/fiscal/anexo-20-sat-cfdi-4-0/), secondary).

| Tool | Default? | Integration | Price (MXN) | Trust tier |
|---|---|---|---|---|
| **Facturapi** | **Default** | REST API with official Node client and a **test mode**; 14-day trial. COMMUNITY MCP `@codespar/mcp-facturapi` (stdio, `FACTURAPI_API_KEY`, MIT, in the official MCP Registry), or the architect writes a thin MCP wrapper itself | CFDI API plan **$299/month + $0.60 per stamp**; bulk CFDI download $999/month + $0.20 per document; Stripe-to-CFDI plan $299/month ([facturapi.io/pricing](https://facturapi.io/pricing), fetched 2026-10-06) | Tier 2 (community MCP pinned to a version) or Tier 3 (generated wrapper) |
| **Facturama** | When they already use it | REST API with free sandbox. **No MCP found**; `stack-researcher` checks again at install. Otherwise the architect writes a thin wrapper | API module **$1,650/year**; folios $0.50 (1–10k), $0.45 (10–50k), $0.40 (>50k), IVA included ([facturama.mx](https://facturama.mx/api-facturacion-electronica)) | Tier 3 |
| **Alegra** (MX) | When they already use it, or want accounting too | **OFFICIAL MCP** launched 2026-06-08, one-click authorisation (no API key). Covers CFDI, RFC status, sales reports, balances. After connecting, list its tools to see write scope and plan gating; keep it read-only | Read Alegra's current plans live (alegra.com) before quoting | Tier 1 |
| **Bind ERP** | Existing users | COMMUNITY `@codespar/mcp-bind-erp` or **Zapier MCP** | — | Tier 3 / Tier 4 |
| **CONTPAQi** | Existing users only | **No MCP, no public cloud API.** Windows/.NET desktop SDK only. Railway cannot host it | — | Local Windows bridge, file exports (XML/Excel), or say plainly it is not supported |
| **SAT portal** | Never directly | — | — | Go through a PAC/SaaS |

Do not route a third party's **remote** Facturapi MCP (for example one that takes your key in a header) to a production key. The `codespar/mcp-dev-latam` catalog marks about a third of its servers "alpha"; check the specific server is not alpha and pin it ([codespar](https://github.com/codespar/mcp-dev-latam)).

**Guardrails the Architect must build in:**
- **Stamping (timbrar) and cancelling a CFDI is irreversible and has legal effect.** Always show a preview (receptor RFC, uso CFDI, régimen, totals) and wait for an explicit "sí" in the same turn (`knowledge/security-checklist.md`, human approval). Cancellation requires a SAT reason code and may require the receiver's acceptance (check the current SAT rules at https://www.sat.gob.mx before cancelling).
- Start in **test mode**; switch to live keys only after the person has approved a test invoice.
- Treat output as "drafts that your accountant reviews" (codespar README, via [skillselion](https://skillselion.com/mcp/tool/io.github.codespar/mcp-facturapi)).
- **Never** let the agent handle the **CSD or e.firma** files or passwords. The person uploads the CSD to Facturapi/Facturama themselves in the vendor's dashboard.
- Fiscal-calendar reminders (e.g. monthly declarations "by the 17th") depend on the regime: phrase them as "confírmalo con tu contador".

## CRM & commerce

| Tool | Status in MX | Tier |
|---|---|---|
| **HubSpot** | OFFICIAL remote MCP, GA 2026-04-13, `https://mcp.hubspot.com`, OAuth 2.1 + PKCE ([changelog](https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available)) | 1 |
| **Pipedrive** | OFFICIAL MCP launched 2026-06-30, all plans, OAuth; `stack-researcher` reads the endpoint from Pipedrive's docs at install ([newsroom](https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants)) | 1 |
| **Kommo** (WhatsApp-native CRM, very common in MX) | No official MCP found (`stack-researcher` checks again at install); community `cAIborg-ai/amocrm-mcp` and others | 2 |
| **Mercado Libre** | OFFICIAL remote MCP `https://mcp.mercadolibre.com/mcp`, OAuth bearer token; list its tools after connecting and plan only on what appears ([GitHub](https://github.com/mercadolibre/mercadolibre-mcp-server), [docs](https://developers.mercadolibre.com.mx/en_us/mcp-server)) | 1 |
| **Mercado Pago** | OFFICIAL MCP, but the official overview lists **developer tools only**; use payment tools only if its tool list shows them after connecting | 1 (dev scope) |
| **Stripe** | OFFICIAL `https://mcp.stripe.com` (OAuth or Agent API keys). **From 2026-10-31 full secret keys and non-Agent restricted keys get 401.** Refunds and payouts require Stripe's human approval URL ([docs.stripe.com/mcp](https://docs.stripe.com/mcp)). Pairs with Facturapi's Stripe-to-CFDI plan | 1 |
| **Shopify** | Official Dev/Storefront MCPs; **Admin (orders, inventory) is community only** | 2 |
| Conekta, Openpay, Clip, STP/SPEI | Community only via codespar, many alpha | 3 |
| Tiendanube, Soft Restaurant, Parrot POS | No MCP; Zapier MCP fallback | 4 |

Irreversible actions (always human approval): CFDI stamp/cancel, refunds, payouts, outbound marketing templates, CRM deletes, Mercado Libre price changes.

## Data-protection law

**Law.** New **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)**, published in the DOF on **2025-03-20**, in force 2025-03-21, repealing the 2010 law. **INAI was dissolved**; enforcement moved to the **Secretaría Anticorrupción y Buen Gobierno**. "Responsible party" now covers anyone who processes data, processors included; a simplified privacy notice is required for data collected electronically; transfers (Arts. 36–37) must appear in the privacy notice and need consent unless an exception applies; processors must keep data confidential after the relationship ends ([EY](https://www.ey.com/es_mx/technical/tax/boletines-fiscales/nueva-ley-federal-proteccion-datos-personal-posesion-particulares), [Hogan Lovells](https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies)).

**What the Architect must warn (and do):**
1. **Personal-only Jarvis:** probably outside scope; the 2025 law's domestic-use exclusion is not spelled out in the sources here. Say "para uso personal no necesitas nada extra" only as a likely reading, not a legal opinion.
2. **Touches customers' data** (CRM, WhatsApp leads, CFDIs with RFCs): the business needs an **aviso de privacidad** that names the LLM provider, the BSP and Railway as processors, the US transfer and the purposes. Generate a draft from the template, marked "revísalo con un abogado".
3. **Data minimisation:** no RFC, CURP, card data or e.firma material in long-term memory; redact before embedding.
4. **AI disclosure** ("Soy un asistente con IA de <negocio>") in the first message of any customer-facing channel: not a Mexican legal requirement verified here, but good practice and required in the EU.
5. Record processors in `compliance.md` in the Jarvis folder.

## Voice accent defaults

| Tier | STT | TTS | Notes |
|---|---|---|---|
| Premium (default for voice Jarvis) | Deepgram Nova-3 multilingual (handles Spanglish) | **ElevenLabs** Flash v2.5 or v4 Turbo, a **Mexican-accent** library voice | Multilingual v2 lists "Spanish (Spain, Mexico)" ([ElevenLabs models](https://elevenlabs.io/docs/overview/models)) |
| Budget cloud | Deepgram Nova-3 | Deepgram Aura-2 Spanish voice (one of the ten covers Mexican; which one is not documented: let the person listen) | ([Deepgram TTS](https://developers.deepgram.com/docs/tts-models-languages-overview)) |
| Fully local | whisper.cpp (`medium`/`large`) | **Piper `es_MX-claude-high`** (or `es_MX-ald-medium`) | Robotic but intelligible; check each voice's model-card licence ([HF piper-voices es_MX](https://huggingface.co/rhasspy/piper-voices/tree/293cad0539066f86e6bce3b9780c472cc9157489/es/es_MX)) |
| Avoid | — | Kokoro | No Mexican accent, weak Spanish |

Text register: Mexican Spanish, **tú**, neutral vocabulary; dates `DD/MM/AAAA`; money `$1,234.50 MXN` (say "MXN" whenever USD prices are also on screen, because both use `$`).

## Timezones & currency

| Zone (IANA) | Where | Notes |
|---|---|---|
| `America/Mexico_City` | Most of the country (CDMX, Jalisco, Nuevo León…) | **Default.** UTC−6, no DST since the 2022 reform |
| `America/Cancun` | Quintana Roo | UTC−5, no DST |
| `America/Hermosillo` | Sonora | UTC−7, no DST |
| `America/Mazatlan` | Sinaloa, Nayarit (most), BCS | UTC−7, no DST |
| `America/Tijuana` | Baja California | Follows US DST (UTC−8/−7) |
| `America/Ciudad_Juarez`, `America/Matamoros`, `America/Ojinaga` | Northern border municipalities | Follow US DST |

Ask the city once and write the IANA zone into the scheduler config; never assume `America/Mexico_City` for Cancún, Sonora or the border. Off-minute crons (e.g. 07:03) per `knowledge/capabilities/scheduling.md`. Zone rules: [IANA tz database](https://www.iana.org/time-zones). The 2022 DST abolition and the border exception are handled by the tz database; trust the tz database shipped with the OS.

**Currency:** MXN (peso). LLM, Railway and most SaaS bill in **USD**: always show both ("~$9 USD ≈ $X MXN", using a live rate from `stack-researcher`, never a remembered one). Card charges in USD may carry a bank FX fee.

## Sources

- https://infobip.com/blog/whatsapp-statistics
- https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (re-fetched 2026-10-06)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers
- https://www.flowcall.co/blog/whatsapp-business-api-pricing (re-fetched 2026-10-06)
- https://respond.io/blog/whatsapp-pricing-change-2026.md
- https://www.ycloud.com/blog/whatsapp-api-businesses-latin-america
- https://www.contxto.com/en/news/meta-chooses-leadsales-as-whatsapp-solution-partner-for-latin-america/
- https://facturapi.io/pricing
- https://facturama.mx/api-facturacion-electronica
- https://siemprealdia.co/mexico/fiscal/anexo-20-sat-cfdi-4-0/
- https://skillselion.com/mcp/tool/io.github.codespar/mcp-facturapi
- https://github.com/codespar/mcp-dev-latam
- https://www.prnewswire.com/mx/comunicados-de-prensa/alegra-revoluciona-la-gestion-contable-en-mexico-contadores-y-empresarios-ya-pueden-consultar-sus-finanzas-en-tiempo-real-usando-su-ia-favorita-302794164.html
- https://developer.alegra.com/llms.txt
- https://feed.nuget.org/packages/ARSoftware.Contpaqi.Comercial.Sdk.Extras
- https://zapier.com/mcp/bind-erp
- https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- https://github.com/mercadolibre/mercadolibre-mcp-server
- https://developers.mercadolibre.com.mx/en_us/mcp-server
- https://docs.stripe.com/mcp
- https://www.ey.com/es_mx/technical/tax/boletines-fiscales/nueva-ley-federal-proteccion-datos-personal-posesion-particulares
- https://www.hoganlovells.com/es/publications/mexicos-new-federal-data-protection-law-what-it-means-for-companies
- https://elevenlabs.io/docs/overview/models
- https://developers.deepgram.com/docs/tts-models-languages-overview
- https://huggingface.co/rhasspy/piper-voices/tree/293cad0539066f86e6bce3b9780c472cc9157489/es/es_MX
- https://www.iana.org/time-zones
