import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FeedbackLink, feedbackUrl } from './FeedbackLink.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('feedbackUrl', () => {
  it('is nothing until a form is configured', () => {
    expect(feedbackUrl(undefined)).toBeNull()
    expect(feedbackUrl('')).toBeNull()
    expect(feedbackUrl('   ')).toBeNull()
  })

  it('accepts a secure web address, trimmed', () => {
    expect(feedbackUrl(' https://forms.gle/abc123 ')).toBe('https://forms.gle/abc123')
  })

  it('refuses anything that is not https, such as a script or a plain web address', () => {
    expect(feedbackUrl('javascript:alert(1)')).toBeNull()
    expect(feedbackUrl('http://example.com/form')).toBeNull()
    expect(feedbackUrl('not a url')).toBeNull()
  })
})

describe('FeedbackLink', () => {
  it('links to the configured form, in a new tab, without handing it the page', () => {
    vi.stubEnv('VITE_FEEDBACK_URL', 'https://forms.gle/abc123')
    render(<FeedbackLink />)
    const link = screen.getByRole('link', { name: /send feedback/i })
    expect(link.getAttribute('href')).toBe('https://forms.gle/abc123')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('shows nothing when no form is configured', () => {
    vi.stubEnv('VITE_FEEDBACK_URL', '')
    const { container } = render(<FeedbackLink />)
    expect(container.firstChild).toBeNull()
  })
})
