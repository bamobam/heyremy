// Fits a step's text into the space the card gives it: the largest whole font size, from `max` down
// to `min`, at which it still fits. Pure, so the search can be tested without a layout engine.

/** The font size range of a step's text column, in px: the starting size, and the smallest it is shrunk to. */
export const STEP_TEXT_SIZE = { min: 22, max: 38 } as const

/** `fits(px)` says whether the text fits at that size; sizes are tried by binary search. */
export function fitFontSize(fits: (px: number) => boolean, { min, max }: { min: number; max: number }): number {
  if (fits(max)) return max
  let lo = min // the best size known to be allowed (the floor, whether or not it fits)
  let hi = max // a size known not to fit
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return lo
}
