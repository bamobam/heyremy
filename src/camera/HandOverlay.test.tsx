import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HAND_CONNECTIONS } from './handConnections.ts'
import { HandOverlay } from './HandOverlay.tsx'

const hand = Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: 0.5 }))

describe('HandOverlay', () => {
  it('draws one dot per landmark, positioned by the 0..1 coordinates', () => {
    render(<HandOverlay landmarks={hand} />)
    const dots = screen.getAllByTestId('landmark')
    expect(dots).toHaveLength(21)
    expect(dots[10].getAttribute('cx')).toBe(String(10 / 21))
    expect(dots[10].getAttribute('cy')).toBe('0.5')
  })

  it('draws a bone for each hand connection', () => {
    render(<HandOverlay landmarks={hand} />)
    expect(screen.getAllByTestId('bone')).toHaveLength(HAND_CONNECTIONS.length)
  })

  it('has the 21 hand connections MediaPipe uses', () => {
    expect(HAND_CONNECTIONS).toHaveLength(21)
    for (const [a, b] of HAND_CONNECTIONS) {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(20)
    }
  })

  it('draws nothing without a hand', () => {
    render(<HandOverlay landmarks={null} />)
    expect(screen.queryAllByTestId('landmark')).toHaveLength(0)
    expect(screen.queryAllByTestId('bone')).toHaveLength(0)
  })
})
