# Roadmap

Agreed 2026-10-18. The hackathon is over; the aim is to polish Remy for a small group of testers, and maybe grow it into a product later. Terms are in [`CONTEXT.md`](../CONTEXT.md).

## Principles

- Gestures stay the main way to cook; voice complements them (Questions, timers).
- The hat cam is the design target, and the laptop camera is a supported second mode.
- A Recipe is never changed silently. A change the cook accepts makes a Version.
- Storage is local to the browser until something needs accounts ([ADR 0002](adr/0002-local-first-storage.md)).
- `api/` is Havier's, and `camera/` and the cooking state, controller and selectors are Nam's. Changes there are listed as hand-offs below, not made without asking. `CookingProvider.tsx`, `contract.ts` and the other glue in `cooking/` are the frontend's.

## Milestones

| | What | Status |
| --- | --- | --- |
| M1 | **Tester-ready.** Step text that fits the card, the up-next rail, the logo going home (with a confirm), a one-time notice about what Remy sends, a feedback link, a "use this laptop's camera" choice | UI parts built on `grace/tester-ready`: the screens, notice, feedback link (set `VITE_FEEDBACK_URL`) and the camera choice. Not yet: rate limits and a spending cap (Havier), back-of-hand gestures (Nam), and a deployment for testers |
| M2 | **Cook settings.** Level (beginner, intermediate, master) and Persona (invented characters; voice and phrasing only, [ADR 0003](adr/0003-narration-by-level-persona-on-live-speech.md)) | Planned |
| M3 | **Voice.** Ask Remy by push-to-talk (speech to text, Gemini with the whole recipe, how far the cook has got and optionally the camera view, then text to speech); jump to a step by voice with a confirm; a short memory within a session; timers; then the "Hey Remy" wake word | Planned |
| M4 | **Auto-checks.** Several frames per check; Auto-check on steps whose cue changes with time, every 8 to 10 seconds, capped per step, speaking only when the cue is met; sound cues later | Planned |
| M5 | **Choosing what to cook.** Pantry (photo upload or typed, always editable) to Suggestions to a Shopping list with map links; no live stock | Planned |
| M6 | **Versions.** Stagger (opt-in second pass), Kitchen profile, saving with Lineage, My recipes, Cook log, export and import | Planned |

Parked: smart glasses (another camera source, later) and World Labs (no fit for the core loop).

## Hand-offs

| For | What |
| --- | --- |
| Havier (`api/`) | Rate limits and a daily spending cap on every route, for the tester link |
| Havier | The parse writes narration at three Levels per step (M2); optional short step titles |
| Havier | New routes: `/api/ask` (M3), `/api/suggest` (M5), `/api/stagger` (M6) |
| Nam | `src/camera/useAnyCam.ts` still exports `USE_ANY_CAMERA`, which nothing uses now that the camera choice lives in `cooking/cameraChoice.ts`, and `camera/cameraMessages.ts` names the hat cam in every message (the UI works around it in laptop mode) |
| Nam (`camera/`) | Back-of-hand gestures: measure first with the dev tag, then classify from the hand landmarks so palm direction doesn't matter. With the hat cam looking down, backs of hands are the common case |

## Open

- The live deployment and its keys are on Nam's Vercel account. Testers should get their own deployment with their own keys and spending cap.
- A small set of golden recipes and an `npm run eval` the owner runs with their keys, to tell whether a prompt change made things better.
