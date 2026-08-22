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
import { SettingsPage } from './admin.settings'
import type { SettingItem } from '@/lib/api/types'

const apiMocks = vi.hoisted(() => ({
  settingsApi: { get: vi.fn(), patch: vi.fn() },
  providersApi: { list: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
}))
vi.mock('@/lib/api/resources', () => ({
  settingsApi: apiMocks.settingsApi,
  providersApi: apiMocks.providersApi,
}))
vi.mock('@/components/provider/ProviderSection', () => ({
  ProviderSection: () => null,
  captchaProviderTypeLabel: (value: string | null | undefined) => value ?? '',
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const defaultItems: SettingItem[] = [
  { key: 'comment_mode', type: 'string', value: 'anonymous' },
  { key: 'comment_sort', type: 'string', value: 'asc' },
  { key: 'moderation', type: 'string', value: 'direct' },
  { key: 'user_delete_mode', type: 'string', value: 'soft' },
  { key: 'max_reply_depth', type: 'integer', value: 3 },
  { key: 'public_registration', type: 'boolean', value: true },
  {
    key: 'privacy',
    type: 'json',
    value: { ip_mode: 'coarse', ua_mode: 'coarse' },
  },
  { key: 'captcha_policy', type: 'json', value: {} },
  {
    key: 'notifications',
    type: 'json',
    value: { moderation: true, replies: true },
  },
  { key: 'email_domain_whitelist', type: 'json', value: [] },
  { key: 'email_domain_blacklist', type: 'json', value: [] },
  {
    key: 'gravatar_base_url',
    type: 'string',
    value: 'https://www.gravatar.com/avatar',
  },
  { key: 'captcha_provider', type: 'string', value: '' },
  { key: 'emoji_catalog_url', type: 'string', value: '' },
]

function renderSettings(items: SettingItem[] = defaultItems) {
  apiMocks.settingsApi.get.mockResolvedValue({ settings: items })
  apiMocks.providersApi.list.mockResolvedValue({ providers: [] })
  apiMocks.settingsApi.patch.mockResolvedValue({ settings: items })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsPage card layout', () => {
  it('pairs wide and compact cards in a balanced twelve-column grid', async () => {
    renderSettings()
    await screen.findByText('评论策略')

    const cardSpans = [
      ['评论策略', 'xl:col-span-7'],
      ['用户与通知', 'xl:col-span-5'],
      ['隐私记录', 'xl:col-span-5'],
      ['邮箱与头像', 'xl:col-span-7'],
      ['人机验证策略', 'xl:col-span-5'],
      ['第三方登录', 'xl:col-span-7'],
    ] as const

    for (const [title, span] of cardSpans) {
      expect(screen.getByText(title).closest('[data-slot="card"]')).toHaveClass(
        span,
      )
    }

    expect(
      screen.getByText('评论策略').closest('[data-slot="card"]')?.parentElement,
    ).toHaveClass('grid', 'gap-6', 'xl:grid-cols-12')
  })
})

describe('SettingsPage privacy precision controls', () => {
  it('renders separate ip and ua precision selects', async () => {
    renderSettings()
    expect(await screen.findByText('隐私记录')).toBeInTheDocument()
    const ipTrigger = screen.getByRole('combobox', { name: 'IP 记录精度' })
    const uaTrigger = screen.getByRole('combobox', {
      name: 'User-Agent 记录精度',
    })
    // 默认值来自既有设置（coarse），以中文标签展示而非原始枚举。
    expect(ipTrigger).toHaveTextContent('粗略记录')
    expect(uaTrigger).toHaveTextContent('粗略记录')
    expect(screen.getByText(/只作用于之后新建的评论/)).toBeInTheDocument()
  })

  it('offers none/coarse/full options with Chinese labels for both controls', async () => {
    renderSettings()
    await screen.findByText('隐私记录')
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'IP 记录精度' }))
    expect(
      await screen.findByRole('option', { name: '不记录' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '粗略记录' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '完整记录' })).toBeInTheDocument()
  })

  it('submits only the privacy key with both precision changes via diff patch', async () => {
    renderSettings()
    await screen.findByText('隐私记录')
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox', { name: 'IP 记录精度' }))
    await user.click(await screen.findByRole('option', { name: '完整记录' }))
    await user.click(
      screen.getByRole('combobox', { name: 'User-Agent 记录精度' }),
    )
    await user.click(await screen.findByRole('option', { name: '不记录' }))
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(apiMocks.settingsApi.patch).toHaveBeenCalledWith([
        {
          key: 'privacy',
          type: 'json',
          value: { ip_mode: 'full', ua_mode: 'none' },
        },
      ])
    })
  })

  it('keeps the other privacy field untouched when only one changes', async () => {
    renderSettings()
    await screen.findByText('隐私记录')
    const user = userEvent.setup()

    await user.click(screen.getByRole('combobox', { name: 'IP 记录精度' }))
    await user.click(await screen.findByRole('option', { name: '不记录' }))
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => {
      expect(apiMocks.settingsApi.patch).toHaveBeenCalledWith([
        {
          key: 'privacy',
          type: 'json',
          value: { ip_mode: 'none', ua_mode: 'coarse' },
        },
      ])
    })
  })

  it('round-trips existing privacy values back into the controls on reload', async () => {
    renderSettings([
      ...defaultItems.filter((item) => item.key !== 'privacy'),
      {
        key: 'privacy',
        type: 'json',
        value: { ip_mode: 'none', ua_mode: 'full' },
      },
    ])
    await screen.findByText('隐私记录')
    expect(
      screen.getByRole('combobox', { name: 'IP 记录精度' }),
    ).toHaveTextContent('不记录')
    expect(
      screen.getByRole('combobox', { name: 'User-Agent 记录精度' }),
    ).toHaveTextContent('完整记录')
  })

  it('scopes privacy dialogs to the 隐私记录 card without leaking into other selects', async () => {
    renderSettings()
    await screen.findByText('隐私记录')
    const card = screen.getByText('隐私记录').closest('div[data-slot="card"]')
    expect(card).not.toBeNull()
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'IP 记录精度' }))
    const popup = await screen.findByRole('listbox')
    expect(
      within(popup).queryByRole('option', { name: '允许匿名评论' }),
    ).not.toBeInTheDocument()
  })
})

describe('SettingsPage comment sort control', () => {
  it('renders the default sort select with the asc default in Chinese', async () => {
    renderSettings()
    const trigger = await screen.findByRole('combobox', {
      name: '评论默认排序',
    })
    expect(trigger).toHaveTextContent('升序（旧到新）')
  })

  it('offers asc/desc options and submits a diff-only comment_sort patch', async () => {
    renderSettings()
    await screen.findByText('评论默认排序')
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: '评论默认排序' }))
    await user.click(
      await screen.findByRole('option', { name: '降序（新到旧）' }),
    )
    await user.click(screen.getByRole('button', { name: '保存设置' }))
    await waitFor(() => {
      expect(apiMocks.settingsApi.patch).toHaveBeenCalledWith([
        {
          key: 'comment_sort',
          type: 'string',
          value: 'desc',
        },
      ])
    })
  })

  it('round-trips an existing desc default on reload', async () => {
    renderSettings([
      ...defaultItems.filter((item) => item.key !== 'comment_sort'),
      { key: 'comment_sort', type: 'string', value: 'desc' },
    ])
    const trigger = await screen.findByRole('combobox', {
      name: '评论默认排序',
    })
    expect(trigger).toHaveTextContent('降序（新到旧）')
  })
})

describe('SettingsPage expression catalog URL control', () => {
  it('renders the catalog input with an empty default value', async () => {
    renderSettings()
    const input = await screen.findByLabelText('表情目录地址')
    expect(input).toHaveValue('')
  })

  it('round-trips an existing catalog URL on reload', async () => {
    renderSettings([
      ...defaultItems.filter((item) => item.key !== 'emoji_catalog_url'),
      {
        key: 'emoji_catalog_url',
        type: 'string',
        value: 'https://cdn.example/emoji.json',
      },
    ])
    const input = await screen.findByLabelText('表情目录地址')
    expect(input).toHaveValue('https://cdn.example/emoji.json')
  })

  it('submits a diff-only emoji_catalog_url patch after editing', async () => {
    renderSettings()
    const input = await screen.findByLabelText('表情目录地址')
    const user = userEvent.setup()
    await user.type(input, 'https://cdn.example/emoji.json')
    await user.click(screen.getByRole('button', { name: '保存设置' }))
    await waitFor(() => {
      expect(apiMocks.settingsApi.patch).toHaveBeenCalledWith([
        {
          key: 'emoji_catalog_url',
          type: 'string',
          value: 'https://cdn.example/emoji.json',
        },
      ])
    })
  })

  it('submits a diff-only clear patch when the URL is emptied', async () => {
    renderSettings([
      ...defaultItems.filter((item) => item.key !== 'emoji_catalog_url'),
      {
        key: 'emoji_catalog_url',
        type: 'string',
        value: 'https://cdn.example/emoji.json',
      },
    ])
    const input = await screen.findByLabelText('表情目录地址')
    const user = userEvent.setup()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: '保存设置' }))
    await waitFor(() => {
      expect(apiMocks.settingsApi.patch).toHaveBeenCalledWith([
        {
          key: 'emoji_catalog_url',
          type: 'string',
          value: '',
        },
      ])
    })
  })
})
