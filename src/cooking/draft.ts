// The recipe text the cook had pasted, set aside across a page reload (switching camera reloads the
// page, which would otherwise empty the box). Kept in the tab only, taken once, and never the parsed
// recipe: the cook starts it again, which is one tap.
import { readItem, removeItem, tabStorage, writeItem, type Store } from './storage.ts'

const KEY = 'remy.draft'

export function stashDraft(text: string | undefined, store: Store = tabStorage()): void {
  if (text?.trim()) writeItem(store, KEY, text)
}

/** The text set aside before the reload, if any; it is forgotten once taken. */
export function takeDraft(store: Store = tabStorage()): string | null {
  const text = readItem(store, KEY)
  removeItem(store, KEY)
  return text?.trim() ? text : null
}
