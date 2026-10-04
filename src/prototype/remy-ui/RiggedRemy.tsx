// PROTOTYPE (throwaway): two-frame flipbook. Frame 1 = Remy 1 (v5 mascot, spoon up), frame 2 = Remy 2 (spoon out).
// Remy 1 is scaled and offset into Remy 2's frame so the hat and feet line up; the pose sets the flip speed.
import './rigged.css'

export type Pose = 'idle' | 'wave' | 'stir' | 'cheer'

export function RiggedRemy({ pose = 'idle', width, className = '' }: { pose?: Pose; width?: number | string; className?: string }) {
  return (
    <div className={`flip-remy pose-${pose} ${className}`} style={{ width }}>
      <img src="/prototype/remy-mascot-2.svg" alt="" className="flip-f2" />
      <img src="/prototype/remy-mascot.svg" alt="" className="flip-f1" />
    </div>
  )
}
