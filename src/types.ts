// Shapes shared by the frontend and the api/ functions. Terms match CONTEXT.md.

export interface Ingredient {
  /** Short slug used in step placeholders, e.g. "flour" for {flour}. */
  id: string
  /** Amount at the recipe's original servings; null for "a pinch", "to taste". */
  amount: number | null
  /** e.g. "cup", "tbsp", "g"; null for whole items like eggs. */
  unit: string | null
  name: string
}

export interface Step {
  id: number
  /** Shown on the cooking screen. May contain {ingredientId} placeholders, filled in at the chosen servings. */
  text: string
  /** Read aloud, e.g. "Step 3. Whisk {flour} with {milk} and {egg}." Same placeholders as text. */
  spoken: string
  /** The visible sign the step is done, e.g. "Batter is smooth with no dry flour streaks". */
  cue: string | null
  /** True only when the cue can be judged from a photo of the food. */
  checkable: boolean
  /** Warning about something the next step needs ready, e.g. "Next step needs a hot pan. Turn it on now." */
  headsUp: string | null
  /** `spoken` at the intermediate Level: shorter, drops the basics. Missing (old saved data) means read `spoken`. */
  spokenIntermediate?: string
  /** `spoken` at the master Level: terse, trusts the cook. Missing means read `spoken`. */
  spokenMaster?: string
  /** The cue changes with time (boiling, browning, rising), so one photo can't judge it. Only ever true on a checkable step. */
  timeDependent?: boolean
}

/** How much guidance Remy speaks while reading steps (CONTEXT.md **Level**). `spoken` is the beginner one. */
export type Level = 'beginner' | 'intermediate' | 'master'

/** The character Remy speaks as (CONTEXT.md **Persona**): invented archetypes, never real chefs. */
export type PersonaId = 'remy' | 'grandma' | 'sergeant'

/** Returned by POST /api/parse { recipe: string }. */
export interface ParsedRecipe {
  title: string
  /** Servings the pasted recipe makes; scaling multiplies amounts by chosen / servings. */
  servings: number
  ingredients: Ingredient[]
  prep: string[]
  steps: Step[]
}

/** Returned by POST /api/check { image: base64 JPEG, cue: string, step: string }. */
export interface Verdict {
  /** "unsure" when the food isn't clearly visible (blurry, out of frame, hand in the way). */
  status: 'ready' | 'not_ready' | 'unsure'
  /** Spoken to the cook, under 15 words; includes a fix when not_ready. */
  feedback: string
}

/** What a held gesture asks for. Thumbs-up = next, thumbs-down = back, open palm = check. */
export type GestureIntent = 'next' | 'back' | 'check'

/** Fired once when a gesture has been held long enough. */
export interface GestureEvent {
  intent: GestureIntent
  /** performance.now() when the hold completed. */
  at: number
}

/** Drives the hold ring while a gesture is being held. */
export interface HoldProgress {
  /** The gesture being held, or null when nothing is. */
  intent: GestureIntent | null
  /** 0..1 */
  progress: number
}

// ---------- Requests to the backend ----------

/** POST /api/parse */
export type ParseRequest = { recipe: string }
/** POST /api/check. `image` is a base64 JPEG with no data: prefix. `persona` only changes how `feedback` is worded. */
export type CheckRequest = { image: string; cue: string; step: string; persona?: PersonaId }
/** POST /api/speak. The response is audio/mpeg. `persona` picks the voice (the default voice when none is set up). */
export type SpeakRequest = { text: string; persona?: PersonaId }

// ---------- API errors (the client and the server agree on these) ----------

export type ApiErrorKind =
  | 'bad_request' // 400: input too large or malformed
  | 'unprocessable' // 422: model output could not be validated
  | 'upstream' // 502: Gemini or ElevenLabs failed
  | 'rate_limited' // 429
  | 'timeout' // client side only
  | 'aborted' // client side only
  | 'unknown'

export type ApiErrorBody = { error: { kind: ApiErrorKind; message: string } }
