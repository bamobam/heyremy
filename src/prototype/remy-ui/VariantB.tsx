// PROTOTYPE (throwaway) — Variant B "Color rail": every step owns a full-bleed palette color and pushes up like a ticket on a rail; Remy peeks from the corner.
import type { Flow } from './useFlow'
import { recipe, formatAmount } from './data'
import { HEAD, MASCOT, RemyLoader, IngredientArt } from './shared'
import './variantB.css'

export const name = 'Color rail'

const FIELDS = [
  { bg: '#541B05', fg: '#FFF7EA', accent: '#DE9762' },
  { bg: '#657167', fg: '#FFF7EA', accent: '#EDCEBA' },
  { bg: '#2F3341', fg: '#FFF7EA', accent: '#F4905F' },
  { bg: '#BE7463', fg: '#1D1B20', accent: '#FFF7EA' },
  { bg: '#73462F', fg: '#FFF7EA', accent: '#E3BEB2' },
  { bg: '#DE9762', fg: '#1D1B20', accent: '#541B05' },
]
const VERDICT_BG = { ready: '#657167', not_ready: '#BE7463', unsure: '#9F9593' } as const

export function VariantB({ flow }: { flow: Flow }) {
  const f = FIELDS[flow.step % FIELDS.length]
  return (
    <div className="vb">
      {flow.screen === 'paste' && (
        <div className="vb-paste vb-enter">
          <div className="vb-paste-left">
            <img src={HEAD} alt="" className="vb-mark" />
            <h1>Cook it.<br />Don't touch it.</h1>
            <p>Paste a recipe. Remy reads every step out loud, watches your bowl, and tells you when it's ready.</p>
          </div>
          <div className="vb-paste-right">
            <textarea defaultValue={'Fluffy pancakes (serves 4)\n1 cup flour, 2 tbsp sugar, 2 tsp baking powder, ½ tsp salt, ¾ cup milk, 1 egg, 2 tbsp butter…'} />
            <button onClick={flow.parse}>Hand it to Remy →</button>
          </div>
        </div>
      )}

      {flow.screen === 'reading' && (
        <div className="vb-full vb-enter" style={{ background: '#2F3341' }}>
          <RemyLoader size={260} />
          <div className="vb-ticker"><span>Finding ingredients</span><span>Moving hidden prep up front</span><span>Writing what "done" looks like</span></div>
        </div>
      )}

      {flow.screen === 'prep' && (
        <div className="vb-prep vb-enter">
          <div className="vb-prep-head">
            <div>
              <div className="vb-kicker">Mise en place</div>
              <h1>{recipe.title}</h1>
            </div>
            <div className="vb-serv">
              <button onClick={() => flow.setServings(Math.max(1, flow.servings - 1))}>−</button>
              <div><b>{flow.servings}</b><span>servings</span></div>
              <button onClick={() => flow.setServings(flow.servings + 1)}>+</button>
            </div>
          </div>
          <div className="vb-counter">
            {recipe.ingredients.map((i, n) => (
              <div key={i.id} className="vb-bowl" style={{ animationDelay: `${n * 60}ms` }}>
                <IngredientArt id={i.id} size={84} />
                <b>{formatAmount(i.amount, i.unit, flow.scale)}</b>
                <span>{i.name}</span>
              </div>
            ))}
          </div>
          <div className="vb-prep-foot">
            <ol>{recipe.prep.map(p => <li key={p}>{p}</li>)}</ol>
            <button onClick={flow.start}>Start cooking</button>
          </div>
          <img src={MASCOT} alt="" className="vb-peek" />
        </div>
      )}

      {flow.screen === 'cooking' && (
        <div className="vb-cook" style={{ background: f.bg, color: f.fg }}>
          <div className="vb-rail">{recipe.steps.map((_, i) => <i key={i} className={i === flow.step ? 'on' : i < flow.step ? 'past' : ''} style={i === flow.step ? { background: f.accent } : undefined} />)}</div>
          <div key={flow.step} className={`vb-step ${flow.dir > 0 ? 'up' : 'down'}`}>
            <div className="vb-num" style={{ color: f.accent }}>{String(flow.step + 1).padStart(2, '0')}</div>
            <h2>{flow.current.text}</h2>
            {flow.current.headsUp && <div className="vb-heads" style={{ background: f.accent, color: f.bg }}>Heads-up · {flow.current.headsUp}</div>}
            {flow.current.cue && <div className="vb-cue">✋ show me when it's <b>{flow.current.cue}</b></div>}
          </div>
          <img src={MASCOT} alt="" className="vb-peek" />
          {flow.check.kind === 'looking' && (
            <div className="vb-full vb-cover" style={{ background: 'rgba(29,27,32,.92)' }}><RemyLoader size={240} label="Hold still, let me look…" /></div>
          )}
          {flow.check.kind === 'verdict' && (
            <div className="vb-full vb-cover vb-wipe" style={{ background: VERDICT_BG[flow.check.verdict.status] }}>
              <div className="vb-kicker light">{flow.check.verdict.status.replace('_', ' ')}</div>
              <div className="vb-verdict">{flow.check.verdict.feedback}</div>
              <img src={MASCOT} alt="" className="vb-verdict-remy" />
            </div>
          )}
        </div>
      )}

      {flow.screen === 'done' && (
        <div className="vb-full vb-enter" style={{ background: '#657167', color: '#FFF7EA' }}>
          <img src={MASCOT} alt="" style={{ width: 280 }} className="vb-cheer" />
          <h1 className="vb-done">Plated. Enjoy!</h1>
          <button className="vb-light" onClick={flow.restart}>Cook something else</button>
        </div>
      )}
    </div>
  )
}
