// Whether a hand is in front of the camera, steadier than the raw detection:
// one dropped frame does not make the hand "leave".

/** How long with no detection before the hand counts as gone. */
export const HAND_GONE_MS = 300

export interface Presence {
  visible: boolean
  /** Time of the last frame with a hand. */
  lastSeen: number
}

export const initialPresence = (): Presence => ({ visible: false, lastSeen: -Infinity })

export function stepPresence(state: Presence, present: boolean, t: number): Presence {
  if (present) return { visible: true, lastSeen: t }
  if (state.visible && t - state.lastSeen >= HAND_GONE_MS) return { visible: false, lastSeen: state.lastSeen }
  return state
}
