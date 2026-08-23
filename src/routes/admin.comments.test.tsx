// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentsPage } from './admin.comments'
import type { AdminComment } from '@/lib/api/types'

// apiMocks 是 commentsApi 的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => ({
  commentsApi: {
    list: vi.fn(),
    pending: vi.fn(),
    publish: vi.fn(),
    spam: vi.fn(),
    pin: vi.fn(),
    unpin: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
    batch: vi.fn(),
  },
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
  useNavigate: () => apiMocks.navigate,
  // 列表单测只渲染列表本身，视为不存在详情子路由匹配。
  useMatch: () => undefined,
  Outlet: () => null,
  Link: ({
    to,
    params,
    className,
    children,
    ...props
  }: {
    to: string
    params?: { commentId?: string }
    className?: string
    children: React.ReactNode
  }) => (
    <a
      href={`${to}?commentId=${params?.commentId ?? ''}`}
      className={className}
      {...props}
    >
      {children}
    </a>
  ),
}))
vi.mock('@/lib/api/resources', () => ({
  commentsApi: apiMocks.commentsApi,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

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
    is_pinned: false,
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

function renderComments() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommentsPage />
    </QueryClientProvider>,
  )
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
    // Base UI 把菜单项渲染为带 menuitem 角色的可点击项；查看详情与其余状态
    // 操作项同样通过 onClick 触发，导航由组件内的命令式 navigate 完成。
    expect(
      screen.getByRole('menuitem', { name: '查看详情' }),
    ).toBeInTheDocument()
  })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.commentsApi.list.mockResolvedValue({
    comments: [
      comment({ id: '1' }),
      comment({ id: '2', status: 'pending', body: 'pending body' }),
    ],
    total: 2,
  })
  apiMocks.commentsApi.pending.mockResolvedValue(undefined)
  apiMocks.commentsApi.publish.mockResolvedValue(undefined)
  apiMocks.commentsApi.spam.mockResolvedValue(undefined)
  apiMocks.commentsApi.pin.mockResolvedValue(
    comment({ id: '1', is_pinned: true }),
  )
  apiMocks.commentsApi.unpin.mockResolvedValue(
    comment({ id: '1', is_pinned: false }),
  )
  apiMocks.commentsApi.remove.mockResolvedValue({
    deleted_root_id: '1',
    hard: false,
  })
  apiMocks.commentsApi.batch.mockResolvedValue({
    action: 'publish',
    requested_count: 2,
    changed_count: 2,
    unchanged_count: 0,
  })
})

describe('CommentsPage animation state coverage', () => {
  it('shows the loading state while the list query is pending', async () => {
    let resolveList: (value: unknown) => void = () => {}
    apiMocks.commentsApi.list.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve
      }),
    )
    renderComments()
    expect(await screen.findByText('正在加载评论...')).toBeInTheDocument()
    resolveList({
      comments: [comment({ id: '1' })],
      total: 1,
    })
    expect(await screen.findByText('hello world')).toBeInTheDocument()
  })

  it('renders the empty state when the filter matches nothing', async () => {
    apiMocks.commentsApi.list.mockResolvedValue({
      comments: [],
      total: 0,
    })
    renderComments()
    expect(await screen.findByText('没有匹配的评论')).toBeInTheDocument()
  })
})

describe('CommentsPage renamed copy', () => {
  it('renders 评论管理 as the page title', async () => {
    renderComments()
    expect(
      await screen.findByRole('heading', { name: '评论管理' }),
    ).toBeInTheDocument()
  })
})

describe('CommentsPage sort control', () => {
  it('requests desc by default, page 1 and shows 最新优先', async () => {
    renderComments()
    await waitFor(() => {
      expect(apiMocks.commentsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'desc', page: 1, limit: 25 }),
      )
    })
    expect(await screen.findByText('最新优先')).toBeInTheDocument()
  })

  it('switches to asc and resets to page 1', async () => {
    renderComments()
    const user = userEvent.setup()
    const trigger = (await screen.findByText('最新优先')).closest('button')
    expect(trigger).not.toBeNull()
    await user.click(trigger as HTMLElement)
    await user.click(await screen.findByRole('option', { name: '最早优先' }))

    // 切换排序方向必须回到第一页重新加载。
    await waitFor(() => {
      expect(apiMocks.commentsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'asc', page: 1 }),
      )
    })
  })
})

describe('CommentsPage pagination', () => {
  it('shows the total summary and navigates to page 2', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      comment({ id: String(i + 1) }),
    )
    apiMocks.commentsApi.list.mockResolvedValue({ comments: many, total: 30 })
    renderComments()
    const user = userEvent.setup()
    expect(await screen.findByText('共 30 条')).toBeInTheDocument()
    // 默认每页 25 条，30 条共 2 页。
    await user.click(await screen.findByRole('button', { name: '下一页' }))
    await waitFor(() => {
      expect(apiMocks.commentsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, limit: 25 }),
      )
    })
  })

  it('changes the page size and resets to page 1', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      comment({ id: String(i + 1) }),
    )
    apiMocks.commentsApi.list.mockResolvedValue({ comments: many, total: 30 })
    renderComments()
    const user = userEvent.setup()
    expect(await screen.findByText('共 30 条')).toBeInTheDocument()
    const sizeTrigger = (await screen.findByText('每页 25 条')).closest(
      'button',
    )
    expect(sizeTrigger).not.toBeNull()
    await user.click(sizeTrigger as HTMLElement)
    await user.click(await screen.findByRole('option', { name: '每页 50 条' }))
    await waitFor(() => {
      expect(apiMocks.commentsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 50, page: 1 }),
      )
    })
  })

  it('resets to page 1 when the status filter changes', async () => {
    apiMocks.commentsApi.list.mockResolvedValue({
      comments: [comment({ id: '1' })],
      total: 1,
    })
    renderComments()
    const user = userEvent.setup()
    const statusTrigger = (await screen.findByText('全部状态')).closest(
      'button',
    )
    expect(statusTrigger).not.toBeNull()
    await user.click(statusTrigger as HTMLElement)
    await user.click(await screen.findByRole('option', { name: '待审核' }))
    await waitFor(() => {
      expect(apiMocks.commentsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'pending', page: 1 }),
      )
    })
  })

  it('sends the server-side q search as a request parameter', async () => {
    renderComments()
    const user = userEvent.setup()
    await user.type(
      await screen.findByPlaceholderText('搜索正文、昵称或邮箱'),
      'needle',
    )
    await user.click(await screen.findByRole('button', { name: '搜索' }))
    await waitFor(() => {
      expect(apiMocks.commentsApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'needle', page: 1 }),
      )
    })
  })
})

describe('CommentsPage batch actions', () => {
  it('sends the selected current-page comment ids in one request', async () => {
    renderComments()
    const user = userEvent.setup()
    const checkboxes = await screen.findAllByRole('checkbox')

    await user.click(checkboxes[1])
    await user.click(checkboxes[2])
    expect(screen.getByText('已选择 2 项')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '发布评论' }))

    await waitFor(() => {
      expect(apiMocks.commentsApi.batch).toHaveBeenCalledWith({
        ids: ['1', '2'],
        action: 'publish',
        confirm: undefined,
      })
    })
  })

  it('confirms batch soft delete with the selected count', async () => {
    renderComments()
    const user = userEvent.setup()
    const checkboxes = await screen.findAllByRole('checkbox')

    await user.click(checkboxes[0])
    await user.click(screen.getByRole('button', { name: '批量软删除' }))
    expect(
      await screen.findByRole('heading', { name: '软删除选中的评论？' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('将软删除 2 条评论；评论会被隐藏且可以恢复。'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认操作' }))

    await waitFor(() => {
      expect(apiMocks.commentsApi.batch).toHaveBeenCalledWith({
        ids: ['1', '2'],
        action: 'soft_delete',
        confirm: true,
      })
    })
  })
})

describe('CommentsPage detail navigation', () => {
  it('invokes the router navigation with the selected comment id on 查看详情', async () => {
    renderComments()
    const user = userEvent.setup()
    await openRowMenu(user, 'hello world')

    await user.click(screen.getByRole('menuitem', { name: '查看详情' }))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/admin/comments/$commentId',
        params: { commentId: '1' },
      })
    })
  })

  it('keeps the menu close behavior after the navigation click', async () => {
    renderComments()
    const user = userEvent.setup()
    await openRowMenu(user, 'hello world')

    await user.click(screen.getByRole('menuitem', { name: '查看详情' }))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalled()
    })
    // Base UI 菜单项点击后关闭菜单，导航由命令式 navigate 完成。
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })
})

describe('CommentsPage four-state matrix', () => {
  it('pins a published root from the row actions', async () => {
    renderComments()
    const user = userEvent.setup()
    await openRowMenu(user, 'hello world')

    await user.click(screen.getByRole('menuitem', { name: '置顶评论' }))
    await waitFor(() => {
      expect(apiMocks.commentsApi.pin).toHaveBeenCalledWith('1')
    })
  })

  it('offers the three other status targets for a published comment', async () => {
    renderComments()
    const user = userEvent.setup()
    await openRowMenu(user, 'hello world')

    expect(
      screen.getByRole('menuitem', { name: '移入待审核' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: '标记垃圾' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '软删除' })).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: '发布评论' }),
    ).not.toBeInTheDocument()
  })

  it('moves a published comment to pending via the pending endpoint', async () => {
    renderComments()
    const user = userEvent.setup()
    await openRowMenu(user, 'hello world')

    await user.click(screen.getByRole('menuitem', { name: '移入待审核' }))
    await waitFor(() => {
      expect(apiMocks.commentsApi.pending).toHaveBeenCalledWith('1')
    })
  })

  it('routes soft delete through the confirmation dialog and removes without hard flag', async () => {
    renderComments()
    const user = userEvent.setup()
    await openRowMenu(user, 'hello world')

    await user.click(screen.getByRole('menuitem', { name: '软删除' }))
    expect(
      await screen.findByRole('heading', { name: '软删除这条评论？' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认操作' }))

    await waitFor(() => {
      expect(apiMocks.commentsApi.remove).toHaveBeenCalledWith('1', false)
    })
  })

  it('keeps permanent delete as a separate confirmed hard command', async () => {
    renderComments()
    const user = userEvent.setup()
    await openRowMenu(user, 'hello world')

    await user.click(screen.getByRole('menuitem', { name: '永久删除' }))
    expect(
      await screen.findByRole('heading', { name: '永久删除这条评论？' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认操作' }))

    await waitFor(() => {
      expect(apiMocks.commentsApi.remove).toHaveBeenCalledWith('1', true)
    })
  })
})
