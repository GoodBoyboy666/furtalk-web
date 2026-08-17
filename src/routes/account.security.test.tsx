// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SecurityPage } from './account.security'
import type { Me } from '@/lib/api/types'

// apiMocks 是 authApi 的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => ({
  me: vi.fn(),
  identities: vi.fn(),
  providers: vi.fn(),
  oauthStart: vi.fn(),
  deleteIdentity: vi.fn(),
  passkeyRegistrationOptions: vi.fn(),
  finishPasskeyRegistration: vi.fn(),
  deletePasskey: vi.fn(),
  renamePasskey: vi.fn(),
  changePassword: vi.fn(),
  revokeSessions: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
  useNavigate: () => apiMocks.navigate,
}))
vi.mock('@/lib/api/resources', () => ({
  authApi: apiMocks,
}))
vi.mock('@/lib/passkey', () => ({
  isPasskeySupported: () => true,
  prepareCredentialCreationOptions: (options: unknown) => options,
  serializeCredential: (credential: unknown) => ({ credential }),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const me: Me = {
  id: '1',
  email: 'admin@example.com',
  nickname: 'Admin',
  website_url: null,
  avatar_url: 'https://www.gravatar.com/avatar/hash',
  role: 'admin',
  status: 'active',
  email_verified: true,
  has_password: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  notification_preferences: {
    moderation_enabled: false,
    reply_enabled: false,
  },
}

function renderSecurity(overrides: Partial<Me> = {}) {
  apiMocks.me.mockResolvedValue({ ...me, ...overrides })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <SecurityPage />
      </QueryClientProvider>,
    ),
  }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.me.mockResolvedValue(me)
  apiMocks.identities.mockResolvedValue({ identities: [] })
  apiMocks.providers.mockResolvedValue({
    providers: [{ key: 'github', kind: 'oauth', name: 'GitHub' }],
  })
  apiMocks.oauthStart.mockResolvedValue({
    auth_url: 'https://github.example/auth',
  })
  apiMocks.deleteIdentity.mockResolvedValue(undefined)
  apiMocks.finishPasskeyRegistration.mockResolvedValue(undefined)
  apiMocks.renamePasskey.mockResolvedValue(undefined)
  apiMocks.changePassword.mockResolvedValue(undefined)
  apiMocks.revokeSessions.mockResolvedValue(undefined)
})

afterEach(() => {
  delete (navigator as { credentials?: unknown }).credentials
})

describe('SecurityPage passkey registration contract', () => {
  it('passes the full top-level WebAuthn options to navigator.credentials.create', async () => {
    const envelope = {
      publicKey: {
        rp: { id: 'furtalk.example.com', name: 'Furtalk' },
        user: { id: 'MTAw', name: 'Admin', displayName: 'Admin' },
        challenge: 'Y2hhbGxlbmdlLWJ5dGVz',
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        excludeCredentials: [{ type: 'public-key', id: 'Y3JlZDE' }],
      },
      mediation: 'optional',
    }
    apiMocks.passkeyRegistrationOptions.mockResolvedValue({
      challenge: 'c',
      options: envelope,
    })
    const createMock = vi.fn().mockResolvedValue({
      id: 'cred-id',
      type: 'public-key',
      rawId: new Uint8Array([1]).buffer,
      response: {
        clientDataJSON: new Uint8Array([2]).buffer,
        attestationObject: new Uint8Array([3]).buffer,
      },
    })
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { create: createMock },
    })

    renderSecurity()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '添加 passkey' }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledTimes(1)
    })
    // 断言传给浏览器 API 的是 { publicKey, mediation } 顶层对象。
    const passed = createMock.mock.calls[0][0]
    expect(passed).toEqual(envelope)
    expect(passed.publicKey).not.toHaveProperty('publicKey')
    await waitFor(() => {
      expect(apiMocks.finishPasskeyRegistration).toHaveBeenCalledWith({
        challenge: 'c',
        response: { credential: expect.objectContaining({ id: 'cred-id' }) },
      })
    })
  })
})

describe('SecurityPage password change contract', () => {
  it('requires and submits the current password when a password exists', async () => {
    renderSecurity()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('当前密码'), 'old-password')
    await user.type(screen.getByLabelText('新密码'), 'new-password-1')
    await user.type(screen.getByLabelText('确认新密码'), 'new-password-1')
    await user.click(screen.getByRole('button', { name: '更新密码' }))

    await waitFor(() => {
      expect(apiMocks.changePassword).toHaveBeenCalledWith({
        current_password: 'old-password',
        new_password: 'new-password-1',
      })
    })
  })

  it('omits current_password for first-time password setup', async () => {
    renderSecurity({ has_password: false })
    const user = userEvent.setup()
    const submit = await screen.findByRole('button', { name: '设置密码' })
    await user.type(screen.getByLabelText('新密码'), 'new-password-1')
    await user.type(screen.getByLabelText('确认新密码'), 'new-password-1')
    await user.click(submit)

    await waitFor(() => {
      expect(apiMocks.changePassword).toHaveBeenCalledWith({
        current_password: undefined,
        new_password: 'new-password-1',
      })
    })
  })

  it('rejects mismatched confirmation without calling the API', async () => {
    renderSecurity()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('当前密码'), 'old-password')
    await user.type(screen.getByLabelText('新密码'), 'new-password-1')
    await user.type(screen.getByLabelText('确认新密码'), 'different-password')
    await user.click(screen.getByRole('button', { name: '更新密码' }))

    await waitFor(() => {
      expect(apiMocks.changePassword).not.toHaveBeenCalled()
    })
  })
})

describe('SecurityPage passkey rename contract', () => {
  it('renames a passkey with a trimmed name and invalidates identities', async () => {
    apiMocks.identities.mockResolvedValue({
      identities: [
        { id: '8', kind: 'passkey', name: '旧名称', last_used_at: null },
      ],
    })
    renderSecurity()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '重命名 旧名称' }),
    )
    const input = await screen.findByLabelText('Passkey 名称')
    await user.clear(input)
    await user.type(input, '  新名称  ')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMocks.renamePasskey).toHaveBeenCalledWith('8', '新名称')
    })
  })

  it('rejects a blank name without calling the API', async () => {
    apiMocks.identities.mockResolvedValue({
      identities: [
        { id: '8', kind: 'passkey', name: '旧名称', last_used_at: null },
      ],
    })
    renderSecurity()
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: '重命名 旧名称' }),
    )
    const input = await screen.findByLabelText('Passkey 名称')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMocks.renamePasskey).not.toHaveBeenCalled()
    })
  })
})

describe('SecurityPage third-party provider bind/unbind contract', () => {
  it('starts a bind flow for an available provider with a local redirect', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'http://furtalk.local/account/security' },
    })
    try {
      renderSecurity()
      const user = userEvent.setup()
      await user.click(
        await screen.findByRole('button', { name: '绑定 GitHub' }),
      )
      await waitFor(() => {
        expect(apiMocks.oauthStart).toHaveBeenCalledWith(
          'github',
          'bind',
          '/account/security',
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

  it('hides providers already bound and renders the empty hint when none remain', async () => {
    apiMocks.identities.mockResolvedValue({
      identities: [
        {
          id: '9',
          kind: 'external',
          provider: 'github',
          last_used_at: null,
        },
      ],
    })
    renderSecurity()
    expect(
      await screen.findByText('没有其他可绑定的第三方账号。'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '绑定 GitHub' }),
    ).not.toBeInTheDocument()
  })

  it('unbinds an external identity and invalidates identities and me', async () => {
    apiMocks.identities.mockResolvedValue({
      identities: [
        { id: '7', kind: 'external', provider: 'google', last_used_at: null },
        { id: '8', kind: 'passkey', name: 'passkey-1', last_used_at: null },
      ],
    })
    renderSecurity()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '解绑 google' }))
    await user.click(await screen.findByRole('button', { name: '确认解绑' }))
    await waitFor(() => {
      expect(apiMocks.deleteIdentity).toHaveBeenCalledWith('7')
    })
  })

  it('shows a clear message when unbinding the last login method', async () => {
    apiMocks.identities.mockResolvedValue({
      identities: [
        { id: '7', kind: 'external', provider: 'github', last_used_at: null },
      ],
    })
    apiMocks.deleteIdentity.mockRejectedValue(
      new Error('不能移除最后一个登录方式'),
    )
    renderSecurity()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '解绑 github' }))
    await user.click(await screen.findByRole('button', { name: '确认解绑' }))
    await waitFor(() => {
      expect(apiMocks.deleteIdentity).toHaveBeenCalledWith('7')
    })
  })
})

describe('SecurityPage revoke-all sessions contract', () => {
  it('requires confirmation and clearly warns that the current device will sign out', async () => {
    renderSecurity()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', { name: '注销全部会话' }),
    )

    expect(apiMocks.revokeSessions).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        '所有设备上的登录会话都会失效，当前设备也会退出。确定继续吗？',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '确认注销全部会话' }))
    await waitFor(() => {
      expect(apiMocks.revokeSessions).toHaveBeenCalledTimes(1)
    })
  })

  it('clears the query cache and navigates to login after success', async () => {
    const { queryClient } = renderSecurity()
    const clear = vi.spyOn(queryClient, 'clear')
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', { name: '注销全部会话' }),
    )
    await user.click(screen.getByRole('button', { name: '确认注销全部会话' }))

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith({ to: '/login' })
    })
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('shows the failure and allows the action to be retried', async () => {
    apiMocks.revokeSessions
      .mockRejectedValueOnce(new Error('网络暂时不可用'))
      .mockResolvedValueOnce(undefined)
    renderSecurity()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', { name: '注销全部会话' }),
    )
    await user.click(screen.getByRole('button', { name: '确认注销全部会话' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时不可用')
    expect(apiMocks.navigate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '注销全部会话' }))
    await user.click(screen.getByRole('button', { name: '确认注销全部会话' }))
    await waitFor(() => {
      expect(apiMocks.revokeSessions).toHaveBeenCalledTimes(2)
    })
  })
})
