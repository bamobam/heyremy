// Plays Remy's voice: cached step clips, live verdict speech, and the browser-speech
// fallback. One voice at a time: every play first stops whatever is playing.

import { createBrowserSpeech, type BrowserSpeech } from './browserSpeech.ts'
import { silentWavUrl } from './silence.ts'
import { clipCache, type ClipCache, type ObjectUrls } from './clipCache.ts'

export interface AudioPlayer {
  unlock(): Promise<void> // call from the Start button click
  preload(id: string, blob: Blob): void
  play(id: string, fallbackText?: string): Promise<void> // cached clip, or browser speech if missing
  playBlob(blob: Blob): Promise<void>
  speakLive(text: string): Promise<void> // api.speak → playBlob; on failure, browser speech
  stop(): void // stops both <audio> and speechSynthesis
}

/** The parts of an `<audio>` element the player uses. */
export interface AudioElement {
  src: string
  play(): Promise<void>
  pause(): void
  addEventListener(type: 'ended' | 'error', listener: () => void): void
  removeEventListener(type: 'ended' | 'error', listener: () => void): void
}

export interface AudioPlayerDeps {
  /** Text → speech audio, e.g. the API client's `speak`. Injected so audio doesn't depend on it. */
  speak(text: string): Promise<Blob>
  cache?: ClipCache
  speech?: BrowserSpeech
  createAudio?: () => AudioElement
  urls?: ObjectUrls
}

type Outcome = 'ended' | 'failed' | 'stopped'

export function createAudioPlayer(deps: AudioPlayerDeps): AudioPlayer {
  const cache = deps.cache ?? clipCache
  const speech = deps.speech ?? createBrowserSpeech()
  const urls = deps.urls ?? URL
  const createAudio = deps.createAudio ?? (() => new Audio())

  // One element for everything, created on first use. Reusing it matters on Safari,
  // where the autoplay unlock applies to the element that played inside the click.
  let element: AudioElement | null = null
  const audio = () => (element ??= createAudio())

  // Bumped by every stop(). A playback whose token is stale was cut off and must not
  // fall back to speech or start late (e.g. a verdict arriving after the cook moved on).
  let token = 0
  let finishCurrent: ((o: Outcome) => void) | null = null

  const stop = () => {
    token++
    const finish = finishCurrent
    finishCurrent = null
    finish?.('stopped')
    element?.pause()
    speech.cancel()
  }

  const begin = () => {
    stop()
    return token
  }

  const isCurrent = (t: number) => t === token

  const playUrl = (url: string, t: number) =>
    new Promise<Outcome>((resolve) => {
      const el = audio()
      const finish = (outcome: Outcome) => {
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('error', onError)
        if (finishCurrent === finish) finishCurrent = null
        resolve(outcome)
      }
      const onEnded = () => finish('ended')
      const onError = () => finish('failed')
      finishCurrent = finish
      el.addEventListener('ended', onEnded)
      el.addEventListener('error', onError)
      el.src = url
      el.play().catch(() => finish(isCurrent(t) ? 'failed' : 'stopped'))
    })

  const playBlobAs = async (blob: Blob, t: number) => {
    const url = urls.createObjectURL(blob)
    try {
      return await playUrl(url, t)
    } finally {
      urls.revokeObjectURL(url)
    }
  }

  const sayIfCurrent = (text: string | undefined, t: number) =>
    text && isCurrent(t) ? speech.say(text) : Promise.resolve()

  return {
    unlock() {
      // Both plays must start synchronously inside the click handler.
      speech.unlock()
      const el = audio()
      el.src = silentWavUrl()
      return el.play().catch(() => {})
    },

    preload(id, blob) {
      cache.put(id, blob)
    },

    async play(id, fallbackText) {
      const t = begin()
      const url = cache.get(id)
      if (!url) return sayIfCurrent(fallbackText, t)
      const outcome = await playUrl(url, t)
      if (outcome === 'failed') await sayIfCurrent(fallbackText, t)
    },

    async playBlob(blob) {
      await playBlobAs(blob, begin())
    },

    async speakLive(text) {
      const t = begin()
      let blob: Blob
      try {
        blob = await deps.speak(text)
      } catch {
        return sayIfCurrent(text, t)
      }
      if (!isCurrent(t)) return
      const outcome = await playBlobAs(blob, t)
      if (outcome === 'failed') await sayIfCurrent(text, t)
    },

    stop,
  }
}
