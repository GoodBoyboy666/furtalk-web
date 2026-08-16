// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle from './ThemeToggle'

function renderToggle() {
  return render(<ThemeToggle />)
}

function mockMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
  window.matchMedia = mockMatchMedia(false)
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.colorScheme = ''
})

afterEach(() => {
  cleanup()
})

describe('ThemeToggle', () => {
  it('renders an icon-only trigger with an accessible name and title', async () => {
    renderToggle()
    const trigger = await screen.findByRole('button', {
      name: '切换主题',
    })
    expect(trigger).toHaveAttribute('title')
    expect(trigger.textContent).not.toMatch(/light|dark|auto/i)
  })

  it('persists a selected mode in localStorage and applies it to the document', async () => {
    renderToggle()
    const user = userEvent.setup()
    const trigger = await screen.findByRole('button', {
      name: '切换主题',
    })
    await user.click(trigger)
    await user.click(await screen.findByRole('menuitemradio', { name: '深色' }))

    await waitFor(() => {
      expect(window.localStorage.getItem('theme')).toBe('dark')
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('reads an existing localStorage theme on mount and applies it', () => {
    window.localStorage.setItem('theme', 'dark')
    renderToggle()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('reapplies the resolved class when auto follows a prefers-color-scheme change', async () => {
    const listeners = new Set<() => void>()
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_event: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_event: string, cb: () => void) =>
        listeners.delete(cb),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    window.localStorage.setItem('theme', 'auto')
    renderToggle()
    await waitFor(() => {
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })
    // 系统偏好变为深色后，auto 模式应重新应用解析后的类。
    const onMediaChange = [...listeners][0]
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: (_event: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_event: string, cb: () => void) =>
        listeners.delete(cb),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    act(() => onMediaChange())
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })
})
