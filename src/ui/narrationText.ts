// What Remy's speech bubble says on the cooking screen: the step's narration at the cook's Level, the
// same words Remy speaks, so a Level is something the cook can see as well as hear. (The card keeps the
// short instruction, which is the same at every Level.)

/** The narration without its spoken "Step N." lead-in (the card shows the number); the card's own text if nothing is left. */
export function bubbleText(spoken: string, cardText: string): string {
  const text = spoken.replace(/^\s*Step\s+\d+\s*[.:]?\s*/i, '').trim()
  return text || cardText
}

/** How many steps have narration written for this Level; the rest read the beginner narration (the dev tag shows it). */
export function levelCoverage(
  steps: readonly { spoken: string; spokenIntermediate?: string; spokenMaster?: string }[],
  level: 'beginner' | 'intermediate' | 'master',
): { written: number; total: number } {
  const has = (s: (typeof steps)[number]) =>
    level === 'beginner' ? true : Boolean((level === 'intermediate' ? s.spokenIntermediate : s.spokenMaster)?.trim())
  return { written: steps.filter(has).length, total: steps.length }
}

/** The dev tag's note on Level coverage; null at beginner or with no recipe. */
export function narrationTag(
  level: 'beginner' | 'intermediate' | 'master',
  steps: readonly { spoken: string; spokenIntermediate?: string; spokenMaster?: string }[],
): { text: string; ok: boolean } | null {
  if (level === 'beginner' || steps.length === 0) return null
  const { written, total } = levelCoverage(steps, level)
  return written === total
    ? { text: `Level ${level}: written for all ${total} steps`, ok: true }
    : { text: `Level ${level}: written for ${written} of ${total} steps, the rest read as beginner`, ok: false }
}
