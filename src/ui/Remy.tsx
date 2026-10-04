// Remy in his three forms (§9.3): a badge when he is just present, a flipbook when he is doing
// something, and a still head for the logo and the non-`ready` verdict heroes.
import { shape, type ShapeName } from './shapes.ts'

export const HEAD_SRC = '/remy/remy-head.svg'
const MASCOT_A = '/remy/remy-mascot.svg'
const MASCOT_B = '/remy/remy-mascot-2.svg'

export type Pose = 'idle' | 'wave' | 'stir' | 'cheer'

/**
 * His head rocking over a shape that breathes, on two different beats so the two never sync.
 * Wherever Remy is just present: welcome, prep card, done.
 */
export function RemyBadge({ size = 160, color, form, className = '' }: { size?: number; color: string; form: ShapeName; className?: string }) {
  return (
    <div className={`ui-badge ${className}`} style={{ width: size, height: size }}>
      <div className="ui-badge__shape" style={{ background: color, clipPath: shape(form) }} />
      <img src={HEAD_SRC} alt="" className="ui-badge__head" />
    </div>
  )
}

/**
 * Two frames of the full mascot that swap like a flipbook; `pose` sets the flip speed and `cheer`
 * also hops. Only when Remy is doing something: stirring while checking, cheering on `ready`.
 */
export function RemyFlipbook({ pose = 'idle', width, className = '' }: { pose?: Pose; width?: number | string; className?: string }) {
  return (
    <div className={`ui-flip ui-flip--${pose} ${className}`} style={{ width }}>
      <img src={MASCOT_B} alt="" className="ui-flip__f2" />
      <img src={MASCOT_A} alt="" className="ui-flip__f1" />
    </div>
  )
}

/** Remy stirring over a blob that morphs, while a recipe is being read. */
export function RemyLoader({ size = 220, label }: { size?: number; label: string }) {
  return (
    <div className="ui-loader" style={{ width: size }}>
      <div className="ui-loader__steam" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="ui-loader__stage">
        <div className="ui-loader__blob" />
        <RemyFlipbook pose="stir" className="ui-loader__img" />
      </div>
      <div className="ui-loader__label">{label}</div>
    </div>
  )
}

/** Remy's speech, with the tail pointing back at him. Bold lines are the catchphrases. */
export function SpeechBubble({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return <div className={`ui-bubble ui-bubble--tail ${small ? 'ui-bubble--small' : ''}`}>{children}</div>
}