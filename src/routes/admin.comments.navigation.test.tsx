// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '@/router'
import type { AdminComment, Me } from '@/lib/api/types'
import type * as Resources from '@/lib/api/resources'

// apiMocks 是真实路由集成测试使用的 API 替代实现：仅覆盖列表、详情与会话读取，
// 其余 resources 导出保留真实实现（不会被本次渲染路径调用）。
const apiMocks = vi.hoisted(() => ({
  commentsApi: {
    list: vi.fn(),
    get: vi.fn(),
  },
  authApi: { me: vi.fn() },
  providersApi: { list: vi.fn() },
}))

vi.mock('@/lib/api/resources', async (importOriginal) => {
  const actual = await importOriginal<typeof Resources>()
  return {
    ...actual,
    commentsApi: apiMocks.commentsApi,
    authApi: { ...actual.authApi, me: apiMocks.authApi.me },
    providersApi: { ...actual.providersApi, list: apiMocks.providersApi.list },
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

function comment(
  partial: Partial<AdminComment> & { id: string },
): AdminComment {
  return {
    site_id: '9',
    thread_id: '1',
    root_id: null,
    parent_id: null,
    user_id: '10',
    author_email: 'author@example.com',
    author_nickname: 'Author',
    author_website: null,
    avatar_url: 'https://example.com/a.png',
    reply_to_user_id: null,
    reply_to_nickname: null,
    body: 'hello world',
    status: 'published',
    depth: 0,
    created_at: '2026-08-11T00:00:00Z',
    published_at: '2026-08-11T00:00:00Z',
    deleted_at: null,
    ip_mode: 'none',
    ip_value: null,
    ua_browser: null,
    ua_device: null,
    ua_os: null,
    ua_mode: 'none',
    ...partial,
  }
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

// renderAdminComments 使用生产路由工厂 getRouter + memory history 挂载真实的
// 路由树，让菜单点击真正经过 TanStack Router 的 navigate 变更路由状态。
function renderAdminComments() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = getRouter({
    history: createMemoryHistory({ initialEntries: ['/admin/comments'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router }
}

// openRowMenu 打开指定评论行（按正文定位）的操作菜单。
async function openRowMenu(
  user: ReturnType<typeof userEvent.setup>,
  body: string,
) {
  const text = await screen.findByText(body)
  const row = text.closest('tr')
  if (!row) throw new Error(`row for ${body} not found`)
  const trigger = row.querySelector('[aria-label="评论操作"]')
  if (!(trigger instanceof HTMLElement)) {
    throw new Error(`menu trigger for ${body} not found`)
  }
  await user.click(trigger)
  await waitFor(() => {
    expect(
      screen.getByRole('menuitem', { name: '查看详情' }),
    ).toBeInTheDocument()
  })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  installMatchMedia()
  apiMocks.authApi.me.mockResolvedValue(adminMe)
  apiMocks.providersApi.list.mockResolvedValue({ providers: [] })
  apiMocks.commentsApi.list.mockResolvedValue({
    comments: [comment({ id: '1' })],
    total: 1,
  })
  apiMocks.commentsApi.get.mockResolvedValue(comment({ id: '1' }))
})

afterEach(() => {
  cleanup()
})

describe('admin comments detail navigation (real router)', () => {
  it('changes the browser location and requests the selected comment detail', async () => {
    const { router } = renderAdminComments()
    const user = userEvent.setup()

    // 等评论列表渲染后，从行内菜单点击“查看详情”。
    await openRowMenu(user, 'hello world')
    await user.click(screen.getByRole('menuitem', { name: '查看详情' }))

    // 路由状态必须实际变为目标详情地址（不只是 href 或菜单关闭）。
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/comments/1')
    })
    expect(router.state.location.href).toBe('/admin/comments/1')

    // 详情路由挂载后必须向详情 API 发起相同 ID 的请求。
    await waitFor(() => {
      expect(apiMocks.commentsApi.get).toHaveBeenCalledWith('1')
    })
    // 详情页渲染后展示目标评论的正文，证明不是停留在列表页。
    expect(await screen.findByText('hello world')).toBeInTheDocument()
  })

  it('navigates to a different comment id when selected from its own row', async () => {
    apiMocks.commentsApi.list.mockResolvedValue({
      comments: [comment({ id: '1' }), comment({ id: '2', body: 'second' })],
      total: 2,
    })
    apiMocks.commentsApi.get.mockResolvedValue(
      comment({ id: '2', body: 'second' }),
    )
    const { router } = renderAdminComments()
    const user = userEvent.setup()

    await openRowMenu(user, 'second')
    await user.click(screen.getByRole('menuitem', { name: '查看详情' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/comments/2')
    })
    await waitFor(() => {
      expect(apiMocks.commentsApi.get).toHaveBeenCalledWith('2')
    })
    expect(await screen.findByText('second')).toBeInTheDocument()
  })
})
