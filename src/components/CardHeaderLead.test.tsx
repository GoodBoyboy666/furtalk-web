// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { ShieldCheck } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { CardHeaderLead } from './CardHeaderLead'

describe('CardHeaderLead', () => {
  it('renders a decorative icon beside caller-owned header content', () => {
    const { container } = render(
      <CardHeaderLead icon={ShieldCheck}>
        <div data-testid="card-title">Provider settings</div>
      </CardHeaderLead>,
    )

    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(
      container.querySelector('[data-testid="card-title"]'),
    ).toHaveTextContent('Provider settings')
    expect(container.firstElementChild).toHaveClass('flex', 'items-center')
    expect(container.firstElementChild?.firstElementChild).toHaveClass(
      'size-9',
      'bg-primary/10',
    )
  })
})
