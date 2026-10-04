// PROTOTYPE (throwaway) — Variant C "Chat with Remy": Ozlo-style. Remy stays big on the left; everything arrives as a conversation on the right.
import { useEffect, useRef } from 'react'
import type { Flow } from './useFlow'
import { recipe, formatAmount } from './data'
import { MASCOT, HEAD, RemyLoader, IngredientArt } from './shared'
import './variantC.css'

export const name = 'Chat with Remy'

const TINTS = ['#EDCEBA', '#E3BEB2', '#B7BDB6', '#F4C9A8', '#D8C3BC', '#C9D1C4']

export function VariantC({ flow }: { flow: Flow }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [flow.screen, flow.step, flow.check])
  const looking = flow.screen === 'reading' || flow.check.kind === 'looking'
  const mood = flow.check.kind === 'verdict' ? flow.check.verdict.status : 'idle'

  return (
    <div className="vc">
      <aside className={`vc-side mood-${mood}`}>
        <div className="vc-name"><img src={HEAD} alt="" />REMY</div>
        <div className="vc-stagebox">
          {looking ? <RemyLoader size={260} /> : <img src={MASCOT} alt="" className="vc-remy" />}
        </div>
        <div className="vc-status">
          {flow.screen === 'cooking' ? <>Step <b>{flow.step + 1}</b> of {flow.total}</> : flow.screen === 'reading' ? 'Reading…' : flow.screen === 'done' ? 'All done!' : 'Ready to cook'}
        </div>
        {flow.screen === 'cooking' && <div className="vc-progress"><i style={{ width: `${((flow.step + 1) / flow.total) * 100}%` }} /></div>}
        <div className="vc-legend"><span>👍 next</span><span>👎 back</span><span>✋ is it ready?</span></div>
      </aside>

      <main className="vc-thread">
        <Msg>Greetings, chef! I'm Remy. Paste any recipe and I'll walk you through it. You won't need to touch the screen.</Msg>

        {flow.screen === 'paste' && (
          <div className="vc-compose vc-in">
            <textarea defaultValue={'Fluffy pancakes (serves 4)\n1 cup flour, 2 tbsp sugar, 2 tsp baking powder, ½ tsp salt, ¾ cup milk, 1 egg, 2 tbsp butter…'} />
            <div className="vc-chips">
              <button onClick={flow.parse}>Cook this</button>
              <button className="ghost" onClick={flow.parse}>Try pancakes</button>
              <button className="ghost">What can you see?</button>
            </div>
          </div>
        )}

        {flow.screen !== 'paste' && <Me>Here's my pancake recipe 🥞</Me>}
        {flow.screen === 'reading' && <Msg typing>Reading it now</Msg>}

        {(flow.screen === 'prep' || flow.screen === 'cooking' || flow.screen === 'done') && (
          <>
            <Msg wide>
              <div className="vc-recipe-head"><b>{recipe.title}</b>
                <span className="vc-serv">
                  <button onClick={() => flow.setServings(Math.max(1, flow.servings - 1))}>−</button>{flow.servings} servings<button onClick={() => flow.setServings(flow.servings + 1)}>+</button>
                </span>
              </div>
              <div className="vc-ing">
                {recipe.ingredients.map((i, n) => (
                  <div key={i.id} style={{ background: TINTS[n % TINTS.length] }}><IngredientArt id={i.id} size={48} /><span><b>{formatAmount(i.amount, i.unit, flow.scale)}</b> {i.name}</span></div>
                ))}
              </div>
            </Msg>
            <Msg>Before we start: {recipe.prep.join(' · ')}.</Msg>
          </>
        )}
        {flow.screen === 'prep' && <div className="vc-chips vc-in"><button onClick={flow.start}>I'm ready, let's go!</button></div>}

        {(flow.screen === 'cooking' || flow.screen === 'done') && (
          <>
            <Me>I'm ready, let's go!</Me>
            {recipe.steps.slice(0, flow.screen === 'done' ? recipe.steps.length : flow.step + 1).map((s, i) => (
              <div key={s.id} className={`vc-stepmsg ${flow.screen === 'cooking' && i === flow.step ? 'now' : 'past'}`} style={{ background: TINTS[i % TINTS.length] }}>
                <div className="vc-stepno">Step {i + 1}</div>
                <div className="vc-steptext">{s.text}</div>
                {flow.screen === 'cooking' && i === flow.step && s.headsUp && <div className="vc-heads">🔥 {s.headsUp}</div>}
                {flow.screen === 'cooking' && i === flow.step && s.cue && <div className="vc-cue">✋ Show me when it's {s.cue}</div>}
              </div>
            ))}
            {flow.screen === 'cooking' && flow.check.kind !== 'idle' && <Me>✋ Is it ready?</Me>}
            {flow.check.kind === 'looking' && <Msg typing>Looking</Msg>}
            {flow.check.kind === 'verdict' && <Msg tone={flow.check.verdict.status}>{flow.check.verdict.feedback}</Msg>}
          </>
        )}
        {flow.screen === 'done' && (
          <>
            <Msg>We did it! Your pancakes are done. Enjoy! 🎉</Msg>
            <div className="vc-chips vc-in"><button onClick={flow.restart}>Cook something else</button></div>
          </>
        )}
        <div ref={end} style={{ height: 120 }} />
      </main>
    </div>
  )
}

function Msg({ children, wide, typing, tone }: { children: React.ReactNode; wide?: boolean; typing?: boolean; tone?: string }) {
  return (
    <div className={`vc-msg vc-in ${wide ? 'wide' : ''} ${tone ? `tone-${tone}` : ''}`}>
      <img src={HEAD} alt="" />
      <div className="vc-bubble">{children}{typing && <span className="vc-typing"><i /><i /><i /></span>}</div>
    </div>
  )
}
function Me({ children }: { children: React.ReactNode }) {
  return <div className="vc-me vc-in"><div>{children}</div></div>
}
