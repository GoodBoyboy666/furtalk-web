// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThreadsPage } from '@/pages/admin.threads'
import type { AdminThread } from '@/lib/api/types'
import { ApiError } from '@/lib/api/client'

// apiMocks 是 sitesApi 与 threadsApi 的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => ({
  sitesApi: { list: vi.fn() },
  threadsApi: {
    list: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    batch: vi.fn(),
  },
}))

vi.mock('@/lib/api/resources', () => ({
  sitesApi: apiMocks.sitesApi,
  threadsApi: apiMocks.threadsApi,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const openThread: AdminThread = {
  id: '1',
  site_id: '9',
  site_name: 'Site',
  page_key: 'open-page',
  page_url: 'https://site.example/open',
  page_title: 'Open Page',
  comments_enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const closedThread: AdminThread = {
  ...openThread,
  id: '2',
  page_key: 'closed-page',
  page_url: null,
  page_title: null,
  comments_enabled: false,
}

function renderThreads() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThreadsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.sitesApi.list.mockResolvedValue({
    sites: [
      {
        id: '9',
        name: 'Site',
        canonical_url: 'https://site.example',
        status: 'active',
        origins: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
  })
  apiMocks.threadsApi.list.mockResolvedValue({
    threads: [openThread, closedThread],
    total: 2,
  })
  apiMocks.threadsApi.update.mockResolvedValue({
    ...closedThread,
    comments_enabled: true,
  })
  apiMocks.threadsApi.batch.mockResolvedValue({
    action: 'enable',
    requested_count: 1,
    changed_count: 1,
    unchanged_count: 0,
  })
})

afterEach(() => {
  cleanup()
})

// openThreadMenu 打开指定线程行的更多操作菜单并返回 user 对象。
async function openThreadMenu(
  user: ReturnType<typeof userEvent.setup>,
  index: number,
) {
  const triggers = await screen.findAllByRole('button', { name: '操作' })
  await user.click(triggers[index])
  await screen.findByRole('menuitem', { name: /编辑/ })
}

describe('ThreadsPage list', () => {
  it('auto-selects the first site and lists its threads', async () => {
    renderThreads()
    expect(await screen.findByText('Open Page')).toBeInTheDocument()
    expect(screen.getByText('open-page')).toBeInTheDocument()
    expect(apiMocks.threadsApi.list).toHaveBeenCalledWith(
      '9',
      expect.objectContaining({ limit: 25 }),
    )
  })

  it('requests desc by default and switches to asc with page reset', async () => {
    renderThreads()
    const user = userEvent.setup()
    await screen.findByText('Open Page')
    await waitFor(() => {
      expect(apiMocks.threadsApi.list).toHaveBeenLastCalledWith(
        '9',
        expect.objectContaining({ sort: 'desc', page: 1, limit: 25 }),
      )
    })

    const trigger = screen.getByText('最新优先').closest('button')
    expect(trigger).not.toBeNull()
    await user.click(trigger as HTMLElement)
    await user.click(await screen.findByRole('option', { name: '最早优先' }))
    // 切换排序方向必须回到第一页重新加载。
    await waitFor(() => {
      expect(apiMocks.threadsApi.list).toHaveBeenLastCalledWith(
        '9',
        expect.objectContaining({ sort: 'asc', page: 1 }),
      )
    })
  })

  it('navigates to page 2 and shows the total summary', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...openThread,
      id: String(i + 1),
      page_key: 'page-' + i,
    }))
    apiMocks.threadsApi.list.mockResolvedValue({ threads: many, total: 30 })
    renderThreads()
    const user = userEvent.setup()
    expect(await screen.findByText('共 30 条')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '下一页' }))
    await waitFor(() => {
      expect(apiMocks.threadsApi.list).toHaveBeenLastCalledWith(
        '9',
        expect.objectContaining({ page: 2, limit: 25 }),
      )
    })
  })

  it('shows the open/closed state labels', async () => {
    renderThreads()
    expect(await screen.findByText('Open Page')).toBeInTheDocument()
    expect(screen.getAllByText('已开启').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已关闭').length).toBeGreaterThan(0)
  })

  it('renders an empty state when no threads match', async () => {
    apiMocks.threadsApi.list.mockResolvedValue({
      threads: [],
      total: 0,
    })
    renderThreads()
    expect(await screen.findByText('没有匹配的评论区')).toBeInTheDocument()
  })

  it('renders an error state on list failure', async () => {
    apiMocks.threadsApi.list.mockRejectedValue(
      new ApiError('评论区加载失败', 500, 'internal_error'),
    )
    renderThreads()
    expect(
      await screen.findByText('评论区加载失败，请刷新重试。'),
    ).toBeInTheDocument()
  })

  it('hides row actions behind a more-menu and shows no inline edit button', async () => {
    renderThreads()
    expect(await screen.findByText('Open Page')).toBeInTheDocument()
    // 每个线程行只有一个更多操作图标，无内联"编辑"按钮。
    expect(screen.getAllByRole('button', { name: '操作' })).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: '编辑' }),
    ).not.toBeInTheDocument()
  })
})

describe('ThreadsPage toggle', () => {
  it('toggles a thread switch and sends the update payload', async () => {
    renderThreads()
    const user = userEvent.setup()
    const closedSwitch = await screen.findByRole('switch', {
      name: '开启评论区',
    })
    await user.click(closedSwitch)

    await waitFor(() => {
      expect(apiMocks.threadsApi.update).toHaveBeenCalledWith('9', '2', {
        comments_enabled: true,
      })
    })
  })

  it('shows an error toast when the mutation fails', async () => {
    apiMocks.threadsApi.update.mockRejectedValue(
      new ApiError('评论区已关闭', 409, 'thread_closed'),
    )
    renderThreads()
    const user = userEvent.setup()
    const closedSwitch = await screen.findByRole('switch', {
      name: '开启评论区',
    })
    await user.click(closedSwitch)

    await waitFor(() => {
      expect(apiMocks.threadsApi.update).toHaveBeenCalled()
    })
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('评论区已关闭')
  })
})

describe('ThreadsPage filters', () => {
  it('queries with comments_enabled when filtering by state', async () => {
    renderThreads()
    const user = userEvent.setup()
    const trigger = (await screen.findByText('全部状态')).closest('button')
    expect(trigger).not.toBeNull()
    await user.click(trigger as HTMLElement)
    await user.click(await screen.findByRole('option', { name: '已关闭' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.list).toHaveBeenCalledWith(
        '9',
        expect.objectContaining({ comments_enabled: false }),
      )
    })
  })

  it('submits the search text as q on enter', async () => {
    renderThreads()
    const user = userEvent.setup()
    await user.type(
      await screen.findByPlaceholderText('搜索页面标识、标题或 URL'),
      'alpha{Enter}',
    )

    await waitFor(() => {
      expect(apiMocks.threadsApi.list).toHaveBeenCalledWith(
        '9',
        expect.objectContaining({ q: 'alpha' }),
      )
    })
  })
})

describe('ThreadsPage batch actions', () => {
  it('selects only the current page and sends one enable request', async () => {
    renderThreads()
    const user = userEvent.setup()
    await screen.findByText('Open Page')

    await user.click(screen.getByRole('checkbox', { name: '选择评论区 1' }))
    await user.click(screen.getByRole('button', { name: '开启评论区' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.batch).toHaveBeenCalledWith('9', {
        ids: ['1'],
        action: 'enable',
      })
    })
  })

  it('confirms hard delete with the selected thread count and cascade warning', async () => {
    renderThreads()
    const user = userEvent.setup()
    await screen.findByText('Open Page')

    await user.click(screen.getByRole('checkbox', { name: '选择评论区 1' }))
    await user.click(screen.getByRole('button', { name: '批量永久删除' }))
    expect(
      await screen.findByText(
        '将永久删除 1 个评论区及其全部评论；该操作不可撤销。',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认操作' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.batch).toHaveBeenCalledWith('9', {
        ids: ['1'],
        action: 'hard_delete',
        confirm: true,
      })
    })
  })

  it('keeps selection after a failed batch and shows the failed id', async () => {
    apiMocks.threadsApi.batch.mockRejectedValue(
      new ApiError('batch failed', 404, 'not_found', undefined, {
        failed_id: '2',
      }),
    )
    renderThreads()
    const user = userEvent.setup()
    await screen.findByText('Open Page')

    await user.click(screen.getByRole('checkbox', { name: '选择评论区 2' }))
    await user.click(screen.getByRole('button', { name: '开启评论区' }))
    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: '选择评论区 2' }),
      ).toBeChecked()
    })
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith(
      '批量操作失败（记录 2），未应用任何变更',
    )
  })
})

describe('ThreadsPage edit dialog', () => {
  it('edits page key and title via the dialog', async () => {
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 0)
    await user.click(screen.getAllByRole('menuitem', { name: /编辑/ })[0])

    const keyInput = await screen.findByLabelText('页面标识')
    const titleInput = screen.getByLabelText('页面标题')
    const urlInput = screen.getByLabelText('页面 URL')
    expect(keyInput).toHaveValue('open-page')
    expect(titleInput).toHaveValue('Open Page')
    expect(urlInput).toHaveValue('https://site.example/open')

    await user.clear(keyInput)
    await user.type(keyInput, 'renamed-page')
    await user.clear(titleInput)
    await user.type(titleInput, 'Renamed Title')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.update).toHaveBeenCalledWith('9', '1', {
        page_key: 'renamed-page',
        page_title: 'Renamed Title',
        page_url: 'https://site.example/open',
      })
    })
    const { toast } = await import('sonner')
    expect(toast.success).toHaveBeenCalledWith('页面信息已更新')
  })

  it('clears page title when the input is blank', async () => {
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 1)
    await user.click(screen.getAllByRole('menuitem', { name: /编辑/ })[0])

    const keyInput = await screen.findByLabelText('页面标识')
    const titleInput = screen.getByLabelText('页面标题')
    expect(keyInput).toHaveValue('closed-page')
    await user.clear(titleInput)
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.update).toHaveBeenCalledWith('9', '2', {
        page_key: 'closed-page',
        page_title: null,
        page_url: null,
      })
    })
  })

  it('edits the page URL and clears it when blank', async () => {
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 0)
    await user.click(screen.getAllByRole('menuitem', { name: /编辑/ })[0])

    const urlInput = await screen.findByLabelText('页面 URL')
    expect(urlInput).toHaveValue('https://site.example/open')

    await user.clear(urlInput)
    await user.type(urlInput, 'https://site.example/renamed')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.update).toHaveBeenCalledWith('9', '1', {
        page_key: 'open-page',
        page_title: 'Open Page',
        page_url: 'https://site.example/renamed',
      })
    })
    apiMocks.threadsApi.update.mockClear()

    await openThreadMenu(user, 0)
    await user.click(screen.getAllByRole('menuitem', { name: /编辑/ })[0])
    const urlInput2 = await screen.findByLabelText('页面 URL')
    await user.clear(urlInput2)
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.update).toHaveBeenCalledWith('9', '1', {
        page_key: 'open-page',
        page_title: 'Open Page',
        page_url: null,
      })
    })
  })

  it('disables save while the key is blank', async () => {
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 0)
    await user.click(screen.getAllByRole('menuitem', { name: /编辑/ })[0])

    const keyInput = await screen.findByLabelText('页面标识')
    await user.clear(keyInput)
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('shows an error toast when the update fails', async () => {
    apiMocks.threadsApi.update.mockRejectedValue(
      new ApiError('页面标识重复', 409, 'conflict'),
    )
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 0)
    await user.click(screen.getAllByRole('menuitem', { name: /编辑/ })[0])

    await screen.findByLabelText('页面标识')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.update).toHaveBeenCalled()
    })
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('页面标识重复')
  })
})

describe('ThreadsPage delete', () => {
  it('deletes a thread after explicit confirmation', async () => {
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 0)
    await user.click(screen.getAllByRole('menuitem', { name: /删除/ })[0])

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('删除这个评论区？')
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.remove).toHaveBeenCalledWith('9', '1')
    })
    const { toast } = await import('sonner')
    expect(toast.success).toHaveBeenCalledWith('评论区已删除')
  })

  it('does not delete when the confirmation is cancelled', async () => {
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 1)
    await user.click(screen.getAllByRole('menuitem', { name: /删除/ })[0])

    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(apiMocks.threadsApi.remove).not.toHaveBeenCalled()
  })

  it('shows an error toast when deletion fails', async () => {
    apiMocks.threadsApi.remove.mockRejectedValue(
      new ApiError('评论区删除失败', 409, 'conflict'),
    )
    renderThreads()
    const user = userEvent.setup()
    await openThreadMenu(user, 0)
    await user.click(screen.getAllByRole('menuitem', { name: /删除/ })[0])

    await screen.findByRole('alertdialog')
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(apiMocks.threadsApi.remove).toHaveBeenCalled()
    })
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalledWith('评论区删除失败')
  })
})
