// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '@/router'

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

// renderNotFound 使用生产路由工厂 getRouter + memory history 挂载真实路由树，
// 验证未知地址进入根级 notFoundComponent 的统一 404 页面；/unsubscribe 已注册
// 为业务路由，由 unsubscribe.test.tsx 覆盖其业务行为。
function renderNotFound(url: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = getRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
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
})

afterEach(() => {
  cleanup()
})

describe('application-level 404 (root notFoundComponent)', () => {
  it.each(['/this-path-does-not-exist', '/definitely/unknown/route'])(
    'renders the shared 404 page for %s without redirecting',
    async (url) => {
      const { router } = renderNotFound(url)

      expect(
        await screen.findByRole('heading', { name: '迷路了？' }),
      ).toBeInTheDocument()
      expect(
        screen.getByText('这条评论似乎发错了地方，找不到对应的页面。'),
      ).toBeInTheDocument()

      const home = screen.getByRole('link', { name: '返回首页' })
      expect(home).toHaveAttribute('href', '/')

      // 未知地址停留在原路径，而不是被当作有效业务路由或跳回首页。
      expect(router.state.location.pathname).toBe(url)
    },
  )

  it('keeps the root language control available on the 404 page', async () => {
    renderNotFound('/this-path-does-not-exist')

    expect(
      await screen.findByRole('button', { name: '切换语言' }),
    ).toBeInTheDocument()
  })

  it('registers /unsubscribe as a business route, not a shared 404', async () => {
    const { router } = renderNotFound('/unsubscribe?token=test-token')

    expect(
      await screen.findByRole('button', { name: '确认退订' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '迷路了？' }),
    ).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/unsubscribe')
  })
})
