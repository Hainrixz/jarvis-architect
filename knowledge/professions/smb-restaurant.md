# Profession: Small business / restaurant owner

> Pack for owners of restaurants, cafés, food trucks and small physical shops (fondas, cafeterías, tiendas, talleres): end-of-day numbers, supplier reorders, review replies and customer questions — read-only on the POS, every price, order, invoice and public reply behind the owner's yes.

Last verified: 2026-10-06

No versions or prices live here. Runtimes and security floors: `knowledge/runtimes/*.md`. Model
slots: `knowledge/models.json`. Costs: `knowledge/capabilities/costs.md`. Fiscal tools, WhatsApp
rates and data law per country: `knowledge/countries/<cc>.md`.

## Signals

- "Tengo un restaurante / una cafetería / una fonda / un food truck / una tienda / un local".
- "Punto de venta", "POS", "Parrot", "Soft Restaurant", "Loyverse", "cierre de caja", "corte",
  "proveedores", "inventario", "merma", "Rappi / DiDi Food / Uber Eats", "reseñas de Google",
  "reservaciones", "autofactura", "mis meseros / empleados".
- "Al final del día no sé cuánto gané", "se me acaba el producto y no me doy cuenta",
  "no contesto las reseñas".

Anti-signal: online-only sellers (Mercado Libre, Shopify) fit `ecommerce`; a multi-branch company
with a management team fits `founder` with this pack as secondary.

## Week-one jobs

| # | Job (as they say it) | Becomes |
|---|---|---|
| 1 | "Al cerrar, mándame cuánto vendí, ticket promedio, lo que más y lo que menos se vendió, y cómo voy contra la semana pasada." | `daily-sales-digest` scheduled |
| 2 | "Avísame cuando algo se esté acabando y prepárame el pedido para el proveedor." | `reorder-check` (draft order only) |
| 3 | "Prepárame respuestas a las reseñas de Google con mi tono; yo las apruebo." | `review-reply-draft` |
| 4 | "Cada lunes dime cuánto me depositaron Rappi, DiDi y Uber Eats y cuánto me cobraron de comisión." | `delivery-payout-check` from emailed statements/exports |
| 5 | "Que los clientes puedan preguntar horario, menú y reservar por WhatsApp." | Later stage: WhatsApp Cloud API business bot (below) |

## Channels

| Use | Channel | Why |
|---|---|---|
| Owner ↔ Jarvis | **Telegram** (default), owner-only allowlist (`SEC-01`); voice notes in (owners talk while working) | Free, phone-first, no policy risk |
| Staff | Not in week one. If added later: a separate Telegram group, mention-gated, read-only tools (`SEC-02`) — staff never get owner tools | Avoids a cook approving a price change |
| Customers (later) | **WhatsApp Cloud API** on the business number (or a BSP: Leadsales, Twilio, Kommo…), task-scoped: hours, location, menu, reservations, order status, how to request an invoice (→ `knowledge/capabilities/whatsapp.md`) | **Allowed**: a business answering its own customers. Messages outside the 24 h window need paid templates (`IRR-09`). Moving the restaurant's existing number to the Cloud API takes it off the WhatsApp Business app — explain before doing it |
| Never | Baileys / unofficial bridges on the restaurant's number | Bans would cut off the customer line (`SEC-31`, `CMP-05`) |

## Memory

- **Markdown workspace** (→ `knowledge/capabilities/memory.md`) with the business facts that make
  drafts right: hours, address, menu highlights, suppliers by alias and their order days, house
  rules, tone for reviews.
- **The POS, the inventory sheet and the invoicing tool are the sources of truth.** Jarvis reads
  them; it does not keep a second copy of sales or stock.
- No vector store in week one. Add sqlite-vec (local) or pgvector (Railway Tier B) only if the
  customer bot needs to search a large menu/FAQ.
- Never store customer card data, CLABE/bank numbers, staff IDs or payroll in memory (`SEC-13`).

## Tools / MCP

Trust tiers per `knowledge/capabilities/tools-mcp.md` (T1 official remote OAuth · T2 pinned
community · T3 alpha/generated wrapper · T4 Zapier). All start **read-only** (`SEC-22`).

| Tool | Tier | Default scope | Notes |
|---|---|---|---|
| **POS** — Parrot | T3 | read (sales, items) | Parrot advertises an open API; no MCP found. Generate a thin wrapper (`la-forja:mcp-tool-forge`) or use Zapier (T4). Endpoint details UNVERIFIED |
| **POS** — Soft Restaurant, Loyverse, others | T3/T4 | read | No MCP found; API availability UNVERIFIED. Fallback that always works: the POS's daily report by email or a CSV export dropped in a folder Jarvis reads |
| Google Sheets / Drive (Workspace MCP) | T1 | read | Inventory and supplier list in a Sheet is the simplest week-one setup |
| Gmail (Workspace MCP) | T1 | read | POS closing reports, delivery-app statements, supplier invoices. Bodies are untrusted (`SEC-12`) |
| Google Calendar (Workspace MCP) | T1 | read | Supplier deliveries, events, private bookings |
| **Google Business Profile** (reviews) | T3 | read | No first-party MCP; community servers exist. The API needs a verified profile and approved API access (per community READMEs, UNVERIFIED). Week one: owner pastes or forwards new reviews; Jarvis drafts. Posting a reply = `IRR-02` |
| Delivery apps (Rappi, DiDi Food, Uber Eats) | none | read emailed statements / exported files | No public MCP for merchants found (UNVERIFIED). Menu or price edits on these apps are `IRR-11` and stay manual |
| **Invoicing** — Facturapi (MX) / Alegra (MX, CO, ES…) / Siigo (CO) | T1–T3 | read | Stamp/cancel = `IRR-05`. Prefer the PAC's or POS's **self-invoice portal** (autofactura) so customers invoice themselves; Jarvis only answers "¿cómo pido mi factura?" with the portal link. Details in `knowledge/countries/<cc>.md` |
| Payments — Mercado Pago / Stripe / Clip | T1 (MP/Stripe), T3 (Clip) | read | Refunds and payment links with amounts = `IRR-03`. Stripe MCP needs Agent keys or OAuth (`CMP-37`) |

## Scheduled jobs

Off-minutes only. Local runtimes use the machine's timezone; **Railway cron is UTC**
([docs](https://docs.railway.com/reference/cron-jobs)) — convert (America/Mexico_City UTC−6 all
year, so 23:17 local = `17 5 * * *` UTC next day; America/Bogota UTC−5;
America/Argentina/Buenos_Aires UTC−3; Europe/Madrid UTC+1/+2). When the conversion crosses
midnight, shift the day-of-week field too (a Mon–Sat 23:17 local job in Mexico City becomes
`17 5 * * 0,2-6` UTC: Tuesday–Sunday). Railway cron runs at most every
5 minutes and the job must exit. Do not use `/loop` / session CronCreate for these (7-day expiry)
(→ `knowledge/capabilities/scheduling.md`).

| Job | Example cron (local) | Does | Unattended limits |
|---|---|---|---|
| Closing digest | `17 23 * * *` (set to ~30 min after their real closing time) | `daily-sales-digest` from the POS report | Read-only |
| Morning prep | `3 8 * * *` | Today's deliveries, bookings/events, items below minimum, weather line | Read-only |
| Reorder check | `13 11 * * 1,3,5` (match supplier order days) | `reorder-check`: draft order per supplier | **Never sends or buys** (`SEC-15`, `CMP-38`) |
| Reviews | `37 12 * * *` | New reviews since yesterday with drafted replies | Never posts |
| Delivery payouts | `21 9 * * 1` | `delivery-payout-check` for last week | Read-only |
| Weekly review | `41 16 * * 0` | Sales vs. last week, best/worst items, open issues, memory proposals | Proposals only |

## Skills

Base skills: `remember` (always), `morning-briefing`, `weekly-review`; `inbox-triage` if the owner
lives in email; `draft-reply` for supplier and customer messages (send behind "sí, envíalo").

Pack skills (week one = at most 3):

| Skill | One-line spec | Approval points |
|---|---|---|
| `daily-sales-digest` | Reads the day's POS report/export and returns total, tickets, average ticket, top/bottom 5 items, payment-method split and the change vs. same weekday last week, in 8 lines | None (read-only) |
| `reorder-check` | Compares stock in the inventory Sheet with minimums and supplier lead times; drafts one order message per supplier with quantities | Sending to a supplier = `IRR-01`; paying = `IRR-03` |
| `review-reply-draft` | Drafts a short, specific reply per review in the owner's voice (thanks, fixes, invitation back); flags reviews that need a human (health, legal threats, staff complaints) | Publishing = `IRR-02`, each reply previewed |
| `delivery-payout-check` | From delivery-app statements, totals orders, commissions, promos and net payout per app; flags differences vs. the POS | None |
| `customer-faq` (only with the customer bot) | Answers hours, location, menu, reservations and the invoice-portal link from `MEMORY.md`; hands off to a human for complaints, allergies and refunds | Reservations created = `IRR-06`; any refund = `IRR-03` |

## Guardrails

- **Irreversible list for this pack** (adds to `knowledge/security-checklist.md` §1): menu, price
  or promo changes in the POS or delivery apps (`IRR-11`); stock adjustments (`IRR-11`); supplier
  orders and payments (`IRR-01`/`IRR-03`); refunds (`IRR-03`); public review replies (`IRR-02`);
  CFDI/electronic-invoice stamping or cancelling (`IRR-05`); paid WhatsApp templates (`IRR-09`).
  All denied in cron (`SEC-15`).
- **POS and accounting stay read-only** in v1. Write access is a `/jarvis-add` with its own yes.
- **Allergens and health claims.** The customer bot never guarantees an item is free of an
  allergen or safe for a condition; it answers from the owner's written menu notes and hands off
  to a human.
- **Customer data.** Phone numbers, names and invoice data (RFC/NIT for CFDI) are personal data.
  Once a customer bot exists, the business needs a privacy notice naming the AI/cloud vendors
  and the international transfer (country pack, `SEC-32`), and the bot discloses it is an AI on the
  first message (mandatory in Spain under EU AI Act Art. 50). No RFC/NIT or card data in memory
  (`SEC-13`).
- **Staff data** (wages, schedules, IDs) is out of scope for week one.
- **Money caps.** Spend cap on the model provider and Railway usage limit before go-live
  (`SEC-27`); small businesses feel a surprise bill most.

## Interview extras

1. "¿Qué punto de venta usas (Parrot, Soft Restaurant, Loyverse, caja registradora, cuaderno) y
   te puede mandar el corte por correo o en Excel?" → POS tool row or the export fallback.
2. "¿A qué hora cierras y qué días haces pedidos a tus proveedores?" → cron times.
3. "¿Tus clientes ya te escriben por WhatsApp Business a un número del negocio?" → whether a
   customer bot makes sense later and what moving that number to the Cloud API implies.

## Recommended default stack

| Budget | Runtime / host | Model | Channels | Memory | Notes |
|---|---|---|---|---|---|
| **Low** (pays Claude Pro/Max, has a computer at the business that stays on) | `claude-code-local` with Desktop scheduled tasks (or `claude-p-cron` if they only want the reports, no chat) | Subscription (owner use only) | Telegram | Markdown | POS email/CSV export + Sheets + Gmail read-only. No customer channel |
| **Low, phone-only owner** (no computer that stays on) | `hermes` on Railway Hobby (Tier A) with an API key and spend cap; Railway cron for the digests | `cheap` for digests/heartbeat, `main` for drafts (`models.json`) | Telegram | Markdown (+ Hermes built-in) on a volume | The usual LATAM case: the owner lives on their phone |
| **Medium** (wants customers answered on WhatsApp) | `hermes` on Railway (Cloud API mode, not Baileys), API key + spend cap; Tier A **plus a generated domain** for the Meta webhook with signature validation (`knowledge/capabilities/deploy-railway.md`) | `cheap` for FAQ, `main` for owner work | WhatsApp Cloud API on the business number (or its BSP) for customers + Telegram for the owner | Markdown; pgvector only for a large menu/FAQ | Customer bot task-scoped with `customer-faq`; reservations and refunds escalate; self-invoice via the PAC/POS portal. Not `openclaw` for WhatsApp without Baileys consent (`CMP-06`) |

## Sources

- Parrot POS (open API claim, auto-invoicing module; secondary): https://www.capterra.es/software/220120/parrot-software · https://techcrunch.com/2022/01/10/parrot-a-tool-for-digitizing-mexicos-restaurants-takes-in-9-5m
- Google Business Profile review MCPs (community): https://github.com/satheeshds/gbp-review-agent · https://socket.dev/npm/package/mcp-google-business
- Facturapi pricing and community MCP: https://www.facturapi.io/pricing · https://skillselion.com/mcp/tool/io.github.codespar/mcp-facturapi
- Alegra MCP: https://developer.alegra.com/llms.txt
- Stripe MCP (Agent keys, human approval for refunds): https://docs.stripe.com/mcp
- Mercado Pago MCP overview: https://www.mercadopago.com.ar/developers/en/docs/mcp-server/overview
- WhatsApp policy: `knowledge/capabilities/whatsapp.md`; https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- Railway cron (UTC, 5-minute minimum, must exit): https://docs.railway.com/reference/cron-jobs
- EU AI Act Art. 50 timing: https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html

UNVERIFIED in this file: Parrot API endpoints and access terms; Soft Restaurant / Loyverse API or
MCP; Google Business Profile API access requirements; merchant APIs for Rappi, DiDi Food and Uber
Eats.
