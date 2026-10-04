/**
 * After the open palm that asks for a check, the palm is still in front of the
 * camera. Wait for it to leave before taking the photo, so the picture shows
 * the food and not a hand.
 *
 * Returns 'gone' once no hand is seen, or 'timeout' if it is still there after
 * `maxMs`. On a timeout the photo is taken anyway and the check can answer
 * "unsure" about it.
 */
export function waitForHandGone(
  isHandVisible: () => boolean,
  { maxMs = 1500, pollMs = 50 }: { maxMs?: number; pollMs?: number } = {},
): Promise<'gone' | 'timeout'> {
  return new Promise((resolve) => {
    const deadline = Date.now() + maxMs
    const check = () => {
      if (!isHandVisible()) return resolve('gone')
      if (Date.now() >= deadline) return resolve('timeout')
      setTimeout(check, pollMs)
    }
    check()
  })
}
