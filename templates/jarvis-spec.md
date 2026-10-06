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
| Voice | {{voice_or_none}} | | knowledge/capabilities/voice.md |
| Face / UI | {{ui}} | | knowledge/capabilities/web-ui.md |

## 4. Security controls (all from knowledge/security-checklist.md)
| ID | Control | How it is implemented here | Verified by |
|---|---|---|---|
| {{id}} | {{control}} | {{implementation}} | {{task_id}} |

## 5. Rule of Two map
| Capability | Untrusted input [A] | Private data [B] | External action [C] | Approval required? |
|---|---|---|---|---|
| {{capability}} | | | | |

## 6. Cost
- Model: ~${{model_cost}}/month ({{usage_tier}}) · Hosting: ~${{host_cost}}/month · Other: {{other_costs}}
- Provider spend cap: ${{cap}} · Railway usage limit: {{railway_limit_or_na}}

## 7. Decisions and consents
| Date | Decision / consent | Person's answer |
|---|---|---|
| {{date}} | {{decision}} | {{answer}} |

## 8. Risks
| Risk | Mitigation |
|---|---|
| {{risk}} | {{mitigation}} |

## 9. Compliance notes
{{compliance_notes_from_country_file_or_"Uso personal, sin datos de terceros."}}

## 10. Runbook pointers
Jarvis folder: {{jarvis_dir}} · Start: `{{start_cmd}}` · Stop: `{{stop_cmd}}` · Logs: {{logs_path}} · Health: `{{health_cmd}}`
