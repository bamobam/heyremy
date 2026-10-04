// @vitest-environment node -- server code runs on Node, not in the browser
import { lookup } from 'node:dns/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FetchRecipeError, decodeEntities, fetchRecipeText, isBlockedIp, isRecipeUrl } from './fetchRecipe.ts'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
const dns = vi.mocked(lookup) as unknown as ReturnType<typeof vi.fn>

const PUBLIC = [{ address: '93.184.216.34', family: 4 }]
const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } })
const ld = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body>x</body></html>`
const LONG_TEXT = 'Whisk the flour and milk until smooth, then cook on a hot pan. '.repeat(6)

async function failure(p: Promise<unknown>): Promise<FetchRecipeError> {
  const e = await p.catch((x: unknown) => x)
  expect(e).toBeInstanceOf(FetchRecipeError)
  return e as FetchRecipeError
}

beforeEach(() => {
  dns.mockResolvedValue(PUBLIC)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('isRecipeUrl', () => {
  it('accepts a lone http(s) link', () => {
    expect(isRecipeUrl('https://www.allrecipes.com/recipe/21014/good-old-fashioned-pancakes/')).toBe(true)
    expect(isRecipeUrl('  http://example.com/pancakes  ')).toBe(true)
  })
  it('rejects text that merely contains a link, and other schemes', () => {
    expect(isRecipeUrl('Pancakes from https://example.com/p: 1 cup flour')).toBe(false)
    expect(isRecipeUrl('ftp://example.com/recipe')).toBe(false)
    expect(isRecipeUrl('1 cup flour')).toBe(false)
  })
})

describe('extraction', () => {
  it('reads a plain JSON-LD Recipe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(html(ld({
      '@context': 'https://schema.org', '@type': 'Recipe', name: 'Pancakes', recipeYield: ['4', '4 pancakes'],
      recipeIngredient: ['1 cup flour', '1 cup milk'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Whisk.' }, { '@type': 'HowToStep', text: 'Cook.' }],
    }))))
    const out = await fetchRecipeText('https://example.com/p')
    expect(out.source).toBe('json-ld')
    expect(out.text).toBe('Pancakes\nMakes: 4 pancakes\n\nIngredients:\n- 1 cup flour\n- 1 cup milk\n\nSteps:\n1. Whisk.\n2. Cook.')
  })

  it('finds a Recipe in @graph with an @type array, flattens sections and decodes entities', async () => {
    const page = ld({
      '@graph': [
        { '@type': 'WebPage', name: 'Site' },
        {
          '@type': ['Recipe', 'NewsArticle'], name: 'Mac &amp; cheese',
          recipeIngredient: ['&frac12; cup milk', '1 cup <b>cheese</b>', '2&#x2F;3 cup pasta'],
          recipeInstructions: [
            { '@type': 'HowToSection', name: 'Sauce', itemListElement: [{ '@type': 'HowToStep', text: 'Melt it.' }, { '@type': 'HowToStep', text: 'Stir.' }] },
            { '@type': 'HowToSection', name: 'Pasta', itemListElement: [{ '@type': 'HowToStep', name: 'Boil it&#39;s water.' }] },
          ],
        },
      ],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(html(page)))
    const { text } = await fetchRecipeText('https://example.com/mac')
    expect(text).toContain('Mac & cheese')
    expect(text).toContain('- ½ cup milk\n- 1 cup cheese\n- 2/3 cup pasta')
    expect(text).toContain("1. Sauce: Melt it.\n2. Stir.\n3. Pasta: Boil it's water.")
  })

  it('skips a broken JSON-LD block and uses the next one', async () => {
    const page = `<script type="application/ld+json">{ not json</script>${ld({ '@type': 'Recipe', name: 'Toast', recipeInstructions: 'Toast the bread.\nButter it.' })}`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(html(page)))
    const { text, source } = await fetchRecipeText('https://example.com/t')
    expect(source).toBe('json-ld')
    expect(text).toContain('1. Toast the bread.\n2. Butter it.')
  })

  it('falls back to visible page text without scripts or site chrome', async () => {
    const page = `<html><head><style>p{}</style><script>var secret = 1</script></head><body><nav>Home | Login</nav>
      <h1>Grandma&rsquo;s pancakes</h1><p>${LONG_TEXT}</p><footer>© Site</footer></body></html>`
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(html(page)))
    const { text, source } = await fetchRecipeText('https://example.com/g')
    expect(source).toBe('page-text')
    expect(text.startsWith('Grandma’s pancakes\nWhisk the flour')).toBe(true)
    expect(text).not.toMatch(/secret|Login|© Site|p\{\}/)
  })

  it('rejects a page with too little text to be a recipe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(html('<html><body><p>Just a moment...</p></body></html>')))
    expect((await failure(fetchRecipeText('https://example.com/cf'))).kind).toBe('unprocessable')
  })

  it('decodes numeric, hex and named entities once', () => {
    expect(decodeEntities('&amp;lt; &#189; &#xBD; &frac34; &bogus;')).toBe('&lt; ½ ½ ¾ &bogus;')
  })
})

describe('SSRF guard', () => {
  it.each([
    'http://localhost/r',
    'http://app.localhost/r',
    'http://printer.local/r',
    'http://db.internal/r',
    'http://127.0.0.1/r',
    'http://10.1.2.3/r',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/r',
    'http://[fd00::1]/r',
    'http://[::ffff:127.0.0.1]/r',
    'http://example.com:8080/r',
    'http://user:pass@example.com/r',
  ])('blocks %s without fetching', async (url) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const e = await failure(fetchRecipeText(url))
    expect(e.kind).toBe('bad_request')
    expect(e.message).toBe("That link can't be opened.")
    expect(fetch).not.toHaveBeenCalled()
  })

  it('blocks a name that resolves to any private address', async () => {
    dns.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '192.168.1.10', family: 4 }])
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await failure(fetchRecipeText('https://sneaky.example/r'))).kind).toBe('bad_request')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('re-checks every redirect hop', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }))
    vi.stubGlobal('fetch', fetch)
    expect((await failure(fetchRecipeText('https://example.com/r'))).kind).toBe('bad_request')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1].redirect).toBe('manual')
  })

  it('follows a safe redirect, but not more than 3', async () => {
    const hop = () => new Response(null, { status: 301, headers: { location: '/next' } })
    let fetch = vi.fn().mockResolvedValueOnce(hop()).mockResolvedValueOnce(html(ld({ '@type': 'Recipe', recipeIngredient: ['1 egg'] })))
    vi.stubGlobal('fetch', fetch)
    expect((await fetchRecipeText('https://example.com/r')).source).toBe('json-ld')
    expect(String(fetch.mock.calls[1][0])).toBe('https://example.com/next')

    fetch = vi.fn().mockImplementation(async () => hop())
    vi.stubGlobal('fetch', fetch)
    expect((await failure(fetchRecipeText('https://example.com/r'))).kind).toBe('unprocessable')
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('classifies addresses', () => {
    for (const ip of ['0.0.0.0', '100.64.0.1', '172.31.255.255', '224.0.0.1', '255.255.255.255', 'fe80::1', '::', '64:ff9b::7f00:1', '::ffff:a00:1']) {
      expect(isBlockedIp(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8']) {
      expect(isBlockedIp(ip), ip).toBe(false)
    }
  })
})

describe('unreadable pages', () => {
  it.each([
    ['a 403', () => new Response('blocked', { status: 403, headers: { 'content-type': 'text/html' } })],
    ['a non-HTML type', () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })],
    ['a declared size over 2 MB', () => html('x', { 'content-length': String(3 * 1024 * 1024) })],
    ['a streamed body over 2 MB', () => html('x'.repeat(2 * 1024 * 1024 + 1))],
  ])('rejects %s as unprocessable', async (_, make) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(make()))
    const e = await failure(fetchRecipeText('https://example.com/r'))
    expect(e.kind).toBe('unprocessable')
    expect(e.message).toBe("Couldn't read a recipe from that page. Paste the recipe text instead.")
  })

  it('times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: URL, init: RequestInit) =>
      new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)))))
    expect((await failure(fetchRecipeText('https://example.com/slow', { timeoutMs: 50 }))).kind).toBe('unprocessable')
  })

  it('maps a network error to unprocessable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    expect((await failure(fetchRecipeText('https://example.com/r'))).kind).toBe('unprocessable')
  })
})
