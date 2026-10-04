// PROTOTYPE (throwaway): Remy's head logo rocking back and forth, with a shape behind it that zooms in and out on its own beat.
// Used wherever Remy is just present; the two-frame flipbook is kept for moments where he's doing something (stirring, cheering).
import { shape, type ShapeName } from './shapes'
import { HEAD } from './shared'
import './badge.css'

export function RemyBadge({ size = 160, color = '#F6B3BC', form = 'sunny', className = '' }: { size?: number; color?: string; form?: ShapeName; className?: string }) {
  return (
    <div className={`remy-badge ${className}`} style={{ width: size, height: size }}>
      <div className="remy-badge__shape" style={{ background: color, clipPath: shape(form) }} />
      <img src={HEAD} alt="" className="remy-badge__head" />
    </div>
  )
}
