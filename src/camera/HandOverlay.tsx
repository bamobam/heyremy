import { HAND_CONNECTIONS } from './handConnections.ts'
import type { Landmark } from './recognizer.ts'

/** Draws the detected hand over a video. Landmarks are 0..1 across the frame; place this exactly over the video. */
export function HandOverlay({ landmarks }: { landmarks: Landmark[] | null }) {
  if (!landmarks) return null
  return (
    <svg className="hand-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {HAND_CONNECTIONS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          data-testid="bone"
          x1={landmarks[a].x}
          y1={landmarks[a].y}
          x2={landmarks[b].x}
          y2={landmarks[b].y}
          stroke="#4ade80"
          strokeWidth="0.004"
        />
      ))}
      {landmarks.map((p, i) => (
        <circle key={i} data-testid="landmark" cx={p.x} cy={p.y} r="0.007" fill="#facc15" />
      ))}
    </svg>
  )
}
