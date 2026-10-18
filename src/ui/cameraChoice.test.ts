import { describe, expect, it } from 'vitest'
import { cameraMode, rememberCameraMode, setupHelp } from './cameraChoice.ts'

/** A Storage that holds strings in a map. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const broken = {
  getItem: () => {
    throw new Error('storage is blocked')
  },
  setItem: () => {
    throw new Error('storage is blocked')
  },
  removeItem: () => {
    throw new Error('storage is blocked')
  },
}

describe('cameraMode', () => {
  it('is the hat cam unless the cook has chosen otherwise', () => {
    expect(cameraMode('', memory())).toBe('hat')
  })

  it('uses the laptop camera for ?cam=any, the way the developer flag always has', () => {
    expect(cameraMode('?cam=any', memory())).toBe('laptop')
    expect(cameraMode('?cam=laptop', memory())).toBe('laptop')
  })

  it('remembers a choice made earlier', () => {
    expect(cameraMode('', memory({ 'remy.camera': 'laptop' }))).toBe('laptop')
  })

  it('lets ?cam=hat override a remembered laptop choice', () => {
    expect(cameraMode('?cam=hat', memory({ 'remy.camera': 'laptop' }))).toBe('hat')
  })

  it('ignores a saved value it does not know', () => {
    expect(cameraMode('', memory({ 'remy.camera': 'toaster' }))).toBe('hat')
  })

  it('still works when the browser blocks storage', () => {
    expect(cameraMode('', broken)).toBe('hat')
    expect(cameraMode('?cam=any', broken)).toBe('laptop')
    expect(cameraMode('', null)).toBe('hat')
  })
})

describe('rememberCameraMode', () => {
  it('saves the laptop choice and clears it for the hat cam', () => {
    const storage = memory()
    rememberCameraMode(storage, 'laptop')
    expect(cameraMode('', storage)).toBe('laptop')
    rememberCameraMode(storage, 'hat')
    expect(cameraMode('', storage)).toBe('hat')
  })

  it('does not throw when storage is blocked', () => {
    expect(() => rememberCameraMode(broken, 'laptop')).not.toThrow()
    expect(() => rememberCameraMode(null, 'laptop')).not.toThrow()
  })
})

describe('setupHelp', () => {
  it('asks about the bowl while the hat cam is fine', () => {
    expect(setupHelp(false, null)).toEqual({ text: expect.stringMatching(/see your bowl/i), switchTo: null })
  })

  it('offers the laptop camera when the hat cam is not there', () => {
    const help = setupHelp(false, 'not_found')
    expect(help.text).toMatch(/no hat cam/i)
    expect(help.switchTo).toEqual({ mode: 'laptop', label: "Use this laptop's camera" })
  })

  it('does not offer a switch for other problems, such as a blocked camera, which a switch would not fix', () => {
    expect(setupHelp(false, 'denied').switchTo).toBeNull()
    expect(setupHelp(false, 'busy').switchTo).toBeNull()
  })

  it('says how to set the laptop up, and offers the way back', () => {
    const help = setupHelp(true, null)
    expect(help.text).toMatch(/laptop/i)
    expect(help.text).toMatch(/hands/i)
    expect(help.switchTo).toEqual({ mode: 'hat', label: 'Use the hat cam instead' })
  })
})
