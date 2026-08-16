// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminShell } from './AdminShell'
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
    select?.({ location: { pathname: '/admin/comments' } }) ??
    '/admin/comments',
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

const adminMe: Me = {
  id: '1',
  email: 'admin@example.com',
  nickname: 'Admin',
  website_url: null,
  avatar_url: '',
  role: 'admin',
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
      <AdminShell>content</AdminShell>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.me.mockResolvedValue(adminMe)
  apiMocks.logout.mockResolvedValue(undefined)
})

describe('AdminShell navigation copy', () => {
  it('labels the comment area 评论管理 while keeping the /admin/comments route', async () => {
    renderShell()
    const link = await screen.findByRole('link', { name: '评论管理' })
    expect(link.getAttribute('href')).toBe('/admin/comments')
    expect(screen.queryByRole('link', { name: '评论审核' })).toBeNull()
  })
})

describe('AdminShell language placement', () => {
  it('renders the language control immediately beside the theme control', async () => {
    renderShell()
    const language = await screen.findByTestId('language-toggle')
    const theme = screen.getByTestId('theme-toggle')
    expect(language.nextElementSibling).toBe(theme)
  })
})

describe('AdminShell account dropdown', () => {
  it('renders an icon beside the personal-center menu item', async () => {
    renderShell()
    const trigger = await screen.findByRole('button', { name: '账户菜单' })
    await userEvent.click(trigger)
    const item = await screen.findByRole('menuitem', { name: '个人中心' })
    expect(item.querySelector('svg')).not.toBeNull()
  })

  it('links the personal-center menu item to /account/profile', async () => {
    renderShell()
    const trigger = await screen.findByRole('button', { name: '账户菜单' })
    await userEvent.click(trigger)
    const item = await screen.findByRole('menuitem', { name: '个人中心' })
    expect(item).toBeInTheDocument()
  })
})
