// Guards §9.1: every colour the UI paints a field with must have a name in tokens.css. This is the
// test that keeps the design doc and the code from drifting apart on token names.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHECKLIST_COLOURS, FIELDS, VERDICT_FIELDS } from './fields.ts'

// Read the stylesheet itself, so this test fails when the code and the doc disagree on a name.
const css = readFileSync(resolve(process.cwd(), 'src/ui/tokens.css'), 'utf8')

/** `--name: #hex`, plus `--name: var(--other)` aliases resolved one level deep. */
function readTokens(source: string): Map<string, string> {
  const raw = new Map<string, string>()
  for (const [, name, value] of source.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    raw.set(name, value.trim())
  }
  const resolved = new Map<string, string>()
  for (const [name, value] of raw) {
    const alias = value.match(/^var\(--([\w-]+)\)$/)
    resolved.set(name, (alias ? raw.get(alias[1]) : value)?.toLowerCase() ?? '')
  }
  return resolved
}

const tokens = readTokens(css)
const hexes = new Set(tokens.values())

describe('visual tokens', () => {
  it('names every colour §9.1 lists', () => {
    for (const name of ['ink', 'cream', 'umber', 'cocoa', 'sand', 'blush', 'stone', 'apricot', 'clay', 'sage', 'slate', 'brand', 'pink', 'sparkle']) {
      expect(tokens.get(name), `--${name} is missing from tokens.css`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('gives the three verdicts a colour by meaning', () => {
    expect(VERDICT_FIELDS.ready).toBe('#657167')
    expect(VERDICT_FIELDS.not_ready).toBe('#BE7463')
    expect(VERDICT_FIELDS.unsure).toBe('#9F9593')
  })

  it('has the two springs and both motion curves', () => {
    expect(tokens.get('spring')).toContain('linear(')
    expect(tokens.get('bouncy')).toContain('linear(')
  })
})

/** WCAG relative luminance: channels are linearised first, which a plain weighted sum skips. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('fields', () => {
  it('paints every card, text and accent colour with a named token', () => {
    const unnamed: string[] = []
    FIELDS.forEach((field, i) => {
      for (const [part, colour] of Object.entries(field)) {
        // `back` is a deeper shade of the card, not a palette token in its own right (§9.1).
        if (part === 'back') continue
        if (!hexes.has(colour.toLowerCase())) unnamed.push(`field ${i + 1} ${part} ${colour}`)
      }
    })
    expect(unnamed).toEqual([])
  })

  it('paints the verdict fields and checklist boxes with named tokens', () => {
    const unnamed = [...Object.values(VERDICT_FIELDS), ...CHECKLIST_COLOURS]
      .map(c => c.toLowerCase())
      .filter(c => !hexes.has(c))
    expect(unnamed).toEqual([])
  })

  it('never repeats a card colour, so six steps all look different', () => {
    expect(new Set(FIELDS.map(f => f.card.toLowerCase())).size).toBe(FIELDS.length)
  })

  it('keeps the step text readable on every card', () => {
    // Step text is 38px at weight 800, so WCAG AA for large text: 3:1 against its card.
    for (const field of FIELDS) {
      expect(contrast(field.fg, field.card), `${field.fg} on ${field.card}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps the step number and heads-up text readable on their accent', () => {
    for (const field of FIELDS) {
      expect(contrast(field.card, field.accent), `${field.card} on ${field.accent}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps the verdict text readable on each verdict field', () => {
    // steps.css paints the unsure verdict in ink, because cream on that grey is only 2.7:1.
    const text = { ready: '#FFF7EA', not_ready: '#FFF7EA', unsure: '#1D1B20' } as const
    for (const [status, field] of Object.entries(VERDICT_FIELDS)) {
      expect(contrast(text[status as keyof typeof text], field), status).toBeGreaterThanOrEqual(3)
    }
  })
})
