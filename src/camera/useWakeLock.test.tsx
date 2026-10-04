import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock.ts'

/** A fake screen wake lock: the browser can take it back, and it can be refused. */
class FakeSentinel extends EventTarget {
  released = false
  release = vi.fn(async () => {
    this.released = true
    this.dispatchEvent(new Event('release'))
  })
  /** The browser (not the page) releases the lock, e.g. when the tab is hidden. */
  revoke() {
    this.released = true
    this.dispatchEvent(new Event('release'))
  }
}

function installWakeLock() {
  const sentinels: FakeSentinel[] = []
  const state = { refuse: false }
  const request = vi.fn(async () => {
    if (state.refuse) throw new DOMException('NotAllowedError', 'NotAllowedError')
    const s = new FakeSentinel()
    sentinels.push(s)
    return s
  })
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
  return { request, sentinels, state, get live() { return sentinels.filter((s) => !s.released) } }
}

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function Harness({ active }: { active: boolean }) {
  const { held, supported } = useWakeLock(active)
  return (
    <>
      <p data-testid="held">{String(held)}</p>
      <p data-testid="supported">{String(supported)}</p>
    </>
  )
}

const held = () => screen.getByTestId('held')

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  delete (navigator as { wakeLock?: unknown }).wakeLock
})

describe('useWakeLock', () => {
  it('holds the screen awake while active', async () => {
    const lock = installWakeLock()
    render(<Harness active />)
    await waitFor(() => expect(held()).toHaveTextContent('true'))
    expect(lock.request).toHaveBeenCalledWith('screen')
    expect(lock.live).toHaveLength(1)
  })

  it('does not ask for a lock while inactive', () => {
    const lock = installWakeLock()
    render(<Harness active={false} />)
    expect(lock.request).not.toHaveBeenCalled()
    expect(held()).toHaveTextContent('false')
  })

  it('lets go when it becomes inactive, and takes it again when active again', async () => {
    const lock = installWakeLock()
    const { rerender } = render(<Harness active />)
    await waitFor(() => expect(held()).toHaveTextContent('true'))

    rerender(<Harness active={false} />)
    await waitFor(() => expect(held()).toHaveTextContent('false'))
    expect(lock.live).toHaveLength(0)

    rerender(<Harness active />)
    await waitFor(() => expect(held()).toHaveTextContent('true'))
    expect(lock.live).toHaveLength(1)
  })

  it('lets go when unmounted', async () => {
    const lock = installWakeLock()
    const { unmount } = render(<Harness active />)
    await waitFor(() => expect(held()).toHaveTextContent('true'))
    unmount()
    expect(lock.live).toHaveLength(0)
  })

  it('takes the lock again when the tab comes back after the browser released it', async () => {
    const lock = installWakeLock()
    render(<Harness active />)
    await waitFor(() => expect(held()).toHaveTextContent('true'))

    setVisibility('hidden')
    act(() => lock.sentinels[0].revoke()) // the browser drops the lock for a hidden tab
    await waitFor(() => expect(held()).toHaveTextContent('false'))
    expect(lock.request).toHaveBeenCalledTimes(1) // it does not ask while hidden

    setVisibility('visible')
    await waitFor(() => expect(held()).toHaveTextContent('true'))
    expect(lock.request).toHaveBeenCalledTimes(2)
    expect(lock.live).toHaveLength(1)
  })

  it('does not ask for a second lock while it already holds one', async () => {
    const lock = installWakeLock()
    render(<Harness active />)
    await waitFor(() => expect(held()).toHaveTextContent('true'))
    setVisibility('visible')
    setVisibility('visible')
    expect(lock.request).toHaveBeenCalledTimes(1)
  })

  it('copes with a refused request and tries again when the tab is shown', async () => {
    const lock = installWakeLock()
    lock.state.refuse = true
    render(<Harness active />)
    await waitFor(() => expect(lock.request).toHaveBeenCalledTimes(1))
    expect(held()).toHaveTextContent('false')

    lock.state.refuse = false
    setVisibility('visible')
    await waitFor(() => expect(held()).toHaveTextContent('true'))
  })

  it('does nothing in a browser without wake lock support', () => {
    render(<Harness active />)
    expect(screen.getByTestId('supported')).toHaveTextContent('false')
    expect(held()).toHaveTextContent('false')
  })
})
