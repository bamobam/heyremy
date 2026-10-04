// PROTOTYPE (throwaway): the hand-drawn Remy, inlined so the #arm group (arm + spoon + sparkle) can move on its own.
import svg from '../../../public/prototype/remy-mascot-rigged.svg?raw'
import './rigged.css'

export type Pose = 'idle' | 'wave' | 'stir' | 'cheer'

export function RiggedRemy({ pose = 'idle', width, className = '' }: { pose?: Pose; width?: number | string; className?: string }) {
  return <div className={`rigged-remy pose-${pose} ${className}`} style={{ width }} dangerouslySetInnerHTML={{ __html: svg }} />
}
