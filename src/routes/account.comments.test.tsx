// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentDetailPage } from './account.comments.$commentId'
import type { CaptchaConfigResponse, MeCommentDetail } from '@/lib/api/types'

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  reply: vi.fn(),
  remove: vi.fn(),
  captchaConfig: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    component: null,
    useParams: () => ({ commentId: '10' }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock('@/lib/api/resources', () => ({
  meCommentsApi: apiMocks,
  captchaApi: { config: apiMocks.captchaConfig },
}))
vi.mock('@/components/CaptchaChallenge', () => ({
  CaptchaChallenge: ({
    onToken,
    config,
  }: {
    onToken: (token: string) => void
    config: { provider: string }
  }) => (
    <button
      type="button"
      data-testid={`challenge-${config.provider}`}
      onClick={() => onToken('solved-token')}
    >
      solve
    </button>
  ),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const comment: MeCommentDetail = {
  id: '10',
  site_id: '1',
  site_name: 'Site',
  thread_id: '5',
  page_key: 'post',
  page_url: 'https://example.com/post',
  page_title: null,
  user_id: '1',
  parent_id: null,
  root_id: null,
  depth: 0,
  body: '我的评论正文',
  status: 'published',
  author_nickname: 'me',
  author_website: null,
  avatar_url: 'https://www.gravatar.com/avatar/hash',
  reply_to_user_id: null,
  reply_to_nickname: null,
  created_at: '2026-01-01T00:00:00Z',
  published_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  user_delete_mode: 'soft',
}

function renderDetail(
  overrides: Partial<MeCommentDetail> = {},
  captchaConfig: CaptchaConfigResponse = { required: false },
) {
  apiMocks.get.mockResolvedValue({ ...comment, ...overrides })
  apiMocks.reply.mockResolvedValue(undefined)
  apiMocks.remove.mockResolvedValue({ deleted_root_id: '10', hard: false })
  apiMocks.captchaConfig.mockResolvedValue(captchaConfig)
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
})

afterEach(() => {
  delete (navigator as { credentials?: unknown }).credentials
})

describe('CommentDetailPage delete policy confirmation', () => {
  it('explains soft delete outcome before confirming', async () => {
    renderDetail()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '删除这条评论' }),
    )
    expect(screen.getByText(/软删除：本条评论会从公开列表隐藏/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => {
      expect(apiMocks.remove).toHaveBeenCalledWith('10')
    })
  })

  it('explains hard delete outcome for hard policy', async () => {
    renderDetail({ user_delete_mode: 'hard' })
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '删除这条评论' }),
    )
    expect(
      screen.getByText(/永久删除：本条评论会永久移除且不可恢复/),
    ).toBeTruthy()
  })

  it('shows the not-found state when the comment is unavailable', async () => {
    apiMocks.get.mockRejectedValue(new Error('not found'))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <CommentDetailPage />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('评论不存在或加载失败。')).toBeTruthy()
  })
})

describe('CommentDetailPage reply gating', () => {
  it('submits a reply only for published comments without captcha token when policy is off', async () => {
    renderDetail()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('回复正文'), '一条回复')
    await user.click(screen.getByRole('button', { name: '发布回复' }))
    await waitFor(() => {
      expect(apiMocks.reply).toHaveBeenCalledWith('10', '一条回复', undefined)
    })
  })

  it('opens the captcha dialog and publishes the reply once after solving', async () => {
    renderDetail(
      {},
      {
        required: true,
        captcha: { provider: 'turnstile', site_key: 'ts-site' },
      },
    )
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('回复正文'), '一条回复')
    await user.click(screen.getByRole('button', { name: '发布回复' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-turnstile')).toBeInTheDocument()
    })
    expect(apiMocks.reply).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('challenge-turnstile'))
    await waitFor(() => {
      expect(apiMocks.reply).toHaveBeenCalledWith(
        '10',
        '一条回复',
        'solved-token',
      )
    })
    expect(apiMocks.reply).toHaveBeenCalledTimes(1)
  })

  it('does not publish a reply when the captcha dialog is cancelled', async () => {
    renderDetail(
      {},
      {
        required: true,
        captcha: { provider: 'turnstile', site_key: 'ts-site' },
      },
    )
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('回复正文'), '一条回复')
    await user.click(screen.getByRole('button', { name: '发布回复' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-turnstile')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => {
      expect(
        screen.queryByTestId('challenge-turnstile'),
      ).not.toBeInTheDocument()
    })
    expect(apiMocks.reply).not.toHaveBeenCalled()
  })

  it('shows the not-found state for unreachable (deleted) comments', async () => {
    apiMocks.get.mockRejectedValue(new Error('not found'))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <CommentDetailPage />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('评论不存在或加载失败。')).toBeTruthy()
    expect(screen.queryByLabelText('回复正文')).toBeNull()
  })
})
