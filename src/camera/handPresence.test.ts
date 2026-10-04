import { describe, expect, it } from 'vitest'
import { HAND_GONE_MS, initialPresence, stepPresence, type Presence } from './handPresence.ts'

/** Feeds [time, present] samples through stepPresence and returns the state after each. */
function run(samples: [number, boolean][], start: Presence = initialPresence()) {
  const states: Presence[] = []
  let state = start
  for (const [t, present] of samples) {
    state = stepPresence(state, present, t)
    states.push(state)
  }
  return states
}

describe('stepPresence', () => {
  it('starts with no hand', () => {
    expect(initialPresence().visible).toBe(false)
  })

  it('is visible as soon as a hand is seen', () => {
    expect(run([[0, true]])[0].visible).toBe(true)
  })

  it('stays gone while no hand is seen', () => {
    const states = run([[0, false], [100, false], [1000, false]])
    expect(states.every((s) => !s.visible)).toBe(true)
  })

  it('treats one dropped frame as still visible', () => {
    const states = run([[0, true], [67, false], [133, true]])
    expect(states.map((s) => s.visible)).toEqual([true, true, true])
  })

  it('is still visible just under 300 ms after the last sighting', () => {
    const states = run([[0, true], [HAND_GONE_MS - 1, false]])
    expect(states[1].visible).toBe(true)
  })

  it('is gone 300 ms after the last sighting', () => {
    const states = run([[0, true], [HAND_GONE_MS, false]])
    expect(states[1].visible).toBe(false)
  })

  it('measures from the last sighting, not the first', () => {
    const states = run([[0, true], [200, true], [450, false], [500, false]])
    expect(states.map((s) => s.visible)).toEqual([true, true, true, false])
  })

  it('comes back as soon as the hand returns', () => {
    const states = run([[0, true], [400, false], [467, true]])
    expect(states.map((s) => s.visible)).toEqual([true, false, true])
  })

  it('does not change the state it was given', () => {
    const before = initialPresence()
    stepPresence(before, true, 100)
    expect(before).toEqual(initialPresence())
  })
})
