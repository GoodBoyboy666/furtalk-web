// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetupPage } from './setup'
import { LoginPage } from './login.index'
import { ApiError } from '@/lib/api/client'
import type { BootstrapStatus } from '@/lib/api/types'

// mocks 是路由、API 与导航的替身，供 vi.mock 与断言共享。
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  status: vi.fn(),
  createAdmin: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
  useNavigate: () => mocks.navigate,
  useSearch: () => ({}),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('@/lib/api/resources', () => ({
  bootstrapApi: {
    status: mocks.status,
    createAdmin: mocks.createAdmin,
  },
  authApi: {
    passwordLogin: vi.fn(),
    passkeyOptions: vi.fn(),
    passkeyVerify: vi.fn(),
  },
  captchaApi: {
    config: vi.fn(),
  },
}))
vi.mock('@/lib/passkey', () => ({
  isPasskeySupported: () => true,
  prepareCredentialRequestOptions: (options: unknown) => options,
  serializeCredential: (credential: unknown) => ({ credential }),
}))
vi.mock('@/components/CaptchaChallenge', () => ({
  CaptchaChallenge: () => null,
}))

function renderSetup(status: BootstrapStatus | 'loading' | 'error') {
  if (status === 'loading') {
    mocks.status.mockReturnValue(new Promise(() => {}))
  } else if (status === 'error') {
    mocks.status.mockRejectedValue(new Error('network down'))
  } else {
    mocks.status.mockResolvedValue(status)
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SetupPage />
    </QueryClientProvider>,
  )
}

// fillSetupForm 等待表单出现后填写全部字段。
async function fillSetupForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<{
    setupToken: string
    email: string
    nickname: string
    password: string
    confirm: string
  }> = {},
) {
  await waitFor(() => {
    expect(screen.getByLabelText('安装令牌')).toBeInTheDocument()
  })
  const values = {
    setupToken: 'setup-token',
    email: 'admin@example.com',
    nickname: 'Admin',
    password: 'correct-horse-1',
    confirm: 'correct-horse-1',
    ...overrides,
  }
  await user.type(screen.getByLabelText('安装令牌'), values.setupToken)
  await user.type(screen.getByLabelText('管理员邮箱'), values.email)
  await user.type(screen.getByLabelText('管理员昵称'), values.nickname)
  await user.type(screen.getByLabelText('密码'), values.password)
  await user.type(screen.getByLabelText('确认密码'), values.confirm)
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.navigate.mockReset()
  mocks.status.mockReset()
  mocks.createAdmin.mockReset()
  mocks.createAdmin.mockResolvedValue(undefined)
})

describe('SetupPage states', () => {
  it('renders a stable loading state while status is pending', async () => {
    renderSetup('loading')
    expect(screen.getByText(/正在检查初始化状态/)).toBeInTheDocument()
  })

  it('renders a retryable error state when status fails', async () => {
    renderSetup('error')
    await waitFor(() => {
      expect(screen.getByText('无法连接服务')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('renders an in-page initialized state with an explicit login action and never navigates automatically', async () => {
    renderSetup({ required: false })
    await waitFor(() => {
      expect(screen.getByText('实例已完成初始化')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: '前往登录' })).toBeInTheDocument()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('renders the setup form when initialization is required', async () => {
    renderSetup({ required: true })
    await waitFor(() => {
      expect(screen.getByLabelText('安装令牌')).toBeInTheDocument()
    })
  })
})

describe('SetupForm validation', () => {
  it('rejects empty required fields before calling the API', async () => {
    renderSetup({ required: true })
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByLabelText('安装令牌')).toBeInTheDocument()
    })
    await user.click(
      screen.getByRole('button', { name: '创建管理员并完成初始化' }),
    )
    await waitFor(() => {
      expect(screen.getByText('请输入安装令牌')).toBeInTheDocument()
    })
    expect(screen.getByText('请输入管理员邮箱')).toBeInTheDocument()
    expect(screen.getByText('请输入管理员昵称')).toBeInTheDocument()
    expect(screen.getByText('请设置密码')).toBeInTheDocument()
    expect(mocks.createAdmin).not.toHaveBeenCalled()
  })

  it('rejects an invalid email shape', async () => {
    renderSetup({ required: true })
    const user = userEvent.setup()
    await fillSetupForm(user, { email: 'not-an-email' })
    await user.click(
      screen.getByRole('button', { name: '创建管理员并完成初始化' }),
    )
    expect(await screen.findByText('邮箱格式不正确')).toBeInTheDocument()
    expect(mocks.createAdmin).not.toHaveBeenCalled()
  })

  it('rejects passwords shorter than the minimum length', async () => {
    renderSetup({ required: true })
    const user = userEvent.setup()
    await fillSetupForm(user, { password: 'short', confirm: 'short' })
    await user.click(
      screen.getByRole('button', { name: '创建管理员并完成初始化' }),
    )
    expect(await screen.findByText('密码至少 8 位')).toBeInTheDocument()
    expect(mocks.createAdmin).not.toHaveBeenCalled()
  })

  it('rejects mismatched password confirmation', async () => {
    renderSetup({ required: true })
    const user = userEvent.setup()
    await fillSetupForm(user, { confirm: 'different-password' })
    await user.click(
      screen.getByRole('button', { name: '创建管理员并完成初始化' }),
    )
    expect(await screen.findByText('两次输入的密码不一致')).toBeInTheDocument()
    expect(mocks.createAdmin).not.toHaveBeenCalled()
  })
})

describe('SetupForm submission', () => {
  it('submits the payload, clears sensitive fields and navigates to /login', async () => {
    renderSetup({ required: true })
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByLabelText('安装令牌')).toBeInTheDocument()
    })
    await fillSetupForm(user)

    await user.click(
      screen.getByRole('button', { name: '创建管理员并完成初始化' }),
    )
    await waitFor(() => {
      expect(mocks.createAdmin.mock.calls[0][0]).toEqual({
        setup_token: 'setup-token',
        email: 'admin@example.com',
        nickname: 'Admin',
        password: 'correct-horse-1',
      })
    })
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/login' })
    })
    expect(screen.getByLabelText('安装令牌')).toHaveValue('')
    expect(screen.getByLabelText('密码')).toHaveValue('')
  })

  it('renders an actionable unavailable state on bootstrap_unavailable', async () => {
    mocks.createAdmin.mockRejectedValue(
      new ApiError('初始化已不可用', 410, 'bootstrap_unavailable'),
    )
    renderSetup({ required: true })
    const user = userEvent.setup()
    await fillSetupForm(user)
    await user.click(
      screen.getByRole('button', { name: '创建管理员并完成初始化' }),
    )
    await waitFor(() => {
      expect(screen.getByText('初始化已不可用')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '重新填写' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前往登录' })).toBeInTheDocument()
    // 不可用状态不自动跳转。
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('renders other normalized API errors without secret values', async () => {
    mocks.createAdmin.mockRejectedValue(
      new ApiError('该邮箱已被注册', 409, 'email_already_registered'),
    )
    renderSetup({ required: true })
    const user = userEvent.setup()
    await fillSetupForm(user)
    await user.click(
      screen.getByRole('button', { name: '创建管理员并完成初始化' }),
    )
    await waitFor(() => {
      expect(screen.getByText('该邮箱已被注册')).toBeInTheDocument()
    })
    // 错误文案不包含令牌或密码。
    expect(screen.queryByText(/setup-token/)).not.toBeInTheDocument()
    expect(screen.queryByText(/correct-horse-1/)).not.toBeInTheDocument()
  })
})

describe('Public routes stay bootstrap-free', () => {
  it('renders the login page without querying bootstrap status', async () => {
    mocks.status.mockRejectedValue(new Error('must not be called'))
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <LoginPage />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })
    expect(mocks.status).not.toHaveBeenCalled()
  })
})
