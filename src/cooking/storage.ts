// The browser's localStorage, where it is allowed. Everything stored here is a convenience (a remembered
// choice, a dismissed notice), so a blocked or full store must never break the app: every call says
// whether it worked instead of throwing.

export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null

/** localStorage, or null where the browser blocks it (a private window, blocked site data). */
export function pageStorage(): Store {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** sessionStorage (kept while the tab stays open, gone after), or null where blocked. */
export function tabStorage(): Store {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function readItem(store: Store, key: string): string | null {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** True if the value was stored. */
export function writeItem(store: Store, key: string, value: string): boolean {
  try {
    if (!store) return false
    store.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** True if the item is gone. */
export function removeItem(store: Store, key: string): boolean {
  try {
    if (!store) return false
    store.removeItem(key)
    return true
  } catch {
    return false
  }
}
