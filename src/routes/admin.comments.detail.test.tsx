// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
  apiMocks.pin.mockResolvedValue(comment({ is_pinned: true }))
  apiMocks.unpin.mockResolvedValue(comment({ is_pinned: false }))
})

describe('CommentDetailPage complete data', () => {
  it('renders identifiers, relations, author, request and lifecycle fields', async () => {
    renderDetail()
    expect(await screen.findByText('hello world')).toBeInTheDocument()
    // 作者（昵称同时出现在头像回退与信息字段中）
    expect(screen.getAllByText('Author').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('author@example.com')).toBeInTheDocument()
    expect(screen.getByText('https://author.example')).toBeInTheDocument()
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
    // 生命周期（标题徽章与生命周期状态徽章各一次）
    expect(screen.getAllByText('已发布').length).toBeGreaterThanOrEqual(2)
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
    // 模式标签与值各出现一次：IP 模式/IP 值、UA 模式/UA 信息共 4 处“未记录”。
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
})

describe('CommentDetailPage responsive layout', () => {
  it('lays the relationship card out in two columns on wider screens', async () => {
    renderDetail()
    await screen.findByText('hello world')
    // “关系与标识”卡片在桌面宽度下使用双栏网格，窄屏回退单栏。
    const heading = screen.getByText('关系与标识')
    const card = heading.closest('[data-slot="card"]')
    expect(card).not.toBeNull()
    const grid = card?.querySelector('[data-slot="card-content"]')
    expect(grid?.className).toContain('grid')
    expect(grid?.className).toContain('sm:grid-cols-2')
  })
})

describe('CommentDetailPage pin action', () => {
  it('pins a published root from the status actions card', async () => {
    renderDetail()
    expect(await screen.findByText('hello world')).toBeInTheDocument()
    await screen.findByRole('button', { name: '置顶评论' })
    screen.getByRole('button', { name: '置顶评论' }).click()
    await waitFor(() => {
      expect(apiMocks.pin).toHaveBeenCalledWith('1')
    })
  })
})
