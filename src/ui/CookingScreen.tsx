// CookingScreen (§9.2): the hands-free part. The page takes the step's colour field, the cards slide
// along one track, and the check happens inside the current card. Every pointer down counts as a tap.
import { canCheck, currentStep, filledSteps, useCooking, type ShownStep } from '../cooking/contract.ts'
import { GestureFallbackNote, GestureLegend, HoldPill, StepCard, StepProgress, UpNext, VerdictPopup } from './cooking.tsx'
import { fieldFor } from './fields.ts'
import { HEAD_SRC, SpeechBubble } from './Remy.tsx'
import { sayFor, type Say } from './say.ts'
import { ErrorBanner } from './prep.tsx'
import { HomeLogo } from './HomeLogo.tsx'
import { bubbleText } from './narrationText.ts'

/** What Remy says on the cooking screen, in priority order (§9.2). */
function bubbleFor(say: Say, step: ShownStep | null, index: number, checking: boolean) {
  if (checking) return <b>{say.look}</b>
  if (!step) return null
  return (
    <>
      {index === 0 && <b>{say.go} </b>}
      {step.headsUp && <b>{say.headsUp} </b>}
      {bubbleText(step.spoken, step.text)}
    </>
  )
}

export function CookingScreen() {
  const { state, dispatch } = useCooking()
  const steps = filledSteps(state)
  const field = fieldFor(state.stepIndex)
  const checking = state.mode === 'checking'
  const say = sayFor(state.settings.persona)

  return (
    <div
      className={`ui-cook ${checking ? 'ui-cook--checking' : ''} ${state.mode === 'verdict' ? 'ui-cook--verdict' : ''}`}
      style={{ background: field.back, color: field.fg }}
      onPointerDown={() => dispatch({ type: 'screenTapped' })}
    >
      <ErrorBanner error={state.error} onDismiss={() => dispatch({ type: 'errorDismissed' })} />
      <GestureFallbackNote />
      <header className="ui-top">
        <HomeLogo light />
        <UpNext steps={steps} index={state.stepIndex} />
        <StepProgress steps={steps} index={state.stepIndex} accent={field.accent} />
      </header>

      <div className="ui-rise">
        <div className="ui-track" style={{ transform: `translateX(calc(${-state.stepIndex} * (70vw + 32px)))` }}>
          {steps.map((s, i) => (
            <StepCard key={s.id} step={s} index={i} current={i === state.stepIndex} checking={checking} />
          ))}
        </div>
      </div>

      <div className="ui-cook__remy">
        <div className="ui-remy-line">
          <img src={HEAD_SRC} alt="" />
          <SpeechBubble small>{bubbleFor(say, currentStep(state), state.stepIndex, checking)}</SpeechBubble>
        </div>
      </div>

      <GestureLegend canCheck={canCheck(state)} />
      <HoldPill canCheck={canCheck(state)} />

      {state.mode === 'verdict' && state.verdict && (
        <VerdictPopup verdict={state.verdict} say={say} />
      )}
    </div>
  )
}