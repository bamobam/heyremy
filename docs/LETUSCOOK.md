# SousSight: StormHacks 2026 proposal

Oct 1, 2026 · @Gracc

We build SousSight at StormHacks 2026 (Oct 3–4, SFU Burnaby): a hands-free cooking buddy that reads each recipe step aloud, moves on when you give a thumbs-up, and looks at your bowl to tell you when it's ready. It also reorders the recipe so hidden prep, like heating the pan, comes before you need it. One flow, done well, with a live moment judges can watch at our table.

## The problem

Following a recipe means touching your phone with messy hands, unlocking it, and finding your place again. This comes from my own cooking: I get distracted, forget what's next, and the friction makes trying new recipes feel like work.

Recipes are also written to be read, not cooked from. Prep hides mid-recipe, like "preheat the oven" in step 6 or "butter, softened" only in the ingredient list, so reading one line at a time means doing things too early or too late.

Two more pain points come before you even start: not knowing if you have enough of everything, and searching for substitutes. Voice assistants can read steps aloud, but none of them can see your food, so they can't answer the question cooks actually ask: is this ready?

## What it does

**One-liner:** SousSight is a hands-free cooking buddy that watches your bowl and tells you when you're ready for the next step, for beginner cooks who give up on new recipes.

1. **Paste a recipe.** AI reorders it into short steps: hidden prep moves to a "Before you start" list, steps that can overlap are marked, and a heads-up comes one step before you need something, like a hot pan. Each step gets a "ready when" cue, such as "batter is smooth, no dry flour streaks".
2. **Start cooking mode.** The laptop sits on the counter with the camera on. The current step shows in huge text and is read aloud.
3. **Thumbs-up to move on.** The next step is read aloud. Thumbs-down repeats the step or goes back one.
4. **Open palm to check.** Only steps with a visual "ready when" cue offer a check, usually 1–3 per recipe, and it's never required to move on. A Logitech webcam on a small tripod sits behind the pan, angled down about 45°, so nothing gets lifted; it takes one snapshot.
5. **Hear the verdict.** The AI compares the snapshot to that step's "ready when" cue and answers out loud: "Still lumpy, keep mixing" or "Looks smooth, next step."

The user never touches the screen after pressing Start.

## Why it can win

Judges remember one moment they can retell: "the app that looked at the batter and said keep mixing." Voice cooking modes already read steps aloud; none of them can see your food. StormHacks 2026 lists four unweighted criteria ([Devpost](https://stormhacks2026.devpost.com/)):

| Criterion | How SousSight scores |
| --- | --- |
| Technical Complexity | In-browser gesture recognition, AI recipe reordering (what must happen before what), and a vision check grounded in each step's "ready when" cue |
| Design | A glanceable cooking screen readable from 2 m away, one action per gesture |
| Pitch | A relatable problem plus a live demo a judge can try with a thumbs-up |
| Originality/Creativity | A cooking assistant that reorders recipes so nothing is done too early, and can see whether your food is ready |

**Prizes to target** (seven prizes on [Devpost](https://stormhacks2026.devpost.com/)): the Grand Prize, Best Use of Gemini API, Best Use of ElevenLabs, and Best .Tech Domain Name. All three sponsor prizes come straight from the core demo. We skip Solana, Tiger Data and Snowflake, which would mean bolting on features.

## Scope

We build one flow that works every time, not five that half work. Anything on screen during the demo must actually run; anything stubbed is said out loud.

| Must-have (v1) | Nice-to-have (after v1 works end to end) | Not building |
| --- | --- | --- |
| Recipe text → reordered steps (prep first, heads-up warnings) with "ready when" cues | Prep check: say or snap what you have, get missing items and substitutes | Continuous video recording or analysis |
| Big-text cooking screen | Auto timers for steps like "bake 20 minutes" | Auto-detecting that a step is finished |
| Thumbs-up / thumbs-down navigation | Browser-voice fallback when offline | Accounts, login, saved recipes |
| Steps read aloud with ElevenLabs | Import from a recipe link | Recipe search or database |
| Open-palm "check it" from a Logitech webcam angled at 45°, with spoken verdict | Scaling servings | Native mobile app |
| Deployed on our .tech domain with the demo recipe preloaded | Local LLM for /parse, only if a teammate has run Ollama or WebLLM before |  |

The prep check is the first nice-to-have to build, because it covers the "do I have enough?" pain point.

## How it works

&#91;embedded content: How SousSight works · 3 flows\]

Only recipe parsing and the bowl check use the network. Gesture tracking runs on every frame on the laptop, so moving between steps stays instant even on slow Wi-Fi.

## Tech stack and data shapes

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Vite + React + TypeScript | Fast to start; familiar |
| Gestures | MediaPipe Gesture Recognizer (`@mediapipe/tasks-vision`) | Recognizes Thumb\_Up, Thumb\_Down and Open\_Palm out of the box, in the browser, no training ([docs](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer)) |
| Voice | ElevenLabs text-to-speech; browser speech as an offline fallback | Natural voice and the Best Use of ElevenLabs prize. Generate step audio right after parsing; only verdicts are generated live |
| AI | Gemini API (text + vision) | One provider parses and reorders recipes and judges snapshots; Best Use of Gemini API prize |
| Backend | Vercel serverless functions | Keeps the API key off the client; Vercel is a 2026 partner |
| Repo | GitHub, `main` always deployable | Every teammate can deploy at any time |
| Food camera | Logitech USB webcam on a small tripod behind the pan, angled down about 45°; the laptop webcam stays on gestures | No lifting hot pans; plugs into any laptop over USB and shows up in Chrome as a second camera, no Mac or iPhone needed |
| Domain | A .tech domain (e.g. soussight.tech) pointed at Vercel | Best .Tech Domain Name prize; doubles as the demo URL |

Agree on these shapes in the first hour so frontend and backend can work in parallel:

```json
{
  "prep": [
    "Take the egg and milk out of the fridge",
    "Get out a pan and a ladle"
  ],
  "steps": [
    {
      "id": 3,
      "text": "Whisk the flour, milk and egg into a batter.",
      "spoken": "Step 3. Whisk the flour, milk and egg into a batter.",
      "readyWhen": "Batter is smooth with no dry flour streaks",
      "headsUp": "Next step needs a hot pan. Turn it on now.",
      "parallelWith": null,
      "timerSeconds": null
    }
  ],
  "verdict": {
    "ready": false,
    "feedback": "Still some dry flour streaks. Keep whisking."
  }
}
```

The vision prompt sends the snapshot plus that step's `readyWhen` cue, and asks for the `verdict` JSON with feedback under 15 words.

The `/parse` prompt moves hidden prep (preheating, softening, thawing) into `prep`, adds a `headsUp` one step before it's needed, and marks steps that can overlap in `parallelWith`. It never deletes steps or changes amounts.

## Team roles

Four roles; with three people, merge AI/backend with camera/integration. Add your name to the role you want.

| Role | Owns | Owner |
| --- | --- | --- |
| Presenter / PM | Scope calls, demo script, pitch, Devpost write-up, demo video, checkpoint meetings |  |
| Frontend + design | Cooking screen, recipe input screen, big-type layout, "looking…" and verdict states |  |
| AI + backend | `/parse` and `/check` functions, prompts, testing the check on 10+ real photos |  |
| Camera + integration | MediaPipe gestures, hold-to-confirm, second camera (Logitech webcam), wiring gestures to steps and speech, deploys |  |

Everyone must be able to explain their own part. "What did you build this weekend?" is a standard judge question.

## 24-hour plan

The full flow works on the deployed URL by 10 PM Saturday, and features freeze at 2 AM. Times assume last year's schedule (hacking 10 AM Sat to 10 AM Sun); shift every row once the 2026 schedule is announced.

| Time | Checkpoint | Done when |
| --- | --- | --- |
| Sat 9–10 AM | Check-in and opening ceremony | Theme, prize list, deadline, video rules and AI policy written down |
| 10–11 AM | Idea locked | Theme angle chosen, sponsors asked what they want, one-liner and 90-second demo script written |
| 11 AM–12 PM | Setup | Fresh repo, blank app deployed to Vercel, .tech domain pointed at it, `steps` and `verdict` shapes agreed |
| 12–2 PM | Skeleton | Cooking screen shows hardcoded pancake steps; thumbs-up logs in the console; `/parse` returns reordered steps |
| 2–6 PM | Core build | Gestures move through steps with ElevenLabs speech; `/check` returns verdicts on test photos |
| 6–7 PM | Dinner check-in | Cut list agreed, sleep shifts set, Devpost draft started |
| 7–10 PM | **Midpoint** | Full flow works end to end on the deployed URL with real batter photos |
| 10 PM–2 AM | Polish | UI polished, Logitech camera framed on the pan, prompts tuned on 10+ photos and 5+ real recipes, 60-second backup screen recording saved by midnight |
| Sun 2 AM | **Feature freeze** | No new features or refactors; known-good build tagged |
| 2–5 AM | Sleep shifts + fixes | Presenter sleeps at least 90 minutes; README has stack, AI disclosure and what's stubbed |
| 5–7 AM | Demo video | Video of 3 minutes or less recorded, uploaded unlisted, link tested in incognito |
| 7–8 AM | **Submit** | Devpost has link, video, repo, the Gemini, ElevenLabs and .Tech prize tracks, all teammates, AI disclosure |
| 8–10 AM | Rehearse | 3–5 timed runs of the pitch, at least one in front of a mentor or stranger |
| After 10 AM | Judging | Last year: 3-minute pitch + 1-minute Q&A, repeated for up to three judges |

Don't write project code before kickoff. StormHacks' 2023 rules banned all pre-event work and checked GitHub history ([2023 rules](https://stormhacks-2023.devpost.com/rules)).

## Demo and pitch

The product is working on screen by 0:30, and the two-verdict moment lands before 2:00.

1. **0:00–0:20 Hook.** "Who's unlocked their phone with flour on their fingers?" One sentence on losing your place and giving up on new recipes.
2. **0:20–0:30 One-liner.** "SousSight is a hands-free cooking buddy that watches your bowl and tells you when you're ready for the next step."
3. **0:30–2:00 Live demo.**
   1. Paste the pancake recipe and show the original beside the reordered one: the buried "heat the pan" now arrives as a heads-up one step early.
   2. Thumbs-up; the whisking step is read aloud. Invite a judge to do the next thumbs-up.
   3. Open palm while the Logitech camera sees lumpy batter: "Still lumpy, keep mixing."
   4. Whisk, check again: "Looks smooth, next step." The next step is read aloud.
4. **2:00–2:35 How it works.** Gestures run on the laptop, so they're instant and private. Name Gemini (reordering, plus the vision check grounded in each step's cue) and ElevenLabs (the voice).
5. **2:35–3:00 Impact and next.** Beginner cooks; next is the prep check with substitutes.

**Q&A prep:** what's real vs. stubbed; how accurate the check is ("tested on N photos"); privacy (one snapshot on request, no video stored); what breaks first at scale (API latency and cost).

**Props:** bowl, whisk, pancake mix, water bottle, tray, paper towels, webcam tripod. Also bring two lidded jars, one of lumpy and one of smooth batter, as a backup if live mixing goes wrong. Keep the backup video one click away.

## Theme fit

The theme is revealed at the opening ceremony, so we keep the core and change the angle.

| If the theme is about… | Angle | What changes |
| --- | --- | --- |
| Sustainability | Cook with what you have, waste less food | Promote the prep check with substitutes to must-have |
| Health / wellness | Cooking at home instead of takeout | Pitch beginners building a habit |
| Accessibility | Hands-free, spoken steps | Pitch cooks who can't easily touch or read a screen; don't overclaim without user input |
| Learning / education | Teaching beginners what "done" looks like | Verdicts explain why, not just yes or no |
| Campus / community | Cheap recipes for residence kitchens | Demo a student-budget recipe |

If the theme fits none of these, we switch to the backup idea (the stretch-break app) and keep the same plan.

## Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| Vision verdicts are wrong or inconsistent | Ground the prompt in the step's `readyWhen` cue; demo steps with an obvious visual change; test 10+ photos per demo step |
| AI response takes a few seconds | Show a "looking…" state and say "Let me look" right away |
| Gestures trigger by accident | Require the gesture held about 1 second, then a short cooldown |
| Venue is noisy | Navigation uses gestures, not voice; bring a small speaker |
| Venue lighting fools the camera | Test at our table early; bring a clip-on light |
| Wi-Fi drops | Phone hotspot; demo recipe preloaded; backup video saved locally |
| Mess at the table | Tray, paper towels, lidded jars |
| API key leaks | Key lives only in Vercel environment variables |
| Rule problems | No project code before kickoff; disclose AI coding tools in the README and on Devpost |
| Reordering puts a step in the wrong place | Prompt only moves prep and adds heads-ups, never deletes steps or changes amounts; test on 5+ real recipes; keep the original recipe one tap away |
| Logitech webcam doesn't connect, or Chrome doesn't list it | Test at our table first thing; try another USB port or adapter; fall back to the laptop camera with the pan angled toward it |
| ElevenLabs credits run out or audio lags | Generate step audio once per recipe and cache it; fall back to browser speech |

## Prep checklist

Prepare accounts, tools and props, not project code.

**Tonight (Friday)**

- [ ] Everyone confirms their StormHacks acceptance (Devpost registration is not the same as acceptance)
- [ ] Join the StormHacks Devpost and Discord; add teammates on Devpost
- [ ] Create accounts and keys: GitHub, Vercel, a Gemini API key (Google AI Studio), ElevenLabs; check free-tier limits
- [ ] Install Node LTS, Git and VS Code; pre-download common packages (venue Wi-Fi is slow)
- [ ] Learn, don't build: try the MediaPipe gesture demo and one Gemini image prompt in a throwaway file, then delete it
- [ ] Check the Logitech webcam shows up as a second camera in Chrome alongside the laptop webcam
- [ ] Shortlist 2–3 .tech domain names
- [ ] Pick the demo recipe: pancakes with buried prep (hot pan, resting batter)
- [ ] Read this doc and comment on the open questions below
- [ ] Charge everything and sleep a full night

**Pack**

- [ ] Laptops, phones, chargers, a power bar, a battery pack
- [ ] Logitech webcam with a small tripod or clamp, USB adapter if needed, small speaker, clip-on light
- [ ] Demo props: bowl, whisk, pancake mix, water bottle, tray, paper towels, two lidded jars
- [ ] Jacket, water bottle, earplugs, toiletries, snacks

**Saturday morning**

- [ ] Arrive by about 9 AM, check in at the AQ, claim a table near power
- [ ] At the opening ceremony, note the theme, deadline, video rules, AI policy, and how to claim the .tech domain and any API credits
- [ ] Ask the Google, ElevenLabs and MLH reps what they want to see
- [ ] Within the first hour, lock the theme angle, final name and roles

## Open questions

- [ ] Who takes which role?
- [ ] Keep the name SousSight, or pick another?
- [ ] Live mixing at the table, or the pre-made jars only?
- [ ] Which .tech domain name do we register?
- [ ] Local LLM as a stretch goal: has anyone run Ollama or WebLLM before?
- [ ] Who brings the Logitech webcam, and does the demo laptop have a free USB port?
- [ ] Are we three or four people?

## Sources

- [StormHacks 2026 on Devpost](https://stormhacks2026.devpost.com/): dates, judging criteria, demo video requirement
- [StormHacks 2025 on Devpost](https://stormhacks2025.devpost.com/): judging format, MLH prize APIs, [project gallery](https://stormhacks2025.devpost.com/project-gallery)
- [StormHacks 2023 rules](https://stormhacks-2023.devpost.com/rules): no pre-event work
- [MediaPipe Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer): built-in gestures, web support
