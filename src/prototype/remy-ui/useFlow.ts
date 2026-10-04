// PROTOTYPE (throwaway): in-memory flow shared by every variant. Fake parse and fake checks; keyboard stands in for gestures.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GestureIntent, Verdict } from '../../types'
import { recipe } from './data'

export type Screen = 'paste' | 'reading' | 'prep' | 'cooking' | 'done'
export type Check = { kind: 'idle' } | { kind: 'looking' } | { kind: 'verdict'; verdict: Verdict }

const FAKE_VERDICTS: Verdict[] = [
  { status: 'not_ready', feedback: 'Still some dry flour streaks. Keep whisking!' },
  { status: 'unsure', feedback: 'Look down at the bowl and hold still.' },
  { status: 'ready', feedback: 'Looks just right. On to the next step!' },
]

export function useFlow() {
  const [screen, setScreen] = useState<Screen>('paste')
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [servings, setServings] = useState(recipe.servings)
  const [check, setCheck] = useState<Check>({ kind: 'idle' })
  const verdictIdx = useRef(0)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const total = recipe.steps.length
  const current = recipe.steps[step]

  const go = useCallback((to: number) => {
    setCheck({ kind: 'idle' })
    if (to >= total) { setScreen('done'); return }
    if (to < 0) return
    setDir(to > step ? 1 : -1)
    setStep(to)
  }, [step, total])

  const gesture = useCallback((g: GestureIntent) => {
    if (screen !== 'cooking') return
    if (g === 'next') go(step + 1)
    if (g === 'back') go(step - 1)
    if (g === 'check' && current.checkable && check.kind !== 'looking') {
      setCheck({ kind: 'looking' })
      later(() => {
        const verdict = FAKE_VERDICTS[verdictIdx.current++ % FAKE_VERDICTS.length]
        setCheck({ kind: 'verdict', verdict })
        if (verdict.status === 'ready') later(() => go(step + 1), 2200)
      }, 2000)
    }
  }, [screen, go, step, current, check.kind])

  const parse = () => { setScreen('reading'); later(() => setScreen('prep'), 2600) }
  const start = () => { setStep(0); setDir(1); setScreen('cooking') }
  const restart = () => { setScreen('paste'); setStep(0); setCheck({ kind: 'idle' }) }

  // Keyboard stand-in for gestures: N = 👍 next, B = 👎 back, Space = ✋ check. (← → are taken by the variant switcher.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'n') gesture('next')
      if (e.key === 'b') gesture('back')
      if (e.key === ' ') { e.preventDefault(); gesture('check') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gesture])

  return { screen, step, dir, total, current, servings, setServings, scale: servings / recipe.servings, check, gesture, parse, start, restart }
}

export type Flow = ReturnType<typeof useFlow>
