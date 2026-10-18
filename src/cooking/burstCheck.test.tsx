// A step whose cue changes with time is checked with several frames; any other step with one. This
// goes through the real provider, camera hook and burst timing; only the canvas grab (jsdom has none)
// and the backend (?mock) are stood in for.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../App.tsx'
import { C270, installFakeMediaDevices } from '../test/fakes/media.ts'

const grab = vi.hoisted(() => vi.fn())
vi.mock('../camera/grabSharpestFrame.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../camera/grabSharpestFrame.ts')>()),
  grabSharpestFrame: grab,
}))

/** The text of the step card the cook is on (Remy's bubble repeats it, so a plain text query finds two). */
const currentStep = () => document.querySelector('.ui-card--now h2')?.textContent ?? ''

const press = (key: string) => act(() => void fireEvent.keyDown(window, { key }))

beforeEach(() => {
  grab.mockReset()
  grab.mockImplementation(async () => ({ blob: new Blob(['frame']), width: 1, height: 1, scores: [1], chosen: 0 }))
  installFakeMediaDevices([C270])
  window.history.replaceState(null, '', '/?mock')
})

afterEach(cleanup)

async function startCooking() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))
  const start = await screen.findByRole('button', { name: /remy, let'?s cook/i }, { timeout: 10_000 })
  await waitFor(() => expect(start).toHaveProperty('disabled', false), { timeout: 10_000 })
  fireEvent.click(start)
  await waitFor(() => expect(currentStep()).toMatch(/whisk/i))
}

describe('how many frames a check takes', () => {
  it('one frame on a step whose cue does not change with time', async () => {
    await startCooking()
    press(' ')
    await screen.findByText('Almost, chef!', undefined, { timeout: 10_000 })
    expect(grab).toHaveBeenCalledTimes(1)
  }, 30_000)

  it('three frames, about 700 ms apart, on a step whose cue changes with time', async () => {
    await startCooking()
    for (let i = 0; i < 3; i++) press('n')
    await waitFor(() => expect(currentStep()).toMatch(/flip when bubbles/i), { timeout: 10_000 })

    const grabAt: number[] = []
    grab.mockImplementation(async () => {
      grabAt.push(Date.now())
      return { blob: new Blob(['frame']), width: 1, height: 1, scores: [1], chosen: 0 }
    })
    press(' ')
    await screen.findByText('Almost, chef!', undefined, { timeout: 10_000 })

    expect(grab).toHaveBeenCalledTimes(3)
    // The spacing is timer-driven, so allow some slack either way.
    expect(grabAt[1] - grabAt[0]).toBeGreaterThanOrEqual(600)
    expect(grabAt[2] - grabAt[1]).toBeGreaterThanOrEqual(600)
    expect(grabAt[2] - grabAt[0]).toBeLessThan(3_000)
  }, 30_000)
})
