// The REMY logo in the corner is the way home (§9.2). Leaving a recipe mid-cook would lose the cook's
// place and the voice already made for it, so it asks first; hands are busy while cooking and a
// stray tap must not throw the session away.
import { useState } from 'react'
import { useCooking, type Phase } from '../cooking/contract.ts'
import { HEAD_SRC } from './Remy.tsx'

/** What a click on the logo does: nothing (already home), ask first, or go. */
export function homeAction(phase: Phase): 'none' | 'confirm' | 'go' {
  if (phase === 'input' || phase === 'parsing') return 'none'
  return phase === 'done' ? 'go' : 'confirm'
}

export function HomeLogo({ light = false }: { light?: boolean }) {
  const { state, controller } = useCooking()
  const [asking, setAsking] = useState(false)
  const action = homeAction(state.phase)

  const onClick = () => {
    if (action === 'go') controller.restart()
    else if (action === 'confirm') setAsking(true)
  }

  return (
    <div className="ui-home">
      <button type="button" className={`ui-logo ui-logo--btn ${light ? 'ui-logo--light' : ''}`} onClick={onClick} aria-label="Remy, back to the start">
        <img src={HEAD_SRC} alt="" />
        REMY
      </button>
      {asking && (
        <div
          className="ui-home__ask"
          role="alertdialog"
          aria-labelledby="ui-home-ask-title"
          aria-describedby="ui-home-ask-body"
          onKeyDown={e => e.key === 'Escape' && setAsking(false)}
        >
          <p id="ui-home-ask-title">Leave this recipe?</p>
          <p id="ui-home-ask-body">Remy will lose your place.</p>
          <div className="ui-home__buttons">
            <button type="button" className="ui-btn" autoFocus onClick={() => setAsking(false)}>
              {state.phase === 'cooking' ? 'Keep cooking' : 'Stay here'}
            </button>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={controller.restart}>
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
