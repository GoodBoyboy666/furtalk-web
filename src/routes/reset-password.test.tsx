// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetPasswordPage } from '@/pages/reset-password'
import type { CaptchaConfigResponse } from '@/lib/api/types'

// apiMocks 是 API 模块的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => ({
  passwordResetCode: vi.fn(),
  passwordResetConfirm: vi.fn(),
  captchaConfig: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => apiMocks.navigate,
  useSearch: () => ({ email: 'prefill@example.com' }),
}))
vi.mock('@/lib/api/resources', () => ({
  authApi: {
    passwordResetCode: apiMocks.passwordResetCode,
    passwordResetConfirm: apiMocks.passwordResetConfirm,
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

function renderReset(config: CaptchaConfigResponse) {
  apiMocks.captchaConfig.mockResolvedValue(config)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ResetPasswordPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.passwordResetCode.mockResolvedValue(undefined)
  apiMocks.passwordResetConfirm.mockResolvedValue(undefined)
})

describe('ResetPasswordPage request stage', () => {
  it('prefills the email from the search param and submits without a token when disabled', async () => {
    renderReset({ required: false })
    expect(screen.getByLabelText<HTMLInputElement>('邮箱')).toHaveValue(
      'prefill@example.com',
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(apiMocks.passwordResetCode.mock.calls[0][0]).toEqual({
        email: 'prefill@example.com',
        captcha_token: undefined,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('验证码')).toBeInTheDocument()
    })
  })

  it('opens the captcha dialog and submits the request once after solving', async () => {
    renderReset({
      required: true,
      captcha: { provider: 'turnstile', site_key: 'ts-site' },
    })
    const user = userEvent.setup()
    const submit = screen.getByRole('button', { name: '发送验证码' })
    expect(submit).toBeEnabled()
    await user.click(submit)

    // 本地字段有效后打开对话框并挂载挑战。
    await waitFor(() => {
      expect(screen.getByTestId('challenge-turnstile')).toBeInTheDocument()
    })
    expect(apiMocks.passwordResetCode).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('challenge-turnstile'))
    await waitFor(() => {
      expect(apiMocks.passwordResetCode.mock.calls[0][0]).toEqual({
        email: 'prefill@example.com',
        captcha_token: 'solved-token',
      })
    })
    expect(apiMocks.passwordResetCode).toHaveBeenCalledTimes(1)
  })

  it('does not submit when the captcha dialog is cancelled', async () => {
    renderReset({
      required: true,
      captcha: { provider: 'turnstile', site_key: 'ts-site' },
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(screen.getByTestId('challenge-turnstile')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => {
      expect(
        screen.queryByTestId('challenge-turnstile'),
      ).not.toBeInTheDocument()
    })
    expect(apiMocks.passwordResetCode).not.toHaveBeenCalled()
  })

  it('queries the public config by the password_reset action', async () => {
    renderReset({ required: false })
    await waitFor(() => {
      expect(apiMocks.captchaConfig).toHaveBeenCalledWith('password_reset')
    })
  })
})

describe('ResetPasswordPage confirm stage', () => {
  it('submits code and matching passwords', async () => {
    renderReset({ required: false })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(screen.getByLabelText('验证码')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('验证码'), '123456')
    await user.type(screen.getByLabelText('新密码'), 'brand-new-password')
    await user.type(screen.getByLabelText('确认新密码'), 'brand-new-password')
    await user.click(screen.getByRole('button', { name: '重置密码' }))

    await waitFor(() => {
      expect(apiMocks.passwordResetConfirm.mock.calls[0][0]).toEqual({
        email: 'prefill@example.com',
        code: '123456',
        new_password: 'brand-new-password',
      })
    })
    await waitFor(() => {
      expect(screen.getByText('密码已重置成功。')).toBeInTheDocument()
    })
  })

  it('rejects mismatched passwords without calling the API', async () => {
    renderReset({ required: false })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(screen.getByLabelText('验证码')).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText('验证码'), '123456')
    await user.type(screen.getByLabelText('新密码'), 'brand-new-password')
    await user.type(screen.getByLabelText('确认新密码'), 'different-password')
    await user.click(screen.getByRole('button', { name: '重置密码' }))

    expect(apiMocks.passwordResetConfirm).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument()
    })
  })
})
