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
      return this.classList.contains('box') ? parseFloat(this.style.fontSize || '38') * 10 : 0
    },
  })
  Object.defineProperty(proto, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('limit') ? 300 : 0
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

function Probe({ text, min = 22, max = 38 }: { text: string; min?: number; max?: number }) {
  const limit = useRef<HTMLElement>(null)
  const box = useRef<HTMLDivElement>(null)
  useFitText({ limit, box }, { min, max }, text)
  return (
    <article className="limit" ref={limit}>
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
    const { container } = render(<Probe text="a long step" min={34} />)
    expect(container.querySelector<HTMLElement>('.box')?.style.fontSize).toBe('34px')
  })

  it('keeps the full size when it already fits', () => {
    const { container } = render(<Probe text="short" max={28} />)
    expect(container.querySelector<HTMLElement>('.box')?.style.fontSize).toBe('28px')
  })
})
