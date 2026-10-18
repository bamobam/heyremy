// What the controller needs from the rest of the app, as small interfaces, so it
// can be tested with fakes and the real pieces can be built separately.

import type { ParsedRecipe, PersonaId, Verdict } from '../types.ts'

/** The backend. The only code in the browser that talks to it. */
export interface ApiClient {
  parseRecipe(recipe: string): Promise<ParsedRecipe>
  /**
   * `step.text` is the step as shown (amounts filled in). Rejects with kind 'aborted' if the signal fires.
   * `persona` only changes how the verdict is worded; left out, it is Remy's.
   */
  checkStep(frame: Blob, step: { text: string; cue: string }, opts?: { signal?: AbortSignal; persona?: PersonaId }): Promise<Verdict>
}

/** The hat cam, as the controller sees it (see useCamera). */
export interface CameraPort {
  /** Waits for the palm that asked for the check to leave the frame, then captures the sharpest frame. */
  grabForCheck(): Promise<{ blob: Blob }>
  /** A gesture is being held right now, so a "ready" countdown should wait. */
  isHolding(): boolean
}
