# Country: Spain (es)

> What changes for a Jarvis built for someone in Spain: WhatsApp first and, unusually, covered by EU interim measures against Meta's AI-chatbot ban; invoices must come from a Verifactu-ready system (TicketBAI in the Basque Country); GDPR applies to any business use and AI Act Art. 50 requires telling people they are talking to an AI.

Last verified: 2026-10-06

No versions are pinned here. Runtimes: `knowledge/runtimes/<id>.md`. Models: `knowledge/models.json`. WhatsApp mechanics and policy: `knowledge/capabilities/whatsapp.md`. Voice engines: `knowledge/capabilities/voice.md`. Tool trust tiers: `knowledge/capabilities/tools-mcp.md`.

## Channels reality

- WhatsApp is the dominant messaging app in Spain; ask the person which apps they and their clients use. Telegram is common among tech users. Same defaults as LATAM:

| Use | Channel | Why |
|---|---|---|
| Personal Jarvis, wants zero risk | **Telegram** | Free, official bot API, no ban risk |
| Personal Jarvis, insists on WhatsApp | **WhatsApp Cloud API** on a **new number** | Lower risk than in LATAM thanks to the EU interim measures (below), but the exception is under appeal |
| Business answering its own customers | **WhatsApp Cloud API** or a BSP | Allowed. **AI disclosure is mandatory** (AI Act Art. 50) |
| Wants WhatsApp without a Meta account | Baileys only after the consent gate in `knowledge/capabilities/whatsapp.md`, **secondary SIM** | Breaks WhatsApp ToS whatever the EU decided; number can be banned |

- BSPs: Twilio, Gupshup, Infobip, respond.io, Wati and others serve Spain; check EU data residency and a GDPR DPA before choosing one.

## WhatsApp rates & policy notes

**Policy: the EU exception.** On **2026-06-09** the European Commission adopted interim measures ordering Meta to give rival general-purpose AI assistants free access to the WhatsApp Business API across the EEA, pending its antitrust investigation ([Houthoff](https://www.houthoff.com/insights/news/a-rare-show-offorce-commission-deploys-interim-measures-against-meta-to-safeguard-ai-competition/), [AP via NY1](https://ny1.com/nyc/all-boroughs/ap-top-news/2026/06/09/eu-orders-meta-to-restore-whatsapp-access-for-rival-ai-chatbots)). Meta filed its appeal at the General Court in August 2026 ([Slaughter and May](https://www.slaughterandmay.com/recent-work/meta-on-its-appeal-against-the-european-commission-s-whatsapp-interim-measures-decision/)). Meta's AI-providers page lists EEA countries, Spain included, as charged for AI-provider non-template messages 2026-03-11 → 2026-05-12 and **not charged from 2026-05-13** ([Meta AI-providers pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers)).

What the Architect says: "En España (UE), por ahora Meta está obligada a dejar entrar asistentes de IA en WhatsApp. Meta apeló, así que puede cambiar." A personal Jarvis on the Cloud API is therefore **much less grey** for +34 numbers than in LATAM, but the person must still never **offer** "Jarvis on WhatsApp" as a product (see `knowledge/capabilities/whatsapp.md`). Have `stack-researcher` re-check the appeal before quoting.

**Template rates (USD per delivered template, Meta platform fee, before BSP markup and VAT):**

| Category | Rate |
|---|---|
| Marketing | **$0.0707** |
| Utility / Authentication | **$0.02** (utility free inside an open 24 h window; authentication figure from the [flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing) table as checked 2026-09-28; `stack-researcher` re-checks it live on Meta's pricing page before quoting) |

Source: [flowcall rate table](https://www.flowcall.co/blog/whatsapp-business-api-pricing) (secondary, mirrors Meta's rate card; re-fetched 2026-10-06). Authoritative: Meta's rate card download on the [pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).

**Service messages: sources disagree; `stack-researcher` re-checks Meta's pricing page live before quoting.** Meta's official doc (re-fetched 2026-10-06) says non-template messages and in-window utility templates are free; flowcall and [respond.io](https://respond.io/blog/whatsapp-pricing-change-2026.md) say service messages are charged from 2026-10-01 after 1,000 free per number per month. Official doc wins; a personal Jarvis stays far under 1,000 either way.

**What a personal Jarvis costs on WhatsApp in Spain.** Replies: $0. A daily briefing sent first by Jarvis: 30 × $0.02 ≈ **$0.60 USD/month** as utility, 30 × $0.0707 ≈ $2.12 as marketing.

**Billing currency.** Meta publishes EUR rate cards (rates and volume tiers) alongside USD, so a Spanish business can be billed in euros ([Meta pricing doc](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), re-fetched 2026-10-06). The USD figures above are what the Architect quotes; the EUR card has its own numbers.

## Fiscal / invoicing tools

**Verifactu** (anti-fraud invoicing-software regulation, Real Decreto 1007/2023) was postponed again by **Real Decreto-ley 15/2025** of 2 December (BOE 2025-12-03): invoicing systems must be adapted by **2027-01-01** for corporate-tax (Impuesto sobre Sociedades) payers and by **2027-07-01** for everyone else in scope (autónomos in IRPF, non-residents with a permanent establishment, entities under income attribution) ([Legal Today](https://www.legaltoday.com/actualidad-juridica/noticias-de-derecho/nueva-prorroga-verifactu-no-sera-obligatorio-hasta-2027-para-sociedades-y-otros-contribuyentes-2025-12-04/), [Maldita](https://maldita.es/malditobulo/20251203/hacienda-retrasa-a-2027-la-entrada-en-vigor-de-verifactu-el-sistema-de-verificacion-de-facturas-para-pymes-y-autonomos)). No further postponement found as of 2026-10-06. RDL 15/2025 amends the fourth final provision of RD 1007/2023 of 5 December, the Verifactu regulation ([notariosyregistradores](https://www.notariosyregistradores.com/web/participa/noticias/prorrogado-el-sistema-verifactu-hasta-el-1-de-julio-de-2027/), [EDICOM](https://edicomgroup.com/blog/spain-computerized-invoicing-system-verifactu)).

**Regional systems:**
- **País Vasco: TicketBAI** (Álava, Bizkaia, Gipuzkoa) is already mandatory; Bizkaia runs it inside **Batuz** with a phased calendar 2024–2026. TicketBAI applies there instead of Verifactu ([guiafiscal](https://guiafiscal.es/iva/ticketbai-pais-vasco-2026/), [billin](https://www.billin.net/blog/bizkaia-amplia-plazo-batuz), [frihet docs](https://docs.frihet.io/en/cumplimiento/ticketbai-pais-vasco), secondary).
- **Navarra** has its own system, outside TicketBAI (secondary source; `stack-researcher` checks Hacienda Foral de Navarra's site before giving details).
- Large companies on **SII** (immediate VAT ledger reporting) are exempt from Verifactu (`stack-researcher` confirms on https://sede.agenciatributaria.gob.es before saying so).
- Mandatory B2B e-invoicing under the "Ley Crea y Crece": implementing-regulation status changes; have `stack-researcher` check before mentioning dates.

**Rule for the Architect:** Jarvis must **never generate legally valid invoices itself** (a PDF Jarvis writes is not a Verifactu/TicketBAI-compliant invoicing system). It drafts the data and pushes it into the person's compliant invoicing software, which registers and sends the record.

| Tool | Default? | Integration | Trust tier |
|---|---|---|---|
| **Alegra** (ES) | Default if they want invoicing + accounting from zero and the MCP covers Spain | OFFICIAL Alegra MCP; confirm Spain coverage and Verifactu/TicketBAI certification in Alegra's docs at install ([developer.alegra.com/llms.txt](https://developer.alegra.com/llms.txt)) | 1 if confirmed |
| **Holded**, Quipu, Billin, Sage, A3 and other Spanish invoicing SaaS | **Default when they already use one** (most autónomos do, or have a gestoría) | `stack-researcher` checks each for an MCP at install; otherwise a wrapper the architect writes over their REST API (Holded has one; read its scope in Holded's API docs) or Zapier MCP | 3–4 |
| AEAT / Diputación forales directly | Never from the agent | — | — |

**Guardrails:** issuing an invoice is **irreversible** (under Verifactu/TicketBAI the record is chained and sent; corrections need a corrective invoice, *factura rectificativa*). Preview (NIF, IVA, IRPF retention, totals) and wait for an explicit "sí". Never store the digital certificate (FNMT or similar) or Cl@ve credentials in the workspace or memory. Tax calendar reminders (modelo 303/130 quarterly) phrased as "confírmalo con tu gestoría".

## CRM & commerce

| Tool | Status | Tier |
|---|---|---|
| **HubSpot** | OFFICIAL remote MCP `https://mcp.hubspot.com`, OAuth 2.1; check EU data-centre account support in HubSpot's docs at install ([changelog](https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available)) | 1 |
| **Pipedrive** | OFFICIAL MCP, OAuth; `stack-researcher` reads the endpoint from Pipedrive's docs at install ([newsroom](https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants)) | 1 |
| **Stripe** | OFFICIAL `https://mcp.stripe.com` (OAuth or Agent API keys; **full secret keys get 401 from 2026-10-31**); refunds/payouts need Stripe's human approval ([docs.stripe.com/mcp](https://docs.stripe.com/mcp)) | 1 |
| **Shopify** | Official Dev/Storefront MCPs; Admin community only | 2 |
| **Kommo** | Community MCPs only | 2 |
| Bizum, Redsys, Amazon Seller | No official MCP listed (`stack-researcher` checks at install); Zapier fallback or nothing | 4 |

Mercado Libre and Mercado Pago do not operate in Spain. Irreversible actions (always human approval): invoices, refunds, payouts, outbound marketing templates, CRM deletes.

## Data-protection law

**GDPR + LOPDGDD (Ley Orgánica 3/2018)**, supervised by the **AEPD**. Purely personal or household use is exempt (GDPR Art. 2(2)(c)); **any business use is not**.

**EU AI Act Article 50 (transparency) has applied since 2026-08-02**: a system that interacts with people must tell them they are dealing with an AI (at the latest at the first interaction), and synthetic audio must be marked as AI-generated. The Digital Omnibus delayed the high-risk rules to 2027-12-02 but **not Art. 50**, apart from a marking grace period until 2026-12-02 for systems already on the market ([Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html), [Ropes & Gray](https://www.ropesgray.com/en/insights/viewpoints/2026/08/102nfqm/you-talkin-to-me-operationalising-the-eu-ai-acts-transparency-obligations)). Spain's AI supervisory authority is AESIA (check https://aesia.digital.gob.es for its role in Art. 50 enforcement).

**What the Architect must enforce (not just warn):**
1. **Customer-facing channel:** the first message must say it is an AI, e.g. "Hola, soy el asistente con IA de <negocio>." This is a hard requirement in Spain; `jarvis-validator` should check the SOUL/AGENTS greeting.
2. **Voice that talks to third parties** (calls, voice notes to customers): disclose AI and keep the audio marked as synthetic.
3. **Business data to US LLM providers:** sign the provider's **DPA** with **SCCs**; prefer EU data residency where offered; list LLM, BSP and Railway (pick an EU region where possible; list Railway's current regions with the Railway CLI or docs) as processors in the **registro de actividades** and the privacy notice. Draft from template, "revísalo con un abogado".
4. **Personal-only Jarvis:** household exemption; say so, and note that once it handles clients' data GDPR applies.
5. Minimise: no DNI/NIE, health or card data in long-term memory; redact before embedding. Record processors in `compliance.md`.

## Voice accent defaults

| Tier | STT | TTS | Notes |
|---|---|---|---|
| Premium | Deepgram Nova-3 multilingual | **ElevenLabs** Multilingual v2 / Flash v2.5 / v4 Turbo with a **Peninsular (castellano)** voice; Multilingual v2 lists "Spanish (Spain, Mexico)" ([ElevenLabs models](https://elevenlabs.io/docs/overview/models)) | A LatAm accent sounds foreign to Spanish users |
| Budget cloud | Deepgram Nova-3 | Deepgram Aura-2: one of the ten Spanish voices is Peninsular; which one is undocumented ([Deepgram TTS](https://developers.deepgram.com/docs/tts-models-languages-overview)) | Play samples |
| Fully local | whisper.cpp (`medium`/`large`) | Piper `es_ES` voices (in the piper-voices repo; read each voice's model card for name and licence before installing) | |
| Avoid | — | Kokoro | Weak Spanish |

Any synthetic voice sent to third parties is "synthetic audio" under Art. 50: keep the disclosure. Text register: Peninsular Spanish, **tú**, **vosotros** for plural, vocabulary "ordenador", "móvil"; Catalan, Basque or Galician if the person writes in them. Money `1.234,50 €`.

## Timezones & currency

| Zone (IANA) | Where | Offset |
|---|---|---|
| `Europe/Madrid` | Peninsula and Balearic Islands | CET/CEST (UTC+1, UTC+2 in summer) — **default** |
| `Africa/Ceuta` | Ceuta and Melilla | Same clock as Madrid |
| `Atlantic/Canary` | Canary Islands | WET/WEST (UTC+0/+1), one hour behind Madrid |

Spain observes EU daylight saving (last Sunday of March / October). Always store crons with the IANA zone, never a fixed offset, so briefings don't shift an hour twice a year ([IANA tz database](https://www.iana.org/time-zones)). Ask whether they are in Canarias.

**Currency:** EUR. LLM and Railway bill in USD; show "≈ X €" using a live rate from `stack-researcher`. EU VAT may be added to USD SaaS invoices for Spanish customers (reverse charge for businesses with a VAT number; check each vendor's first invoice).

## Sources

- https://www.houthoff.com/insights/news/a-rare-show-offorce-commission-deploys-interim-measures-against-meta-to-safeguard-ai-competition/
- https://ny1.com/nyc/all-boroughs/ap-top-news/2026/06/09/eu-orders-meta-to-restore-whatsapp-access-for-rival-ai-chatbots
- https://www.slaughterandmay.com/recent-work/meta-on-its-appeal-against-the-european-commission-s-whatsapp-interim-measures-decision/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (re-fetched 2026-10-06)
- https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- https://www.flowcall.co/blog/whatsapp-business-api-pricing (re-fetched 2026-10-06)
- https://respond.io/blog/whatsapp-pricing-change-2026.md
- https://www.legaltoday.com/actualidad-juridica/noticias-de-derecho/nueva-prorroga-verifactu-no-sera-obligatorio-hasta-2027-para-sociedades-y-otros-contribuyentes-2025-12-04/
- https://www.notariosyregistradores.com/web/participa/noticias/prorrogado-el-sistema-verifactu-hasta-el-1-de-julio-de-2027/
- https://edicomgroup.com/blog/spain-computerized-invoicing-system-verifactu
- https://maldita.es/malditobulo/20251203/hacienda-retrasa-a-2027-la-entrada-en-vigor-de-verifactu-el-sistema-de-verificacion-de-facturas-para-pymes-y-autonomos
- https://guiafiscal.es/iva/ticketbai-pais-vasco-2026/
- https://www.billin.net/blog/bizkaia-amplia-plazo-batuz
- https://docs.frihet.io/en/cumplimiento/ticketbai-pais-vasco
- https://developer.alegra.com/llms.txt
- https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- https://docs.stripe.com/mcp
- https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html
- https://www.ropesgray.com/en/insights/viewpoints/2026/08/102nfqm/you-talkin-to-me-operationalising-the-eu-ai-acts-transparency-obligations
- https://elevenlabs.io/docs/overview/models
- https://developers.deepgram.com/docs/tts-models-languages-overview
- https://www.iana.org/time-zones
