// PrepReview (§9.2): the recipe card with scaled amounts, what to do before starting, and the camera
// setup check. The Start button only comes alive once every clip for the chosen servings is cached.
import { canStart, scaledIngredients, useCooking } from '../cooking/contract.ts'
import { HEAD_SRC, RemyBadge, SpeechBubble } from './Remy.tsx'
import { SAY } from './say.ts'
import { CameraSetup, ErrorBanner, IngredientList, PrepChecklist, ServingsStepper, VoicingProgress } from './prep.tsx'

/** A rough read of how long the recipe takes, from the step count. */
function timeChip(stepCount: number): string {
  const minutes = Math.max(5, Math.round(stepCount * 4))
  return `${stepCount} steps, about ${minutes} minutes`
}

export function PrepReview() {
  const { state, controller, dispatch, voiceFailed } = useCooking()
  const recipe = state.recipe

  if (!recipe) return null

  return (
    <div className="ui-prep ui-enter">
      <ErrorBanner error={state.error} onDismiss={() => dispatch({ type: 'errorDismissed' })} />
      <header className="ui-top">
        <div className="ui-logo">
          <img src={HEAD_SRC} alt="" />
          REMY
        </div>
        <div className="ui-chip">{timeChip(recipe.steps.length)}</div>
      </header>

      <div className="ui-prep__grid">
        <section className="ui-prep__card">
          <div className="ui-prep__head">
            <RemyBadge size={132} color="var(--apricot)" form="cookie" />
            <div>
              <h1>{recipe.title}</h1>
              <ServingsStepper servings={state.servings} original={recipe.servings} onChange={controller.setServings} />
            </div>
          </div>
          <IngredientList ingredients={scaledIngredients(state)} />
        </section>

        <section className="ui-prep__side">
          <div>
            <PrepChecklist items={recipe.prep} />
            <CameraSetup />
          </div>
          <div className="ui-remy-line ui-remy-line--small">
            <img src={HEAD_SRC} alt="" />
            <SpeechBubble small>{SAY.prep}</SpeechBubble>
          </div>
          <button type="button" className="ui-btn ui-btn--wide" onClick={controller.start} disabled={!canStart(state)}>
            Remy, let's cook!
          </button>
          <VoicingProgress ready={state.voicing.servings === state.servings ? state.voicing.ready.length : 0} total={state.voicing.total} failed={voiceFailed} onRetry={controller.retryVoicing} />
        </section>
      </div>
    </div>
  )
}