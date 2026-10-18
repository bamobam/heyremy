// The browser's localStorage, where it is allowed. Everything stored here is a convenience (a remembered
// choice, a dismissed notice), so a blocked or full store must never break the app.

export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null

/** localStorage, or null where the browser blocks it (a private window, blocked site data). */
export function pageStorage(): Store {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
