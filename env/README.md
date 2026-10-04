# env/

Put your API keys here. Nothing in this folder is committed except this file and `.env.example`.

1. Copy the example: `cp env/.env.example env/.env.local`
2. Fill in `GEMINI_API_KEY` (needed for `/api/parse` and `/api/check`) and, when you want Remy's real voice, `ELEVENLABS_API_KEY`.
3. Restart `npm run dev`. Vite reads this folder (`envDir` in `vite.config.ts`), and `scripts/devApi.ts` passes the keys to the local API; they never reach the browser.

Set `VITE_MOCK_API=1` to run against the stand-in backend with no keys.

On Vercel, set the same names in the project's environment variables instead.
