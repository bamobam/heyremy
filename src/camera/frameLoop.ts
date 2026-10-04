// Runs a callback on the live video at a fixed, lower rate than the display.

export interface FrameEnv {
  raf: (cb: (t: number) => void) => number
  caf: (id: number) => void
  isHidden: () => boolean
}

const browserEnv: FrameEnv = {
  raf: (cb) => requestAnimationFrame(cb),
  caf: (id) => cancelAnimationFrame(id),
  isHidden: () => document.hidden,
}

/**
 * Calls onFrame(t) about `fps` times a second while the video has data and the
 * tab is visible. Returns a function that stops the loop.
 */
export function startFrameLoop(
  video: HTMLVideoElement,
  onFrame: (t: number) => void,
  fps = 15,
  env: FrameEnv = browserEnv,
): () => void {
  const interval = 1000 / fps
  let last = -Infinity
  let handle = 0
  let stopped = false

  const tick = (t: number) => {
    if (stopped) return
    handle = env.raf(tick)
    if (env.isHidden() || video.readyState < 2) return
    // A frame that arrives slightly early still counts, so 60 Hz lands near 15 fps.
    if (t - last < interval - 1000 / 120) return
    last = t
    try {
      onFrame(t)
    } catch (error) {
      console.error('frame handler failed', error)
    }
  }

  handle = env.raf(tick)
  return () => {
    stopped = true
    env.caf(handle)
  }
}
