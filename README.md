# Remy

A hands-free cooking buddy: reads each recipe step aloud, moves on with a hand gesture, and looks at your food through a hat cam to tell you when a step is done. Built at StormHacks 2026.

- Glossary: [CONTEXT.md](CONTEXT.md)
- Plan, owners, checkpoints: [docs/PLAN.md](docs/PLAN.md)
- Why one hat cam: [docs/adr/0001-single-hat-cam.md](docs/adr/0001-single-hat-cam.md)

## Run

```bash
npm install
npm run dev
```

Copy `env/.env.example` to `env/.env.local` and add `GEMINI_API_KEY` and `ELEVENLABS_API_KEY`. In production they live in Vercel environment variables only.

## Try the real backend

`npm run dev` also serves the functions in `api/` (a small Vite plugin, development only), so the app can talk to the real backend with no Vercel account.

1. `cp env/.env.example env/.env.local`, then put your Gemini key after `GEMINI_API_KEY=` (from Google AI Studio). `ELEVENLABS_API_KEY` is not needed yet: only `/api/parse` and `/api/check` are tried here. The keys stay in the dev server; the browser never sees them.
2. `npm run dev` (restart it after changing `env/.env.local`).
3. Open <http://localhost:5173/?debug=api> with the hat cam plugged in.
4. **Parse recipe** sends the recipe text to `/api/parse`. **Check with a photo** takes a real photo from the hat cam and sends it to `/api/check`. Holding an open palm for 1 s and then taking your hand away does the same check.

The page shows the answer, how long it took, and the exact photo that was sent. Each failure shows its kind and HTTP status:

| What you see | What it means |
| --- | --- |
| `upstream (HTTP 502): GEMINI_API_KEY is not set.` | The key is missing, or the dev server was not restarted after adding it |
| `upstream` with another message | Gemini refused or failed; the dev server terminal has a log line for the call |
| `timeout` | Gemini was slower than the limit (parse 20 s, check 8 s) |
| `unprocessable` | Gemini answered, but not in a shape the app can use |
| `bad_request` | The request was rejected before Gemini; the message says why |

Add `?mock` to the address to use the stand-in backend instead (`?mock=slow`, `?mock=fail`).
