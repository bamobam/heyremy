import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { useFitText } from './useFitText.ts'

// jsdom does no layout, so the box's content height is faked: ten lines tall, so it is 10 × the column's
// font size, against a card that is 300 px tall. The text therefore fits up to 30 px.
const proto = HTMLElement.prototype
const original = {
  scrollHeight: Object.getOwnPropertyDescriptor(proto, 'scrollHeight'),
  clientHeight: Object.getOwnPropertyDescriptor(proto, 'clientHeight'),
}

beforeEach(() => {
  Object.defineProperty(proto, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      // Ten lines tall at the column's font size; with the cue dropped (data-tight) 150 px shorter.
      return this.classList.contains('box') ? parseFloat(this.style.fontSize || '38') * 10 - (this.hasAttribute('data-tight') ? 150 : 0) : 0
    },
  })
  Object.defineProperty(proto, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('limit') ? parseFloat(this.dataset.limit ?? '300') : 0
    },
  })
})

afterEach(() => {
  cleanup()
  if (original.scrollHeight) Object.defineProperty(proto, 'scrollHeight', original.scrollHeight)
  else delete (proto as unknown as Record<string, unknown>).scrollHeight
  if (original.clientHeight) Object.defineProperty(proto, 'clientHeight', original.clientHeight)
  else delete (proto as unknown as Record<string, unknown>).clientHeight
})

function Probe({ text, min = 22, max = 38, limitPx = 300 }: { text: string; min?: number; max?: number; limitPx?: number }) {
  const limit = useRef<HTMLElement>(null)
  const box = useRef<HTMLDivElement>(null)
  useFitText({ limit, box }, { min, max }, text)
  return (
    <article className="limit" data-limit={limitPx} ref={limit}>
      <div className="box" ref={box}>
        <h2>{text}</h2>
      </div>
    </article>
  )
}

describe('useFitText', () => {
  it('shrinks the text until its box fits the card', () => {
    const { container } = render(<Probe text="a long step" />)
    expect(container.querySelector<HTMLElement>('.box')?.style.fontSize).toBe('30px')
  })

  it('stops at the floor rather than shrinking forever', () => {
    // 100 px tall: nothing fits, even without the cue, so it stays at the floor.
    const { container } = render(<Probe text="a long step" min={34} limitPx={100} />)
    expect(container.querySelector<HTMLElement>('.box')?.style.fontSize).toBe('34px')
  })

  it('keeps the full size when it already fits', () => {
    const { container } = render(<Probe text="short" max={28} />)
    expect(container.querySelector<HTMLElement>('.box')?.style.fontSize).toBe('28px')
  })

  it('drops the cue, the least urgent line, when even the smallest size would not fit, so the step itself is not cut', () => {
    // 200 px tall: ten lines never fit at 22 px (220), but without the cue they do, up to 35 px (200).
    const { container } = render(<Probe text="a very long step" limitPx={200} />)
    const box = container.querySelector<HTMLElement>('.box')
    expect(box?.hasAttribute('data-tight')).toBe(true)
    expect(box?.style.fontSize).toBe('35px')
  })

  it('keeps the cue when the step fits with it', () => {
    const { container } = render(<Probe text="a long step" />)
    expect(container.querySelector('.box')?.hasAttribute('data-tight')).toBe(false)
  })

  it('does not run again after it has been unmounted, when the web font finishes loading late', async () => {
    let finishFonts: () => void = () => {}
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>(resolve => (finishFonts = resolve)) } })
    const { container, unmount } = render(<Probe text="a long step" />)
    const box = container.querySelector<HTMLElement>('.box')!
    unmount()
    box.style.fontSize = '99px'
    finishFonts()
    await Promise.resolve()
    expect(box.style.fontSize).toBe('99px')
    delete (document as unknown as Record<string, unknown>).fonts
  })
})
