// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountShell } from './AccountShell'
import type { Me } from '@/lib/api/types'

const apiMocks = vi.hoisted(() => ({
  me: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    className,
    children,
  }: {
    to: string
    className?: string
    children: React.ReactNode
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({
    select,
  }: {
    select?: (state: { location: { pathname: string } }) => unknown
  }) =>
    select?.({ location: { pathname: '/account/profile' } }) ??
    '/account/profile',
}))
vi.mock('@/lib/api/resources', () => ({
  authApi: { me: apiMocks.me, logout: apiMocks.logout },
}))
vi.mock('@/lib/api/client', () => ({
  isUnauthorized: () => false,
}))
vi.mock('./ThemeToggle', () => ({
  default: () => <span data-testid="theme-toggle" />,
}))
vi.mock('./LanguageToggle', () => ({
  default: () => <span data-testid="language-toggle" />,
}))

const userMe: Me = {
  id: '1',
  email: 'user@example.com',
  nickname: 'User',
  website_url: null,
  avatar_url: '',
  role: 'user',
  status: 'active',
  email_verified: true,
  has_password: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  notification_preferences: { moderation_enabled: false, reply_enabled: false },
}

function renderShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AccountShell>content</AccountShell>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.me.mockResolvedValue(userMe)
  apiMocks.logout.mockResolvedValue(undefined)
})

describe('AccountShell language placement', () => {
  it('renders the language control immediately beside the theme control', async () => {
    renderShell()
    const language = await screen.findByTestId('language-toggle')
    const theme = screen.getByTestId('theme-toggle')
    expect(language.nextElementSibling).toBe(theme)
  })
})

describe('AccountShell branding', () => {
  it('renders the Furtalk brand name on the left navbar', async () => {
    renderShell()
    expect(await screen.findByText('Furtalk')).toBeInTheDocument()
    expect(screen.getByText('个人中心')).toBeInTheDocument()
  })
})

describe('AccountShell account dropdown', () => {
  it('opens dropdown menu on avatar click showing username, email and logout', async () => {
    renderShell()
    const trigger = await screen.findByRole('button', { name: '账户菜单' })
    await userEvent.click(trigger)

    expect(await screen.findByText('User')).toBeInTheDocument()
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: '退出登录' }),
    ).toBeInTheDocument()
    // Normal user does not have admin console option
    expect(
      screen.queryByRole('menuitem', { name: '管理控制台' }),
    ).not.toBeInTheDocument()
  })

  it('includes admin console in dropdown for admin users', async () => {
    apiMocks.me.mockResolvedValue({ ...userMe, role: 'admin' })
    renderShell()
    const trigger = await screen.findByRole('button', { name: '账户菜单' })
    await userEvent.click(trigger)

    expect(
      await screen.findByRole('menuitem', { name: '管理控制台' }),
    ).toBeInTheDocument()
  })

  it('does not render redundant admin console link in subnav', async () => {
    apiMocks.me.mockResolvedValue({ ...userMe, role: 'admin' })
    renderShell()
    await screen.findByText('Furtalk')
    // There should not be an inline link named 管理控制台 in the subnav
    const subnavLinks = screen.getAllByRole('link')
    const adminLink = subnavLinks.find((l) =>
      l.textContent.includes('管理控制台'),
    )
    expect(adminLink).toBeUndefined()
  })
})
