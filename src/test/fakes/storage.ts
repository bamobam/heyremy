// A Storage that holds strings in a map, and one that throws like a browser that blocks storage.
import type { Store } from '../../cooking/storage.ts'

export function memory(initial: Record<string, string> = {}): NonNullable<Store> {
  const data = new Map(Object.entries(initial))
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: k => void data.delete(k),
  }
}

const refuse = () => {
  throw new Error('storage is blocked')
}

export const blocked: NonNullable<Store> = { getItem: refuse, setItem: refuse, removeItem: refuse }
