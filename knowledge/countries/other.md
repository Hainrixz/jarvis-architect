# Country: other (US, rest of Latin America, anywhere else)

> Generic rules for a person outside Mexico, Colombia, Argentina and Spain: safe defaults that hold anywhere, the few regional facts already verified, and a research checklist the Architect runs before it recommends any local tool, price or legal claim.

Last verified: 2026-10-06

No versions are pinned here. Runtimes: `knowledge/runtimes/<id>.md`. Models: `knowledge/models.json`. WhatsApp: `knowledge/capabilities/whatsapp.md`. Voice: `knowledge/capabilities/voice.md`. Tools: `knowledge/capabilities/tools-mcp.md`. Dedicated packs: `knowledge/countries/mx.md`, `knowledge/countries/co.md`, `knowledge/countries/ar.md`, `knowledge/countries/es.md`.

## How to research a country not covered here

Run this before DEEP DIVE ends; dispatch `stack-researcher` with the list. Anything not confirmed by a primary source goes into the spec as `UNVERIFIED` and is never quoted as fact.

1. **Channel:** which messenger dominates (WhatsApp, Telegram, iMessage/SMS, LINE, KakaoTalk…). Source: a recent usage report plus the person's own answer ("¿Por dónde te escribe la gente?"). The person's answer wins.
2. **WhatsApp:** the country's row in Meta's current rate card ([pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)); whether it appears on Meta's [AI-providers page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) as a regulator exception; local billing currency.
3. **Invoicing:** is e-invoicing mandatory, who runs it (tax authority), does it go through an authorised provider (PAC/PSE/OSE-style), which SaaS the person already uses, and whether that SaaS has an official MCP, a REST API, or only Zapier.
4. **Payments and commerce:** dominant wallet/gateway; is Stripe available for businesses there ([stripe.com/global](https://stripe.com/global)); is Mercado Libre/Mercado Pago present.
5. **Data protection:** the law's name and regulator, international-transfer rules (the LLM is usually in the US), any AI-specific transparency rule, any database registration duty. Find a primary source (official gazette or regulator) or a law-firm summary; never rely on memory.
6. **Timezone(s)** (IANA names) and **currency**.
7. **Voice:** which accent the person wants; check ElevenLabs/Deepgram/Piper voice lists for it.

Write findings into the Jarvis's `compliance.md` with URLs, and suggest a PR adding a country pack (see `CONTRIBUTING.md`).

## Channels reality

**Default rules anywhere:**

| Use | Channel |
|---|---|
| Personal Jarvis, zero policy risk | **Telegram** (free, official bot API, works in nearly every country) |
| Developer / Claude Code user | Terminal or the Claude app (Remote Control), see `knowledge/capabilities/channels.md` |
| WhatsApp-dominant country (most of LatAm) | WhatsApp **Cloud API** on a new number; Baileys only after the consent gate, secondary SIM |
| Business answering its own customers | WhatsApp Cloud API / BSP, or the channel the customers already use |
| US | iMessage/SMS dominate; WhatsApp is common among Spanish-speaking and immigrant communities. SMS bots need A2P 10DLC registration through a provider such as Twilio (`stack-researcher` checks current process and fees on Twilio's docs). Telegram is the easy personal default |

For WhatsApp usage beyond MX/CO/AR, ask the person.

## WhatsApp rates & policy notes

**Policy.** Meta's AI-provider clause applies in full **everywhere except** Italy (+39, AGCM), Brazil (+55, CADE) and the EEA (European Commission interim measures 2026-06-09, under appeal). Details and classes: `knowledge/capabilities/whatsapp.md`. US, Chile, Peru and the rest of LatAm have **no exception**.

**Template rates (USD per delivered template, Meta platform fee, before BSP markup and taxes)** from [flowcall](https://www.flowcall.co/blog/whatsapp-business-api-pricing) (secondary, mirrors Meta's rate card, re-fetched 2026-10-06):

| Market | Marketing | Utility |
|---|---|---|
| North America (US, Canada) | $0.025 | $0.0034 |
| Chile | $0.0889 | $0.02 |
| Peru | $0.0703 | $0.03 |
| Brazil | $0.0625 | $0.0068 |
| Rest of Latin America (e.g. Ecuador, Central America, Venezuela, Bolivia, Uruguay, Paraguay; exact membership: read Meta's rate card) | $0.074 | $0.0113 |

Authentication rates and the "Rest of" groupings: read Meta's rate card. Utility templates inside an open 24 h window are free (Meta doc). **Service messages, sources disagree (`stack-researcher` re-checks Meta's pricing page live before quoting):** Meta's official doc (re-fetched 2026-10-06) says non-template messages are free; flowcall/respond.io say they are charged from 2026-10-01 after 1,000 free per number per month. Official doc wins; personal volume is under 1,000 anyway.

**Brazil note:** Meta charges AI providers for non-template messages to Brazilian users from 2026-03-11 ([Meta AI-providers pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers)); check whether that applies to the person's setup.

**Billing currencies** confirmed in Meta's doc (2026-10-06): ARS, CLP, COP, PEN and others from 2026-04-01; BRL from 2026-07-01. USD otherwise.

**Rule of thumb for the cost quote:** 30 proactive briefings/month × the country's utility rate; replies ≈ $0.

## Fiscal / invoicing tools

Generic rules:
- **Never** let Jarvis issue tax documents itself. It drafts; the person's invoicing system (or authorised provider) issues. Issuing, cancelling and correcting tax documents is **irreversible** and always needs human approval in the same turn.
- **Never** store tax certificates, e-signature files or tax-portal passwords in the workspace, memory or chat.
- Integration preference: official MCP (OAuth) > maintained community MCP pinned to a version, read-only first > thin wrapper the architect writes itself > Zapier MCP.
- `codespar/mcp-dev-latam` lists 104+ community servers across BR, MX, AR, CO, CL, PE; about a third are **alpha**. Use it as a catalogue, not a recommendation ([codespar](https://github.com/codespar/mcp-dev-latam)).
- **Alegra** has an official MCP and operates in several LatAm countries (CR, PA and others); confirm per-country MCP coverage in Alegra's docs at install ([developer.alegra.com/llms.txt](https://developer.alegra.com/llms.txt)).

Known tax authorities to research (names only; `stack-researcher` fetches current e-invoicing rules): Chile **SII**, Peru **SUNAT**, Ecuador **SRI**, Brazil **Receita Federal / NF-e** (state SEFAZ), Uruguay **DGI**, Guatemala **SAT**, Costa Rica **Hacienda**. **US:** no national e-invoicing mandate; invoices come from Stripe, QuickBooks or similar, and sales tax is state-level, so suggest the person's accountant for anything tax-related.

## CRM & commerce

Works in most countries (official MCPs, tier 1): **HubSpot** (`https://mcp.hubspot.com`, OAuth 2.1), **Pipedrive** (OAuth; `stack-researcher` reads the endpoint from Pipedrive's docs at install), **Stripe** where Stripe operates (`https://mcp.stripe.com`; full secret keys get 401 from 2026-10-31; human approval for refunds/payouts) ([HubSpot](https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available), [Pipedrive](https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants), [Stripe](https://docs.stripe.com/mcp)).

LatAm: **Mercado Libre** official MCP and **Mercado Pago** official MCP (developer scope only per the official overview) where they operate ([Mercado Libre](https://github.com/mercadolibre/mercadolibre-mcp-server), [Mercado Pago](https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview)). **Kommo** for WhatsApp-centric sales teams (community MCPs). Local gateways: research per country, assume no MCP until proven.

Irreversible actions (always human approval): tax documents, refunds, payouts, outbound marketing templates, CRM deletes, marketplace price changes.

## Data-protection law

Generic obligations to warn about anywhere:
1. **Personal-only vs. third parties.** Most laws bite when Jarvis processes other people's data (clients, leads, patients, students).
2. **International transfer.** The LLM provider is usually in the US: sign the provider's DPA, name LLM, BSP and host as processors in a privacy notice, draft marked "revísalo con un abogado".
3. **AI disclosure** in the first message of any customer-facing channel. Mandatory in the EU/EEA (AI Act Art. 50 since 2026-08-02, see `knowledge/countries/es.md`); good practice everywhere else.
4. **Minimise:** no national ID numbers, card, health or minors' data in long-term memory; redact before embedding.
5. Record processors in `compliance.md`.

Known laws (names for `stack-researcher` to confirm; it fetches current obligations): Brazil **LGPD** (ANPD), Chile **Ley 19.628** and its 2024 reform (new agency, phased in), Peru **Ley 29733**, Ecuador **LOPDP**, Uruguay **Ley 18.331**, US: no general federal privacy law; state laws such as California's **CCPA/CPRA**, plus HIPAA for health data. Italy (+39) and other EU countries: GDPR + AI Act as in Spain.

## Voice accent defaults

Ask which accent they want; play 2–3 samples (`knowledge/capabilities/voice.md`).

| Person | Default |
|---|---|
| Spanish speaker, accent not covered by a pack | ElevenLabs voice matching their country if the library has one; else a neutral LatAm voice (v4 Turbo "Spanish, LatAm") ([ElevenLabs models](https://elevenlabs.io/docs/overview/models)) |
| US Spanish speaker | Ask: Mexican, Caribbean or neutral; Deepgram Nova-3 multilingual for STT handles Spanglish ([Deepgram](https://deepgram.com/learn/nova-3-multilingual-major-wer-improvements-across-languages)) |
| English speaker | Any engine; Kokoro is acceptable for a free local English voice |
| Portuguese (Brazil) | Check pt-BR voices per engine and let the person listen |
| Fully local | whisper.cpp + Piper voice for their locale if one exists |

Text register: mirror the person. Neutral LatAm **tú** by default; **vos** if they write with voseo (Uruguay, Paraguay, Central America and Argentina); **usted** for customer-facing bots where it is the norm.

## Timezones & currency

- Always ask the city and store the **IANA zone** (e.g. `America/Santiago`, `America/Lima`, `America/Guayaquil`, `America/New_York`, `America/Los_Angeles`, `America/Sao_Paulo`), never a fixed offset. Countries with DST (US, Chile, EU; Paraguay dropped DST in 2024 for permanent UTC−3 ([timeanddate](https://timeanddate.com/news/time/paraguay-abolish-dst-2024.html)), so trust the OS tz database rather than memory) shift briefings twice a year otherwise ([IANA tz database](https://www.iana.org/time-zones)). Multi-zone countries (US, Brazil, Chile, Ecuador with Galápagos) need the city.
- **Currency:** quote in USD (what LLM providers and Railway bill) plus the local currency at a live rate from `stack-researcher`. In high-inflation economies, USD first.

## Sources

- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (re-fetched 2026-10-06)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers
- https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform
- https://www.flowcall.co/blog/whatsapp-business-api-pricing (re-fetched 2026-10-06)
- https://respond.io/blog/whatsapp-pricing-change-2026.md
- https://github.com/codespar/mcp-dev-latam
- https://developer.alegra.com/llms.txt
- https://developers.hubspot.com/changelog/remote-hubspot-mcp-server-is-now-generally-available
- https://www.pipedrive.com/en/newsroom/pipedrive-launches-native-mcp-server-bringing-crm-workflows-directly-into-ai-assistants
- https://docs.stripe.com/mcp
- https://stripe.com/global
- https://github.com/mercadolibre/mercadolibre-mcp-server
- https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview
- https://elevenlabs.io/docs/overview/models
- https://deepgram.com/learn/nova-3-multilingual-major-wer-improvements-across-languages
- https://timeanddate.com/news/time/paraguay-abolish-dst-2024.html
- https://www.iana.org/time-zones
