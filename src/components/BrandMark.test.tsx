// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandMark } from './BrandMark'

describe('BrandMark', () => {
  it('renders the shared paw-print icon as a decorative mark by default', () => {
    const { container } = render(<BrandMark className="size-5" />)
    const icon = container.querySelector('svg')

    expect(icon).toHaveClass('lucide-paw-print', 'size-5')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('allows independently announced callers to provide an accessible label', () => {
    const { container } = render(
      <BrandMark aria-hidden={false} aria-label="Furtalk" />,
    )
    const icon = container.querySelector('svg')

    expect(icon).toHaveAttribute('aria-hidden', 'false')
    expect(icon).toHaveAttribute('aria-label', 'Furtalk')
  })
})
