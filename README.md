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

Copy `.env.example` to `.env.local` and add `GEMINI_API_KEY` and `ELEVENLABS_API_KEY`. In production they live in Vercel environment variables only.
