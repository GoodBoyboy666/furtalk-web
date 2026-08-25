// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Checkbox } from './checkbox'

beforeEach(() => {
  cleanup()
})

describe('Checkbox glyph state mapping', () => {
  it('publishes checked state and wires the Check glyph to the root group', () => {
    const { container } = render(
      <Checkbox checked onCheckedChange={() => {}} aria-label="check" />,
    )
    const root = container.querySelector(
      '[data-slot="checkbox"]',
    ) as HTMLElement
    expect(root).not.toBeNull()
    expect(root.getAttribute('data-checked')).not.toBeNull()
    expect(root.classList.contains('group')).toBe(true)
    const check = root.querySelector<HTMLElement>('.lucide-check')
    expect(check).not.toBeNull()
    expect(check?.getAttribute('class')).toContain('group-data-[checked]:block')
  })

  it('publishes indeterminate state and wires the Minus glyph to the root group', () => {
    const { container } = render(
      <Checkbox indeterminate onCheckedChange={() => {}} aria-label="minus" />,
    )
    const root = container.querySelector(
      '[data-slot="checkbox"]',
    ) as HTMLElement
    expect(root.getAttribute('data-indeterminate')).not.toBeNull()
    const minus = root.querySelector<HTMLElement>('.lucide-minus')
    expect(minus).not.toBeNull()
    expect(minus?.getAttribute('class')).toContain(
      'group-data-[indeterminate]:block',
    )
  })

  it('publishes no state glyph for unchecked', () => {
    const { container } = render(
      <Checkbox
        checked={false}
        indeterminate={false}
        onCheckedChange={() => {}}
        aria-label="empty"
      />,
    )
    const root = container.querySelector(
      '[data-slot="checkbox"]',
    ) as HTMLElement
    expect(root).not.toBeNull()
    expect(root.hasAttribute('data-checked')).toBe(false)
    expect(root.hasAttribute('data-indeterminate')).toBe(false)
  })
})
