// §9.2: a first-time visitor on the real backend is told what Remy sends before a first recipe can be sent.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from './App.tsx'
import { installFakeMediaDevices, MACBOOK } from './test/fakes/media.ts'

beforeEach(() => {
  installFakeMediaDevices([MACBOOK])
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(cleanup)

describe('the first visit', () => {
  it('locks the start screen behind the notice, and unlocks it on "Got it"', () => {
    const { container } = render(<App />)
    const gate = container.querySelector('[inert]')
    expect(gate).toBeTruthy()
    expect(gate?.querySelector('textarea')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: /what remy sends/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(container.querySelector('[inert]')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not ask again after accepting', () => {
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    first.unmount()
    cleanup()

    render(<App />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
