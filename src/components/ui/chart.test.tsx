// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartContainer, ChartTooltipContent } from './chart'

describe('ChartTooltipContent', () => {
  it('renders an axis label that is not a chart config key', () => {
    expect(() =>
      render(
        <ChartContainer
          config={{ comments: { label: '新建评论', color: '#000' } }}
        >
          <ChartTooltipContent
            active
            label="2026-08-28"
            payload={[
              {
                dataKey: 'comments',
                graphicalItemId: 'comments',
                name: 'comments',
                value: 3,
                payload: { date: '2026-08-28' },
              },
            ]}
            labelFormatter={(value) => `date:${String(value)}`}
          />
        </ChartContainer>,
      ),
    ).not.toThrow()

    expect(screen.getByText('date:2026-08-28')).toBeInTheDocument()
    expect(screen.getByText('新建评论')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
