// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentDetailPage } from './admin.comments.$commentId'
import type { AdminComment } from '@/lib/api/types'

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  pending: vi.fn(),
  publish: vi.fn(),
  spam: vi.fn(),
  pin: vi.fn(),
  unpin: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    component: null,
    useParams: () => ({ commentId: '1' }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock('@/lib/api/resources', () => ({
  commentsApi: apiMocks,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function comment(partial: Partial<AdminComment> = {}): AdminComment {
  return {
    id: '1',
    site_id: '9',
    thread_id: '5',
    root_id: null,
    parent_id: null,
    user_id: '10',
    author_email: 'author@example.com',
    author_nickname: 'Author',
    author_website: 'https://author.example',
    avatar_url: 'https://example.com/a.png',
    reply_to_user_id: '7',
    reply_to_nickname: 'Replied',
    body: 'hello world',
    status: 'published',
    is_pinned: false,
    depth: 1,
    created_at: '2026-08-11T00:00:00Z',
    published_at: '2026-08-11T00:00:00Z',
    deleted_at: null,
    ip_mode: 'full',
    ip_value: '203.0.113.42',
    ua_browser: 'Chrome',
    ua_device: 'desktop',
    ua_os: 'Windows',
    ua_mode: 'full',
    ua_raw: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',
    ...partial,
  }
}

function renderDetail(overrides: Partial<AdminComment> = {}) {
  apiMocks.get.mockResolvedValue(comment(overrides))
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CommentDetailPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.update.mockReset()
  apiMocks.pending.mockResolvedValue(comment({ status: 'pending' }))
  apiMocks.publish.mockResolvedValue(comment({ status: 'published' }))
  apiMocks.spam.mockResolvedValue(comment({ status: 'spam' }))
  apiMocks.remove.mockResolvedValue(comment({ status: 'deleted' }))
  apiMocks.pin.mockResolvedValue(comment({ is_pinned: true }))
  apiMocks.unpin.mockResolvedValue(comment({ is_pinned: false }))
})

describe('CommentDetailPage complete data', () => {
  it('renders identifiers, relations, author, request and lifecycle fields', async () => {
    renderDetail()
    expect(await screen.findByText('hello world')).toBeInTheDocument()
    // 作者栏仅保留头像旁的主要昵称与右侧三项元数据。
    const authorName = screen.getByText('Author')
    const authorHeader = authorName.closest('[data-slot="card-header"]')
    expect(authorHeader).not.toBeNull()
    expect(screen.getByText('author@example.com')).toBeInTheDocument()
    expect(screen.getByText('https://author.example')).toBeInTheDocument()
    expect(
      within(authorHeader as HTMLElement).getByText('邮箱'),
    ).toBeInTheDocument()
    expect(
      within(authorHeader as HTMLElement).getByText('网站'),
    ).toBeInTheDocument()
    expect(
      within(authorHeader as HTMLElement).getByText('创建时间'),
    ).toBeInTheDocument()
    expect(
      within(authorHeader as HTMLElement).queryByText('用户 ID'),
    ).not.toBeInTheDocument()
    expect(
      within(authorHeader as HTMLElement).queryByText('昵称'),
    ).not.toBeInTheDocument()
    expect(
      within(authorHeader as HTMLElement).queryByText('IP 值'),
    ).not.toBeInTheDocument()
    expect(
      within(authorHeader as HTMLElement).queryByText('UA 信息'),
    ).not.toBeInTheDocument()
    // 关系与标识
    expect(screen.getByText('站点 ID')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('线程 ID')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('父评论 ID')).toBeInTheDocument()
    expect(screen.getByText('根评论 ID')).toBeInTheDocument()
    expect(screen.getByText('深度')).toBeInTheDocument()
    // 深度值为 1，同时评论 ID 也是 1（标题“评论 #1”），因此允许多次出现。
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getByText('回复对象 ID')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('回复对象昵称')).toBeInTheDocument()
    expect(screen.getByText('Replied')).toBeInTheDocument()
    // 请求信息（full 模式：IP 与 UA 的模式标签各一次）
    expect(screen.getAllByText('完整记录')).toHaveLength(2)
    expect(screen.getByText('203.0.113.42')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',
      ),
    ).toBeInTheDocument()
    // 状态在标题区保留一次，避免信息卡重复展示。
    expect(screen.getByText('已发布')).toBeInTheDocument()
  })
})

describe('CommentDetailPage privacy modes', () => {
  it('shows 未记录 for both ip and ua in none mode without fabricating values', async () => {
    renderDetail({
      ip_mode: 'none',
      ip_value: null,
      ua_mode: 'none',
      ua_browser: null,
      ua_os: null,
      ua_device: null,
      ua_raw: null,
    })
    await screen.findByText('hello world')
    // IP / UA 仅在技术信息中展示：模式标签与值各有一处“未记录”。
    expect(screen.getAllByText('未记录')).toHaveLength(4)
    expect(screen.queryByText('203.0.113.42')).not.toBeInTheDocument()
    expect(screen.queryByText(/Mozilla/)).not.toBeInTheDocument()
  })

  it('shows the coarse ip value and parsed browser/os/device for coarse mode', async () => {
    renderDetail({
      ip_mode: 'coarse',
      ip_value: '203.0.113.0/24',
      ua_mode: 'coarse',
      ua_browser: 'Chrome',
      ua_os: 'Windows',
      ua_device: 'desktop',
      ua_raw: 'Mozilla/5.0 secret raw',
    })
    await screen.findByText('hello world')
    expect(screen.getByText('203.0.113.0/24')).toBeInTheDocument()
    expect(screen.getByText('Chrome / Windows / desktop')).toBeInTheDocument()
    // coarse 模式绝不回退展示原始 UA
    expect(screen.queryByText(/secret raw/)).not.toBeInTheDocument()
  })

  it('shows the full ip and raw ua for full mode', async () => {
    renderDetail({
      ip_mode: 'full',
      ip_value: '198.51.100.7',
      ua_mode: 'full',
      ua_raw: 'Raw-User-Agent-String',
    })
    await screen.findByText('hello world')
    expect(screen.getByText('198.51.100.7')).toBeInTheDocument()
    expect(screen.getByText('Raw-User-Agent-String')).toBeInTheDocument()
  })
})

describe('CommentDetailPage missing values', () => {
  it('renders the unified placeholder for null ids, website and timestamps', async () => {
    renderDetail({
      site_id: '9',
      thread_id: '5',
      parent_id: null,
      root_id: null,
      reply_to_user_id: null,
      reply_to_nickname: null,
      author_website: null,
      published_at: null,
      deleted_at: null,
    })
    await screen.findByText('hello world')
    // 缺失的 ID / 网站 / 时间统一使用占位符
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(7)
  })

  it('keeps empty string values stable with the placeholder', async () => {
    renderDetail({
      author_nickname: '',
      author_email: '',
      author_website: '',
      ip_value: '',
      ua_raw: '',
      ua_browser: '',
      ua_os: '',
      ua_device: '',
    })
    await screen.findByText('hello world')
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('keeps a partial reply target visible in independent information cells', async () => {
    renderDetail({ reply_to_user_id: '7', reply_to_nickname: null })
    await screen.findByText('hello world')

    expect(screen.getByText('回复对象 ID')).toBeInTheDocument()
    expect(screen.getByText('回复对象昵称')).toBeInTheDocument()
    expect(screen.getAllByText('7').length).toBeGreaterThan(0)
    expect(screen.queryByText('Replied · 用户 ID 7')).not.toBeInTheDocument()
  })

  it('keeps a nickname-only reply target visible alongside the missing id', async () => {
    renderDetail({ reply_to_user_id: null, reply_to_nickname: 'Replied' })
    await screen.findByText('hello world')

    expect(screen.getByText('回复对象昵称')).toBeInTheDocument()
    expect(screen.getByText('Replied')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
    expect(screen.queryByText('Replied · 用户 ID 7')).not.toBeInTheDocument()
  })
})

describe('CommentDetailPage responsive layout', () => {
  it('lays the relationship card out in two columns on wider screens', async () => {
    renderDetail()
    await screen.findByText('hello world')
    // “评论信息”卡片在桌面宽度下使用三栏网格，窄屏逐级回退。
    const heading = screen.getByText('评论信息')
    const card = heading.closest('[data-slot="card"]')
    expect(card).not.toBeNull()
    const grid = card?.querySelector('[data-slot="card-content"]')
    expect(grid?.className).toContain('grid')
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-3')
  })

  it('places author identity beside the three wrapping metadata fields', async () => {
    renderDetail({
      author_email: `${'long'.repeat(30)}@example.com`,
      author_website: `https://example.com/${'path'.repeat(30)}`,
    })
    await screen.findByText('hello world')

    const authorHeader = screen
      .getByText('Author')
      .closest('[data-slot="card-header"]')
    const layout = authorHeader?.firstElementChild
    expect(layout).toHaveClass('flex-col', 'md:flex-row')
    const metadata = within(authorHeader as HTMLElement).getByText('邮箱')
      .parentElement?.parentElement
    expect(metadata).toHaveClass('min-w-0', 'sm:grid-cols-3')
    expect(
      within(authorHeader as HTMLElement).getByText(/@example\.com/),
    ).toHaveClass('break-words', '[overflow-wrap:anywhere]')
  })

  it('keeps long body and technical values inside wrapping containers', async () => {
    renderDetail({
      body: 'x'.repeat(300),
      ip_value: '203.0.113.' + '9'.repeat(80),
      ua_raw: 'Mozilla/' + 'x'.repeat(300),
    })
    expect(await screen.findByText('x'.repeat(300))).toHaveClass(
      'break-words',
      '[overflow-wrap:anywhere]',
    )

    const summary = screen.getByText('技术信息').closest('summary')
    await userEvent.setup().click(summary as HTMLElement)
    const uaValues = screen.getAllByText(/Mozilla\/x+/)
    expect(uaValues.at(-1)).toHaveClass(
      'break-words',
      '[overflow-wrap:anywhere]',
    )
  })
})

describe('CommentDetailPage body editing', () => {
  it('starts in reading mode and only enables save after a changed draft', async () => {
    const user = userEvent.setup()
    renderDetail()

    expect(await screen.findByText('hello world')).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: '评论正文' }),
    ).not.toBeInTheDocument()
    const editButton = screen.getByRole('button', { name: '编辑' })
    const managementButton = screen.getByRole('button', { name: '评论操作' })
    expect(editButton).toBeInTheDocument()
    expect(editButton.compareDocumentPosition(managementButton) & 4).toBe(4)
    expect(
      screen.queryByRole('button', { name: '保存修改' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '编辑' }))
    const textarea = screen.getByRole('textbox', { name: '评论正文' })
    expect(textarea).toHaveValue('hello world')
    const save = screen.getByRole('button', { name: '保存修改' })
    const cancel = screen.getByRole('button', { name: '取消' })
    const editingManagement = screen.getByRole('button', { name: '评论操作' })
    expect(save).toBeDisabled()
    expect(save.compareDocumentPosition(cancel) & 4).toBe(4)
    expect(cancel.compareDocumentPosition(editingManagement) & 4).toBe(4)

    await user.type(textarea, ' updated')
    expect(save).toBeEnabled()
  })

  it('cancels a draft and does not leak it into the next edit session', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '编辑' }))
    const textarea = screen.getByRole('textbox', { name: '评论正文' })
    await user.clear(textarea)
    await user.type(textarea, 'discarded draft')
    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.getByText('hello world')).toBeInTheDocument()
    expect(screen.queryByText('discarded draft')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '编辑' }))
    expect(screen.getByRole('textbox', { name: '评论正文' })).toHaveValue(
      'hello world',
    )
  })

  it('saves a changed draft and returns to reading mode', async () => {
    const user = userEvent.setup()
    const saved = comment({ body: 'saved comment' })
    apiMocks.update.mockResolvedValue(saved)
    renderDetail()
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '编辑' }))
    const textarea = screen.getByRole('textbox', { name: '评论正文' })
    await user.clear(textarea)
    await user.type(textarea, 'saved comment')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.update).toHaveBeenCalledWith('1', 'saved comment')
    })
    await waitFor(() => {
      expect(
        screen.queryByRole('textbox', { name: '评论正文' }),
      ).not.toBeInTheDocument()
    })
  })

  it('keeps the save action pending until the update resolves', async () => {
    const user = userEvent.setup()
    let resolveUpdate: (value: AdminComment) => void = () => undefined
    apiMocks.update.mockImplementation(
      () =>
        new Promise<AdminComment>((resolve) => {
          resolveUpdate = resolve
        }),
    )
    renderDetail()
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '编辑' }))
    const textarea = screen.getByRole('textbox', { name: '评论正文' })
    await user.clear(textarea)
    await user.type(textarea, 'pending comment')
    const save = screen.getByRole('button', { name: '保存修改' })
    await user.click(save)

    await waitFor(() => expect(save).toBeDisabled())
    resolveUpdate(comment({ body: 'pending comment' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('textbox', { name: '评论正文' }),
      ).not.toBeInTheDocument()
    })
  })
})

describe('CommentDetailPage technical disclosure', () => {
  it('is closed by default and toggles with the native summary control', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByText('hello world')

    const summary = screen.getByText('技术信息').closest('summary')
    expect(summary).not.toBeNull()
    const details = summary?.closest('details')
    expect(details).not.toHaveAttribute('open')
    await user.click(summary as HTMLElement)
    expect(details).toHaveAttribute('open')
  })
})

describe('CommentDetailPage pin action', () => {
  it('pins a published root from the management dropdown', async () => {
    const user = userEvent.setup()
    renderDetail()
    expect(await screen.findByText('hello world')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '评论操作' }))
    await user.click(await screen.findByRole('menuitem', { name: '置顶评论' }))
    await waitFor(() => {
      expect(apiMocks.pin).toHaveBeenCalledWith('1')
    })
  })

  it('offers unpin only for a pinned root and calls the unpin endpoint', async () => {
    const user = userEvent.setup()
    renderDetail({ is_pinned: true })
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '评论操作' }))
    expect(
      await screen.findByRole('menuitem', { name: '取消置顶' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: '置顶评论' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: '取消置顶' }))
    await waitFor(() => {
      expect(apiMocks.unpin).toHaveBeenCalledWith('1')
    })
  })

  it('keeps the pin action hidden for a non-root comment', async () => {
    const user = userEvent.setup()
    renderDetail({ parent_id: '4', status: 'published' })
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '评论操作' }))
    await screen.findByRole('menuitem', { name: '移入待审核' })
    expect(
      screen.queryByRole('menuitem', { name: '置顶评论' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: '取消置顶' }),
    ).not.toBeInTheDocument()
  })
})

describe('CommentDetailPage status actions', () => {
  it('moves a published comment to pending through the shared endpoint mapping', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '评论操作' }))
    await user.click(
      await screen.findByRole('menuitem', { name: '移入待审核' }),
    )
    await waitFor(() => {
      expect(apiMocks.pending).toHaveBeenCalledWith('1')
    })
  })

  it('confirms soft deletion before calling the non-permanent endpoint', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '评论操作' }))
    await user.click(await screen.findByRole('menuitem', { name: '删除' }))
    expect(
      await screen.findByRole('heading', { name: '软删除这条评论？' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认操作' }))
    await waitFor(() => {
      expect(apiMocks.remove).toHaveBeenCalledWith('1', false)
    })
  })

  it('uses the explicit spam label in the management dropdown', async () => {
    const user = userEvent.setup()
    renderDetail()
    await screen.findByText('hello world')

    await user.click(screen.getByRole('button', { name: '评论操作' }))
    expect(
      await screen.findByRole('menuitem', { name: '标记为垃圾' }),
    ).toBeInTheDocument()
  })

  it('does not expose a permanent-delete action on the detail page', async () => {
    renderDetail()
    await screen.findByText('hello world')

    expect(screen.queryByText('永久删除')).not.toBeInTheDocument()
    expect(screen.queryByText('永久删除请从列表确认')).not.toBeInTheDocument()
  })
})
