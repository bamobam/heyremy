import { grabSharpestFrame, type GrabResult } from './grabSharpestFrame.ts'

/** How many frames a burst takes. One still can't tell a simmer from a boil; three can. */
export const BURST_FRAMES = 3
/** Time from the start of one frame's capture to the start of the next. */
export const BURST_SPACING_MS = 700
/** The most frames a burst takes. /api/check accepts no more than this. */
export const MAX_BURST_FRAMES = 4

export interface BurstOptions {
  /** How many frames to take, 1 to MAX_BURST_FRAMES. Default 3. */
  frames?: number
  /** Time from the start of one frame to the start of the next. Default 700 ms. */
  spacingMs?: number
}

/** What a burst needs from the outside, so tests can swap it. */
export interface BurstEnv {
  /** One frame: the sharpest of a short run, as a JPEG. */
  grab(video: HTMLVideoElement): Promise<GrabResult>
  sleep(ms: number): Promise<void>
  /** Milliseconds on a steady clock. */
  now(): number
}

const browserEnv = (): BurstEnv => ({
  grab: (video) => grabSharpestFrame(video),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => performance.now(),
})

/**
 * Takes several frames over a couple of seconds, for a step whose cue changes with time (boiling,
 * browning, rising). Each frame is the sharpest of its own short run (`grabSharpestFrame`), so a burst
 * of 3 takes about 1.9 s where one frame takes 0.5 s.
 *
 * Does not wait for the cook's hand to leave the frame: the caller does that once, before the burst
 * (see `useCamera.grabBurstForCheck`). Frames come back in time order. If the camera drops partway,
 * rejects with its error and takes no more frames.
 */
export async function grabBurst(
  video: HTMLVideoElement,
  { frames = BURST_FRAMES, spacingMs = BURST_SPACING_MS }: BurstOptions = {},
  env: Partial<BurstEnv> = {},
): Promise<GrabResult[]> {
  const { grab, sleep, now } = { ...browserEnv(), ...env }
  const count = Number.isFinite(frames) ? Math.min(Math.max(Math.floor(frames), 1), MAX_BURST_FRAMES) : BURST_FRAMES

  const taken: GrabResult[] = []
  for (let i = 0; i < count; i++) {
    const started = now()
    taken.push(await grab(video))
    // The capture itself takes time, so only the rest of the spacing is waited out; none after the last.
    if (i < count - 1) {
      const wait = spacingMs - (now() - started)
      if (wait > 0) await sleep(wait)
    }
  }
  return taken
}
