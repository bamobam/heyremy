// The "up next" rail on the cooking screen: what is coming after the step the cook is on, so there
// is nothing to be anxious about. Pure; the rail itself is in cooking.tsx.

/** Words that read badly at the end of a short title ("Cook over medium heat for"). */
const DANGLING = new Set(['a', 'an', 'the', 'of', 'to', 'into', 'in', 'on', 'for', 'with', 'and', 'or', 'about', 'over', 'at', 'until'])

const MAX_WORDS = 5

/** A short title from a step's text: its first clause, a few words, starting with a capital. */
export function stepTitle(text: string): string {
  const clause = text.split(/[,;.:!?]|\sthen\s/i)[0].trim()
  const words = clause.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS)
  while (words.length > 1 && DANGLING.has(words[words.length - 1].toLowerCase())) words.pop()
  const title = words.join(' ')
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export interface UpNextItem {
  id: number
  /** 1-based, as on the step cards. */
  number: number
  title: string
  /** The step carries a heads-up, so the cook knows to get something ready. */
  headsUp: boolean
}

/** The next `count` steps after `index`, and how many more come after those. */
export function upcomingSteps(
  steps: readonly { id: number; text: string; headsUp: string | null }[],
  index: number,
  count: number,
): { items: UpNextItem[]; more: number } {
  const after = steps.slice(index + 1)
  const items = after.slice(0, count).map((s, i) => ({ id: s.id, number: index + 2 + i, title: stepTitle(s.text), headsUp: s.headsUp !== null }))
  return { items, more: Math.max(0, after.length - items.length) }
}
