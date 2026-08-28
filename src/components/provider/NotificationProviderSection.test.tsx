// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { NotificationProviderSection } from './NotificationProviderSection'

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  upsert: vi.fn(),
  test: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/api/resources', () => ({
  providersApi: apiMocks,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const channelKeys = [
  'notification.telegram',
  'notification.feishu',
  'notification.dingtalk',
  'notification.bark',
  'notification.slack',
  'notification.line',
  'notification.webhook',
  'notification.discord',
] as const

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationProviderSection />
    </QueryClientProvider>,
  )
}

function notificationProvider(
  key: string,
  extra: Partial<{
    kind: string
    enabled: boolean
    configured: boolean
    public_config: Record<string, unknown>
  }> = {},
) {
  return {
    provider_key: key,
    kind: 'notification',
    enabled: false,
    configured: true,
    public_config: {},
    ...extra,
  }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.list.mockResolvedValue({ providers: [] })
  apiMocks.upsert.mockResolvedValue(undefined)
  apiMocks.test.mockResolvedValue(undefined)
  apiMocks.remove.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('NotificationProviderSection fixed eight-slot catalog', () => {
  it('renders all eight notification channels in fixed order even with no provider rows', async () => {
    const { container } = renderSection()
    // 先等待任一通道卡片渲染完成，确保 8 个插槽已就绪。
    await screen.findByText('Telegram')
    const cards = channelKeys.map((key) =>
      container.querySelector(`[data-testid="notification-provider-${key}"]`),
    )
    for (const card of cards) {
      expect(card).not.toBeNull()
    }
    const positions = channelKeys.map((key) =>
      [
        ...container.querySelectorAll(
          '[data-testid^="notification-provider-"]',
        ),
      ].findIndex(
        (el) =>
          el.getAttribute('data-testid') === `notification-provider-${key}`,
      ),
    )
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('renders exactly one slot per channel even when the list returns duplicate keys', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        notificationProvider('notification.telegram'),
        notificationProvider('notification.telegram'),
        notificationProvider('notification.discord'),
      ],
    })
    const { container } = renderSection()
    await screen.findByText('Telegram')
    const cards = [
      ...container.querySelectorAll('[data-testid^="notification-provider-"]'),
    ]
    expect(cards).toHaveLength(8)
    expect(
      container.querySelectorAll(
        '[data-testid="notification-provider-notification.telegram"]',
      ),
    ).toHaveLength(1)
    expect(
      container.querySelectorAll(
        '[data-testid="notification-provider-notification.discord"]',
      ),
    ).toHaveLength(1)
  })

  it('keeps Bark and WebHook outbound warnings inside configuration dialogs', async () => {
    renderSection()
    await screen.findByText('多通道通知')
    await screen.findByTestId('notification-provider-notification.bark')
    expect(
      screen.queryByText(/Bark 服务器地址允许任意 HTTP\/HTTPS/),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/通用 WebHook 允许任意 HTTP\/HTTPS/),
    ).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: '配置 notification.bark' }),
    )
    expect(
      await screen.findByText(/Bark 服务器地址允许任意 HTTP\/HTTPS/),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    await userEvent.click(
      screen.getByRole('button', { name: '配置 notification.webhook' }),
    )
    expect(
      await screen.findByText(/通用 WebHook 允许任意 HTTP\/HTTPS/),
    ).toBeInTheDocument()
  })

  it('renders configured and enabled state for an existing channel', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        notificationProvider('notification.telegram', { enabled: true }),
      ],
    })
    renderSection()
    expect(await screen.findByText('已配置 · 已启用')).toBeInTheDocument()
  })

  it('disables the switch for an unconfigured channel', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        notificationProvider('notification.telegram', { configured: false }),
      ],
    })
    renderSection()
    const toggle = await screen.findByRole('switch', {
      name: '启用通知通道 notification.telegram',
    })
    // base-ui Switch 用 aria-disabled 表示禁用态（span 无法携带原生 disabled 属性）。
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('NotificationProviderSection configure/edit contract', () => {
  it('creates a Telegram channel with bot token and chat id', async () => {
    renderSection()
    await screen.findByText('Telegram')
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '配置 notification.telegram' }),
    )
    await user.type(await screen.findByLabelText('Bot Token *'), '123456:ABC')
    await user.type(screen.getByLabelText('Chat ID *'), '-1001234567890')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('notification.telegram', {
        kind: 'notification',
        enabled: false,
        config: {
          bot_token: '123456:ABC',
          chat_id: '-1001234567890',
        },
      })
    })
  })

  it('requires a required field when creating a channel', async () => {
    renderSection()
    await screen.findByText('Telegram')
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '配置 notification.telegram' }),
    )
    await user.type(await screen.findByLabelText('Chat ID *'), '-1001')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).not.toHaveBeenCalled()
      expect(toast.error).toHaveBeenCalledWith('请填写 Bot Token')
    })
  })

  it('preserves an existing secret on edit by leaving it blank', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [notificationProvider('notification.telegram')],
    })
    renderSection()
    await screen.findByText('Telegram')
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '配置 notification.telegram' }),
    )
    // 机密字段永不回显；直接保存表示保留现值。
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith(
        'notification.telegram',
        expect.objectContaining({
          kind: 'notification',
          config: expect.objectContaining({}),
        }),
      )
    })
    const call = apiMocks.upsert.mock.calls[0]
    expect(JSON.stringify(call)).not.toContain('bot_token')
  })

  it('clears an optional signing secret by sending null', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [notificationProvider('notification.feishu')],
    })
    renderSection()
    await screen.findByText('飞书')
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '配置 notification.feishu' }),
    )
    await user.click(await screen.findByLabelText('清除已保存的签名密钥'))
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('notification.feishu', {
        kind: 'notification',
        enabled: false,
        config: { signing_secret: null },
      })
    })
  })

  it('replaces an optional signing secret when a new value is typed', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [notificationProvider('notification.dingtalk')],
    })
    renderSection()
    await screen.findByText('钉钉')
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '配置 notification.dingtalk' }),
    )
    await user.type(
      await screen.findByLabelText('签名密钥（可选）'),
      'SECRET-1',
    )
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('notification.dingtalk', {
        kind: 'notification',
        enabled: false,
        config: { signing_secret: 'SECRET-1' },
      })
    })
  })
})

describe('NotificationProviderSection toggle/test/delete contract', () => {
  it('toggles enablement with an empty config so the stored envelope is kept', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        notificationProvider('notification.telegram', { enabled: true }),
      ],
    })
    renderSection()
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch', {
      name: '启用通知通道 notification.telegram',
    })
    await user.click(toggle)

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('notification.telegram', {
        kind: 'notification',
        enabled: false,
        config: {},
      })
    })
  })

  it('confirms before running a delivery test and calls the test endpoint', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [notificationProvider('notification.slack')],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', {
        name: '测试 notification.slack 投递',
      }),
    )
    // 测试确认框先警告真实投递，确认后才调用接口。
    expect(await screen.findByText('发送测试消息？')).toBeInTheDocument()
    expect(
      screen.getByText(/将向 notification.slack 发送一条真实测试消息/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '发送测试' }))

    await waitFor(() => {
      expect(apiMocks.test).toHaveBeenCalledWith('notification.slack')
    })
  })

  it('allows test on a disabled but configured channel', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [notificationProvider('notification.line')],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', {
        name: '测试 notification.line 投递',
      }),
    )
    await user.click(await screen.findByRole('button', { name: '发送测试' }))
    await waitFor(() => {
      expect(apiMocks.test).toHaveBeenCalledWith('notification.line')
    })
  })

  it('deletes a channel after confirmation', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [notificationProvider('notification.webhook')],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '删除 notification.webhook' }),
    )
    await user.click(await screen.findByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(apiMocks.remove).toHaveBeenCalledWith('notification.webhook')
    })
  })
})
