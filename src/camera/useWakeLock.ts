import { useEffect, useState } from 'react'

/**
 * Keeps the screen awake while `active`. A laptop that dims and sleeps during a
 * long cook would stop the camera. Browsers drop the lock when the tab is
 * hidden, so it is taken again when the tab is shown. Does nothing where the
 * browser has no screen wake lock.
 */
export function useWakeLock(active: boolean): { held: boolean; supported: boolean } {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (!active || !supported) return
    let cancelled = false
    let sentinel: WakeLockSentinel | null = null

    async function acquire() {
      // The browser only grants it to a visible tab, and one lock at a time is enough.
      if (cancelled || sentinel || document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled || sentinel) {
          void lock.release()
          return
        }
        sentinel = lock
        setHeld(true)
        lock.addEventListener('release', () => {
          if (sentinel === lock) {
            sentinel = null
            setHeld(false)
          }
        })
      } catch {
        // Refused (low battery, say): try again the next time the tab is shown.
      }
    }

    const onVisibility = () => void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    void acquire()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [active, supported])

  return { held: active && held, supported }
}
