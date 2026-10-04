// The voice flow in the provider: a failure of any kind leaves the cook a way forward.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App.tsx'
import { ApiError } from '../api/errors.ts'
import { silentWavBlob } from '../audio/silence.ts'
import { installFakeMediaDevices, MACBOOK } from '../test/fakes/media.ts'

const speak = vi.hoisted(() => vi.fn())
vi.mock('../audio/speak.ts', () => ({ speak }))

beforeEach(() => {
  installFakeMediaDevices([MACBOOK])
  window.history.replaceState(null, '', '/?mock')
})

afterEach(() => {
  cleanup()
  speak.mockReset()
})

describe('voicing', () => {
  it('offers Try again after a timeout, not only after an upstream error, and recovers', async () => {
    speak.mockRejectedValue(new ApiError('timeout'))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /let'?s cook/i }))

    const tryAgain = await screen.findByRole('button', { name: /try again/i }, { timeout: 10_000 })
    expect(screen.getByRole('button', { name: /remy, let'?s cook/i })).toHaveProperty('disabled', true)

    speak.mockResolvedValue(silentWavBlob())
    fireEvent.click(tryAgain)

    await screen.findByText(/voice is ready/i, undefined, { timeout: 10_000 })
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    expect(screen.getByRole('button', { name: /remy, let'?s cook/i })).toHaveProperty('disabled', false)
  }, 25_000)
})
