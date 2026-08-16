// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnsubscribePage } from './unsubscribe'
import { ApiError } from '@/lib/api/client'

// apiMocks 是 API 模块的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => {
  const search: Record<string, unknown> = {}
  return {
    search,
    unsubscribe: vi.fn(),
  }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
  useSearch: () => apiMocks.search,
}))

vi.mock('@/lib/api/resources', () => ({
  notificationApi: {
    unsubscribe: apiMocks.unsubscribe,
  },
}))

function renderUnsubscribe() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <UnsubscribePage />
    </QueryClientProvider>,
  )
}

function setSearch(patch: Record<string, unknown>) {
  apiMocks.search = { ...patch }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  setSearch({ token: 'test-token' })
  apiMocks.unsubscribe.mockResolvedValue(undefined)
})

describe('UnsubscribePage invalid link handling', () => {
  it.each([
    ['missing', {}],
    ['empty', { token: '' }],
    ['repeated', { token: ['a', 'b'] }],
  ])(
    'renders the invalid-link state for a %s token without an API call',
    async (_label, search) => {
      setSearch(search)
      renderUnsubscribe()

      expect(
        screen.getByText('该退订链接无效，可能缺少参数或已被改动。'),
      ).toBeInTheDocument()
      expect(apiMocks.unsubscribe).not.toHaveBeenCalled()
    },
  )

  it('never reveals the raw token in the invalid-link UI', () => {
    setSearch({ token: 'super-secret-token' })
    renderUnsubscribe()

    expect(screen.queryByText('super-secret-token')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('super-secret-token')
  })
})

describe('UnsubscribePage confirmation flow', () => {
  it('sends zero mutation requests while loading a valid link', () => {
    renderUnsubscribe()
    expect(apiMocks.unsubscribe).not.toHaveBeenCalled()
  })

  it('confirms by sending exactly one POST with the raw token', async () => {
    renderUnsubscribe()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '确认退订' }))

    await waitFor(() => {
      expect(apiMocks.unsubscribe).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.unsubscribe).toHaveBeenCalledWith('test-token')

    await waitFor(() => {
      expect(
        screen.getByText('已成功退订，你将不再收到此类通知邮件。'),
      ).toBeInTheDocument()
    })
  })

  it('does not reveal the raw token in the ready or success UI', async () => {
    renderUnsubscribe()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '确认退订' }))
    await waitFor(() => {
      expect(apiMocks.unsubscribe).toHaveBeenCalledTimes(1)
    })

    expect(document.body.textContent).not.toContain('test-token')
  })
})

describe('UnsubscribePage pending and failure states', () => {
  it('disables duplicate submission while the request is pending', async () => {
    let resolveRequest: (() => void) | undefined
    apiMocks.unsubscribe.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
        }),
    )
    renderUnsubscribe()
    const user = userEvent.setup()
    const confirm = screen.getByRole('button', { name: '确认退订' })
    await user.click(confirm)

    await waitFor(() => {
      expect(apiMocks.unsubscribe).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: '正在退订…' })).toBeDisabled()

    resolveRequest?.()
    await waitFor(() => {
      expect(
        screen.getByText('已成功退订，你将不再收到此类通知邮件。'),
      ).toBeInTheDocument()
    })
    expect(apiMocks.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('renders the invalid-or-expired state for invalid_unsubscribe_token', async () => {
    apiMocks.unsubscribe.mockRejectedValue(
      new ApiError('退订令牌无效', 400, 'invalid_unsubscribe_token'),
    )
    renderUnsubscribe()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '确认退订' }))

    await waitFor(() => {
      expect(
        screen.getByText('该退订链接无效或已过期，你可能已经退订过这类通知。'),
      ).toBeInTheDocument()
    })
  })

  it('keeps a transient failure retryable', async () => {
    apiMocks.unsubscribe
      .mockRejectedValueOnce(new ApiError('网络错误', 500, 'internal'))
      .mockResolvedValueOnce(undefined)
    renderUnsubscribe()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '确认退订' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => {
      expect(apiMocks.unsubscribe).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(
        screen.getByText('已成功退订，你将不再收到此类通知邮件。'),
      ).toBeInTheDocument()
    })
  })
})
