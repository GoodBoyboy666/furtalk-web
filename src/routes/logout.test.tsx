// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LogoutPage } from '@/pages/logout'
import { ApiError } from '@/lib/api/client'

const apiMocks = vi.hoisted(() => ({
  logout: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock('@/lib/api/resources', () => ({
  authApi: {
    logout: apiMocks.logout,
  },
}))

const closeMock = vi.hoisted(() => vi.fn())

function renderLogout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <LogoutPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.logout.mockResolvedValue(undefined)
  Object.defineProperty(window, 'close', {
    configurable: true,
    value: closeMock,
  })
})

afterEach(() => {
  Object.defineProperty(window, 'close', {
    configurable: true,
    value: () => undefined,
  })
})

describe('LogoutPage', () => {
  it('auto-invokes first-party logout on mount and attempts to close the tab', async () => {
    renderLogout()
    await waitFor(() => {
      expect(apiMocks.logout).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(closeMock).toHaveBeenCalled()
    })
  })

  it('keeps a success page when the browser refuses to close the tab', async () => {
    closeMock.mockImplementation(() => {
      throw new Error('cannot close')
    })
    renderLogout()
    await waitFor(() => {
      expect(apiMocks.logout).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText(/已退出登录/)).toBeInTheDocument()
  })

  it('renders a retryable error and never pretends logout happened on failure', async () => {
    apiMocks.logout.mockRejectedValue(
      new ApiError('退出失败', 500, 'internal_error'),
    )
    renderLogout()
    expect(await screen.findByText('退出失败')).toBeInTheDocument()
    expect(closeMock).not.toHaveBeenCalled()
    expect(screen.queryByText(/已退出登录/)).toBeNull()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => {
      expect(apiMocks.logout).toHaveBeenCalledTimes(2)
    })
  })

  it('does not issue any retry or navigation on its own after success', async () => {
    renderLogout()
    await waitFor(() => {
      expect(apiMocks.logout).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(closeMock).toHaveBeenCalled()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(apiMocks.logout).toHaveBeenCalledTimes(1)
  })
})
