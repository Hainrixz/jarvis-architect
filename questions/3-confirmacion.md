# Phase 3 — Architecture confirmation

> Present ONE clear design, kill every silent assumption, quote the cost, and get an explicit yes
> before anything is installed.

Last verified: 2026-10-06

## Order of operations

1. Check the draft against `knowledge/compatibility.md`. Fix any hit.
2. **Gate A** — resolve every `[NEEDS CLARIFICATION]` marker.
3. **Gate B** — pre-mortem. Survivors become risks or Non-Goals.
4. **Gate C** — consent for any flagged risk (subscription token on a server, a setup-token for
   scheduled jobs, WhatsApp unofficial bridge, sensitive third-party data on a cloud host, OpenClaw
   on a public host, local-only tradeoffs: a declined hybrid on `HW-small`/`HW-weak` hardware or no
   push channel).
5. Present ONE message. Get the yes.
6. Write `jarvis-spec.md` (from `templates/jarvis-spec.md`) into `.jarvis/`. Transition to BUILD.

## Gate A — markers

| Area | Marker if you can't answer it from what they said |
|---|---|
| Who may talk to Jarvis | Only the owner? Family? Clients? (clients → `knowledge/capabilities/whatsapp.md` § Customer-facing bot, SEC-01 exception + SEC-32 privacy notice from `countries/<cc>.md`; for `lawyer-accountant`/`health` it is Deferred to v2 and v1 drafts only) |
| What Jarvis may do alone | Read only? Draft? Send/pay/delete? (default: drafts; irreversible = approval) |
| Accounts & keys | Which accounts does it touch, and who owns them? If a GitHub org, mailbox or drive is the **employer's**: "¿Tu empresa permite usar IA con eso? Revisa su política" (log the answer); third parties' emails processed even for personal use are listed in spec §9 |
| Money | Monthly cap they accept (model + hosting)? |
| Data | Where does memory live? Any third-party personal data? |
| Host | Exactly where it runs and what happens when that machine sleeps |
| Channel identity | Which bot / number / account; personal or dedicated |

Resolve each marker one of three ways, out loud: **Answered**, **Defaulted** (you state it, they
confirm), or **Deferred** (becomes a Non-Goal). Translate markers into plain questions; never paste
the raw marker list. Max 3 questions per message.

## Gate B — pre-mortem

"It's three months from now and this Jarvis was abandoned or caused a problem. Why?"
Run these 8 angles inline on the draft:

1. **Cost** — what if usage is 5× the estimate? Is a hard cap set at the provider?
2. **Uptime** — what happens when the laptop sleeps, Railway redeploys, a token expires?
3. **Security** — what could a stranger who finds the bot do? What could a malicious email make it do?
4. **Policy** — which provider term is this closest to breaking? (subscription, WhatsApp, data law)
5. **Fragility** — which component is a research preview / fast-moving project? What's the fallback?
6. **Complexity** — is this more than they can maintain at their technical level?
7. **Value** — will the three week-one jobs actually save them time? Which is weakest?
8. **Lock-in** — can they move runtime later? (the markdown workspace keeps memory portable)

Keep 3–7 surviving findings. Each becomes a risk with a mitigation, or a Non-Goal.

## Gate C — consent

For each flagged risk, one plain sentence plus an `AskUserQuestion` yes/no. Log the answer with
date in `jarvis-spec.md → Decisions` and in `.jarvis/state.json → consents[]` as
`{ "id": "<id>", "accepted_at": "<ISO>", "text_version": "2026-10-06" }` (same shape as the Baileys
gate in `capabilities/whatsapp.md`). No consent → choose the safe alternative.

**`sensitive-data-cloud`** (Step 1 `very-sensitive` + 24/7 with no always-on box,
`decision-tree.md`). Shown verbatim, adapted only for the country name and region:

> **Antes de guardar datos de tus clientes en un servidor en la nube, lee esto:**
>
> 1. Para que tu Jarvis funcione 24/7 sin tu compu, su memoria (notas sobre tus clientes, nunca
>    números de identificación ni datos bancarios) vivirá en un servidor de Railway en <región>,
>    fuera de <país>.
> 2. Lo que Jarvis lee se procesa con <proveedor del modelo> (Estados Unidos) con una llave de
>    API, bajo sus términos comerciales (no los de una cuenta personal).
> 3. La ley de tu país te pide avisar a tus clientes y nombrar a estos encargados en tu aviso de
>    privacidad (te dejo un borrador). Revísalo con tu abogado.
> 4. La alternativa sin este riesgo: Jarvis en tu compu, que solo trabaja cuando está prendida.
>
> ¿Aceptas guardar esas notas en la nube?
> - **Mejor en mi compu, aunque no sea 24/7 (Recomendado)**
> - Acepto, en la nube

Region: the one closest to the person that Railway offers (`capabilities/deploy-railway.md`,
"Region" paragraph), chosen before the first deploy. Transfer clauses: `countries/<cc>.md` § Data-protection
law.

## The message (≤40 lines)

```
## Tu Jarvis: <nombre>

| Pieza | Elección | Por qué |
|---|---|---|
| Dónde vive | … | … |
| Cerebro (modelo) | main: … · rápido: … · máximo: … | … |
| Arnés (runtime) | … | … |
| Cómo entra | <credencial> | cumple con los términos de <proveedor> |
| Canales | … | … |
| Memoria | … | … |
| Herramientas | … (solo lectura al inicio) | … |
| Trabajos automáticos | … | … |
| Panel | … (dónde lo abres) | … |
| Seguridad | allowlist solo tú · aprobación para enviar/pagar/borrar · sandbox · tope de gasto | siempre |

**Costo estimado:** ~$X/mes (modelo ~$Y + hosting ~$Z) ≈ <moneda local> (tipo de cambio de hoy, solo si `countries/<cc>.md` lo pide). Tope de gasto: $N.
**Costo de armarlo (una vez):** $0 con tu plan · ~$A con llave de API (`capabilities/costs.md` § 6.8).
**Consentimientos:** <lista con fecha, o "ninguno">.
**Qué NO incluye esta versión:** …
**Riesgos y cómo los cubrimos:** …
**Tiempo estimado:** ~N min, con M pasos donde necesito que hagas algo tú (crear el bot, pegar la llave…).

¿Lo construimos así?
```

Frame it as "esto es lo que haría" — not "estas son tus opciones". Silence is not confirmation.
"Sí / va / dale / hazlo" is. Any adjustment loops back to DEEP DIVE for that slot only.

## On yes

1. Write `.jarvis/jarvis-spec.md` from `templates/jarvis-spec.md`, every section filled, zero
   placeholders.
2. Ask where the Jarvis folder goes (default `~/jarvis-<slug>/`, outside this repo). Confirm.
3. Update state → `BUILD`, RUNNING BRIEF, and say how long it will take and which steps need them.
