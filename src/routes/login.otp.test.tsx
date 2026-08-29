// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginOtpPage } from '@/pages/login.otp'
import type { CaptchaConfigResponse, Me } from '@/lib/api/types'
import {
  createOtpRecord,
  otpRecordKey,
  safeOtpSessionStorage,
  writeOtpRecord,
} from '@/lib/otp'

// input-otp 在挂载时用 ResizeObserver 跟踪根高度；jsdom 未实现，测试环境补充最小桩。
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  writable: true,
  value: ResizeObserverStub,
})
// input-otp 的密码管理器徽章逻辑通过定时器调用 document.elementFromPoint，
// jsdom 未实现该方法，补充最小桩避免未捕获异常。
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => null
}

// apiMocks 是 API 模块的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => {
  const search: Record<string, unknown> = {}
  return {
    emailCodeSend: vi.fn(),
    emailCodeLogin: vi.fn(),
    captchaConfig: vi.fn(),
    me: vi.fn(),
    navigate: vi.fn(),
    search,
  }
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => apiMocks.navigate,
  useSearch: () => apiMocks.search,
}))
vi.mock('@/lib/api/resources', () => ({
  authApi: {
    emailCodeSend: apiMocks.emailCodeSend,
    emailCodeLogin: apiMocks.emailCodeLogin,
    me: apiMocks.me,
  },
  captchaApi: {
    config: apiMocks.captchaConfig,
  },
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

// seedRecord 在渲染前写入一条有效的 pending OTP 记录。
function seedRecord(
  options: {
    email?: string
    redirect?: string
    authorize?: boolean
    now?: Date
  } = {},
) {
  const record = createOtpRecord({
    email: options.email ?? 'visitor@example.com',
    redirect: options.redirect,
    authorize: options.authorize ?? false,
    now: options.now,
  })
  writeOtpRecord(safeOtpSessionStorage(), record)
  return record
}

function renderOtp(
  configs: Record<string, CaptchaConfigResponse>,
  strictMode = false,
) {
  apiMocks.captchaConfig.mockImplementation((action: string) =>
    Promise.resolve(configs[action] ?? { required: false }),
  )
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const content = (
    <QueryClientProvider client={queryClient}>
      <LoginOtpPage />
    </QueryClientProvider>
  )
  return render(strictMode ? <StrictMode>{content}</StrictMode> : content)
}

// typeCode 在 OTP 输入中键入验证码。
async function typeCode(
  user: ReturnType<typeof userEvent.setup>,
  code: string,
) {
  await user.type(screen.getByLabelText('验证码'), code)
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  sessionStorage.clear()
  apiMocks.search = {}
  apiMocks.emailCodeSend.mockResolvedValue(undefined)
  apiMocks.emailCodeLogin.mockResolvedValue(undefined)
  apiMocks.me.mockResolvedValue(adminMe)
})

describe('LoginOtpPage record guard', () => {
  it('renders the masked destination and six OTP slots for a valid record', async () => {
    seedRecord({ email: 'visitor@example.com' })
    const { container } = renderOtp({})
    expect(screen.getByText(/v\*\*\*@example\.com/)).toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-slot="input-otp-slot"]'),
    ).toHaveLength(6)
    expect(screen.queryByText(/我已阅读并同意/)).not.toBeInTheDocument()
  })

  it('auto-submits exactly once after all six digits are present', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: '登录' })).toBeDisabled()
    await typeCode(user, '123')
    expect(screen.getByRole('button', { name: '登录' })).toBeDisabled()
    await typeCode(user, '456')
    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.emailCodeLogin).toHaveBeenCalledWith({
      email: 'visitor@example.com',
      code: '123456',
      captcha_token: undefined,
    })
  })

  it('auto-submits a pasted complete code', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    const input = screen.getByLabelText('验证码')
    await user.click(input)
    await user.paste('654321')

    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.emailCodeLogin).toHaveBeenCalledWith({
      email: 'visitor@example.com',
      code: '654321',
      captcha_token: undefined,
    })
  })

  it('deduplicates automatic verification under StrictMode', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({}, true)
    const user = userEvent.setup()
    await typeCode(user, '123456')

    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
  })

  it('does not submit another request while verification is pending', async () => {
    let resolveLogin: (() => void) | undefined
    apiMocks.emailCodeLogin.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve
        }),
    )
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    await typeCode(user, '123456')

    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: '登录' })).toBeDisabled()
    })
    resolveLogin?.()
    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
  })

  it('navigates back to /login with the expired marker when the record is missing', async () => {
    renderOtp({})
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/login',
        search: { otp: 'expired' },
      })
    })
  })

  it('navigates back to /login and clears the record when it is expired', async () => {
    seedRecord({ now: new Date(Date.now() - 6 * 60 * 1000) })
    renderOtp({})
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/login',
        search: { otp: 'expired' },
      })
    })
    expect(sessionStorage.getItem(otpRecordKey)).toBeNull()
  })

  it('navigates back to /login and clears the record when it is malformed', async () => {
    sessionStorage.setItem(otpRecordKey, '{broken')
    renderOtp({})
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/login',
        search: { otp: 'expired' },
      })
    })
    expect(sessionStorage.getItem(otpRecordKey)).toBeNull()
  })
})

describe('LoginOtpPage verify flow', () => {
  it('submits the code without a token when the policy is off and deletes the record', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    await typeCode(user, '123456')

    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledWith({
        email: 'visitor@example.com',
        code: '123456',
        captcha_token: undefined,
      })
    })
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({ href: '/admin' })
    })
    expect(sessionStorage.getItem(otpRecordKey)).toBeNull()
  })

  it('navigates to the safe redirect carried in the record', async () => {
    seedRecord({ email: 'visitor@example.com', redirect: '/account/comments' })
    renderOtp({})
    const user = userEvent.setup()
    await typeCode(user, '123456')

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        href: '/account/comments',
      })
    })
  })

  it('sends ordinary users to the account comments default', async () => {
    seedRecord({ email: 'visitor@example.com' })
    apiMocks.me.mockResolvedValue(userMe)
    renderOtp({})
    const user = userEvent.setup()
    await typeCode(user, '123456')

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        href: '/account/comments',
      })
    })
  })

  it('opens the email_code_login dialog and submits the pending verify once after solving', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({
      email_code_login: {
        required: true,
        captcha: { provider: 'recaptcha', site_key: 'rc-site' },
      },
    })
    const user = userEvent.setup()
    await typeCode(user, '123456')

    await waitFor(() => {
      expect(screen.getByTestId('challenge-recaptcha')).toBeInTheDocument()
    })
    expect(apiMocks.emailCodeLogin).not.toHaveBeenCalled()
    await user.click(screen.getByTestId('challenge-recaptcha'))
    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.emailCodeLogin.mock.calls[0][0]).toEqual({
      email: 'visitor@example.com',
      code: '123456',
      captcha_token: 'solved-token',
    })
  })

  it('does not submit verify when the email_code_login dialog is cancelled', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({
      email_code_login: {
        required: true,
        captcha: { provider: 'recaptcha', site_key: 'rc-site' },
      },
    })
    const user = userEvent.setup()
    await typeCode(user, '123456')
    await waitFor(() => {
      expect(screen.getByTestId('challenge-recaptcha')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => {
      expect(
        screen.queryByTestId('challenge-recaptcha'),
      ).not.toBeInTheDocument()
    })
    expect(apiMocks.emailCodeLogin).not.toHaveBeenCalled()
  })

  it('keeps the code after automatic failure and allows manual recovery', async () => {
    apiMocks.emailCodeLogin
      .mockRejectedValueOnce(new Error('invalid code'))
      .mockResolvedValueOnce(undefined)
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    const input = screen.getByLabelText<HTMLInputElement>('验证码')
    await typeCode(user, '123456')

    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
      expect(input).toHaveValue('123456')
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登录' })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(2)
    })
  })

  it('auto-retries a changed code after the first attempt fails', async () => {
    apiMocks.emailCodeLogin
      .mockRejectedValueOnce(new Error('invalid code'))
      .mockResolvedValueOnce(undefined)
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    const input = screen.getByLabelText<HTMLInputElement>('验证码')
    await typeCode(user, '123456')
    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登录' })).toBeEnabled()
    })

    await user.clear(input)
    await user.type(input, '654321')
    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(2)
    })
    expect(apiMocks.emailCodeLogin.mock.calls[1][0]).toEqual({
      email: 'visitor@example.com',
      code: '654321',
      captcha_token: undefined,
    })
  })

  it('keeps a cancelled CAPTCHA attempt recoverable through the manual button', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({
      email_code_login: {
        required: true,
        captcha: { provider: 'recaptcha', site_key: 'rc-site' },
      },
    })
    const user = userEvent.setup()
    const input = screen.getByLabelText<HTMLInputElement>('验证码')
    await typeCode(user, '123456')
    await waitFor(() => {
      expect(screen.getByTestId('challenge-recaptcha')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(input).toHaveValue('123456')
    expect(apiMocks.emailCodeLogin).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-recaptcha')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('challenge-recaptcha'))
    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
  })
})

describe('LoginOtpPage resend flow', () => {
  it('disables resend while pending and announces success after it resolves', async () => {
    let resolveSend: (() => void) | undefined
    apiMocks.emailCodeSend.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve
        }),
    )
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    const resend = screen.getByRole('button', { name: '重新发送' })
    expect(resend).toBeEnabled()
    await user.click(resend)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '正在发送…' })).toBeDisabled()
    })
    resolveSend?.()
    await waitFor(() => {
      expect(screen.getByText('验证码已重新发送。')).toBeInTheDocument()
    })
  })

  it('refreshes the record expiry and clears the code on resend success', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const before = JSON.parse(sessionStorage.getItem(otpRecordKey) ?? 'null')
    const user = userEvent.setup()
    await typeCode(user, '123456')
    await user.click(screen.getByRole('button', { name: '重新发送' }))
    await waitFor(() => {
      expect(screen.getByText('验证码已重新发送。')).toBeInTheDocument()
    })
    const after = JSON.parse(sessionStorage.getItem(otpRecordKey) ?? 'null')
    expect(Date.parse(after.expires_at)).toBeGreaterThan(
      Date.parse(before.expires_at),
    )
    expect(screen.getByLabelText<HTMLInputElement>('验证码')).toHaveValue('')
  })

  it('shows the normalized message when resend fails', async () => {
    apiMocks.emailCodeSend.mockRejectedValue(new Error('server unavailable'))
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '重新发送' }))
    await waitFor(() => {
      expect(screen.getByText('重新发送失败，请稍后重试。')).toBeInTheDocument()
    })
  })

  it('keeps resend and verify captcha dialogs independent', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({
      email_code: {
        required: true,
        captcha: { provider: 'hcaptcha', site_key: 'hc-site' },
      },
      email_code_login: {
        required: true,
        captcha: { provider: 'recaptcha', site_key: 'rc-site' },
      },
    })
    const user = userEvent.setup()

    // 重新发送：打开 email_code 对话框，取消不触发发送且可再次打开。
    await user.click(screen.getByRole('button', { name: '重新发送' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-hcaptcha')).toBeInTheDocument()
    })
    expect(apiMocks.emailCodeSend).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => {
      expect(screen.queryByTestId('challenge-hcaptcha')).not.toBeInTheDocument()
    })
    expect(apiMocks.emailCodeSend).not.toHaveBeenCalled()

    // 重新发送：解决后独立触发 email_code mutation，token 只进该 action。
    await user.click(screen.getByRole('button', { name: '重新发送' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-hcaptcha')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('challenge-hcaptcha'))
    await waitFor(() => {
      expect(apiMocks.emailCodeSend).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.emailCodeSend.mock.calls[0][0]).toEqual({
      email: 'visitor@example.com',
      captcha_token: 'solved-token',
    })
    // 重新发送成功会清空验证码；重新输入后自动打开验证 CAPTCHA。
    await typeCode(user, '123456')

    // 验证码登录：打开 email_code_login 对话框，与 email_code 互不串用。
    await waitFor(() => {
      expect(screen.getByTestId('challenge-recaptcha')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('challenge-hcaptcha')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('challenge-recaptcha'))
    await waitFor(() => {
      expect(apiMocks.emailCodeLogin).toHaveBeenCalledTimes(1)
    })
    expect(apiMocks.emailCodeLogin.mock.calls[0][0]).toEqual({
      email: 'visitor@example.com',
      code: '123456',
      captcha_token: 'solved-token',
    })
  })
})

describe('LoginOtpPage change-email flow', () => {
  it('returns to /login from the change-email action and deletes the record', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({})
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '更换邮箱' }))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/login',
        search: {},
      })
    })
    expect(sessionStorage.getItem(otpRecordKey)).toBeNull()
  })

  it('carries the authorize markers back when changing the email in the widget flow', async () => {
    const authorizeRedirect =
      '/authorize?site_id=123&request_id=AQEBAQEBAQEBAQEBAQEBAQ'
    seedRecord({
      email: 'visitor@example.com',
      redirect: authorizeRedirect,
      authorize: true,
    })
    renderOtp({})
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '更换邮箱' }))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/login',
        search: { authorize: '1', redirect: authorizeRedirect },
      })
    })
    expect(sessionStorage.getItem(otpRecordKey)).toBeNull()
  })

  it('carries a plain safe redirect back when changing email outside the widget flow', async () => {
    seedRecord({
      email: 'visitor@example.com',
      redirect: '/account/comments',
      authorize: false,
    })
    renderOtp({})
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '更换邮箱' }))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({
        to: '/login',
        search: { redirect: '/account/comments' },
      })
    })
    expect(sessionStorage.getItem(otpRecordKey)).toBeNull()
  })
})

describe('LoginOtpPage privacy', () => {
  it('never puts the email, code, captcha token or profile hints into navigation targets', async () => {
    seedRecord({ email: 'visitor@example.com' })
    renderOtp({
      email_code_login: {
        required: true,
        captcha: { provider: 'recaptcha', site_key: 'rc-site' },
      },
    })
    const user = userEvent.setup()
    await typeCode(user, '123456')
    await waitFor(() => {
      expect(screen.getByTestId('challenge-recaptcha')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('challenge-recaptcha'))
    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({ href: '/admin' })
    })
    for (const call of apiMocks.navigate.mock.calls) {
      const target = JSON.stringify(call[0])
      expect(target).not.toContain('visitor@example.com')
      expect(target).not.toContain('123456')
      expect(target).not.toContain('solved-token')
      expect(target).not.toContain('nickname')
      expect(target).not.toContain('website_url')
    }
    expect(sessionStorage.getItem(otpRecordKey)).toBeNull()
  })
})
