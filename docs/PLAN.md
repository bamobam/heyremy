# Hackathon plan (10 hours)

## Scope

Must-have:
1. Paste a recipe → Gemini returns prep, steps, heads-ups and cues
2. Big-text cooking screen
3. Next / back gestures (held 1 s at 0.7+ confidence, 2 s cooldown)
4. ElevenLabs reads each step; browser speech if it fails
5. Open palm → check → spoken verdict

Stretch: auto-check (checks a checkable step every few seconds, speaks only when the cue is met).

Cut: timers, ingredient scan, accounts, saved recipes.

## Owners

| Track | Owner | Helping |
|---|---|---|
| Frontend + voice: input screen, cooking screen, "looking…" and verdict states, ElevenLabs playback | Grace | Nam |
| AI + backend: `api/parse`, `api/check`, prompts, testing on 10+ batter photos, Vercel deploys | Havier | Nam |
| Camera + gestures: hat rig, MediaPipe, hold-to-confirm, frame capture, wiring gestures to steps | Nam | Havier, Grace |

## Checkpoints

| Hour | Done when |
|---|---|
| 0–0.5 | App deployed to Vercel, heyremy.tech pointed at it, hat rig taped up |
| 0.5–3 | Each track works alone: hardcoded steps on screen, gestures logged from the hat cam, `api/parse` returns JSON, `api/check` judges a test photo |
| 3 | Integration: gestures move through steps, ElevenLabs speaks them |
| 5 | Full flow on the deployed URL: paste → steps → gesture → open palm → spoken verdict |
| 5–7.5 | Prompts tuned on real photos, UI polish, auto-check if hour 5 landed on time, backup video recorded |
| 7.5 | Feature freeze, known-good build tagged |
| 7.5–10 | Demo-path fixes only, README with AI disclosure, record the cooking footage |

If hour 5 slips, cut the stretch goal and polish, never the check.

## Hour-1 tests (decide early)

- Hat cam: film each gesture for 20 s and run it through the MediaPipe demo. If thumbs-up registers below about 70%, switch to open palm = check, closed fist = next, victory = back.
- Check: one Gemini call with a lumpy and a smooth batter photo plus the cue. Does it tell them apart?

## Data shapes

See `src/types.ts`. Steps without a visual cue have `checkable: false` and never offer a check.

## Voice

- Generate each step's audio right after parsing and cache it; verdicts are generated live.
- Pre-generate "Hold still, let me look…" and play it as soon as the open palm registers, to cover the Gemini wait.

## Git

- `main` always deploys. One short branch per task (`grace/cooking-screen`), merged by PR within about an hour. Keep the build green.
- API keys live only in Vercel environment variables (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`); never in the client or the repo.

## Demo

- In person: raw batter in a bowl, lumpy then smooth, checked live from the hat cam.
- Video: real cooking footage, plus a backup screen recording of the full flow.
