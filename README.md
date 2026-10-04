# Remy

**A hands-free cooking buddy.** Paste a recipe or a link, and Remy turns it into short steps a beginner can follow, reads each one aloud, moves on when you give a thumbs-up, and looks at your food through a hat cam to tell you when a step is really done.

Built at StormHacks 2026. **Live:** <https://heyremy.vercel.app>

## How it works

1. **Paste a recipe (or a link to one).** Gemini rewrites it for cooking, not reading: hidden prep ("preheat the oven", "melt the butter") moves to a *Before you start* list, each step gets a heat level and a rough time, a heads-up arrives one step before you need a hot pan, and a final step checks the food is done before you serve.
2. **Check the prep screen.** Ingredients scale to the servings you pick (plain code, not AI), and Remy's voice for every step is generated while you read.
3. **Cook without touching anything.** The current step shows in big type and is read aloud.

| Gesture (hold ~1 s) | Key | Does |
| --- | --- | --- |
| 👍 Thumbs up | `N` | Next step |
| 👎 Thumbs down | `B` | Previous step, or hear this one again |
| ✋ Open palm | `Space` | Check: Remy takes one photo and tells you if the step's cue is met |

A check answers **ready**, **not ready** (with what to keep doing), or **unsure** (with what to fix, e.g. "Look down at the bowl"). It never guesses "ready". After a ready verdict Remy finishes speaking, then moves on by itself unless you give a 👎.

## Stack

| Part | What it uses |
| --- | --- |
| App | Vite, React 19, TypeScript |
| Gestures | [MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer), in the browser, on every frame. No video leaves the laptop |
| Hat cam | A Logitech C270 or C920 on a hat, looking down at the bowl; it sees both your hand and your food |
| Recipes and checks | Gemini (`gemini-3.8-flash`, with `gemini-3.5-flash` as a one-shot fallback) with JSON-schema output |
| Voice | ElevenLabs text-to-speech (`eleven_flash_v2_5`); the browser's own voice if a clip is missing |
| Backend | Three Vercel functions in `api/`; the API keys live only there |
| Tests | Vitest and Testing Library (~880 tests) |

## Run it locally

You need a current Node (22 or later) and Chrome.

```bash
npm install
```

Put your keys in a `.env` file at the repo root (it is gitignored):

```
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
```

The dev server also reads `env/.env.local` as a fallback, for setups that keep keys there; values in the root `.env` win. Keys never reach the browser: only `VITE_`-prefixed variables do, and none of these have that prefix.

```bash
npm run dev
```

`npm run dev` serves the app and the functions in `api/` together (a small Vite plugin, development only), so no Vercel account is needed. Each backend call prints a line like `POST /api/parse 200 3098ms` in the terminal.

| Open | For |
| --- | --- |
| <http://localhost:5173/> | The app, with the Logitech hat cam |
| <http://localhost:5173/?cam=any> | The app with any camera, e.g. the MacBook's (slower first load) |
| <http://localhost:5173/?mock> | A stand-in backend: no API calls, no keys needed, **all voices are silent**. Also `?mock=slow` and `?mock=fail` |
| <http://localhost:5173/?debug=api> | Try `/api/parse` and `/api/check` directly and see each answer, its timing and the exact photo sent |
| <http://localhost:5173/?debug=camera> | Camera and gesture debugging: live hand tracking, a tally of recognised gestures, and saving a grabbed frame as a JPEG |

After switching branches, reload the tab fully (Cmd+Shift+R) so no old code stays loaded. Run `npm run cam:check` on macOS to confirm the Logitech is plugged in and visible.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | App and API on <http://localhost:5173> |
| `npm test` | All tests once (`npm run test:watch` to keep watching) |
| `npm run build` | Typecheck and production build, as Vercel runs it |
| `npm run lint` | oxlint |
| `npm run cam:check` | Checks macOS sees the hat cam |
| `npm run prototype` | The UI prototypes at `/prototype` |

## Backend API

All three take JSON and return JSON (or audio), with errors as `{ "error": { "kind", "message" } }`. Shared types are in [`src/types.ts`](src/types.ts).

| Endpoint | Request | Returns | Typical time |
| --- | --- | --- | --- |
| `POST /api/parse` | `{ recipe }`: recipe text (up to 10,000 characters) or a single recipe link | Title, servings, ingredients, prep, steps with cues | 3–5 s |
| `POST /api/check` | `{ image, cue, step }`: base64 JPEG (up to 1 MB), the step's cue and text | `{ status: "ready" \| "not_ready" \| "unsure", feedback }` | 2–4 s |
| `POST /api/speak` | `{ text }` (up to 300 characters) | `audio/mpeg` | under 1 s |

A few details worth knowing:

- **Amounts are code, not AI.** Gemini writes `{flour}` instead of "1 cup flour", and the app fills the amount in at the chosen servings.
- **Recipe links** are fetched by the server, which reads the recipe data most recipe sites publish for search engines (schema.org JSON-LD), or the page text otherwise. The fetch only goes to public addresses (no internal IPs, max 3 redirects, 6 s, 2 MB). Some big sites (Allrecipes, Simply Recipes, Serious Eats and others) block automated reading; the app then asks you to paste the text. BBC Good Food and RecipeTin Eats work.
- **Reliability:** if Gemini is overloaded or rate-limited, the request is retried once on the fallback model, within the time the browser waits (20 s for parse, 8 s for check). Gemini's thinking is set to `low`, which keeps parse around 3–5 s.
- **Logs:** one JSON line per request (route, status, timings, which model answered). Never the recipe, the photo or a key.

### When something fails

| You see | It means |
| --- | --- |
| `upstream: GEMINI_API_KEY is not set` | No key in `.env`, or the dev server wasn't restarted after adding it |
| `upstream` with another message | Gemini or ElevenLabs refused or failed; the dev server terminal or Vercel logs have a line for the call |
| `timeout` | Slower than the limit (parse 20 s, check 8 s) |
| `unprocessable` | The answer couldn't be used, or a recipe link couldn't be read |
| `bad_request` | Rejected before any AI call; the message says why (too long, not a JPEG, a link that can't be opened) |
| `rate_limited` | Too many requests to Gemini or ElevenLabs; wait a few seconds |

## Deploying

The repo is connected to Vercel:

- **`main`** deploys to production at <https://heyremy.vercel.app>.
- **Every other branch** gets its own preview URL (see Vercel → Deployments).
- Set `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` in Vercel → Settings → Environment Variables for Production and Preview, then redeploy.
- [`vercel.json`](vercel.json) gives the functions time limits (parse 30 s, check 15 s, speak 10 s).

> **In `api/`, import other files with `.js`, not `.ts`** (`import { guard } from './_lib/http.js'`). Vercel compiles each file to `.js` but keeps import paths as written, so a `.ts` path crashes every function on load. TypeScript and Vitest resolve `.js` to the `.ts` source. Files and folders starting with `_` (like `api/_lib`) are not deployed as endpoints.

## Project layout

```
api/              Vercel functions: parse.ts, check.ts, speak.ts
  _lib/           Gemini and ElevenLabs clients, validation, limits, link fetching, logging
  _prompts/       The parse and check prompts
src/
  camera/         Hat cam, MediaPipe gestures, hold-to-confirm, sharpest-frame capture
  cooking/        State, reducer, controller (the cooking flow), servings scaling
  audio/          Voice playback, clip cache, browser-voice fallback
  api/            Browser client for the backend, plus the stand-in mock
  ui/             Screens and components
  debug/          The ?debug=api page
  types.ts        Types shared by the app and the backend
scripts/          Dev API plugin, camera check, MediaPipe file copy
docs/             Plan, system design, decisions, mockups
```

## Privacy

- Gestures are recognised on the laptop. Video is never uploaded or recorded.
- A check sends one photo, only when you ask with an open palm. Nothing is stored.
- API keys stay on the server (Vercel or the dev server) and never reach the browser.

## Not built (yet)

Auto-check (checking a step on its own every few seconds), timers, voice questions ("how much flour again?"), accounts and saved recipes. See [docs/PLAN.md](docs/PLAN.md).

## Docs

- [CONTEXT.md](CONTEXT.md): the glossary (recipe, step, cue, check, verdict…)
- [docs/PLAN.md](docs/PLAN.md): scope, owners, checkpoints
- [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md): how the pieces fit together
- [docs/adr/0001-single-hat-cam.md](docs/adr/0001-single-hat-cam.md): why one camera sees both your hand and your food
- [LETUSCOOK.md](LETUSCOOK.md): the original proposal

## Team

| Who | Built |
| --- | --- |
| Grace | Frontend and Remy's voice |
| Havier | AI and backend: parsing, checks, prompts, Vercel |
| Nam | Hat cam and gestures, cooking flow, API client |

## AI disclosure

Remy uses Gemini (recipe restructuring and photo checks) and ElevenLabs (voice) at runtime. AI coding assistants were used during development to help write, test and review code.
