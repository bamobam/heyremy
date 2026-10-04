// PROTOTYPE (throwaway) — Variant A "Recipe card": light kitchen, illustrated recipe-card prep, steps as a sideways card carousel.
import type { Flow } from './useFlow'
import { recipe, formatAmount, ingredientLook } from './data'
import { HEAD, MASCOT, RemyLoader, IngredientArt } from './shared'
import './variantA.css'

export const name = 'Recipe card'

const STEP_COLORS = ['#EDCEBA', '#E3BEB2', '#B7BDB6', '#DE9762', '#F4905F', '#BE7463']

export function VariantA({ flow }: { flow: Flow }) {
  return (
    <div className="va">
      <header className="va-top">
        <div className="va-logo"><img src={HEAD} alt="" />REMY</div>
        {flow.screen === 'cooking' && (
          <div className="va-dots">{recipe.steps.map((_, i) => <i key={i} className={i < flow.step ? 'd' : i === flow.step ? 'n' : ''} />)}</div>
        )}
      </header>

      <div key={flow.screen} className="va-stage">
        {flow.screen === 'paste' && (
          <div className="va-paste">
            <div className="va-hero">
              <div className="va-bubble">Hi, I'm Remy! Paste a recipe and I'll cook it with you, one step at a time.</div>
              <img src={MASCOT} alt="" className="va-hero-img" />
            </div>
            <div className="va-ask">
              <h1>What are we cooking today?</h1>
              <textarea className="va-box" defaultValue={'Fluffy pancakes (serves 4)\n1 cup flour, 2 tbsp sugar, 2 tsp baking powder, ½ tsp salt, ¾ cup milk, 1 egg, 2 tbsp butter…'} />
              <div className="va-row"><button className="va-btn" onClick={flow.parse}>Let's cook</button><button className="va-btn ghost" onClick={flow.parse}>Try the pancake demo</button></div>
            </div>
          </div>
        )}

        {flow.screen === 'reading' && <div className="va-center"><RemyLoader size={240} label="Reading your recipe…" /></div>}

        {flow.screen === 'prep' && (
          <div className="va-prep">
            <section className="va-card">
              <div className="va-card-head">
                <div className="va-plate"><img src={MASCOT} alt="" /></div>
                <div>
                  <div className="va-kicker">Tonight's recipe</div>
                  <h1>{recipe.title}</h1>
                  <div className="va-stepper">
                    <button onClick={() => flow.setServings(Math.max(1, flow.servings - 1))}>−</button>
                    <b>{flow.servings} servings</b>
                    <button onClick={() => flow.setServings(flow.servings + 1)}>+</button>
                  </div>
                </div>
              </div>
              <div className="va-ing">
                {recipe.ingredients.map(i => (
                  <div key={i.id} className="va-ing-item" style={{ background: `${ingredientLook[i.id]?.color ?? '#EDCEBA'}55` }}>
                    <IngredientArt id={i.id} size={78} />
                    <b>{formatAmount(i.amount, i.unit, flow.scale)}</b>
                    <span>{i.name}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="va-side">
              <div className="va-before">
                <div className="va-kicker">Before you start</div>
                {recipe.prep.map((p, i) => <div key={p} className="va-before-item"><em style={{ background: STEP_COLORS[i] }}>{i + 1}</em>{p}</div>)}
              </div>
              <button className="va-btn big" onClick={flow.start}>Start cooking</button>
            </section>
          </div>
        )}

        {flow.screen === 'cooking' && (
          <div className="va-cook">
            <div className="va-track" style={{ transform: `translateX(calc(${-flow.step} * (70% + 32px)))` }}>
              {recipe.steps.map((s, i) => (
                <article key={s.id} className={`va-step ${i === flow.step ? 'now' : ''}`} style={{ background: STEP_COLORS[i % STEP_COLORS.length] }}>
                  <div className="va-kicker">Step {i + 1} of {flow.total}</div>
                  <h2>{s.text}</h2>
                  {s.headsUp && <div className="va-headsup">🔥 {s.headsUp}</div>}
                  {s.cue && <div className="va-cue">✋ Ready when: <b>{s.cue}</b></div>}
                </article>
              ))}
            </div>
            <div className="va-remy">
              <img src={HEAD} alt="" />
              <div className="va-bubble small">{flow.current.text}</div>
            </div>
            {flow.check.kind !== 'idle' && (
              <div className="va-overlay">
                {flow.check.kind === 'looking'
                  ? <RemyLoader size={220} label="Hold still, let me look…" />
                  : <div className={`va-verdict ${flow.check.verdict.status}`}>
                      <img src={MASCOT} alt="" />
                      <div><div className="va-kicker">{flow.check.verdict.status.replace('_', ' ')}</div><p>{flow.check.verdict.feedback}</p></div>
                    </div>}
              </div>
            )}
          </div>
        )}

        {flow.screen === 'done' && (
          <div className="va-center">
            <div className="va-bubble">We did it! Enjoy your pancakes.</div>
            <img src={MASCOT} alt="" className="va-hero-img" />
            <button className="va-btn" onClick={flow.restart}>Cook something else</button>
          </div>
        )}
      </div>
    </div>
  )
}
