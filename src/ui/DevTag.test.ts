import { describe, expect, it } from 'vitest'
import { describeSetup } from './DevTag.tsx'

const ready = { status: 'ready', error: null } as const
const live = { mock: false, laptop: false, status: 'live', error: null, cooking: true, gestures: ready, reading: null } as const
const reading = (label: string, score: number, handPresent = true) => ({ label, score, handPresent })
const shaped = (name: 'open' | 'thumb_up' | 'thumb_down', score: number, label = 'None') => ({ ...reading(label, 0.2), shape: { name, score } })

describe('describeSetup', () => {
  it('names the real backend and a live hat cam as fine', () => {
    expect(describeSetup(live)).toEqual({
      backend: { text: 'Real backend', ok: true },
      camera: { text: 'Hat cam: live', ok: true },
      gestures: { text: 'Gestures: ready, no hand in view', ok: true },
    })
  })

  it('flags the stand-in backend, so it is never mistaken for the real one', () => {
    expect(describeSetup({ ...live, mock: true }).backend).toEqual({ text: 'Stand-in backend', ok: false })
  })

  it('says how to use the laptop camera when the Logitech is not found', () => {
    const { camera } = describeSetup({ ...live, status: 'error', error: 'not_found' })
    expect(camera.ok).toBe(false)
    expect(camera.text).toMatch(/laptop camera/i)
  })

  it('names the laptop camera when it is the one in use', () => {
    expect(describeSetup({ ...live, laptop: true }).camera.text).toBe('Laptop camera: live')
  })

  it('shows what the hand model reads right now, so a palm that does not register can be told from a blank camera', () => {
    expect(describeSetup({ ...live, reading: reading('Open_Palm', 0.93) }).gestures.text).toBe('Gestures: Open_Palm 0.93')
    expect(describeSetup({ ...live, reading: reading('Thumb_Up', 0.8) }).gestures.text).toBe('Gestures: Thumb_Up 0.80')
  })

  it('says so when the hand shape, not the label, is what fired', () => {
    expect(describeSetup({ ...live, reading: shaped('open', 0.91) }).gestures).toEqual({ text: 'Gestures: open (shape 0.91)', ok: true })
    expect(describeSetup({ ...live, reading: shaped('thumb_up', 0.8, 'Closed_Fist') }).gestures.text).toBe('Gestures: thumb_up (shape 0.80)')
    expect(describeSetup({ ...live, reading: shaped('thumb_down', 0.756) }).gestures.text).toBe('Gestures: thumb_down (shape 0.76)')
  })

  it('tells a hand with no known gesture from no hand at all', () => {
    expect(describeSetup({ ...live, reading: reading('None', 0) }).gestures.text).toBe('Gestures: hand seen, no gesture')
    expect(describeSetup({ ...live, reading: reading('None', 0, false) }).gestures.text).toBe('Gestures: ready, no hand in view')
  })

  it('flags a hand model that failed to load, with the reason', () => {
    const { gestures } = describeSetup({ ...live, gestures: { status: 'error', error: 'model missing' } })
    expect(gestures).toEqual({ text: 'Gestures: failed (model missing)', ok: false })
  })

  it('does not call gestures broken before the cooking screen, where they are not running', () => {
    const { gestures } = describeSetup({ ...live, cooking: false, gestures: { status: 'loading', error: null } })
    expect(gestures.ok).toBe(true)
  })
})
