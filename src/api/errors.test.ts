import { describe, expect, it } from 'vitest'
import { ApiError, fromStatus, userMessage } from './errors.ts'

describe('fromStatus', () => {
  it.each([
    [400, 'bad_request'],
    [422, 'unprocessable'],
    [429, 'rate_limited'],
    [500, 'upstream'],
    [502, 'upstream'],
    [503, 'upstream'],
    [504, 'upstream'],
    [401, 'unknown'],
    [404, 'unknown'],
    [418, 'unknown'],
  ] as const)('maps %i to %s', (status, kind) => {
    expect(fromStatus(status)).toBe(kind)
  })
})

describe('userMessage', () => {
  it.each([
    ['bad_request', 'That recipe is too long or empty.'],
    ['unprocessable', "I couldn't make sense of that recipe."],
    ['upstream', 'Something went wrong on our side. Try again.'],
    ['rate_limited', 'Too many requests, wait a few seconds.'],
    ['timeout', 'That took too long. Try again.'],
    ['aborted', ''],
    ['unknown', 'Something went wrong.'],
  ] as const)('says the right thing for %s', (kind, message) => {
    expect(userMessage(kind)).toBe(message)
  })
})

describe('userMessage with a message from the server', () => {
  const daily = "Remy has reached today's limit. Try again tomorrow."

  it('shows the server message for a rate limit, so the daily cap can say "tomorrow"', () => {
    expect(userMessage('rate_limited', daily)).toBe(daily)
  })

  it.each([undefined, '', '   '])('keeps the default for a rate limit when the server sent %j', (sent) => {
    expect(userMessage('rate_limited', sent)).toBe('Too many requests, wait a few seconds.')
  })

  it('does not take the server message for any other kind', () => {
    expect(userMessage('upstream', 'Gemini returned 503.')).toBe('Something went wrong on our side. Try again.')
    expect(userMessage('timeout', 'slow')).toBe('That took too long. Try again.')
  })
})

describe('ApiError', () => {
  it('carries the kind and status, and is an Error', () => {
    const e = new ApiError('upstream', { status: 502 })
    expect(e).toBeInstanceOf(Error)
    expect(e).toMatchObject({ name: 'ApiError', kind: 'upstream', status: 502 })
  })

  it('defaults the message to what the cook should read', () => {
    expect(new ApiError('timeout').message).toBe('That took too long. Try again.')
  })

  it('uses a message from the server when it gives one', () => {
    expect(new ApiError('unprocessable', { message: 'No steps found.' }).message).toBe('No steps found.')
  })

  it('uses the server message for a rate limit, and the default when there is none', () => {
    expect(new ApiError('rate_limited', { message: "Remy has reached today's limit. Try again tomorrow." }).message).toBe(
      "Remy has reached today's limit. Try again tomorrow.",
    )
    expect(new ApiError('rate_limited', { status: 429 }).message).toBe('Too many requests, wait a few seconds.')
  })
})
