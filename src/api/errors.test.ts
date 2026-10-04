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
})
