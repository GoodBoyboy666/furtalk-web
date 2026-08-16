// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import { setI18nLanguage } from '@/lib/i18n-test'
import LanguageToggle from './LanguageToggle'

function renderToggle() {
  return render(<LanguageToggle />)
}

beforeEach(async () => {
  cleanup()
  window.localStorage.clear()
  await setI18nLanguage('zh-CN')
})

afterEach(() => {
  cleanup()
})

describe('LanguageToggle', () => {
  it('renders an icon-only trigger with an accessible name and title', async () => {
    renderToggle()
    const trigger = await screen.findByRole('button', {
      name: '切换语言',
    })
    expect(trigger).toHaveAttribute('title')
    expect(trigger.textContent).not.toMatch(/简体中文|English/i)
  })

  it('shows Simplified Chinese and English and marks the active language', async () => {
    renderToggle()
    const user = userEvent.setup()
    const trigger = await screen.findByRole('button', {
      name: '切换语言',
    })
    await user.click(trigger)
    const zhItem = await screen.findByRole('menuitemradio', {
      name: '简体中文',
    })
    const enItem = screen.getByRole('menuitemradio', { name: 'English' })
    expect(zhItem).toHaveAttribute('aria-checked', 'true')
    expect(enItem).toHaveAttribute('aria-checked', 'false')
  })

  it('switches to English and updates the active state and document metadata', async () => {
    renderToggle()
    const user = userEvent.setup()
    const trigger = await screen.findByRole('button', {
      name: '切换语言',
    })
    await user.click(trigger)
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'English' }),
    )

    await waitFor(() => {
      expect(i18n.resolvedLanguage).toBe('en')
    })
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Furtalk Admin Console')
  })

  it('switches back to Simplified Chinese from English', async () => {
    await setI18nLanguage('en')
    renderToggle()
    const user = userEvent.setup()
    const trigger = await screen.findByRole('button', {
      name: 'Switch language',
    })
    await user.click(trigger)
    await user.click(
      await screen.findByRole('menuitemradio', { name: '简体中文' }),
    )

    await waitFor(() => {
      expect(i18n.resolvedLanguage).toBe('zh-CN')
    })
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(document.title).toBe('Furtalk 管理控制台')
  })
})
