import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ConsentNotice } from './ConsentNotice.tsx'

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(cleanup)

describe('ConsentNotice', () => {
  it('tells a new visitor what is sent, and to whom', () => {
    render(<ConsentNotice />)
    const dialog = screen.getByRole('dialog', { name: /what remy sends/i })
    expect(dialog.textContent).toMatch(/recipe/i)
    expect(dialog.textContent).toMatch(/photo/i)
    expect(dialog.textContent).toMatch(/Gemini/)
    expect(dialog.textContent).toMatch(/ElevenLabs/)
    expect(dialog.textContent).toMatch(/doesn't save/i)
  })

  it('goes away on "Got it" and stays away on the next visit', () => {
    const { unmount } = render(<ConsentNotice />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()

    render(<ConsentNotice />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is not shown on the stand-in backend, where nothing is sent', () => {
    window.history.replaceState(null, '', '/?mock')
    render(<ConsentNotice />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
