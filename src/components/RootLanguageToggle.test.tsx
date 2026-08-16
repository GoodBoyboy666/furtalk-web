// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RootLanguageToggle from './RootLanguageToggle'

// pathname 由 mock 的 useRouterState 返回，用于验证壳层路径树排除规则。
let pathname = '/'

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select?: (s: { location: { pathname: string } }) => unknown
  }) => select?.({ location: { pathname } }) ?? pathname,
}))

vi.mock('./LanguageToggle', () => ({
  default: () => <span data-testid="language-toggle" />,
}))

function setPathname(next: string) {
  pathname = next
}

beforeEach(() => {
  cleanup()
  setPathname('/')
})

afterEach(() => {
  cleanup()
})

describe('RootLanguageToggle placement', () => {
  it('renders the language control on public and authentication routes', () => {
    for (const route of [
      '/',
      '/login',
      '/logout',
      '/setup',
      '/authorize',
      '/reset-password',
    ]) {
      setPathname(route)
      render(<RootLanguageToggle />)
      expect(screen.getByTestId('language-toggle')).toBeInTheDocument()
      cleanup()
    }
  })

  it('renders the language control with fixed bottom-right safe-area positioning', () => {
    render(<RootLanguageToggle />)
    const wrapper = screen.getByTestId('language-toggle').parentElement
    expect(wrapper?.className).toContain('fixed')
    expect(wrapper?.getAttribute('style')).toContain(
      'env(safe-area-inset-right)',
    )
    expect(wrapper?.getAttribute('style')).toContain(
      'env(safe-area-inset-bottom)',
    )
  })

  it('suppresses itself on /admin and its descendants', () => {
    for (const route of ['/admin', '/admin/comments', '/admin/settings']) {
      setPathname(route)
      render(<RootLanguageToggle />)
      expect(screen.queryByTestId('language-toggle')).not.toBeInTheDocument()
      cleanup()
    }
  })

  it('suppresses itself on /account and its descendants', () => {
    for (const route of ['/account', '/account/profile', '/account/comments']) {
      setPathname(route)
      render(<RootLanguageToggle />)
      expect(screen.queryByTestId('language-toggle')).not.toBeInTheDocument()
      cleanup()
    }
  })
})
