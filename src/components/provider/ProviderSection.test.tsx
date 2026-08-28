// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderSection } from './ProviderSection'

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

function renderSection(mode?: 'all' | 'auth' | 'captcha') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ProviderSection mode={mode} />
    </QueryClientProvider>,
  )
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

describe('ProviderSection provider management contract', () => {
  it('keeps create actions in card header action slots', async () => {
    renderSection('auth')
    const authCreate = await screen.findByRole('button', {
      name: '新建登录入口',
    })
    expect(authCreate.closest('[data-slot="card-action"]')).not.toBeNull()

    cleanup()
    renderSection('captcha')
    const captchaCreate = await screen.findByRole('button', {
      name: '新建验证码提供商',
    })
    expect(captchaCreate.closest('[data-slot="card-action"]')).not.toBeNull()
  })

  it('can render auth and captcha management independently', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'github',
          kind: 'oauth',
          configured: true,
          public_config: { client_id: 'c' },
        },
        {
          provider_key: 'turnstile',
          kind: 'captcha',
          configured: true,
          public_config: { provider: 'turnstile' },
        },
      ],
    })
    const { unmount } = renderSection('auth')
    expect(await screen.findByText('GitHub')).toBeInTheDocument()
    expect(screen.queryByText('还没有验证码提供商')).not.toBeInTheDocument()
    unmount()

    renderSection('captcha')
    expect(await screen.findByText(/Cloudflare Turnstile/)).toBeInTheDocument()
    expect(screen.queryByText('还没有第三方登录入口')).not.toBeInTheDocument()
  })

  it('renders an empty hint when no auth providers exist', async () => {
    renderSection()
    expect(await screen.findByText('还没有第三方登录入口')).toBeInTheDocument()
  })

  it('renders configured provider rows with enabled state', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'github',
          kind: 'oauth',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    expect(await screen.findByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('已配置 · 已启用')).toBeInTheDocument()
  })

  it('creates a custom OIDC provider with key, id, secret and HTTPS issuer', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: '自定义 OIDC' }))
    await user.type(
      await screen.findByLabelText('唯一 Provider Key'),
      'my-oidc',
    )
    await user.type(screen.getByLabelText('Client ID'), 'client-1')
    await user.type(screen.getByLabelText('Client Secret *'), 'secret-1')
    await user.type(
      screen.getByLabelText('Issuer URL'),
      'https://issuer.example.com',
    )
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('my-oidc', {
        kind: 'oidc',
        enabled: false,
        config: {
          client_id: 'client-1',
          issuer_url: 'https://issuer.example.com',
          client_secret: 'secret-1',
        },
      })
    })
  }, 10_000)

  it('requires a client secret when creating', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.type(await screen.findByLabelText('Client ID'), 'client-1')
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).not.toHaveBeenCalled()
    })
  })

  it('keeps the existing secret when editing without a new one', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'github',
          kind: 'oauth',
          enabled: true,
          configured: true,
          public_config: { client_id: 'client-1' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '编辑 github' }))
    await user.click(await screen.findByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('github', {
        kind: 'oauth',
        enabled: true,
        config: { client_id: 'client-1' },
      })
    })
  })

  it('toggles enablement while carrying existing public fields', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'google',
          kind: 'oidc',
          enabled: false,
          configured: true,
          public_config: { client_id: 'client-1' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch', { name: '启用 google' })
    await user.click(toggle)

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('google', {
        kind: 'oidc',
        enabled: true,
        config: { client_id: 'client-1' },
      })
    })
  })

  it('deletes a provider after confirmation', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'google',
          kind: 'oidc',
          enabled: false,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '删除 google' }))
    await user.click(await screen.findByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(apiMocks.remove).toHaveBeenCalledWith('google')
    })
  })

  it('runs a connectivity test for a provider', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'google',
          kind: 'oidc',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '测试 google 连通性' }),
    )
    await waitFor(() => {
      expect(apiMocks.test).toHaveBeenCalledWith('google')
    })
  })
})

describe('ProviderSection CAPTCHA provider management contract', () => {
  it('renders an empty hint when no captcha providers exist', async () => {
    renderSection()
    expect(await screen.findByText('还没有验证码提供商')).toBeInTheDocument()
  })

  it('creates a Turnstile CAPTCHA provider with site key and secret key', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建验证码提供商' }),
    )
    await user.type(screen.getByLabelText('Site Key'), '0x4AAAAAAA')
    await user.type(screen.getByLabelText('Secret Key *'), 'secret-1')
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('turnstile', {
        kind: 'captcha',
        config: {
          provider: 'turnstile',
          site_key: '0x4AAAAAAA',
          secret_key: 'secret-1',
        },
      })
    })
  })

  it('shows the localized label for the captcha type dropdown', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建验证码提供商' }),
    )
    const trigger = await screen.findByRole('combobox')
    expect(trigger).toHaveTextContent('Cloudflare Turnstile')
    expect(trigger).not.toHaveTextContent('turnstile')
    await user.click(trigger)
    await user.click(await screen.findByRole('option', { name: 'hCaptcha' }))
    expect(trigger).toHaveTextContent('hCaptcha')
  })

  it('creates a CAP provider with a required endpoint', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建验证码提供商' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'CAP' }))
    await user.type(screen.getByLabelText('Site Key'), 'cap-site-key')
    await user.type(screen.getByLabelText('Secret Key *'), 'secret-1')
    await user.type(
      screen.getByLabelText('Endpoint *'),
      'https://captcha.example.com',
    )
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('cap', {
        kind: 'captcha',
        config: {
          provider: 'cap',
          site_key: 'cap-site-key',
          endpoint: 'https://captcha.example.com',
          secret_key: 'secret-1',
        },
      })
    })
  })

  it('allows an optional endpoint for a non-CAP provider', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建验证码提供商' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'hCaptcha' }))
    await user.type(screen.getByLabelText('Site Key'), 'hcaptcha-site')
    await user.type(screen.getByLabelText('Secret Key *'), 'secret-1')
    await user.type(
      screen.getByLabelText('Endpoint'),
      'https://proxy.example.com/siteverify',
    )
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('hcaptcha', {
        kind: 'captcha',
        config: {
          provider: 'hcaptcha',
          site_key: 'hcaptcha-site',
          endpoint: 'https://proxy.example.com/siteverify',
          secret_key: 'secret-1',
        },
      })
    })
  })

  it('requires a secret key when creating a CAPTCHA provider', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建验证码提供商' }),
    )
    await user.type(screen.getByLabelText('Site Key'), '0x4AAAAAAA')
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).not.toHaveBeenCalled()
    })
  })

  it('keeps the existing secret when editing without a new one', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'turnstile',
          kind: 'captcha',
          configured: true,
          public_config: { provider: 'turnstile', site_key: '0x4AAAAAAA' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '编辑 turnstile' }),
    )
    await user.click(await screen.findByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('turnstile', {
        kind: 'captcha',
        config: { provider: 'turnstile', site_key: '0x4AAAAAAA' },
      })
    })
  })

  it('renders configured captcha provider rows without an enabled switch', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'turnstile',
          kind: 'captcha',
          configured: true,
          public_config: { provider: 'turnstile', site_key: '0x4AAAAAAA' },
        },
      ],
    })
    renderSection()
    expect(
      await screen.findByText('Cloudflare Turnstile · turnstile'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('switch', { name: '启用 turnstile' }),
    ).not.toBeInTheDocument()
  })

  it('deletes a captcha provider after confirmation', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'turnstile',
          kind: 'captcha',
          configured: true,
          public_config: { provider: 'turnstile', site_key: '0x4AAAAAAA' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '删除 turnstile' }),
    )
    await user.click(await screen.findByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(apiMocks.remove).toHaveBeenCalledWith('turnstile')
    })
  })
})

describe('ProviderSection create-option filtering', () => {
  it('hides the already-configured GitHub preset but keeps custom OIDC', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'github',
          kind: 'oauth',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await screen.findByRole('option', { name: '自定义 OIDC' })
    expect(
      screen.queryByRole('option', { name: 'GitHub' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Google' })).toBeInTheDocument()
  })

  it('hides both GitHub and Google presets when both are configured', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'github',
          kind: 'oauth',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
        {
          provider_key: 'google',
          kind: 'oidc',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await screen.findByRole('option', { name: '自定义 OIDC' })
    expect(
      screen.queryByRole('option', { name: 'GitHub' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'Google' }),
    ).not.toBeInTheDocument()
  })

  it('locks the preset and key when editing', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'google',
          kind: 'oidc',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '编辑 google' }))
    const trigger = await screen.findByRole('combobox')
    // 编辑时预设下拉被锁定，且显示当前预设的翻译名。
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveTextContent('Google')
    await user.click(trigger)
    expect(
      screen.queryByRole('option', { name: '自定义 OIDC' }),
    ).not.toBeInTheDocument()
  })

  it('hides the already-configured CAPTCHA type from the create dropdown', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'turnstile',
          kind: 'captcha',
          configured: true,
          public_config: { provider: 'turnstile', site_key: '0x4AAAAAAA' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建验证码提供商' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await screen.findByRole('option', { name: 'hCaptcha' })
    expect(
      screen.queryByRole('option', { name: 'Cloudflare Turnstile' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Google reCAPTCHA' }),
    ).toBeInTheDocument()
  })

  it('disables CAPTCHA creation when every fixed type is configured', async () => {
    apiMocks.list.mockResolvedValue({
      providers: ['turnstile', 'recaptcha', 'hcaptcha', 'cap'].map(
        (provider) => ({
          provider_key: provider,
          kind: 'captcha',
          configured: true,
          public_config: { provider, site_key: '0x4AAAAAAA' },
        }),
      ),
    })
    renderSection()
    await screen.findByText('Cloudflare Turnstile · turnstile')
    const createButton = await screen.findByRole('button', {
      name: '新建验证码提供商',
    })
    expect(createButton).toBeDisabled()
    expect(createButton).toHaveAttribute('title', '所有验证码类型都已配置')
  })

  it('restores a removed CAPTCHA type after deletion reload', async () => {
    apiMocks.list.mockResolvedValueOnce({
      providers: ['turnstile', 'recaptcha', 'hcaptcha', 'cap'].map(
        (provider) => ({
          provider_key: provider,
          kind: 'captcha',
          configured: true,
          public_config: { provider, site_key: '0x4AAAAAAA' },
        }),
      ),
    })
    apiMocks.list.mockResolvedValueOnce({
      providers: ['turnstile', 'recaptcha', 'hcaptcha'].map((provider) => ({
        provider_key: provider,
        kind: 'captcha',
        configured: true,
        public_config: { provider, site_key: '0x4AAAAAAA' },
      })),
    })
    renderSection()
    const user = userEvent.setup()
    await screen.findByText('Cloudflare Turnstile · turnstile')
    expect(
      screen.getByRole('button', { name: '新建验证码提供商' }),
    ).toBeDisabled()
    // 删除 cap 后重新查询，固定类型重新出现。
    await user.click(await screen.findByRole('button', { name: '删除 cap' }))
    await user.click(await screen.findByRole('button', { name: '确认删除' }))
    const createButton = await screen.findByRole('button', {
      name: '新建验证码提供商',
    })
    expect(createButton).toBeEnabled()
  })

  it('defaults to the next available preset (Google) when GitHub is already configured', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'github',
          kind: 'oauth',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    const trigger = await screen.findByRole('combobox')
    expect(trigger).toHaveTextContent('Google')
    expect(trigger).not.toHaveTextContent('GitHub')
  })

  it('defaults to custom OIDC when all fixed auth presets are already configured', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        'github',
        'google',
        'gitlab',
        'gitea',
        'mastodon',
        'microsoft',
        'twitter',
        'discord',
        'apple',
        'line',
      ].map((key) => ({
        provider_key: key,
        kind:
          key === 'github' ||
          key === 'mastodon' ||
          key === 'twitter' ||
          key === 'discord'
            ? 'oauth'
            : 'oidc',
        enabled: true,
        configured: true,
        public_config: { client_id: 'c' },
      })),
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    const trigger = await screen.findByRole('combobox')
    expect(trigger).toHaveTextContent('自定义 OIDC')
  })

  it('defaults to the next available captcha type (Google reCAPTCHA) when Turnstile is already configured', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'turnstile',
          kind: 'captcha',
          configured: true,
          public_config: { provider: 'turnstile', site_key: '0x4AAAAAAA' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建验证码提供商' }),
    )
    const trigger = await screen.findByRole('combobox')
    expect(trigger).toHaveTextContent('Google reCAPTCHA')
    expect(trigger).not.toHaveTextContent('Cloudflare Turnstile')
  })
})

describe('ProviderSection preset-driven create/edit contract', () => {
  it('hides an already-configured fixed preset like GitLab but keeps custom OIDC', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'gitlab',
          kind: 'oidc',
          enabled: true,
          configured: true,
          public_config: { client_id: 'c' },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await screen.findByRole('option', { name: '自定义 OIDC' })
    expect(
      screen.queryByRole('option', { name: 'GitLab' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mastodon' })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: '自定义 OIDC' }),
    ).toBeInTheDocument()
  })

  it('renders preset-specific fields for GitLab: instance URL without issuer URL', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'GitLab' }))
    expect(screen.getByLabelText('Instance URL')).toBeInTheDocument()
    expect(screen.queryByLabelText('Issuer URL')).not.toBeInTheDocument()
  })

  it('creates a GitLab provider with the default instance URL', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'GitLab' }))
    await user.type(screen.getByLabelText('Client ID'), 'client-gitlab')
    await user.type(screen.getByLabelText('Client Secret *'), 'secret-1')
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('gitlab', {
        kind: 'oidc',
        enabled: false,
        config: {
          client_id: 'client-gitlab',
          instance_url: 'https://gitlab.com',
          client_secret: 'secret-1',
        },
      })
    })
  }, 10_000)

  it('requires an explicit instance URL when creating a Gitea provider', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Gitea' }))
    await user.type(screen.getByLabelText('Client ID'), 'client-gitea')
    await user.type(screen.getByLabelText('Client Secret *'), 'secret-1')
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).not.toHaveBeenCalled()
    })
  }, 10_000)

  it('renders Apple fields: Services ID, Team ID, Key ID and multiline Private Key', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Apple' }))
    expect(screen.getByLabelText('Services ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Team ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Key ID')).toBeInTheDocument()
    expect(screen.getByLabelText('Private Key *')).toBeInTheDocument()
    expect(screen.queryByLabelText('Issuer URL')).not.toBeInTheDocument()
  })

  it('creates an Apple provider with team_id, key_id and a multiline private_key', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '新建登录入口' }),
    )
    await user.click(await screen.findByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Apple' }))
    await user.type(screen.getByLabelText('Services ID'), 'com.example.app')
    await user.type(screen.getByLabelText('Team ID'), 'TEAM123456')
    await user.type(screen.getByLabelText('Key ID'), 'KEY123456')
    await user.type(
      screen.getByLabelText('Private Key *'),
      '-----BEGIN PRIVATE KEY-----{enter}MIGHAgEA{enter}-----END PRIVATE KEY-----',
    )
    await user.click(screen.getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('apple', {
        kind: 'oidc',
        enabled: false,
        config: {
          client_id: 'com.example.app',
          team_id: 'TEAM123456',
          key_id: 'KEY123456',
          private_key:
            '-----BEGIN PRIVATE KEY-----\nMIGHAgEA\n-----END PRIVATE KEY-----',
        },
      })
    })
  }, 10_000)

  it('edits an Apple provider: preloads public fields and omits the blank private key', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'apple',
          kind: 'oidc',
          enabled: true,
          configured: true,
          public_config: {
            client_id: 'com.example.app',
            team_id: 'TEAM123456',
            key_id: 'KEY123456',
          },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '编辑 apple' }))
    // 只回显公开字段；机密信息永不显示，留空提交表示保留现有值。
    expect(screen.getByLabelText('Services ID')).toHaveValue('com.example.app')
    expect(screen.getByLabelText('Team ID')).toHaveValue('TEAM123456')
    expect(screen.getByLabelText('Key ID')).toHaveValue('KEY123456')
    expect(screen.getByLabelText('Private Key')).toHaveValue('')
    await user.click(await screen.findByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('apple', {
        kind: 'oidc',
        enabled: true,
        config: {
          client_id: 'com.example.app',
          team_id: 'TEAM123456',
          key_id: 'KEY123456',
        },
      })
    })
  })

  it('preserves the multiline Apple private key when replacing it on edit', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'apple',
          kind: 'oidc',
          enabled: true,
          configured: true,
          public_config: {
            client_id: 'com.example.app',
            team_id: 'TEAM123456',
            key_id: 'KEY123456',
          },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '编辑 apple' }))
    await user.type(screen.getByLabelText('Private Key'), 'line-1{enter}line-2')
    await user.click(await screen.findByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('apple', {
        kind: 'oidc',
        enabled: true,
        config: {
          client_id: 'com.example.app',
          team_id: 'TEAM123456',
          key_id: 'KEY123456',
          private_key: 'line-1\nline-2',
        },
      })
    })
  }, 10_000)

  it('toggles enablement while carrying every public config string', async () => {
    apiMocks.list.mockResolvedValue({
      providers: [
        {
          provider_key: 'apple',
          kind: 'oidc',
          enabled: false,
          configured: true,
          public_config: {
            client_id: 'com.example.app',
            team_id: 'TEAM123456',
            key_id: 'KEY123456',
          },
        },
      ],
    })
    renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: '启用 apple' }))

    await waitFor(() => {
      expect(apiMocks.upsert).toHaveBeenCalledWith('apple', {
        kind: 'oidc',
        enabled: true,
        config: {
          client_id: 'com.example.app',
          team_id: 'TEAM123456',
          key_id: 'KEY123456',
        },
      })
    })
  })
})
