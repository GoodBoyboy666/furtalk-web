// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentsPage, parseCommentsPage } from './account.comments'

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  sites: vi.fn(),
}))

const searchMock = vi.hoisted(() => ({
  useSearch: vi.fn(),
  useNavigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useSearch: searchMock.useSearch,
  useNavigate: searchMock.useNavigate,
}))
vi.mock('@/lib/api/resources', () => ({
  meCommentsApi: apiMocks,
}))

const emptyList = {
  comments: [],
  total: 0,
  user_delete_mode: 'soft',
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommentsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  searchMock.useSearch.mockReturnValue({})
  searchMock.useNavigate.mockReturnValue(vi.fn())
  apiMocks.sites.mockResolvedValue({ sites: [] })
  apiMocks.list.mockResolvedValue(emptyList)
})

afterEach(() => {
  cleanup()
})

describe('account comments status filter label', () => {
  it('renders the localized label for a selected raw status value', async () => {
    searchMock.useSearch.mockReturnValue({ status: 'pending' })
    renderPage()
    const triggers = await screen.findAllByRole('combobox')
    const statusTrigger = triggers[1]
    expect(statusTrigger).toHaveTextContent('待审核')
    expect(statusTrigger).not.toHaveTextContent('pending')
  })

  it('falls back to the all-status label for an empty status', async () => {
    renderPage()
    const triggers = await screen.findAllByRole('combobox')
    const statusTrigger = triggers[1]
    expect(statusTrigger).toHaveTextContent('全部状态')
  })
})

describe('account comments site filter label', () => {
  it('renders the site name for a selected site id', async () => {
    searchMock.useSearch.mockReturnValue({ site_id: '3' })
    apiMocks.sites.mockResolvedValue({
      sites: [
        { id: '2', name: '示例站' },
        { id: '3', name: '另一个站' },
      ],
    })
    renderPage()
    const triggers = await screen.findAllByRole('combobox')
    const siteTrigger = triggers[0]
    await waitFor(() => {
      expect(siteTrigger).toHaveTextContent('另一个站')
    })
    expect(siteTrigger).not.toHaveTextContent('3')
  })

  it('falls back to the all-sites label when no site is selected', async () => {
    renderPage()
    const triggers = await screen.findAllByRole('combobox')
    const siteTrigger = triggers[0]
    expect(siteTrigger).toHaveTextContent('全部站点')
  })
})

describe('account comments URL page parameter', () => {
  it('sends a valid URL page as the request page', async () => {
    searchMock.useSearch.mockReturnValue({ page: 2 })
    renderPage()
    await waitFor(() => {
      expect(apiMocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, limit: 25 }),
      )
    })
  })

  it('falls back to page 1 for an invalid or non-positive page', async () => {
    for (const page of ['abc', '0', '-1', '1.5', '', '01']) {
      expect(parseCommentsPage(page)).toBeUndefined()
    }
    expect(parseCommentsPage('2')).toBe(2)
    expect(parseCommentsPage(2)).toBeUndefined()
    expect(parseCommentsPage(undefined)).toBeUndefined()
  })

  it('navigates to page 2 via the pagination control preserving filters', async () => {
    const navigate = vi.fn()
    searchMock.useNavigate.mockReturnValue(navigate)
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      site_id: '9',
      site_name: 'Site',
      thread_id: '1',
      page_key: 'page',
      page_url: null,
      page_title: null,
      user_id: '1',
      parent_id: null,
      root_id: null,
      depth: 0,
      body: '评论 ' + i,
      status: 'published',
      author_nickname: 'me',
      author_website: null,
      avatar_url: '',
      reply_to_user_id: null,
      reply_to_nickname: null,
      created_at: '2026-01-01T00:00:00Z',
      published_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    }))
    apiMocks.list.mockResolvedValue({
      comments: many,
      total: 30,
      user_delete_mode: 'soft',
    })
    renderPage()
    const user = (await import('@testing-library/user-event')).default
    await screen.findByText('共 30 条')
    await user.click(await screen.findByRole('button', { name: '下一页' }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          search: expect.objectContaining({ page: 2 }),
        }),
      )
    })
  })
})
