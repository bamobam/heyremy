// The REMY logo in the corner is the way home (§9.2). Leaving a recipe mid-cook would lose the cook's
// place and the voice already made for it, so it asks first; hands are busy while cooking and a
// stray tap must not throw the session away.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCooking, type Phase } from '../cooking/contract.ts'
import { HEAD_SRC } from './Remy.tsx'

/** What a click on the logo does: nothing (already home), ask first, or go. */
export function homeAction(phase: Phase): 'none' | 'confirm' | 'go' {
  if (phase === 'input' || phase === 'parsing') return 'none'
  return phase === 'done' ? 'go' : 'confirm'
}

export function HomeLogo({ light = false }: { light?: boolean }) {
  const { state, controller, setDialogOpen } = useCooking()
  const [asking, setAsking] = useState(false)
  const logo = useRef<HTMLButtonElement>(null)
  const action = homeAction(state.phase)
  const className = `ui-logo ${light ? 'ui-logo--light' : ''}`

  const close = useCallback(() => {
    setAsking(false)
    logo.current?.focus()
  }, [])

  // While the question is up, gestures and the keys wait, and Escape closes it from anywhere.
  useEffect(() => {
    if (!asking) return
    setDialogOpen(true)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      setDialogOpen(false)
    }
  }, [asking, close, setDialogOpen])

  // Already at the start: a plain logo, not a button that does nothing.
  if (action === 'none') {
    return (
      <div className={className}>
        <img src={HEAD_SRC} alt="" />
        REMY
      </div>
    )
  }

  return (
    <div className="ui-home">
      <button
        ref={logo}
        type="button"
        className={`${className} ui-logo--btn`}
        onClick={() => (action === 'go' ? controller.restart() : setAsking(true))}
        aria-label="Remy, back to the start"
      >
        <img src={HEAD_SRC} alt="" />
        REMY
      </button>
      {asking && (
        <div className="ui-home__ask" role="alertdialog" aria-modal="true" aria-labelledby="ui-home-ask-title" aria-describedby="ui-home-ask-body">
          <p id="ui-home-ask-title">Leave this recipe?</p>
          <p id="ui-home-ask-body">Remy will lose your place.</p>
          <div className="ui-home__buttons">
            <button type="button" className="ui-btn" autoFocus onClick={close}>
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
