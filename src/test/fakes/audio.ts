// Test doubles for the audio APIs jsdom doesn't have: an <audio> element that can be
// told to finish or fail, speechSynthesis + SpeechSynthesisUtterance, and object URLs.

type PlayError = 'NotAllowedError' | 'NotSupportedError' | 'AbortError'

export class FakeAudio extends EventTarget {
  src = ''
  paused = true
  /** The src of every play() call, in order. */
  readonly plays: string[] = []
  private nextError: PlayError | null = null

  play(): Promise<void> {
    this.plays.push(this.src)
    if (this.nextError) {
      const name = this.nextError
      this.nextError = null
      return Promise.reject(new DOMException(name, name))
    }
    this.paused = false
    return Promise.resolve()
  }

  pause() {
    this.paused = true
  }

  /** The next play() rejects, like a browser blocking autoplay. */
  failNextPlay(name: PlayError = 'NotAllowedError') {
    this.nextError = name
  }

  /** The clip plays to the end. */
  finish() {
    this.paused = true
    this.dispatchEvent(new Event('ended'))
  }

  /** The source can't be decoded or loaded. */
  breakSource() {
    this.paused = true
    this.dispatchEvent(new Event('error'))
  }
}

export class FakeUtterance {
  text: string
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  volume = 1
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

export class FakeSpeechSynthesis extends EventTarget {
  voices: SpeechSynthesisVoice[]
  /** Every utterance passed to speak(), in order. */
  readonly spoken: FakeUtterance[] = []
  cancelCount = 0
  private queue: FakeUtterance[] = []

  constructor(voices: SpeechSynthesisVoice[] = []) {
    super()
    this.voices = voices
  }

  getVoices() {
    return this.voices
  }

  speak(utterance: FakeUtterance) {
    this.spoken.push(utterance)
    this.queue.push(utterance)
  }

  /** Like Chrome: every queued utterance gets an error event. */
  cancel() {
    this.cancelCount++
    const queued = this.queue
    this.queue = []
    for (const u of queued) u.onerror?.({ error: 'canceled' })
  }

  /** The utterance being read finishes. */
  finish() {
    this.queue.shift()?.onend?.()
  }

  /** Voices arrive late, as in Chrome. */
  loadVoices(voices: SpeechSynthesisVoice[]) {
    this.voices = voices
    this.dispatchEvent(new Event('voiceschanged'))
  }

  get pending() {
    return this.queue.length
  }
}

export function voice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return { name, lang, default: isDefault, localService: true, voiceURI: name }
}

export class FakeObjectUrls {
  private next = 0
  readonly live = new Set<string>()
  readonly revoked: string[] = []
  readonly blobs = new Map<string, Blob>()

  createObjectURL = (blob: Blob) => {
    const url = `blob:fake/${++this.next}`
    this.live.add(url)
    this.blobs.set(url, blob)
    return url
  }

  revokeObjectURL = (url: string) => {
    this.live.delete(url)
    this.revoked.push(url)
  }
}
