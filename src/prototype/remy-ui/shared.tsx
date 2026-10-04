// PROTOTYPE (throwaway): pieces every variant may use: the animated mascot loader, ingredient drawings, and the debug gesture pad.
import type { Flow } from './useFlow'
import { ingredientLook } from './data'
import './shared.css'
import { injectShapeKeyframes } from './shapes'
import { RiggedRemy } from './RiggedRemy'
injectShapeKeyframes()

export const MASCOT = '/prototype/remy-mascot.svg'
export const HEAD = '/prototype/remy-head.svg'

/** Remy stirs: tilt left, hop, tilt right, settle (1.2 s loop) with steam puffs. */
export function RemyLoader({ size = 220, label }: { size?: number; label?: string }) {
  return (
    <div className="remy-loader" style={{ width: size }}>
      <div className="remy-loader__steam"><i /><i /><i /></div>
      <div className="remy-loader__stage">
        <div className="remy-loader__blob" />
        <RiggedRemy pose="stir" className="remy-loader__img" />
      </div>
      {label && <div className="remy-loader__label">{label}</div>}
    </div>
  )
}

/** Simple drawn ingredient in its palette color, so prep isn't emoji. */
export function IngredientArt({ id, size = 72 }: { id: string; size?: number }) {
  const look = ingredientLook[id] ?? { color: '#EDCEBA', shape: 'jar' }
  const c = look.color
  const ink = '#1D1B20'
  const shapes: Record<string, React.ReactNode> = {
    sack: <><path d="M18 30 Q14 60 22 62 H50 Q58 60 54 30 Z" fill={c} stroke={ink} strokeWidth="3" /><path d="M20 30 Q36 20 52 30" fill="none" stroke={ink} strokeWidth="3" /><path d="M28 44 h16" stroke={ink} strokeWidth="3" strokeLinecap="round" /></>,
    jug: <><path d="M22 20 H46 L48 62 H20 Z" fill={c} stroke={ink} strokeWidth="3" /><path d="M46 28 Q58 30 54 44 L48 46" fill="none" stroke={ink} strokeWidth="3" /><path d="M20 34 H48" stroke={ink} strokeWidth="2" opacity=".5" /></>,
    egg: <ellipse cx="36" cy="40" rx="17" ry="22" fill={c} stroke={ink} strokeWidth="3" />,
    block: <><path d="M14 36 L36 26 L58 36 L36 46 Z" fill="#FFE2B8" stroke={ink} strokeWidth="3" /><path d="M14 36 V50 L36 60 V46 Z" fill={c} stroke={ink} strokeWidth="3" /><path d="M58 36 V50 L36 60 V46 Z" fill={c} stroke={ink} strokeWidth="3" /></>,
    jar: <><rect x="20" y="24" width="32" height="38" rx="8" fill={c} stroke={ink} strokeWidth="3" /><rect x="22" y="16" width="28" height="9" rx="3" fill="#73462F" stroke={ink} strokeWidth="3" /></>,
    tin: <><rect x="20" y="22" width="32" height="40" rx="4" fill={c} stroke={ink} strokeWidth="3" /><ellipse cx="36" cy="22" rx="16" ry="5" fill="#E3BEB2" stroke={ink} strokeWidth="3" /><path d="M26 40 h20" stroke={ink} strokeWidth="3" strokeLinecap="round" /></>,
    shaker: <><path d="M24 30 Q24 22 36 20 Q48 22 48 30 V60 H24 Z" fill={c} stroke={ink} strokeWidth="3" /><circle cx="32" cy="26" r="1.8" fill={ink} /><circle cx="40" cy="26" r="1.8" fill={ink} /></>,
    bottle: <><path d="M30 14 H42 V26 Q52 32 52 44 V62 H20 V44 Q20 32 30 26 Z" fill={c} stroke={ink} strokeWidth="3" /><path d="M20 46 H52" stroke={ink} strokeWidth="2" opacity=".5" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden>{shapes[look.shape]}</svg>
}

/** Debug pad so anyone can drive the prototype without a camera. Shows the live state. */
export function GesturePad({ flow }: { flow: Flow }) {
  const s = flow.check.kind === 'verdict' ? flow.check.verdict.status : flow.check.kind
  return (
    <div className="gesture-pad">
      <span className="gesture-pad__state">{flow.screen} · step {flow.step + 1}/{flow.total} · check: {s}</span>
      <button onClick={() => flow.gesture('back')}>👎 B</button>
      <button onClick={() => flow.gesture('check')}>✋ Space</button>
      <button onClick={() => flow.gesture('next')}>👍 N</button>
    </div>
  )
}
