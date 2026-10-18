// The one-time notice about what Remy sends to other services (shown before a first recipe on the
// real backend). Accepting is remembered in the browser; where storage is blocked it just asks again.
import { readItem, writeItem, type Store } from '../cooking/storage.ts'

const KEY = 'remy.notice'
/** Bump when what Remy sends (or the notice's wording) changes, so everyone is told again. */
const REVISION = '1'

/** Show it to a visitor who has not accepted this revision, unless the stand-in backend is on (nothing leaves the browser). */
export function needsNotice(mockBackend: boolean, store: Store): boolean {
  return !mockBackend && readItem(store, KEY) !== REVISION
}

export function markNoticeSeen(store: Store): void {
  writeItem(store, KEY, REVISION)
}
