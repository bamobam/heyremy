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
}

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
