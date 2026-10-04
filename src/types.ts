// Shapes shared by the frontend and the api/ functions. Terms match CONTEXT.md.

export interface Step {
  id: number
  /** Shown on the cooking screen. */
  text: string
  /** Read aloud, e.g. "Step 3. Whisk the flour, milk and egg into a batter." */
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
  prep: string[]
  steps: Step[]
}

/** Returned by POST /api/check { image: base64 JPEG, cue: string }. */
export interface Verdict {
  ready: boolean
  /** Spoken to the cook, under 15 words. */
  feedback: string
}
