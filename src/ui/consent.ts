// The one-time notice about what Remy sends to other services (shown before a first recipe on the
// real backend). Accepting is remembered in the browser; where storage is blocked it just asks again.
import type { Store } from './storage.ts'

const KEY = 'remy.consent'
/** Bump when what Remy sends changes, so everyone is told again. */
const VERSION = '1'

export function hasConsented(storage: Store): boolean {
  try {
    return storage?.getItem(KEY) === VERSION
  } catch {
    return false
  }
}

export function giveConsent(storage: Store): void {
  try {
    storage?.setItem(KEY, VERSION)
  } catch {
    // Not remembered: the notice shows again next visit.
  }
}

/** Show it to a visitor who has not accepted it, unless the stand-in backend is on (nothing leaves the browser). */
export function needsNotice(mockBackend: boolean, storage: Store): boolean {
  return !mockBackend && !hasConsented(storage)
}
