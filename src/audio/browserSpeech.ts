// Fallback voice: the browser's speechSynthesis reads text when a clip is missing or
// a live speech request fails. Sounds worse than ElevenLabs but keeps cooking hands-free.

/** The parts of `speechSynthesis` this module uses. */
export interface SpeechEngine {
  speak(utterance: SpeechSynthesisUtterance): void
  cancel(): void
  getVoices(): SpeechSynthesisVoice[]
  addEventListener(type: 'voiceschanged', listener: () => void): void
  removeEventListener(type: 'voiceschanged', listener: () => void): void
}

export interface BrowserSpeech {
  /** Reads the text aloud. Resolves when it ends, fails or is cancelled; never rejects. */
  say(text: string): Promise<void>
  /** Stops anything being read. */
  cancel(): void
  /** Speaks a silent utterance; call inside a click so later speech isn't blocked. */
  unlock(): void
}

const LANG = 'en-US'

const normalize = (lang: string) => lang.replace('_', '-').toLowerCase()

/** Picks an English voice: en-US first, then any English; the browser's default wins a tie. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const rank = (v: SpeechSynthesisVoice) => {
    const lang = normalize(v.lang)
    const base = lang === 'en-us' ? 0 : lang.startsWith('en') ? 2 : 4
    return base + (v.default ? 0 : 1)
  }
  let best: SpeechSynthesisVoice | null = null
  for (const v of voices) {
    if (rank(v) >= 4) continue
    if (!best || rank(v) < rank(best)) best = v
  }
  return best
}

export function createBrowserSpeech(
  deps: {
    engine?: SpeechEngine | null
    makeUtterance?: (text: string) => SpeechSynthesisUtterance
  } = {},
): BrowserSpeech {
  const engine =
    deps.engine !== undefined ? deps.engine : typeof speechSynthesis === 'undefined' ? null : speechSynthesis
  const makeUtterance = deps.makeUtterance ?? ((text: string) => new SpeechSynthesisUtterance(text))

  // The voice is picked once. Chrome loads voices asynchronously, so wait for them if needed.
  let voice: SpeechSynthesisVoice | null = null
  let picked = false
  const tryPick = () => {
    if (picked || !engine) return
    const voices = engine.getVoices()
    if (voices.length === 0) return
    voice = pickVoice(voices)
    picked = true
    engine.removeEventListener('voiceschanged', tryPick)
  }
  if (engine) {
    engine.addEventListener('voiceschanged', tryPick)
    tryPick()
  }

  let settlePending: (() => void) | null = null

  const cancel = () => {
    if (!engine) return
    const settle = settlePending
    settlePending = null
    engine.cancel()
    settle?.()
  }

  return {
    say(text) {
      if (!engine || !text.trim()) return Promise.resolve()
      cancel()
      tryPick()
      return new Promise<void>((resolve) => {
        const utterance = makeUtterance(text)
        utterance.lang = LANG
        if (voice) utterance.voice = voice
        const settle = () => {
          if (settlePending === settle) settlePending = null
          resolve()
        }
        settlePending = settle
        utterance.onend = settle
        utterance.onerror = settle
        engine.speak(utterance)
      })
    },
    cancel,
    unlock() {
      if (!engine) return
      const utterance = makeUtterance(' ')
      utterance.lang = LANG
      utterance.volume = 0
      engine.speak(utterance)
    },
  }
}
