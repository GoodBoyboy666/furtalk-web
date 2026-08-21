// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OAuthCallbackPage } from './oauth.callback.$provider'
import { ApiError } from '@/lib/api/client'
import type { OAuthCompleteResponse } from '@/lib/api/types'

// apiMocks 是 API 与路由参数的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => {
  const search: Record<string, unknown> = {}
  const params: Record<string, string> = {}
  return {
    oauthComplete: vi.fn(),
    search,
    params,
  }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ useParams: () => apiMocks.params }),
  useSearch: () => apiMocks.search,
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
}))

vi.mock('@/lib/api/resources', () => ({
  authApi: { oauthComplete: apiMocks.oauthComplete },
}))

const replaceMock = vi.fn()

// jsdom 的 window.location.replace 只读，用可写 mock 替换整个 location，
// 使成功导航可被断言，同时保留 pathname 供 URL 清理逻辑读取。
Object.defineProperty(window, 'location', {
  value: {
    replace: replaceMock,
    pathname: '/oauth/callback/github',
    search: '',
    origin: 'http://localhost',
    href: 'http://localhost/oauth/callback/github',
  },
  writable: true,
  configurable: true,
})

function renderCallback() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <OAuthCallbackPage />
    </QueryClientProvider>,
  )
}

function success(redirect = '/account/comments'): OAuthCompleteResponse {
  return { redirect }
}

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    apiMocks.search = {}
    apiMocks.params = { provider: 'github' }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    apiMocks.oauthComplete.mockReset()
  })

  it('sends query callback parameters and navigates to the safe redirect', async () => {
    apiMocks.search = { state: 's1', code: 'c1' }
    apiMocks.oauthComplete.mockResolvedValue(success('/account/comments'))

    renderCallback()

    await waitFor(() =>
      expect(apiMocks.oauthComplete).toHaveBeenCalledWith('github', {
        state: 's1',
        code: 'c1',
      }),
    )
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/account/comments'),
    )
    expect(screen.getByText('登录成功，正在跳转…')).toBeTruthy()
  })

  it('sends an opaque handoff for Apple without exposing a code', async () => {
    apiMocks.search = { handoff: 'h1' }
    apiMocks.params = { provider: 'apple' }
    apiMocks.oauthComplete.mockResolvedValue(success('/account/security'))

    renderCallback()

    await waitFor(() =>
      expect(apiMocks.oauthComplete).toHaveBeenCalledWith('apple', {
        handoff: 'h1',
      }),
    )
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('/account/security'),
    )
  })

  it('falls back to / when the backend redirect is unsafe', async () => {
    apiMocks.search = { state: 's1', code: 'c1' }
    apiMocks.oauthComplete.mockResolvedValue(success('//evil.com'))

    renderCallback()

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
  })

  it('shows the backend message and request id, and returns to details.redirect on denial', async () => {
    apiMocks.search = { state: 's1', error: 'access_denied' }
    apiMocks.oauthComplete.mockRejectedValue(
      new ApiError('授权已被取消', 400, 'oauth_access_denied', 'req-123', {
        redirect: '/account/security',
      }),
    )

    renderCallback()

    await waitFor(() => expect(screen.getByText('授权已被取消')).toBeTruthy())
    expect(screen.getByText('请求 ID：req-123')).toBeTruthy()
    expect(screen.getByText('返回').closest('a')).toHaveAttribute(
      'href',
      '/account/security',
    )
  })

  it('falls back to /login when details.redirect is missing', async () => {
    apiMocks.search = { state: 's1', code: 'c1' }
    apiMocks.oauthComplete.mockRejectedValue(
      new ApiError(
        'Sign-in did not complete. Please try again.',
        400,
        'invalid_request',
        'req-9',
      ),
    )

    renderCallback()

    await waitFor(() => expect(screen.getByText('登录失败')).toBeTruthy())
    expect(screen.getByText('返回').closest('a')).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('never replays the callback under Strict Mode double-effects', async () => {
    apiMocks.search = { state: 's1', code: 'c1' }
    apiMocks.oauthComplete.mockResolvedValue(success('/account/comments'))

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })
    const { unmount } = render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <OAuthCallbackPage />
        </QueryClientProvider>
      </StrictMode>,
    )

    await waitFor(() => expect(apiMocks.oauthComplete).toHaveBeenCalledTimes(1))
    unmount()
  })
})
