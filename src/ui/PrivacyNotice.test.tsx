import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { PrivacyNotice, useNotice } from './PrivacyNotice.tsx'

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(cleanup)

describe('PrivacyNotice', () => {
  it('tells a new visitor what is sent, to whom, and that it may show them', () => {
    render(<PrivacyNotice onAccept={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: /what remy sends/i })
    const text = dialog.textContent ?? ''
    expect(text).toMatch(/recipe/i)
    expect(text).toMatch(/link/i)
    expect(text).toMatch(/photo/i)
    expect(text).toMatch(/may include you/i)
    expect(text).toMatch(/Gemini/)
    expect(text).toMatch(/ElevenLabs/)
    expect(text).toMatch(/Google Fonts/)
    expect(text).toMatch(/doesn't save/i)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('reports "Got it"', () => {
    const onAccept = vi.fn()
    render(<PrivacyNotice onAccept={onAccept} />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })
})

describe('useNotice', () => {
  it('is open for a new visitor, closes on accept, and stays closed on the next visit', () => {
    const first = renderHook(() => useNotice())
    expect(first.result.current.open).toBe(true)
    act(() => first.result.current.accept())
    expect(first.result.current.open).toBe(false)
    first.unmount()

    expect(renderHook(() => useNotice()).result.current.open).toBe(false)
  })

  it('is never open on the stand-in backend', () => {
    window.history.replaceState(null, '', '/?mock')
    expect(renderHook(() => useNotice()).result.current.open).toBe(false)
  })
})
