import { describe, expect, it } from 'vitest'
import type { GestureIntent } from '../types.ts'
import {
  DEFAULT_FILTER_CONFIG as cfg,
  idleFilter,
  stepFilter,
  type FilterConfig,
  type FilterState,
  type Sample,
} from './gestureFilter.ts'

const FRAME_MS = 67 // about 15 frames per second

/** `count` samples of the same reading, one per frame, the first at t0. */
function frames(intent: GestureIntent | null, t0: number, count: number, score = 0.9): Sample[] {
  return Array.from({ length: count }, (_, i) => ({ intent, score, t: t0 + i * FRAME_MS }))
}

/** Runs samples through the filter; returns every output plus when it fired. */
function run(samples: Sample[], start: FilterState = idleFilter, config: FilterConfig = cfg) {
  let state = start
  const outputs = samples.map((sample) => {
    const out = stepFilter(state, sample, config)
    state = out.state
    return { ...out, t: sample.t }
  })
  const fires = outputs.filter((o) => o.fire).map((o) => ({ t: o.t, intent: o.fire }))
  return { outputs, final: state, fires }
}

// 16 frames of a held gesture from t=0 fire at t=1005 and start a cooldown until t=3005.
const firedNext = () => run(frames('next', 0, 16))
const COOLDOWN_END = 3005

describe('stepFilter', () => {
  describe('idle', () => {
    it('stays idle with no gesture', () => {
      const { outputs } = run(frames(null, 0, 10))
      expect(outputs.every((o) => o.state.kind === 'idle')).toBe(true)
      expect(outputs.every((o) => o.progress.intent === null && o.progress.progress === 0)).toBe(true)
    })

    it('starts a hold on a confident gesture, at progress 0', () => {
      const { outputs } = run([{ intent: 'next', score: 0.9, t: 100 }])
      expect(outputs[0].state).toEqual({ kind: 'holding', intent: 'next', since: 100, misses: 0 })
      expect(outputs[0].progress).toEqual({ intent: 'next', progress: 0 })
    })

    it('starts a hold at exactly the minimum score', () => {
      const { outputs } = run([{ intent: 'next', score: 0.7, t: 0 }])
      expect(outputs[0].state.kind).toBe('holding')
    })

    it('does not start a hold below the minimum score', () => {
      const { outputs } = run(frames('next', 0, 10, 0.69))
      expect(outputs.every((o) => o.state.kind === 'idle')).toBe(true)
    })
  })

  describe('holding', () => {
    it('reports progress as the share of the hold time elapsed', () => {
      const { outputs } = run([
        { intent: 'back', score: 0.9, t: 0 },
        { intent: 'back', score: 0.9, t: 250 },
        { intent: 'back', score: 0.9, t: 500 },
        { intent: 'back', score: 0.9, t: 750 },
      ])
      expect(outputs.map((o) => o.progress.progress)).toEqual([0, 0.25, 0.5, 0.75])
      expect(outputs.every((o) => o.progress.intent === 'back')).toBe(true)
    })

    it('does not fire before the hold time', () => {
      const { fires } = run(frames('next', 0, 15)) // last frame at t=938
      expect(fires).toEqual([])
    })

    it('fires the intent once the hold time is reached', () => {
      const { fires } = run([
        { intent: 'next', score: 0.9, t: 0 },
        { intent: 'next', score: 0.9, t: 999 },
        { intent: 'next', score: 0.9, t: 1000 },
      ])
      expect(fires).toEqual([{ t: 1000, intent: 'next' }])
    })

    it.each(['next', 'back', 'check'] as const)('fires %s', (intent) => {
      expect(run(frames(intent, 0, 20)).fires.map((f) => f.intent)).toEqual([intent])
    })

    it('goes to cooldown when it fires, with progress back at 0', () => {
      const { outputs } = run([
        { intent: 'next', score: 0.9, t: 0 },
        { intent: 'next', score: 0.9, t: 1000 },
      ])
      expect(outputs[1].state).toEqual({ kind: 'cooldown', until: 3000, intent: 'next', misses: 0, released: false })
      expect(outputs[1].progress).toEqual({ intent: null, progress: 0 })
    })

    it('survives a flicker of up to 3 missed frames', () => {
      const { fires, outputs } = run([
        ...frames('next', 0, 6), // t 0..335
        ...frames(null, 402, 3), // 3 lost frames
        ...frames('next', 603, 10), // back, still the same hold
      ])
      expect(fires).toEqual([{ t: 1005, intent: 'next' }])
      const beforeFire = outputs.filter((o) => o.t < 1005)
      expect(beforeFire.every((o) => o.state.kind === 'holding')).toBe(true)
    })

    it('is reset by a fourth missed frame in a row', () => {
      const { outputs, fires } = run([...frames('next', 0, 4), ...frames(null, 268, 4)])
      expect(outputs.at(-1)?.state.kind).toBe('idle')
      expect(outputs.at(-1)?.progress).toEqual({ intent: null, progress: 0 })
      expect(fires).toEqual([])
    })

    it('a good frame clears the miss count', () => {
      const { outputs } = run([
        ...frames('next', 0, 4),
        ...frames(null, 268, 3), // 3 misses
        ...frames('next', 469, 1),
        ...frames(null, 536, 3), // 3 more misses, still fine
      ])
      expect(outputs.at(-1)?.state.kind).toBe('holding')
    })

    it('counts low-score frames of the same gesture as misses', () => {
      const { outputs } = run([...frames('next', 0, 3), ...frames('next', 201, 4, 0.5)])
      expect(outputs.at(-1)?.state.kind).toBe('idle')
    })

    it('switches to a different confident gesture and restarts the clock', () => {
      const { outputs, fires } = run([...frames('next', 0, 12), ...frames('back', 804, 20)])
      const switched = outputs.find((o) => o.t === 804)!
      expect(switched.state).toEqual({ kind: 'holding', intent: 'back', since: 804, misses: 0 })
      expect(switched.progress).toEqual({ intent: 'back', progress: 0 })
      expect(fires.map((f) => f.intent)).toEqual(['back'])
      expect(fires[0].t).toBeGreaterThanOrEqual(804 + 1000)
    })

    it('ignores a different gesture seen below the minimum score', () => {
      const { outputs } = run([...frames('next', 0, 4), { intent: 'back', score: 0.5, t: 268 }])
      expect(outputs.at(-1)?.state).toMatchObject({ kind: 'holding', intent: 'next', misses: 1 })
    })
  })

  describe('cooldown', () => {
    it('does not fire during the cooldown', () => {
      const { fires } = run(frames('back', 1072, 28), firedNext().final) // up to t=2881
      expect(fires).toEqual([])
    })

    it('shows no progress during the cooldown', () => {
      const { outputs } = run(frames('back', 1072, 28), firedNext().final)
      expect(outputs.every((o) => o.progress.intent === null && o.progress.progress === 0)).toBe(true)
    })

    it('accepts a new gesture once the cooldown is over', () => {
      const { fires, outputs } = run(frames('back', 1072, 60), firedNext().final)
      const started = outputs.find((o) => o.state.kind === 'holding')!
      expect(started.t).toBeGreaterThanOrEqual(COOLDOWN_END)
      expect(fires).toHaveLength(1)
      expect(fires[0].intent).toBe('back')
    })

    it('goes back to idle when the cooldown ends with nothing held', () => {
      const { final } = run(frames(null, 1072, 35), firedNext().final) // up to t=3350
      expect(final.kind).toBe('idle')
    })
  })

  describe('one fire per hold', () => {
    it('does not fire again when the same gesture is kept up through and after the cooldown', () => {
      const { fires } = run(frames('next', 0, 120)) // about 8 seconds
      expect(fires).toEqual([{ t: 1005, intent: 'next' }])
    })

    it('fires again after a real release and a fresh hold', () => {
      const { fires } = run([
        ...frames('next', 0, 16),
        ...frames('next', 1072, 29), // kept up through the cooldown, to t=2948
        ...frames(null, 3015, 5), // released: more than 3 frames with no gesture
        ...frames('next', 3350, 20), // a fresh attempt
      ])
      expect(fires.map((f) => f.intent)).toEqual(['next', 'next'])
    })

    it('a brief tracking flicker while still holding does not count as a release', () => {
      const { fires } = run([
        ...frames('next', 0, 16),
        ...frames('next', 1072, 29),
        ...frames(null, 3015, 3), // 3 lost frames
        ...frames('next', 3216, 40), // the same hold carries on
      ])
      expect(fires).toHaveLength(1)
    })

    it('a release during the cooldown lets the next hold start when it ends', () => {
      const { fires } = run([
        ...frames('next', 0, 16),
        ...frames(null, 1072, 5), // released while cooling down
        ...frames('next', 1407, 70), // raised again and held through the end of the cooldown
      ])
      expect(fires.map((f) => f.intent)).toEqual(['next', 'next'])
    })

    it('a different gesture right after the cooldown starts normally', () => {
      const { fires } = run([
        ...frames('next', 0, 16),
        ...frames('next', 1072, 29),
        ...frames('back', 3015, 20),
      ])
      expect(fires.map((f) => f.intent)).toEqual(['next', 'back'])
    })
  })

  it('does not change the state it was given', () => {
    const before: FilterState = { kind: 'holding', intent: 'next', since: 0, misses: 0 }
    const copy = { ...before }
    stepFilter(before, { intent: 'next', score: 0.9, t: 500 }, cfg)
    expect(before).toEqual(copy)
  })

  it('uses the thresholds from the config it is given', () => {
    const quick: FilterConfig = { ...cfg, holdMs: 200, minScore: 0.5 }
    const { fires } = run(
      [
        { intent: 'next', score: 0.6, t: 0 },
        { intent: 'next', score: 0.6, t: 200 },
      ],
      idleFilter,
      quick,
    )
    expect(fires).toEqual([{ t: 200, intent: 'next' }])
  })

  it('has the documented default thresholds', () => {
    expect(cfg).toEqual({ holdMs: 1000, minScore: 0.7, minScoreFor: { check: 0.6 }, cooldownMs: 2000, dropToleranceFrames: 3 })
  })

  it('lets an open palm count from 0.6 while thumbs still need 0.7', () => {
    const held = (intent: 'check' | 'next', score: number) => [
      { intent, score, t: 0 },
      { intent, score, t: 500 },
      { intent, score, t: 1000 },
    ]
    expect(run(held('check', 0.62)).fires).toEqual([{ t: 1000, intent: 'check' }])
    expect(run(held('check', 0.58)).fires).toEqual([])
    expect(run(held('next', 0.62)).fires).toEqual([])
  })
})
