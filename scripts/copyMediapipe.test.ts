// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs so it can run as a postinstall step
import { copyWasm } from './copyMediapipe.mjs'

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'mediapipe-'))
  const from = join(root, 'wasm')
  const to = join(root, 'public', 'wasm')
  mkdirSync(from, { recursive: true })
  return { from, to }
}

describe('copyWasm', () => {
  it('copies every wasm and js file into the destination, creating it', () => {
    const { from, to } = setup()
    writeFileSync(join(from, 'vision_wasm_internal.js'), 'js')
    writeFileSync(join(from, 'vision_wasm_internal.wasm'), 'wasm')

    const copied = copyWasm(from, to)

    expect(readdirSync(to).sort()).toEqual(['vision_wasm_internal.js', 'vision_wasm_internal.wasm'])
    expect(readFileSync(join(to, 'vision_wasm_internal.wasm'), 'utf8')).toBe('wasm')
    expect(copied).toBe(2)
  })

  it('overwrites files from an older install', () => {
    const { from, to } = setup()
    writeFileSync(join(from, 'a.wasm'), 'new')
    mkdirSync(to, { recursive: true })
    writeFileSync(join(to, 'a.wasm'), 'old')

    copyWasm(from, to)

    expect(readFileSync(join(to, 'a.wasm'), 'utf8')).toBe('new')
  })

  it('does nothing and returns 0 if MediaPipe is not installed', () => {
    const { to } = setup()
    expect(copyWasm(join(to, '..', 'missing'), to)).toBe(0)
  })
})
