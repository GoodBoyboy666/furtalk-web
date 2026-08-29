// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/pages/login.index'
import type { CaptchaConfigResponse, Me } from '@/lib/api/types'
import { pendingRecordKey, pendingRecordTTLMs } from '@/lib/authorize'
import { otpRecordKey } from '@/lib/otp'
import { defaultPublicConfig } from '@/lib/public-config'

// apiMocks 是 API 模块的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => {
  const search: Record<string, unknown> = {}
  return {
    passwordLogin: vi.fn(),
    emailCodeSend: vi.fn(),
    emailCodeLogin: vi.fn(),
    passkeyOptions: vi.fn(),
    passkeyVerify: vi.fn(),
    captchaConfig: vi.fn(),
    me: vi.fn(),
    providers: vi.fn(),
    oauthStart: vi.fn(),
    publicConfig: vi.fn(),
    navigate: vi.fn(),
    search,
  }
})

// 模拟路由与 API，避免真实导航和网络。
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => apiMocks.navigate,
  useSearch: () => apiMocks.search,
  Link: ({
    to,
    className,
    children,
  }: {
    to: string
    className?: string
    children: React.ReactNode
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('@/lib/api/resources', () => ({
  authApi: {
    passwordLogin: apiMocks.passwordLogin,
    emailCodeSend: apiMocks.emailCodeSend,
    emailCodeLogin: apiMocks.emailCodeLogin,
    passkeyOptions: apiMocks.passkeyOptions,
    passkeyVerify: apiMocks.passkeyVerify,
    me: apiMocks.me,
    providers: apiMocks.providers,
    oauthStart: apiMocks.oauthStart,
  },
  captchaApi: {
    config: apiMocks.captchaConfig,
  },
  publicConfigApi: {
    get: apiMocks.publicConfig,
  },
}))
vi.mock('@/lib/passkey', () => ({
  isPasskeySupported: () => true,
  prepareCredentialRequestOptions: (options: unknown) => options,
  serializeCredential: (credential: unknown) => ({ credential }),
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

const adminMe: Me = {
  id: '1',
  email: 'admin@example.com',
  nickname: 'Admin',
  website_url: null,
  avatar_url: '',
  role: 'admin',
  status: 'active',
  email_verified: true,
  has_password: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  notification_preferences: { moderation_enabled: false, reply_enabled: false },
}

const userMe: Me = {
  ...adminMe,
  id: '2',
  email: 'user@example.com',
  role: 'user',
}

function renderLogin(
  config: CaptchaConfigResponse,
  search: Record<string, unknown> = {},
) {
  // 按 action 路由 CAPTCHA 配置：email_code 与 email_code_login 默认关闭，
  // 其余 action 返回测试传入的 config，避免验证码控件在既有用例中重复出现。
  apiMocks.captchaConfig.mockImplementation((action: string) => {
    if (action === 'email_code' || action === 'email_code_login') {
      return Promise.resolve({ required: false })
    }
    return Promise.resolve(config)
  })
  apiMocks.search = { ...search }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>,
  )
}

// renderLoginWithCaptchaActions 按 action 返回测试配置，用于断言
// 密码登录与邮箱验证码两条链路的 CAPTCHA 展示互斥。
function renderLoginWithCaptchaActions(
  configs: Record<string, CaptchaConfigResponse>,
) {
  apiMocks.captchaConfig.mockImplementation((action: string) =>
    Promise.resolve(configs[action] ?? { required: false }),
  )
  apiMocks.search = {}
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>,
  )
}

// openEmailCodeTab 切到邮箱验证码 Tab（base-ui 渲染 role=tab）。
async function openEmailCodeTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: '邮箱验证码' }))
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: '发送验证码' }),
    ).toBeInTheDocument()
  })
}

// openPasswordTab 切到密码登录 Tab，供需要密码表单的用例使用。
async function openPasswordTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: '密码登录' }))
  await waitFor(() => {
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
  })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  sessionStorage.clear()
  apiMocks.search = {}
  apiMocks.passwordLogin.mockResolvedValue(undefined)
  apiMocks.emailCodeSend.mockResolvedValue(undefined)
  apiMocks.emailCodeLogin.mockResolvedValue(undefined)
  apiMocks.passkeyOptions.mockResolvedValue({
    challenge: 'c',
    options: {},
  })
  apiMocks.passkeyVerify.mockResolvedValue(undefined)
  apiMocks.me.mockResolvedValue(adminMe)
  apiMocks.providers.mockResolvedValue({ providers: [] })
  apiMocks.oauthStart.mockResolvedValue({
    auth_url: 'https://github.example/auth',
  })
  apiMocks.publicConfig.mockResolvedValue(defaultPublicConfig)
})

afterEach(() => {
  delete (navigator as { credentials?: unknown }).credentials
})

describe('LoginPage default login method', () => {
  it('activates 邮箱验证码 as the first tab and shows the send-code flow on first render', async () => {
    renderLogin({ required: false })
    const emailCodeTab = screen.getByRole('tab', { name: '邮箱验证码' })
    const passwordTab = screen.getByRole('tab', { name: '密码登录' })
    // 邮箱验证码必须是视觉顺序第一且默认选中。
    expect(emailCodeTab).toHaveAttribute('aria-selected', 'true')
    expect(passwordTab).toHaveAttribute('aria-selected', 'false')
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveTextContent('邮箱验证码')
    expect(tabs[1]).toHaveTextContent('密码登录')
    // 首屏直接进入发送验证码流程，密码表单未挂载。
    expect(
      screen.getByRole('button', { name: '发送验证码' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送验证码' })).toHaveClass(
      'bg-primary',
    )
    expect(document.querySelector('svg.lucide-paw-print')).not.toBeNull()
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
  })

  it('keeps the password form usable after switching tabs', async () => {
    renderLogin({ required: false })
    const user = userEvent.setup()
    await openPasswordTab(user)
    expect(screen.getByLabelText('密码')).toBeInTheDocument()
    const passwordLabel = screen.getByText('密码', { selector: 'label' })
    const forgotPassword = screen.getByRole('link', { name: '忘记密码？' })
    expect(forgotPassword).toBeInTheDocument()
    expect(
      passwordLabel.compareDocumentPosition(forgotPassword) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(forgotPassword.parentElement).toContainElement(passwordLabel)
  })

  it('places legal consent immediately above each tab primary action', async () => {
    apiMocks.publicConfig.mockResolvedValue({
      ...defaultPublicConfig,
      user_agreement_url: 'https://example.com/terms',
      privacy_policy_url: 'https://example.com/privacy',
    })
    renderLogin({ required: false })
    const user = userEvent.setup()
    const send = screen.getByRole('button', { name: '发送验证码' })
    const emailConsent = await screen.findByRole('checkbox', {
      name: /我已阅读并同意/,
    })
    expect(
      emailConsent.compareDocumentPosition(send) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await openPasswordTab(user)
    const passwordSubmit = screen.getByRole('button', { name: '登录' })
    const passwordConsent = screen.getByRole('checkbox', {
      name: /我已阅读并同意/,
    })
    expect(
      passwordConsent.compareDocumentPosition(passwordSubmit) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(
      screen.getByRole('checkbox', { name: /我已阅读并同意/ }).closest('div'),
    ).not.toHaveClass('rounded-md', 'border', 'bg-muted/30', 'p-3')
  })
})

describe('LoginPage CAPTCHA gating', () => {
  it('submits email and password without a token when the policy is disabled', async () => {
    renderLogin({ required: false })
    const user = userEvent.setup()
    await openPasswordTab(user)
    await user.type(screen.getByLabelText('邮箱'), 'admin@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(apiMocks.passwordLogin.mock.calls[0][0]).toEqual({
        email: 'admin@example.com',
        password: 'secret',
        captcha_token: undefined,
      })
    })
  })

  it('opens the captcha dialog and submits the pending password login once after solving', async () => {
    renderLogin({
      required: true,
      captcha: { provider: 'turnstile', site_key: 'ts-site' },
    })
    const user = userEvent.setup()
    await openPasswordTab(user)
    // 表单内不存在内联挑战，提交按钮保持可用。
    expect(screen.queryByTestId('challenge-turnstile')).not.toBeInTheDocument()
    const submit = screen.getByRole('button', { name: '登录' })
    expect(submit).toBeEnabled()

    await user.type(screen.getByLabelText('邮箱'), 'admin@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(submit)

    // 本地字段有效后才打开对话框并挂载挑战。
    await waitFor(() => {
      expect(screen.getByTestId('challenge-turnstile')).toBeInTheDocument()
    })
    expect(apiMocks.passwordLogin).not.toHaveBeenCalled()

    // 解决后只提交一次，载荷携带 solved token，对话框关闭。
    await user.click(screen.getByTestId('challenge-turnstile'))
    await waitFor(() => {
      expect(apiMocks.passwordLogin.mock.calls[0][0]).toEqual({
        email: 'admin@example.com',
        password: 'secret',
        captcha_token: 'solved-token',
      })
    })
    expect(apiMocks.passwordLogin).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(
        screen.queryByTestId('challenge-turnstile'),
      ).not.toBeInTheDocument()
    })
  })

  it('does not submit when the captcha dialog is cancelled', async () => {
    renderLogin({
      required: true,
      captcha: { provider: 'turnstile', site_key: 'ts-site' },
    })
    const user = userEvent.setup()
    await openPasswordTab(user)
    await user.type(screen.getByLabelText('邮箱'), 'admin@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-turnstile')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => {
      expect(
        screen.queryByTestId('challenge-turnstile'),
      ).not.toBeInTheDocument()
    })
    expect(apiMocks.passwordLogin).not.toHaveBeenCalled()
  })

  it('queries the public config by the password_login action', async () => {
    renderLogin({ required: false })
    await waitFor(() => {
      expect(apiMocks.captchaConfig).toHaveBeenCalledWith('password_login')
    })
  })

  it('offers a forgot-password link to the reset page', async () => {
    renderLogin({ required: false })
    const user = userEvent.setup()
    await openPasswordTab(user)
    const link = screen.getByRole('link', { name: '忘记密码？' })
    expect(link.getAttribute('href')).toBe('/reset-password')
  })

  it('keeps each action dialog isolated and mounts challenges only while open', async () => {
    renderLoginWithCaptchaActions({
      password_login: {
        required: true,
        captcha: { provider: 'turnstile', site_key: 'ts-site' },
      },
      email_code: {
        required: true,
        captcha: { provider: 'hcaptcha', site_key: 'hc-site' },
      },
    })
    const user = userEvent.setup()

    // 表单内不存在任何内联挑战，挑战只在对应对话框打开时挂载。
    expect(screen.queryByTestId('challenge-hcaptcha')).not.toBeInTheDocument()
    expect(screen.queryByTestId('challenge-turnstile')).not.toBeInTheDocument()

    // email_code 发送对话框：解决后写入 OTP 记录并跳转，挑战随对话框关闭卸载。
    await user.type(screen.getByLabelText('邮箱'), 'visitor@example.com')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-hcaptcha')).toBeInTheDocument()
    })
    expect(apiMocks.emailCodeSend).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('challenge-hcaptcha'))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({ to: '/login/otp' })
    })
    expect(screen.queryByTestId('challenge-hcaptcha')).not.toBeInTheDocument()

    // 密码 Tab：password_login 对话框独立。
    await openPasswordTab(user)
    const emailInput = screen.getByLabelText('邮箱')
    // 邮箱 state 在 Tab 间共享，密码 Tab 已预填发送阶段的邮箱，先清空再输入。
    await user.clear(emailInput)
    await user.type(emailInput, 'admin@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-turnstile')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('challenge-turnstile'))
    await waitFor(() => {
      expect(apiMocks.passwordLogin).toHaveBeenCalledTimes(1)
    })
  })
})

describe('LoginPage role-aware redirect', () => {
  it('sends admins to /admin after password login', async () => {
    renderLogin({ required: false })
    const user = userEvent.setup()
    await openPasswordTab(user)
    await user.type(screen.getByLabelText('邮箱'), 'admin@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({ href: '/admin' })
    })
  })

  it('sends ordinary users to /account/comments after password login', async () => {
    apiMocks.me.mockResolvedValue(userMe)
    renderLogin({ required: false })
    const user = userEvent.setup()
    await openPasswordTab(user)
    await user.type(screen.getByLabelText('邮箱'), 'user@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        href: '/account/comments',
      })
    })
  })
})

describe('LoginPage passkey contract', () => {
  it('passes the full top-level WebAuthn options to navigator.credentials.get', async () => {
    const envelope = {
      publicKey: {
        challenge: 'Y2hhbGxlbmdlLWJ5dGVz',
        rpId: 'furtalk.example.com',
        allowCredentials: [],
      },
      mediation: 'optional',
    }
    apiMocks.passkeyOptions.mockResolvedValue({
      challenge: 'c',
      options: envelope,
    })
    const getMock = vi.fn().mockResolvedValue({
      id: 'cred-id',
      type: 'public-key',
      rawId: new Uint8Array([1]).buffer,
      response: { clientDataJSON: new Uint8Array([2]).buffer },
    })
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { get: getMock },
    })

    renderLogin({ required: false })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '使用 passkey 登录' }))

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.passkeyOptions).toHaveBeenCalledWith()
    // 断言传给浏览器 API 的是 { publicKey, mediation } 顶层对象，
    // 而不是把 options 再包一层产生的 { publicKey: { publicKey: ... } }。
    const passed = getMock.mock.calls[0][0]
    expect(passed).toEqual(envelope)
    expect(passed.publicKey).not.toHaveProperty('publicKey')
    await waitFor(() => {
      expect(apiMocks.passkeyVerify).toHaveBeenCalled()
    })
  })
})

describe('LoginPage third-party provider contract', () => {
  it('renders public providers and starts a login flow in the same window', async () => {
    apiMocks.providers.mockResolvedValue({
      providers: [{ key: 'github', kind: 'oauth', name: 'GitHub' }],
    })
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'http://furtalk.local/login' },
    })
    try {
      renderLogin({ required: false })
      const user = userEvent.setup()
      await user.click(
        await screen.findByRole('button', { name: '使用 GitHub 登录' }),
      )
      await waitFor(() => {
        expect(apiMocks.oauthStart).toHaveBeenCalledWith(
          'github',
          'login',
          undefined,
        )
      })
      await waitFor(() => {
        expect(window.location.href).toBe('https://github.example/auth')
      })
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it('hides the third-party area when no providers are available', async () => {
    apiMocks.providers.mockResolvedValue({ providers: [] })
    renderLogin({ required: false })
    await waitFor(() => {
      expect(apiMocks.providers).toHaveBeenCalled()
    })
    expect(screen.queryByText('第三方登录')).not.toBeInTheDocument()
  })
})

describe('LoginPage email-code flow', () => {
  it('sends an email code, writes the OTP record and navigates to the OTP route', async () => {
    renderLogin({ required: false })
    const user = userEvent.setup()
    await openEmailCodeTab(user)
    await user.type(screen.getByLabelText('邮箱'), 'visitor@example.com')
    await user.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => {
      expect(apiMocks.emailCodeSend).toHaveBeenCalledWith({
        email: 'visitor@example.com',
        captcha_token: undefined,
      })
    })
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({ to: '/login/otp' })
    })
    // 待登录上下文写入 sessionStorage：邮箱只存记录，绝不进入 URL。
    const record = JSON.parse(sessionStorage.getItem(otpRecordKey) ?? 'null')
    expect(record).toMatchObject({
      version: 1,
      email: 'visitor@example.com',
      authorize: false,
    })
    expect(apiMocks.search).not.toHaveProperty('email')
    // 登录页不再渲染内联验证码输入。
    expect(screen.queryByLabelText('验证码')).not.toBeInTheDocument()
  })

  it('does not send a code when the email is empty', async () => {
    renderLogin({ required: false })
    const user = userEvent.setup()
    await openEmailCodeTab(user)
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    expect(apiMocks.emailCodeSend).not.toHaveBeenCalled()
    expect(screen.getByText('请先填写邮箱')).toBeInTheDocument()
  })

  it('shows the expired-session notice when returning from the OTP route', async () => {
    renderLogin({ required: false }, { otp: 'expired' })
    expect(
      screen.getByText('登录会话已过期，请重新发送验证码。'),
    ).toBeInTheDocument()
    // 用户重新编辑邮箱即视为开始新会话，提示消失。
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('邮箱'), 'a')
    expect(
      screen.queryByText('登录会话已过期，请重新发送验证码。'),
    ).not.toBeInTheDocument()
  })
})

describe('LoginPage authorization flow', () => {
  const requestId = 'AQEBAQEBAQEBAQEBAQEBAQ'
  const authorizeRedirect = `/authorize?site_id=123&request_id=${requestId}`
  const record = {
    version: 2,
    site_id: '123',
    request_id: requestId,
    embedding_origin: 'https://embed.example',
    email: 'visitor@example.com',
    expires_at: new Date(Date.now() + pendingRecordTTLMs).toISOString(),
  }

  it('prefills the email from the popup pending record without a URL hint', async () => {
    sessionStorage.setItem(pendingRecordKey(requestId), JSON.stringify(record))
    renderLogin(
      { required: false },
      { authorize: '1', redirect: authorizeRedirect },
    )

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toHaveValue('visitor@example.com')
    })
    expect(apiMocks.search).not.toHaveProperty('email')
  })

  it('keeps the pending OTP record free of profile hints and carries the authorize markers', async () => {
    sessionStorage.setItem(pendingRecordKey(requestId), JSON.stringify(record))
    renderLogin(
      { required: false },
      { authorize: '1', redirect: authorizeRedirect },
    )
    const user = userEvent.setup()

    await openEmailCodeTab(user)
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({ to: '/login/otp' })
    })
    // OTP 记录携带授权 marker 与安全回跳，但绝不包含任何资料提示字段。
    const stored = JSON.parse(sessionStorage.getItem(otpRecordKey) ?? 'null')
    expect(stored).not.toHaveProperty('nickname')
    expect(stored).not.toHaveProperty('website_url')
    expect(stored).toMatchObject({
      version: 1,
      email: 'visitor@example.com',
      authorize: true,
      redirect: authorizeRedirect,
    })
  })

  it('preserves the /authorize redirect after password login', async () => {
    renderLogin(
      { required: false },
      { authorize: '1', redirect: authorizeRedirect },
    )
    const user = userEvent.setup()
    await openPasswordTab(user)
    await user.type(screen.getByLabelText('邮箱'), 'admin@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        href: authorizeRedirect,
      })
    })
  })

  it('keeps the password login payload free of profile hints', async () => {
    sessionStorage.setItem(pendingRecordKey(requestId), JSON.stringify(record))
    renderLogin(
      { required: false },
      { authorize: '1', redirect: authorizeRedirect },
    )
    const user = userEvent.setup()
    await openPasswordTab(user)
    const emailInput = screen.getByLabelText('邮箱')
    // 授权流程预填了 pending 记录的邮箱；等待预填后改为手动输入密码登录邮箱。
    await waitFor(() => expect(emailInput).toHaveValue('visitor@example.com'))
    await user.clear(emailInput)
    await user.type(emailInput, 'admin@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '登录' }))

    // 密码登录 mutation 直接绑定 authApi.passwordLogin，react-query 会传入
    // 第二个 context 参数，因此与既有用例一样只断言第一个参数。
    await waitFor(() => {
      expect(apiMocks.passwordLogin.mock.calls[0][0]).toEqual({
        email: 'admin@example.com',
        password: 'secret',
        captcha_token: undefined,
      })
    })
  })
})
