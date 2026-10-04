// PROTOTYPE (throwaway): floating variant switcher. ← / → or the arrows cycle ?variant=. Hidden in production builds.
import { useEffect } from 'react'

export function PrototypeSwitcher({ variants, current }: { variants: { key: string; name: string }[]; current: string }) {
  const i = Math.max(0, variants.findIndex(v => v.key === current))
  const go = (d: number) => {
    const next = variants[(i + d + variants.length) % variants.length]
    const url = new URL(location.href)
    url.searchParams.set('variant', next.key)
    history.replaceState(null, '', url)
    dispatchEvent(new PopStateEvent('popstate'))
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  if (import.meta.env.PROD) return null
  const v = variants[i]
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, background: '#111', color: '#fff', borderRadius: 999, padding: '6px 8px', font: '600 14px system-ui, sans-serif', boxShadow: '0 6px 20px rgba(0,0,0,.35)' }}>
      <button onClick={() => go(-1)} style={btn}>←</button>
      <span style={{ minWidth: 170, textAlign: 'center' }}>{v.key} ({v.name})</span>
      <button onClick={() => go(1)} style={btn}>→</button>
    </div>
  )
}
const btn: React.CSSProperties = { border: 0, borderRadius: 999, width: 32, height: 32, background: '#333', color: '#fff', cursor: 'pointer', fontSize: 16 }
