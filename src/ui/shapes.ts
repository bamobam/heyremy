// M3 Expressive-style shapes as CSS clip-path polygons (§9.1). Pure: no DOM, no React.
// Every shape returns the same number of points, so CSS can morph one into another.
const N = 96

/** t in radians, returns a radius in % (0–50). */
type Radius = (t: number) => number

const radii: Record<string, Radius> = {
  circle: () => 48,
  cookie: t => 44 + 5 * Math.cos(9 * t),
  sunny: t => 41 + 8 * Math.cos(8 * t),
  clover: t => 36 + 13 * Math.cos(4 * t),
  burst: t => 39 + 10 * Math.cos(12 * t),
  square: t => (47 / Math.pow(Math.pow(Math.abs(Math.cos(t)), 4) + Math.pow(Math.abs(Math.sin(t)), 4), 1 / 4)) * 0.98,
}

export type ShapeName = keyof typeof radii

export function shape(name: ShapeName, rotateDeg = 0): string {
  const radius = radii[name]
  const rot = (rotateDeg * Math.PI) / 180
  const points: string[] = []
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    const r = Math.min(50, radius(t))
    points.push(`${(50 + r * Math.cos(t + rot)).toFixed(2)}% ${(50 + r * Math.sin(t + rot)).toFixed(2)}%`)
  }
  return `polygon(${points.join(',')})`
}

/** The shape behind each step number, cycling with the step fields. */
export const STEP_SHAPES: readonly ShapeName[] = ['cookie', 'clover', 'sunny', 'square', 'burst', 'cookie']

/** The hero shape for each verdict. */
export const VERDICT_SHAPE = { ready: 'burst', not_ready: 'clover', unsure: 'square' } as const satisfies Record<string, ShapeName>

/** The shape a RemyBadge sits on, per screen. */
export const BADGE_SHAPE = { welcome: 'sunny', prep: 'cookie', done: 'burst' } as const satisfies Record<string, ShapeName>

/** The colours of the parser's morphing blob, in the order it morphs. */
const MORPH_SEQUENCE: readonly ShapeName[] = ['cookie', 'clover', 'sunny', 'square', 'cookie']

/** The @keyframes the blob animates, as text, so it can be injected once into the document head. */
export function shapeKeyframes(): string {
  const last = MORPH_SEQUENCE.length - 1
  const frames = MORPH_SEQUENCE.map((s, i) => `${((i / last) * 100).toFixed(2)}% { clip-path: ${shape(s, i * 45)} }`)
  return `@keyframes remy-morph {\n${frames.join('\n')}\n}`
}

let injected = false

/** Adds the morph keyframes once. Safe to call from module scope. */
export function injectShapeKeyframes(): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  const el = document.createElement('style')
  el.textContent = shapeKeyframes()
  document.head.appendChild(el)
}