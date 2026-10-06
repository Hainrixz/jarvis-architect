---
name: jarvis-refresh
description: >-
  Maintainer command: re-verify every pinned version, price, model ID and policy in knowledge/
  against live sources, and report what moved. Use before a release or when a runtime ships a new
  version. EN — "refresh the knowledge base", "are the pins stale". ES — "actualiza el conocimiento",
  "revisa versiones".
argument-hint: "[runtime id | models | policies | all]"
---

# /jarvis-refresh

1. Scope: the argument, default `all`.
2. Collect every pin: `knowledge/runtimes/*.md` (§ Pinned versions), `knowledge/models.json`,
   prices in `knowledge/capabilities/costs.md`, policy claims in `knowledge/auth-matrix.md` and
   `knowledge/capabilities/whatsapp.md`, security floors in `knowledge/runtimes/*.md` (§ Pinned
   versions; `knowledge/security-checklist.md` names the CVEs but never holds a version).
3. Dispatch `stack-researcher` (one call per runtime, plus one for models/prices, one for policies).
4. Report a table: item · pinned · live · source · date · action (keep / bump / breaking / policy changed).
5. With the maintainer's yes, edit the files, bump each file's `Last verified:` date and
   `models.json → verified_at`, add a CHANGELOG entry under `Unreleased`. Never change a security
   floor downward.
