// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from './combobox'

const options = ['Asia/Shanghai', 'America/New_York', 'UTC']

function TestCombobox({
  onValueChange = vi.fn(),
}: {
  onValueChange?: (value: string) => void
}) {
  const [value, setValue] = useState(options[0])
  const [inputValue, setInputValue] = useState(options[0])

  return (
    <Combobox
      items={options}
      value={value}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      onValueChange={(next) => {
        if (typeof next !== 'string') return
        setValue(next)
        setInputValue(next)
        onValueChange(next)
      }}
    >
      <label htmlFor="test-timezone">Time zone</label>
      <ComboboxInputGroup>
        <ComboboxInput id="test-timezone" />
        <ComboboxTrigger aria-label="Open time zones" />
      </ComboboxInputGroup>
      <ComboboxContent>
        <ComboboxList>
          {(option: string, index: number) => (
            <ComboboxItem key={option} value={option} index={index}>
              {option}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

beforeEach(() => {
  cleanup()
  if (typeof Element.prototype.scrollIntoView === 'undefined') {
    Element.prototype.scrollIntoView = () => {}
  }
})

describe('Combobox', () => {
  it('exposes an editable combobox input and filters options while typing', async () => {
    render(<TestCombobox />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Time zone' })

    await user.click(input)
    await user.clear(input)
    await user.type(input, 'America')

    expect(input).toHaveValue('America')
    expect(
      await screen.findByRole('option', { name: 'America/New_York' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Asia/Shanghai' }),
    ).not.toBeInTheDocument()
  })

  it('commits a selected option and closes the popup', async () => {
    const onValueChange = vi.fn()
    render(<TestCombobox onValueChange={onValueChange} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Open time zones' }))
    await user.click(await screen.findByRole('option', { name: 'UTC' }))

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('UTC'))
    expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveValue(
      'UTC',
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows the indicator only for the selected option and moves it after selection', async () => {
    render(<TestCombobox />)
    const user = userEvent.setup()
    const trigger = screen.getByRole('button', { name: 'Open time zones' })

    await user.click(trigger)
    const shanghai = await screen.findByRole('option', {
      name: 'Asia/Shanghai',
    })
    const utc = screen.getByRole('option', { name: 'UTC' })
    expect(
      shanghai.querySelector('[data-slot="combobox-item-indicator"]'),
    ).toHaveClass('flex')
    expect(
      utc.querySelector('[data-slot="combobox-item-indicator"]'),
    ).toHaveClass('hidden')

    await user.click(utc)
    await user.click(trigger)
    const nextShanghai = await screen.findByRole('option', {
      name: 'Asia/Shanghai',
    })
    const nextUtc = screen.getByRole('option', { name: 'UTC' })
    expect(
      nextShanghai.querySelector('[data-slot="combobox-item-indicator"]'),
    ).toHaveClass('hidden')
    expect(
      nextUtc.querySelector('[data-slot="combobox-item-indicator"]'),
    ).toHaveClass('flex')
  })
})
