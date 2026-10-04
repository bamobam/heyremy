// RecipeInput (§9.2): the welcome split, and the parsing field while Remy reads the recipe.
import { DEMO_RECIPE_TEXT, type CookingError } from '../cooking/contract.ts'
import { HEAD_SRC, RemyBadge, RemyLoader, SpeechBubble } from './Remy.tsx'
import { SAY } from './say.ts'
import { injectShapeKeyframes } from './shapes.ts'
import { ErrorBanner } from './prep.tsx'

injectShapeKeyframes()

/** The three lines Remy is working through, revealed as he goes. */
const TICKER = ['Finding ingredients', 'Moving hidden prep up front', 'Writing what "done" looks like']

export function RecipeInput({
  phase,
  recipeText,
  error,
  onTextChange,
  onSubmit,
  onDismissError,
}: {
  phase: 'input' | 'parsing'
  recipeText: string
  error: CookingError | null
  onTextChange: (text: string) => void
  onSubmit: (text: string) => void
  onDismissError: () => void
}) {
  if (phase === 'parsing') {
    return (
      <div className="ui-full ui-enter" style={{ background: 'var(--slate)' }}>
        <RemyLoader size={250} label={SAY.reading} />
        <div className="ui-ticker">
          {TICKER.map(line => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="ui-welcome ui-enter">
      <ErrorBanner error={error} onDismiss={onDismissError} />
      <div className="ui-welcome__left">
        <div className="ui-logo ui-logo--light">
          <img src={HEAD_SRC} alt="" />
          REMY
        </div>
        <div className="ui-welcome__copy">
          <div className="ui-welcome__catch">“Hey Remy, let's cook!”</div>
          <h1>
            Cook it.
            <br />
            Don't touch it.
          </h1>
          <p>Paste a recipe. Remy reads every step out loud, watches your bowl, and tells you when it's ready.</p>
          <div className="ui-welcome__hints">
            <span>👍 next</span>
            <span>👎 back</span>
            <span>✋ is it ready?</span>
          </div>
        </div>
      </div>
      <div className="ui-welcome__right">
        <div className="ui-welcome__meet">
          <RemyBadge size={200} color="var(--pink)" form="sunny" />
          <SpeechBubble>
            <b>{SAY.hello}</b>
            <br />
            {SAY.ask}
          </SpeechBubble>
        </div>
        <textarea
          value={recipeText}
          onChange={e => onTextChange(e.target.value)}
          aria-label="Paste a recipe"
          spellCheck={false}
        />
        <div className="ui-row">
          <button type="button" className="ui-btn" onClick={() => onSubmit(recipeText)} disabled={recipeText.trim() === ''}>
            Let's cook!
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { onTextChange(DEMO_RECIPE_TEXT); onSubmit(DEMO_RECIPE_TEXT) }}>
            Try the pancake demo
          </button>
        </div>
      </div>
    </div>
  )
}