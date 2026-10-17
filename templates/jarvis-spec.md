# Jarvis spec — {{jarvis_name}}

> Written to `.jarvis/jarvis-spec.md` after the ARCHITECTURE gate. Every `{{…}}` is replaced; the
> validator fails on any survivor. Prose in the person's language.

Generated: {{date}} · Architect version: {{architect_version}}

## 1. Who and what for
- Owner: {{owner_first_name}} · Profession pack: {{pack}} · Country: {{country}}
- Week-one jobs:
  1. {{job_1}}
  2. {{job_2}}
  3. {{job_3}}

## 2. Non-Goals (at least 3)
| Not in this version | Why |
|---|---|
| {{non_goal}} | {{reason}} |

## 3. Architecture
| Slot | Choice | Reason | Source |
|---|---|---|---|
| Host | {{host}} | | knowledge/capabilities/deploy-*.md |
| Runtime | {{runtime_id}} {{runtime_version}} | | knowledge/runtimes/{{runtime_id}}.md |
| Credential | {{credential}} | | knowledge/auth-matrix.md |
| Models | cheap {{model_cheap}} · main {{model_main}} · max {{model_max}} | | knowledge/models.json (verified {{models_verified_at}}) |
| Channels | {{channels}} | | knowledge/capabilities/channels.md |
| Memory | {{memory}} | | knowledge/capabilities/memory.md |
| Tools / MCP | {{tools}} | | knowledge/capabilities/tools-mcp.md |
| Jobs | {{jobs}} | | knowledge/capabilities/scheduling.md |
| Autonomy | level {{autonomy_level}} · l3_types {{autonomy_l3_types}} · daily_usd {{autonomy_daily_usd}} · autopilot `13 10,13,16 * * 1-5` | | knowledge/capabilities/autonomy.md |
| Learning | mode: automatic (lecciones al instante + skills en prueba) · native: {{learning_native}} · channels: {{learn_channels}} | | knowledge/capabilities/learning.md |
| Multimodal | stt: {{stt}} · model: {{whisper_model}} · video: {{video}} · gemini: off | | knowledge/capabilities/multimodal.md |
| ↳ Voice | {{voice_or_none}} | | knowledge/capabilities/voice.md |
| Face / UI | {{ui}} (panel views: Chat, Pendientes, Memoria, Aprendizajes, Trabajos, Aprobaciones, Estado) | | knowledge/capabilities/web-ui.md |

<!-- Row values. Autonomy: level L1 (default) or L0; l3_types "ninguna" or reversible types with a §7
consent each; daily_usd 1.00; cowork: one weekday local task instead of the cron line; L0: no
autopilot. Learning native: "hermes on" / "openclaw dreaming off" / "codex memories off" / "claude
auto memory off"; channels = the owner's allowlisted channels. Multimodal: stt local | cloud(groq|openai)
(cloud needs a §7 consent and no sensitive pack, CMP-39); model ggml-large-v3-turbo-q5_0 | ggml-small;
video on | off; cowork: "no soportado". Delete the panel views when there is no panel. -->

## 4. Security controls (all from knowledge/security-checklist.md)
| ID | Control | How it is implemented here | Verified by |
|---|---|---|---|
| {{id}} | {{control}} | {{implementation}} | {{task_id}} |

## 5. Rule of Two map
| Capability | Untrusted input [A] | Private data [B] | External action [C] | Approval required? |
|---|---|---|---|---|
| {{capability}} | | | | |
| Autopilot | yes (mail/calendar reads) | yes | no (L3 list empty) | L2 via "sí, ejecuta T-N" |
| Video fetch (`watch-video`) | yes (the video, its captions and page) | no | no | Only links the owner sent or asked for (CMP-40) |

## 6. Cost
- Model: ~${{model_cost}}/month ({{usage_tier}}) · Hosting: ~${{host_cost}}/month · Other: {{other_costs}}
- Provider spend cap: ${{cap}} · Railway usage limit: {{railway_limit_or_na}}

## 7. Decisions and consents
| Date | Decision / consent | Person's answer |
|---|---|---|
| {{date}} | {{decision}} | {{answer}} |
| {{date}} | Nivel de autonomía L1, piloto 3×/día hábil, tope 1 USD/día; lista L3 vacía | {{answer}} |
| {{date}} | Aprendizaje automático con aviso y «deshaz» | {{answer}} |
| {{date}} | Audio y video en la computadora (local); videos de YouTube y redes solo para consulta personal, como permiten sus Términos; nube de voz a texto: no | {{answer}} |

<!-- Add a row only when it applies: each L3 type turned on (name it); cloud STT with the vendor
named; Gemini on a paid tier. Without its row the default stays: L3 empty, local STT, no Gemini.
If the person declines the media row's YouTube clause, write video: off in §3 and drop that clause. -->

## 8. Risks
| Risk | Mitigation |
|---|---|
| {{risk}} | {{mitigation}} |

## 9. Compliance notes
{{compliance_notes_from_country_file_or_"Uso personal, sin datos de terceros."}}

## 10. Runbook pointers
Jarvis folder: {{jarvis_dir}} · Start: `{{start_cmd}}` · Stop: `{{stop_cmd}}` · Logs: {{logs_path}} · Health: `{{health_cmd}}`
