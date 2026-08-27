// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OverviewPage } from './admin.index'

const apiMocks = vi.hoisted(() => ({
  commentsApi: { list: vi.fn(), trend: vi.fn() },
  sitesApi: { list: vi.fn() },
  usersApi: { list: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('@/lib/api/resources', () => apiMocks)

function renderOverview() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <OverviewPage />
    </QueryClientProvider>,
  )
}

function trend(days: 7 | 30) {
  return {
    days,
    timezone: 'UTC',
    points: Array.from({ length: days }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      count: 0,
    })),
  }
}

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.clearAllMocks()
  apiMocks.commentsApi.list.mockResolvedValue({
    comments: [{ id: '1', body: 'one pending comment' }],
    total: 9,
  })
  apiMocks.commentsApi.trend.mockImplementation((days: 7 | 30) =>
    Promise.resolve(trend(days)),
  )
  apiMocks.sitesApi.list.mockResolvedValue({ sites: [] })
  apiMocks.usersApi.list.mockResolvedValue({ users: [], total: 0 })
})

describe('OverviewPage comment trend', () => {
  it('uses the pending comment total instead of the preview row count', async () => {
    renderOverview()
    expect(await screen.findByText('9')).toBeInTheDocument()
    expect(screen.queryByText('one pending comment')).toBeInTheDocument()
  })

  it('requests seven days by default and refetches thirty days on selection', async () => {
    renderOverview()
    await waitFor(() => {
      expect(apiMocks.commentsApi.trend).toHaveBeenCalledWith(
        7,
        expect.any(String),
      )
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '近 30 天' }))
    await waitFor(() => {
      expect(apiMocks.commentsApi.trend).toHaveBeenLastCalledWith(
        30,
        expect.any(String),
      )
    })
  })
})
