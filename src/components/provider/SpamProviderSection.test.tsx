// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { SpamProviderSection } from './SpamProviderSection'

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/api/resources', () => ({
  providersApi: apiMocks,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SpamProviderSection />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.list.mockResolvedValue({ providers: [] })
  apiMocks.upsert.mockResolvedValue(undefined)
  apiMocks.remove.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('SpamProviderSection contract', () => {
  it('renders the four fixed spam channels in fixed order', async () => {
    const { container } = renderSection()
    const order = ['spam.local', 'spam.akismet', 'spam.aliyun', 'spam.tencent']
    await screen.findByText('本地关键词库')
    const cards = order.map((key) =>
      container.querySelector(`[data-testid="spam-provider-${key}"]`),
    )
    for (const card of cards) {
      expect(card).not.toBeNull()
    }
    // 固定顺序：卡片在 DOM 中按本地 → Akismet → 阿里云 → 腾讯云排列。
    const positions = order.map((key) =>
      [
        ...container.querySelectorAll('[data-testid^="spam-provider-"]'),
      ].findIndex(
        (el) => el.getAttribute('data-testid') === `spam-provider-${key}`,
      ),
    )
    expect(positions).toEqual([0, 1, 2, 3])
  })

  it('shows a persistent Akismet data-transfer warning near the enable switch', async () => {
    renderSection()
    expect(await screen.findByText(/发送至 Akismet 服务/)).toBeInTheDocument()
  })

  it('renders enabled/configured state for an existing local provider', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'spam.local',
          kind: 'spam',
          enabled: true,
          configured: true,
          public_config: { file_path: '/tmp/words.txt', action: 'pending' },
        },
      ],
    })
    renderSection()
    expect(await screen.findByText('已配置 · 已启用')).toBeInTheDocument()
  })

  it('saves a local provider with file path, nickname toggle and action', async () => {
    renderSection()
    await screen.findByText('本地关键词库')
    const edit = screen.getAllByLabelText('编辑 spam.local')[0]
    await userEvent.click(edit)
    const path = await screen.findByLabelText('词库文件路径')
    await userEvent.type(path, '/var/lib/furtalk/keywords.txt')
    await userEvent.click(screen.getByLabelText('同时检测昵称'))
    await userEvent.click(screen.getByLabelText('命中动作'))
    await userEvent.click(await screen.findByText('标记为垃圾（spam）'))
    await userEvent.click(screen.getByText('保存修改'))
    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith(
        'spam.local',
        expect.objectContaining({
          kind: 'spam',
          enabled: false,
          config: expect.objectContaining({
            file_path: '/var/lib/furtalk/keywords.txt',
            check_nickname: true,
            action: 'spam',
          }),
        }),
      )
    })
  })

  it('requires a file path when creating a local provider', async () => {
    renderSection()
    await screen.findByText('本地关键词库')
    await userEvent.click(screen.getAllByLabelText('编辑 spam.local')[0])
    await userEvent.click(screen.getByText('保存修改'))
    await waitFor(() => {
      expect(apiMocks.upsert).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('请填写词库文件路径')
    })
  })

  it('never submits an existing secret on edit and keeps secret blank to preserve it', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'spam.akismet',
          kind: 'spam',
          enabled: true,
          configured: true,
          public_config: { action: 'spam' },
        },
      ],
    })
    renderSection()
    await screen.findByText('Akismet')
    await userEvent.click(screen.getAllByLabelText('编辑 spam.akismet')[0])
    await userEvent.click(screen.getByText('保存修改'))
    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith(
        'spam.akismet',
        expect.objectContaining({
          config: expect.objectContaining({ action: 'spam' }),
        }),
      )
    })
    const call = apiMocks.upsert.mock.calls[0]
    expect(JSON.stringify(call)).not.toContain('api_key')
  })

  it('rejects a partial cloud credential group', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'spam.aliyun',
          kind: 'spam',
          configured: false,
          public_config: {},
        },
      ],
    })
    renderSection()
    await screen.findByText('阿里云内容安全')
    await userEvent.click(screen.getAllByLabelText('编辑 spam.aliyun')[0])
    await userEvent.type(
      await screen.findByLabelText('区域（Region）'),
      'cn-shanghai',
    )
    await userEvent.type(await screen.findByLabelText('AccessKey ID'), 'id')
    await userEvent.click(screen.getByText('保存修改'))
    await waitFor(() => {
      expect(apiMocks.upsert).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('凭据必须完整填写或整组留空')
    })
  })
})
