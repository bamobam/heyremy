# Remy

Hands-free cooking buddy (StormHacks 2026). Start with `docs/PLAN.md`, `docs/SYSTEM_DESIGN.md` and `CONTEXT.md` (the glossary: use its terms in code names).

## Secrets: do not use or access the env folder

- **Never read, open, print, copy, search, or edit anything in `env/`** (`env/.env.local`, or any other `.env*` file anywhere in the repo). That is where the user keeps their API keys.
- Never use an API key yourself: do not call the Gemini or ElevenLabs APIs, run the real backend with keys, or ask for a key to be pasted into the chat. If a task needs the real backend, tell the user to run it themselves.
- Do not run commands that would reveal them: `cat`, `grep`, `ls -la`, `env`, `printenv` or similar on `env/` or on `GEMINI_API_KEY` / `ELEVENLABS_API_KEY`.
- Work with the stand-in backend instead: `?mock` in the URL, or `VITE_MOCK_API=1`.
- You may read and edit `env/.env.example` and `env/README.md`; they hold no secrets.
- Never commit anything under `env/` other than those two files.
