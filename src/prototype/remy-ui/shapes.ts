// PROTOTYPE (throwaway): M3 Expressive-style shapes as CSS clip-path polygons.
// Every shape has the same number of points, so CSS can morph between them (transition or keyframes).
const N = 96

type Radius = (t: number) => number // t in radians, returns radius in % (0–50)

const shapes: Record<string, Radius> = {
  circle: () => 48,
  cookie: t => 44 + 5 * Math.cos(9 * t),
  sunny: t => 41 + 8 * Math.cos(8 * t),
  clover: t => 36 + 13 * Math.cos(4 * t),
  burst: t => 39 + 10 * Math.cos(12 * t),
  square: t => 47 / Math.pow(Math.pow(Math.abs(Math.cos(t)), 4) + Math.pow(Math.abs(Math.sin(t)), 4), 1 / 4) * 0.98,
}

export type ShapeName = keyof typeof shapes

export function shape(name: ShapeName, rotateDeg = 0): string {
  const r = shapes[name]
  const rot = (rotateDeg * Math.PI) / 180
  const pts: string[] = []
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const rad = Math.min(50, r(t))
    pts.push(`${(50 + rad * Math.cos(t + rot)).toFixed(2)}% ${(50 + rad * Math.sin(t + rot)).toFixed(2)}%`)
  }
  return `polygon(${pts.join(',')})`
}

export const STEP_SHAPES: ShapeName[] = ['cookie', 'clover', 'sunny', 'square', 'burst', 'cookie']
export const VERDICT_SHAPE = { ready: 'burst', not_ready: 'clover', unsure: 'square' } as const

// Inject morph keyframes once: the loading indicator cycles cookie → clover → sunny → square while spinning.
let injected = false
export function injectShapeKeyframes() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const seq: ShapeName[] = ['cookie', 'clover', 'sunny', 'square', 'cookie']
  const frames = seq.map((s, i) => `${(i / (seq.length - 1)) * 100}% { clip-path: ${shape(s, i * 45)} }`).join('\n')
  const css = `@keyframes remy-morph {\n${frames}\n}`
  const el = document.createElement('style')
  el.textContent = css
  document.head.appendChild(el)
}
