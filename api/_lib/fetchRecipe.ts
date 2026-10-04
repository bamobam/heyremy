// Recipe-link import for /api/parse: fetch a page safely and pull out the recipe text.
// Prefers the schema.org Recipe JSON-LD most recipe sites embed; falls back to the page's text.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { MAX_RECIPE_CHARS } from './limits.ts'

const DEFAULT_TIMEOUT_MS = 6_000
const MAX_REDIRECTS = 3
const MAX_BYTES = 2 * 1024 * 1024
// Shorter than this after stripping, the page has no recipe worth parsing.
const MIN_PAGE_TEXT_CHARS = 200
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
}

const BLOCKED = "That link can't be opened."
const UNREADABLE = "Couldn't read a recipe from that page. Paste the recipe text instead."

export type RecipeSource = 'json-ld' | 'page-text'

/** A link we refuse (bad_request) or a page we couldn't read (unprocessable); message is user-facing. */
export class FetchRecipeError extends Error {
  kind: 'bad_request' | 'unprocessable'
  constructor(kind: 'bad_request' | 'unprocessable', message: string) {
    super(message)
    this.name = 'FetchRecipeError'
    this.kind = kind
  }
}

/** True when the whole input is one http(s) URL, not a recipe that happens to contain a link. */
export function isRecipeUrl(input: string): boolean {
  const s = input.trim()
  if (s === '' || /\s/.test(s)) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function fetchRecipeText(
  url: string,
  opts: { timeoutMs?: number } = {},
): Promise<{ text: string; source: RecipeSource }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs
  const signal = AbortSignal.timeout(timeoutMs)

  let current: URL
  try {
    current = new URL(url)
  } catch {
    throw new FetchRecipeError('bad_request', BLOCKED)
  }

  let html: string | null = null
  for (let hop = 0; html === null; hop++) {
    await assertAllowed(current, deadline)
    let res: Response
    try {
      res = await fetch(current, { redirect: 'manual', signal, headers: HEADERS })
    } catch {
      throw new FetchRecipeError('unprocessable', UNREADABLE)
    }
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) throw new FetchRecipeError('unprocessable', UNREADABLE)
      try {
        current = new URL(location, current)
      } catch {
        throw new FetchRecipeError('unprocessable', UNREADABLE)
      }
      continue
    }
    if (!res.ok) throw new FetchRecipeError('unprocessable', UNREADABLE)
    if (!/html/i.test(res.headers.get('content-type') ?? '')) throw new FetchRecipeError('unprocessable', UNREADABLE)
    html = await readCapped(res)
  }

  const fromLd = recipeFromJsonLd(html)
  if (fromLd !== null) return { text: fromLd.slice(0, MAX_RECIPE_CHARS), source: 'json-ld' }
  const text = pageText(html)
  if (text.length < MIN_PAGE_TEXT_CHARS) throw new FetchRecipeError('unprocessable', UNREADABLE)
  return { text, source: 'page-text' }
}

// ---------- SSRF guard ----------

async function assertAllowed(u: URL, deadline: number): Promise<void> {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new FetchRecipeError('bad_request', BLOCKED)
  if (u.port !== '' && u.port !== '80' && u.port !== '443') throw new FetchRecipeError('bad_request', BLOCKED)
  if (u.username !== '' || u.password !== '') throw new FetchRecipeError('bad_request', BLOCKED)

  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new FetchRecipeError('bad_request', BLOCKED)
  }
  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) throw new FetchRecipeError('bad_request', BLOCKED)
    return
  }

  let addresses: { address: string }[]
  try {
    const left = Math.max(0, deadline - Date.now())
    addresses = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), left)),
    ])
  } catch {
    throw new FetchRecipeError('unprocessable', UNREADABLE)
  }
  // Any internal address means no: a name that resolves to both could still reach the inside.
  if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
    throw new FetchRecipeError('bad_request', BLOCKED)
  }
}

/** Loopback, private, link-local, CGNAT, multicast, reserved and documentation ranges, v4 and v6. */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return isBlockedV4(ip)
  if (kind === 6) return isBlockedV6(ip)
  return true
}

function v4ToNumber(ip: string): number {
  return ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)
}

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

function isBlockedV4(ip: string): boolean {
  const n = v4ToNumber(ip)
  return V4_BLOCKED.some(([base, bits]) => {
    const size = 2 ** (32 - bits)
    const start = v4ToNumber(base)
    return n >= start && n < start + size
  })
}

/** Expands an IPv6 address to 8 numbers, turning a trailing dotted IPv4 into two groups. */
function v6Groups(ip: string): number[] {
  let s = ip.split('%')[0]
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const n = v4ToNumber(dotted[1])
    s = s.slice(0, -dotted[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`
  }
  const [head, tail] = s.split('::')
  const h = head ? head.split(':') : []
  const t = tail !== undefined && tail !== '' ? tail.split(':') : []
  const fill = tail !== undefined ? Array(8 - h.length - t.length).fill('0') : []
  return [...h, ...fill, ...t].map((g) => parseInt(g, 16))
}

function isBlockedV6(ip: string): boolean {
  const g = v6Groups(ip)
  const embeddedV4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`
  if (g.every((x) => x === 0)) return true // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true // ::1
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return isBlockedV4(embeddedV4) // ::ffff:v4, ::v4
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedV4(embeddedV4) // NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation
  return false
}

async function readCapped(res: Response): Promise<string> {
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new FetchRecipeError('unprocessable', UNREADABLE)
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => {})
        throw new FetchRecipeError('unprocessable', UNREADABLE)
      }
      chunks.push(value)
    }
  } catch (e) {
    if (e instanceof FetchRecipeError) throw e
    throw new FetchRecipeError('unprocessable', UNREADABLE)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

// ---------- Extraction ----------

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔', frac18: '⅛',
  deg: '°', ndash: '–', mdash: '—', hellip: '…', times: '×', frasl: '⁄',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', eacute: 'é', egrave: 'è',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return NAMED[name.toLowerCase()] ?? whole
  })
}

/** Plain text from a JSON-LD string: tags stripped, entities decoded, whitespace collapsed. */
function clean(x: unknown): string {
  if (typeof x !== 'string' && typeof x !== 'number') return ''
  return decodeEntities(String(x).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)

function hasType(node: Obj, type: string): boolean {
  const t = node['@type']
  return Array.isArray(t) ? t.includes(type) : t === type
}

function findRecipe(node: unknown, depth = 0): Obj | null {
  if (depth > 8) return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findRecipe(n, depth + 1)
      if (found) return found
    }
    return null
  }
  if (!isObj(node)) return null
  if (hasType(node, 'Recipe')) return node
  for (const value of Object.values(node)) {
    if (typeof value === 'object' && value !== null) {
      const found = findRecipe(value, depth + 1)
      if (found) return found
    }
  }
  return null
}

/** Flattens recipeInstructions: a string, string[], HowToStep, or HowToSection of steps. */
function instructionLines(x: unknown, depth = 0): string[] {
  if (depth > 6) return []
  if (typeof x === 'string') {
    return decodeEntities(x.replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '))
      .split(/\n+/)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  }
  if (Array.isArray(x)) return x.flatMap((i) => instructionLines(i, depth + 1))
  if (!isObj(x)) return []
  if (x.itemListElement !== undefined) {
    const lines = instructionLines(x.itemListElement, depth + 1)
    const name = hasType(x, 'HowToSection') ? clean(x.name) : ''
    return name && lines.length > 0 ? [`${name}: ${lines[0]}`, ...lines.slice(1)] : lines
  }
  const text = clean(x.text) || clean(x.name)
  return text ? [text] : []
}

function yieldText(x: unknown): string {
  const list = (Array.isArray(x) ? x : [x]).map(clean).filter(Boolean)
  // Sites often give ["4", "4 servings"]; the longest says the most.
  return list.sort((a, b) => b.length - a.length)[0] ?? ''
}

/** The recipe as plain text from schema.org JSON-LD, or null if the page has none worth using. */
export function recipeFromJsonLd(html: string): string | null {
  const blocks = html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, raw] of blocks) {
    let data: unknown
    try {
      data = JSON.parse(raw.trim())
    } catch {
      continue
    }
    const recipe = findRecipe(data)
    if (!recipe) continue
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []).map(clean).filter(Boolean)
    const steps = instructionLines(recipe.recipeInstructions)
    if (ingredients.length === 0 && steps.length === 0) continue

    const lines: string[] = []
    const name = clean(recipe.name)
    if (name) lines.push(name)
    const makes = yieldText(recipe.recipeYield)
    if (makes) lines.push(`Makes: ${makes}`)
    if (ingredients.length > 0) lines.push('', 'Ingredients:', ...ingredients.map((i) => `- ${i}`))
    if (steps.length > 0) lines.push('', 'Steps:', ...steps.map((s, i) => `${i + 1}. ${s}`))
    return lines.join('\n')
  }
  return null
}

/** Visible text of a page, minus scripts, styles and site chrome, capped at MAX_RECIPE_CHARS. */
export function pageText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|nav|header|footer|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<\/(p|li|h[1-6]|div|tr|section|article)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_RECIPE_CHARS)
}
