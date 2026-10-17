---
name: jarvis-quick
description: >-
  Fast-track Jarvis Architect: three questions, smart defaults for everything else, same
  confirmation gate and the same security controls. EN — "just build my Jarvis", "quick setup".
  ES — "hazlo ya", "rápido", "arma mi Jarvis sin tantas preguntas", "modo express".
argument-hint: "[what you do + what Jarvis should do]"
---

# Jarvis Architect — modo express

Load and follow the `jarvis-start` skill's rules (all 14 apply). This skill only changes the
interview depth:

1. Run PREFLIGHT exactly as in `questions/0-preflight.md` (it's silent and fast).
2. Ask **three questions in one message** (`AskUserQuestion`):
   - ¿A qué te dedicas y qué 3 cosas quieres que haga tu Jarvis? (open — or skip if the argument already says it)
   - ¿Dónde le quieres hablar? (Telegram (Recomendado) · WhatsApp · Terminal / app de Claude)
   - ¿Tiene que estar prendido 24/7 sin tu compu? (No, en mi compu (Recomendado si tienes Claude Pro/Max) · Sí, en la nube)
3. Take the defaults from `knowledge/decision-tree.md` § *Quick defaults* for everything else, and
   **state every default in one block** so the person can correct any of them. That block always
   includes the three that every Jarvis gets, in one line each:
   - **Autonomía:** L1, piloto `13 10,13,16 * * 1-5` en el slot `cheap`, tope 1.00 USD/día, lista
     L3 vacía ("prepara borradores; nunca envía ni paga sin tu sí"). Cowork: una tarea local L–V.
   - **Aprende de ti:** sí, automático (te aviso en una línea; «deshaz» lo quita; nunca permisos).
   - **Audio, video, fotos y PDFs:** en tu compu (whisper.cpp ≈574 MB), video encendido, nada a la
     nube. Cowork: ni audio ni video. Railway: audio en la nube solo con tu permiso; si no, solo
     texto, y video con subtítulos e imágenes.
   - The panel, when it's in the stack, shows Pendientes and Aprendizajes.
4. Show the ARCHITECTURE card from `questions/3-confirmacion.md` (including cost and consent for
   any flagged risk). Wait for an explicit yes. Fast-track never removes the gate.
5. Continue with BUILD exactly as `/jarvis-start`.
