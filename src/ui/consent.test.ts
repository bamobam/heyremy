import { describe, expect, it } from 'vitest'
import { giveConsent, hasConsented, needsNotice } from './consent.ts'

function memory() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const broken = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('consent', () => {
  it('has not been given until the cook says so, and is remembered after', () => {
    const storage = memory()
    expect(hasConsented(storage)).toBe(false)
    giveConsent(storage)
    expect(hasConsented(storage)).toBe(true)
  })

  it('is not given when storage is blocked, and giving it does not throw', () => {
    expect(hasConsented(broken)).toBe(false)
    expect(hasConsented(null)).toBe(false)
    expect(() => giveConsent(broken)).not.toThrow()
  })
})

describe('needsNotice', () => {
  it('shows the notice to a new visitor of the real app', () => {
    expect(needsNotice(false, memory())).toBe(true)
  })

  it('does not show it again once it has been accepted', () => {
    const storage = memory()
    giveConsent(storage)
    expect(needsNotice(false, storage)).toBe(false)
  })

  it('does not show it on the stand-in backend, where nothing is sent anywhere', () => {
    expect(needsNotice(true, memory())).toBe(false)
  })
})
