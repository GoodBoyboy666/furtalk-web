// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

const commentModeOptions = [
  { value: 'anonymous', label: '允许匿名评论' },
  { value: 'authenticated', label: '仅认证用户' },
] as const

function ControlledSelect({
  initial,
  onValueChange,
}: {
  initial: string
  onValueChange?: (value: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (!next) return
        setValue(next)
        onValueChange?.(next)
      }}
      items={commentModeOptions}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {commentModeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

beforeEach(() => {
  cleanup()
  if (typeof Element.prototype.scrollIntoView === 'undefined') {
    Element.prototype.scrollIntoView = () => {}
  }
})

describe('Select', () => {
  it('renders the Chinese label for an initially selected raw value', () => {
    render(<ControlledSelect initial="authenticated" />)
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('仅认证用户')
    expect(trigger).not.toHaveTextContent('authenticated')
  })

  it('emits the raw value and updates the closed label after a user selection', async () => {
    const onValueChange = vi.fn()
    render(
      <ControlledSelect
        initial="authenticated"
        onValueChange={onValueChange}
      />,
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', {
      name: '允许匿名评论',
    })
    await user.click(option)

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('anonymous')
    })
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('允许匿名评论')
    expect(trigger).not.toHaveTextContent('authenticated')
  })
})
