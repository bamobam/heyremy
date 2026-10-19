// The instruction on a step card is the step's narration at the cook's Level, the same words Remy
// says, so a Level is something the cook can see as well as hear: fuller for a beginner, terse for a
// master. Steps, amounts and cues do not change with the Level; the wording does.

/** The narration without its spoken "Step N." lead-in (the card shows the number); the step's plain text if nothing is left. */
export function cardText(narration: string, plainText: string): string {
  const text = narration.replace(/^\s*Step\s+\d+\s*[.:]?\s*/i, '').trim()
  return text || plainText
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
