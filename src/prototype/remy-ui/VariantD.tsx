// PROTOTYPE (throwaway) — Variant D "Best of A + B": B's palette, welcome split and prep→cook rise; A's prep dashboard, card carousel, bob and verdict pop.
import { useState } from 'react'
import type { Flow } from './useFlow'
import { recipe, formatAmount, ingredientLook } from './data'
import { HEAD, RemyLoader, IngredientArt } from './shared'
import { RiggedRemy } from './RiggedRemy'
import { RemyBadge } from './RemyBadge'
import { CameraView } from './CameraView'
import { useHatCam } from '../../camera/useHatCam'
import './variantD.css'
import { shape, STEP_SHAPES, VERDICT_SHAPE } from './shapes'


export const name = 'Best of A + B'

// B's color fields, one per step: card color, page backdrop (a deeper shade), text, accent.
const FIELDS = [
  { card: '#541B05', back: '#2A0D02', fg: '#FFF7EA', accent: '#DE9762' },
  { card: '#657167', back: '#343B35', fg: '#FFF7EA', accent: '#EDCEBA' },
  { card: '#2F3341', back: '#181A22', fg: '#FFF7EA', accent: '#F4905F' },
  { card: '#BE7463', back: '#5E3127', fg: '#1D1B20', accent: '#FFF7EA' },
  { card: '#73462F', back: '#3A2317', fg: '#FFF7EA', accent: '#E3BEB2' },
  { card: '#DE9762', back: '#6E4325', fg: '#1D1B20', accent: '#541B05' },
]
const VERDICT = { ready: '#657167', not_ready: '#BE7463', unsure: '#9F9593' } as const
const PREP_DOTS = ['#DE9762', '#BE7463', '#657167', '#2F3341']

// Remy's voice: short, warm, a little French-kitchen. Reused by speech later.
export const SAY = {
  hello: "Hey, I'm Remy! Let's cook!",
  ask: 'What are we making today, chef?',
  reading: 'Sniffing out the steps…',
  prep: 'Mise en place, chef! Ready when you are.',
  go: 'Remy ready! Aprons on.',
  look: 'Whiskers on it… hold still!',
  verdict: { ready: 'Oui, chef!', not_ready: 'Almost, chef!', unsure: "Hmm, my whiskers can't see that" },
  headsUp: 'Psst, chef!',
  done: 'Bon appétit, chef!',
} as const

export function VariantD({ flow }: { flow: Flow }) {
  const f = FIELDS[flow.step % FIELDS.length]
  const cam = useHatCam()
  const [ticked, setTicked] = useState<string[]>([])
  const tick = (p: string) => setTicked(t => t.includes(p) ? t.filter(x => x !== p) : [...t, p])
  return (
    <div className="vd">
      {flow.screen === 'paste' && (
        <div className="vd-paste vd-enter">
          <div className="vd-paste-left">
            <div className="vd-logo light"><img src={HEAD} alt="" />REMY</div>
            <div className="vd-paste-copy">
              <div className="vd-catch">“Hey Remy, let's cook!”</div>
              <h1>Cook it.<br />Don't touch it.</h1>
              <p>Paste a recipe. Remy reads every step out loud, watches your bowl, and tells you when it's ready.</p>
              <div className="vd-hints"><span>👍 next</span><span>👎 back</span><span>✋ is it ready?</span></div>
            </div>
          </div>
          <div className="vd-paste-right">
            <div className="vd-meet">
              <RemyBadge size={200} color="#F6B3BC" form="sunny" />
              <div className="vd-bubble left"><b>{SAY.hello}</b><br />{SAY.ask}</div>
            </div>
            <textarea defaultValue={'Fluffy pancakes (serves 4)\n1 cup flour, 2 tbsp sugar, 2 tsp baking powder, ½ tsp salt, ¾ cup milk, 1 egg, 2 tbsp butter…'} />
            <div className="vd-row"><button className="vd-btn" onClick={flow.parse}>Let's cook!</button><button className="vd-btn ghost" onClick={flow.parse}>Try the pancake demo</button></div>
          </div>
        </div>
      )}

      {flow.screen === 'reading' && (
        <div className="vd-full vd-enter" style={{ background: '#2F3341' }}>
          <RemyLoader size={250} label={SAY.reading} />
          <div className="vd-ticker"><span>Finding ingredients</span><span>Moving hidden prep up front</span><span>Writing what "done" looks like</span></div>
        </div>
      )}

      {flow.screen === 'prep' && (
        <div className="vd-prep-page vd-enter">
          <header className="vd-top"><div className="vd-logo"><img src={HEAD} alt="" />REMY</div><div className="vd-chip">6 steps, about 25 minutes</div></header>
          <div className="vd-prep">
            <section className="vd-card">
              <div className="vd-card-head">
                <RemyBadge size={132} color="#DE9762" form="cookie" />
                <div>
                  <h1>{recipe.title}</h1>
                  <div className="vd-stepper">
                    <button onClick={() => flow.setServings(Math.max(1, flow.servings - 1))}>−</button>
                    <b>{flow.servings} servings</b>
                    <button onClick={() => flow.setServings(flow.servings + 1)}>+</button>
                  </div>
                </div>
              </div>
              <div className="vd-ing">
                {recipe.ingredients.map((i, n) => (
                  <div key={i.id} className="vd-ing-item" style={{ background: `${ingredientLook[i.id]?.color ?? '#EDCEBA'}55`, animationDelay: `${n * 50}ms` }}>
                    <IngredientArt id={i.id} size={74} />
                    <b>{formatAmount(i.amount, i.unit, flow.scale)}</b>
                    <span>{i.name}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="vd-side">
              <div className="vd-before">
                <h3>Before you start</h3>
                {recipe.prep.map((p, i) => (
                  <label key={p} className={`vd-before-item ${ticked.includes(p) ? 'done' : ''}`}>
                    <input type="checkbox" checked={ticked.includes(p)} onChange={() => tick(p)} />
                    <span className="vd-box" style={{ borderColor: PREP_DOTS[i], background: ticked.includes(p) ? PREP_DOTS[i] : 'transparent' }} />
                    {p}
                  </label>
                ))}
              </div>
              <CameraView cam={cam} primary={flow.screen === 'prep'} caption="Hat cam: aim it at your bowl" className="vd-prep-cam" />
              <div className="vd-remy-line"><img src={HEAD} alt="" /><div className="vd-bubble small left">{SAY.prep}</div></div>
              <button className="vd-btn big" onClick={flow.start}>Remy, let's cook!</button>
            </section>
          </div>
        </div>
      )}

      {flow.screen === 'cooking' && (
        <div className="vd-cook" style={{ background: f.back, color: f.fg }}>
          <header className="vd-top">
            <div className="vd-logo light"><img src={HEAD} alt="" />REMY</div>
            <div className="vd-dots">{recipe.steps.map((_, i) => <i key={i} className={i < flow.step ? 'd' : i === flow.step ? 'n' : ''} style={i === flow.step ? { background: f.accent } : undefined} />)}</div>
          </header>
          <div className="vd-rise">
            <div className="vd-track" style={{ transform: `translateX(calc(${-flow.step} * (58% + 32px)))` }}>
              {recipe.steps.map((s, i) => {
                const c = FIELDS[i % FIELDS.length]
                return (
                  <article key={s.id} className={`vd-step ${i === flow.step ? 'now' : ''}`} style={{ background: c.card, color: c.fg }}>
                    <div className="vd-num" style={{ background: c.accent, color: c.card, clipPath: shape(STEP_SHAPES[i % STEP_SHAPES.length], i * 20) }}>{i + 1}</div>
                    <h2>{s.text}</h2>
                    {s.headsUp && <div className="vd-heads" style={{ background: c.accent, color: c.card }}>🔥 {s.headsUp}</div>}
                    {s.cue && <div className="vd-cue">✋ Ready when: <b>{s.cue}</b></div>}
                  </article>
                )
              })}
            </div>
          </div>
          <CameraView cam={cam} primary={flow.screen === 'cooking'} className="vd-cook-cam" />
          <div className="vd-remy"><img src={HEAD} alt="" /><div className="vd-bubble small left">{flow.step === 0 && <b>{SAY.go} </b>}{flow.current.headsUp && <b>{SAY.headsUp} </b>}{flow.current.text}</div></div>
          <div className="vd-legend"><div className="vd-group"><span>👎 back</span><span className={flow.current.checkable ? 'hot' : 'off'}>✋ is it ready?</span><span className="main">👍 next</span></div></div>

          {flow.check.kind === 'looking' && (
            <div className="vd-full vd-fade vd-looking" style={{ background: 'rgba(29,27,32,.92)' }}><CameraView cam={cam} caption="Remy is looking at this" className="vd-look-cam" /><RemyLoader size={200} label={SAY.look} /></div>
          )}
          {flow.check.kind === 'verdict' && (
            <div className="vd-full vd-wipe" style={{ background: VERDICT[flow.check.verdict.status] }}>
              <div className={`vd-verdict ${flow.check.verdict.status}`}>
                <div className="vd-hero">
                  <div className="vd-hero-shape" style={{ clipPath: shape(VERDICT_SHAPE[flow.check.verdict.status]) }} />
                  {flow.check.verdict.status === 'ready' && <><i className="vd-spark s1">✦</i><i className="vd-spark s2">✦</i><i className="vd-spark s3">✦</i></>}
                  {flow.check.verdict.status === 'ready'
                    ? <RiggedRemy pose="cheer" className="vd-hero-remy" />
                    : <img src={HEAD} alt="" className="vd-hero-head" />}
                </div>
                <div><div className="vd-catchline">{SAY.verdict[flow.check.verdict.status]}</div><p>{flow.check.verdict.feedback}</p></div>
              </div>
            </div>
          )}
        </div>
      )}

      {flow.screen === 'done' && (
        <div className="vd-full vd-enter" style={{ background: '#657167' }}>
          <div className="vd-meet">
            <RemyBadge size={230} color="#FFD84D" form="burst" />
            <div className="vd-bubble left"><b>{SAY.done}</b><br />Pancakes are done. You didn't touch the screen once.</div>
          </div>
          <button className="vd-btn light" onClick={flow.restart}>Let's cook something else!</button>
        </div>
      )}
    </div>
  )
}
