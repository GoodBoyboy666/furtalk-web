// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '@/router'
import type { Me, MeComment, MeCommentDetail } from '@/lib/api/types'
import type * as Resources from '@/lib/api/resources'

// apiMocks 覆盖真实路由集成测试会访问的会话、本人评论和 CAPTCHA 资源。
const apiMocks = vi.hoisted(() => ({
  authApi: { me: vi.fn() },
  meCommentsApi: {
    list: vi.fn(),
    sites: vi.fn(),
    get: vi.fn(),
  },
  captchaApi: { config: vi.fn() },
}))

vi.mock('@/lib/api/resources', async (importOriginal) => {
  const actual = await importOriginal<typeof Resources>()
  return {
    ...actual,
    authApi: { ...actual.authApi, me: apiMocks.authApi.me },
    meCommentsApi: apiMocks.meCommentsApi,
    captchaApi: { ...actual.captchaApi, config: apiMocks.captchaApi.config },
  }
})
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))
vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))
vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
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
  notification_preferences: {
    moderation_enabled: false,
    reply_enabled: false,
  },
}

function comment(partial: Partial<MeComment> & { id: string }): MeComment {
  return {
    site_id: '9',
    site_name: 'Site',
    thread_id: '1',
    page_key: 'page',
    page_url: 'https://example.com/page',
    page_title: 'Page title',
    user_id: '1',
    parent_id: null,
    root_id: null,
    depth: 0,
    body: '列表正文',
    status: 'published',
    author_nickname: 'User',
    author_website: null,
    avatar_url: '',
    reply_to_user_id: null,
    reply_to_nickname: null,
    created_at: '2026-08-17T00:00:00Z',
    published_at: '2026-08-17T00:00:00Z',
    deleted_at: null,
    ...partial,
  }
}

function detail(partial: Partial<MeComment> & { id: string }): MeCommentDetail {
  return { ...comment(partial), user_delete_mode: 'soft' }
}

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderAccountComments() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = getRouter({
    history: createMemoryHistory({ initialEntries: ['/account/comments'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  installMatchMedia()
  apiMocks.authApi.me.mockResolvedValue(userMe)
  apiMocks.meCommentsApi.sites.mockResolvedValue({ sites: [] })
  apiMocks.meCommentsApi.list.mockResolvedValue({
    comments: [comment({ id: '1' })],
    total: 1,
    user_delete_mode: 'soft',
  })
  apiMocks.meCommentsApi.get.mockResolvedValue(
    detail({ id: '1', body: '详情正文' }),
  )
  apiMocks.captchaApi.config.mockResolvedValue({ required: false })
})

afterEach(() => {
  cleanup()
})

describe('account comments detail navigation (real router)', () => {
  it('changes the pathname, requests the selected id, and renders the detail', async () => {
    const { router } = renderAccountComments()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('link', { name: /列表正文/ }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/account/comments/1')
    })
    expect(router.state.location.href).toBe('/account/comments/1')
    await waitFor(() => {
      expect(apiMocks.meCommentsApi.get).toHaveBeenCalledWith('1')
    })
    expect(await screen.findByText('详情正文')).toBeInTheDocument()
    expect(screen.queryByText('列表正文')).not.toBeInTheDocument()
  })
})
