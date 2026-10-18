// The "up next" rail on the cooking screen: what is coming after the step the cook is on, so there
// is nothing to be anxious about. Pure; the rail itself is in cooking.tsx. (A step's heads-up warns about
// the step after it, so the rail does not flag steps by their own heads-up.)

/** Words that read badly at the end of a short title ("Cook over medium heat for"). */
const DANGLING = new Set(['a', 'an', 'the', 'of', 'to', 'into', 'in', 'on', 'for', 'with', 'and', 'or', 'about', 'over', 'at', 'until'])

/** A bare number or time ("25", "2.5", "2:30") says nothing without its unit, so it is not left at the end. */
const isDangling = (word: string) => DANGLING.has(word.toLowerCase()) || /^\d+([.,:]\d+)*$/.test(word)

/** Where a clause ends: a comma, semicolon or sentence end, but not the point in 2.5, the comma in 1,000 or the colon in 2:30. */
const CLAUSE_END = /[;!?]|,(?=\s)|[.:](?=\s|$)|\sthen\s/i

const MAX_WORDS = 5

/** A short title from a step's text: its first clause, a few words, starting with a capital. */
export function stepTitle(text: string): string {
  const clause = text.split(CLAUSE_END)[0].trim()
  const words = clause.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS)
  while (words.length > 1 && isDangling(words[words.length - 1])) words.pop()
  const title = words.join(' ')
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export interface UpNextItem {
  id: number
  /** 1-based, as on the step cards. */
  number: number
  title: string
}

/** The next `count` steps after `index`, and how many more come after those. */
export function upcomingSteps(
  steps: readonly { id: number; text: string }[],
  index: number,
  count: number,
): { items: UpNextItem[]; more: number } {
  const after = steps.slice(index + 1)
  const items = after.slice(0, count).map((s, i) => ({ id: s.id, number: index + 2 + i, title: stepTitle(s.text) }))
  return { items, more: Math.max(0, after.length - items.length) }
}
