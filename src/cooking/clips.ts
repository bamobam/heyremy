// Which audio clips the prep screen has to make before Start can turn on: the two fixed lines, then one
// clip per step, at the chosen servings, Level and Persona (ADR 0003: only the chosen Level's clips are
// voiced). Pure. The provider makes these; the reducer uses the ids to drop clips a settings change
// made unwanted.
import { DONE_CLIP, LOOKING_CLIP, fixedClipId, fixedLine } from '../audio/lines.ts'
import { stepClipId } from './scaling.ts'
import type { CookingState } from './state.ts'
import { filledSteps } from './uiSelectors.ts'

export interface WantedClip {
  id: string
  text: string
}

export function wantedClips(s: CookingState): WantedClip[] {
  const recipe = s.recipe
  if (!recipe) return []
  const { level, persona } = s.settings
  const steps = filledSteps(s).map((step, i) => ({ id: stepClipId(recipe.steps[i], s.servings, level, persona), text: step.spoken }))
  return [
    { id: fixedClipId(LOOKING_CLIP, persona), text: fixedLine(LOOKING_CLIP, persona) },
    { id: fixedClipId(DONE_CLIP, persona), text: fixedLine(DONE_CLIP, persona) },
    ...steps,
  ]
}
