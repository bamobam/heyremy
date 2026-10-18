// Sizes a step's column so it always fits its card, instead of being clipped (§9.3 StepCard). The
// column is shrunk, never scrolled: the cook's hands are busy. It re-fits when the text changes, when the
// card changes size (a resized window, a different step on screen) and once the web font has loaded.
import { useLayoutEffect, type RefObject } from 'react'
import { fitFontSize } from './fitText.ts'

interface Refs {
  /**
   * The column holding the text and everything beside it (number, badge, heads-up, cue). Its font size
   * is what changes; the rest are sized in em from it, so the whole column scales together. Its
   * content may overflow the card, which is what is measured.
   */
  box: RefObject<HTMLElement | null>
  /** The card: a fixed height the box's content has to fit inside. */
  limit: RefObject<HTMLElement | null>
}

/** `key` changes whenever the text does. */
export function useFitText({ box, limit }: Refs, range: { min: number; max: number }, key: string): void {
  const { min, max } = range
  useLayoutEffect(() => {
    let cancelled = false

    const fit = () => {
      const column = box.current
      const card = limit.current
      if (!column || !card) return
      const best = () =>
        fitFontSize(px => {
          column.style.fontSize = `${px}px`
          return column.scrollHeight <= card.clientHeight
        }, { min, max })

      column.removeAttribute('data-tight')
      let px = best()
      column.style.fontSize = `${px}px`
      if (column.scrollHeight > card.clientHeight) {
        // Even the smallest size is too tall. Leave off the least urgent line (the cue, see steps.css) and
        // try again, so the step and its heads-up are not cut off.
        column.setAttribute('data-tight', '')
        px = best()
      }
      column.style.fontSize = `${px}px`
    }

    fit()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    if (limit.current) observer?.observe(limit.current)
    void document.fonts?.ready.then(() => {
      if (!cancelled) fit()
    })
    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [box, limit, min, max, key])
}
