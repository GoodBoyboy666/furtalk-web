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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './admin.users'
import type { AdminUser } from '@/lib/api/types'
import { ApiError } from '@/lib/api/client'

// apiMocks 是 usersApi 的替代实现，供 vi.mock 与断言共享。
const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  resetPassword: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
}))
vi.mock('@/lib/api/resources', () => ({
  usersApi: apiMocks,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const user: AdminUser = {
  id: '7',
  email: 'user@example.com',
  nickname: 'User',
  website_url: 'https://example.com',
  avatar_url: 'https://www.gravatar.com/avatar/hash',
  role: 'user',
  status: 'active',
  email_verified: true,
  has_password: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}

const admin: AdminUser = {
  ...user,
  id: '1',
  email: 'admin@example.com',
  nickname: 'Admin',
  role: 'admin',
}

function renderUsers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.list.mockResolvedValue({ users: [user, admin], total: 2 })
  apiMocks.create.mockResolvedValue(user)
  apiMocks.update.mockResolvedValue(user)
  apiMocks.resetPassword.mockResolvedValue(undefined)
  apiMocks.remove.mockResolvedValue(undefined)
  apiMocks.restore.mockResolvedValue(user)
})

afterEach(() => {
  cleanup()
})

describe('UsersPage role and status options', () => {
  it('only offers admin|user and active|disabled options', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    await userAgent.click(
      await screen.findByRole('button', { name: '创建用户' }),
    )
    const dialog = await screen.findByRole('dialog')
    const roleTrigger = within(dialog).getByText('用户').closest('button')
    expect(roleTrigger).not.toBeNull()
    await userAgent.click(roleTrigger as HTMLElement)
    expect(
      await screen.findByRole('option', { name: '管理员' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: '审核员' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: '已暂停' }),
    ).not.toBeInTheDocument()
  })
})

describe('UsersPage create dialog', () => {
  it('submits the full create payload with password and verification switch', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    await userAgent.click(
      await screen.findByRole('button', { name: '创建用户' }),
    )

    await userAgent.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await userAgent.type(screen.getByLabelText('昵称'), 'New User')
    await userAgent.type(
      screen.getByLabelText('个人网站'),
      'https://new.example',
    )
    await userAgent.type(
      screen.getByLabelText('初始密码（可选）'),
      'supersecret',
    )
    await userAgent.click(screen.getByLabelText('邮箱已验证'))
    await userAgent.click(screen.getByRole('button', { name: '创建用户' }))

    await waitFor(() => {
      expect(apiMocks.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        nickname: 'New User',
        website_url: 'https://new.example',
        role: 'user',
        password: 'supersecret',
        email_verified: true,
      })
    })
  })

  it('keeps password and verification optional for legacy-style creation', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    await userAgent.click(
      await screen.findByRole('button', { name: '创建用户' }),
    )
    await userAgent.type(screen.getByLabelText('邮箱'), 'plain@example.com')
    await userAgent.type(screen.getByLabelText('昵称'), 'Plain')

    await userAgent.click(screen.getByRole('button', { name: '创建用户' }))
    await waitFor(() => {
      expect(apiMocks.create).toHaveBeenCalledWith({
        email: 'plain@example.com',
        nickname: 'Plain',
        website_url: undefined,
        role: 'user',
        password: undefined,
        email_verified: false,
      })
    })
  })

  it('preserves the submit error without closing the dialog', async () => {
    apiMocks.create.mockRejectedValue(
      new ApiError('该邮箱已被注册', 409, 'conflict'),
    )
    renderUsers()
    const userAgent = userEvent.setup()
    await userAgent.click(
      await screen.findByRole('button', { name: '创建用户' }),
    )
    await userAgent.type(screen.getByLabelText('邮箱'), 'dup@example.com')
    await userAgent.type(screen.getByLabelText('昵称'), 'Dup')
    await userAgent.click(screen.getByRole('button', { name: '创建用户' }))

    expect(await screen.findByText('该邮箱已被注册')).toBeInTheDocument()
  })
})

describe('UsersPage edit dialog', () => {
  it('initializes from the detail query and submits only changed fields', async () => {
    apiMocks.get.mockResolvedValue(user)
    renderUsers()
    const userAgent = userEvent.setup()

    const editButtons = await screen.findAllByRole('button', { name: '编辑' })
    await userAgent.click(editButtons[0])

    expect(await screen.findByLabelText('邮箱')).toHaveValue('user@example.com')
    expect(screen.getByLabelText('昵称')).toHaveValue('User')
    expect(screen.getByLabelText('个人网站')).toHaveValue('https://example.com')

    await userAgent.clear(screen.getByLabelText('昵称'))
    await userAgent.type(screen.getByLabelText('昵称'), 'Renamed')
    await userAgent.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.update).toHaveBeenCalledWith('7', {
        email: undefined,
        nickname: 'Renamed',
        website_url: undefined,
        role: undefined,
        status: undefined,
        email_verified: true,
      })
    })
  })

  it('sends explicit null website_url when cleared', async () => {
    apiMocks.get.mockResolvedValue(user)
    renderUsers()
    const userAgent = userEvent.setup()
    const editButtons = await screen.findAllByRole('button', { name: '编辑' })
    await userAgent.click(editButtons[0])

    await screen.findByLabelText('个人网站')
    await userAgent.clear(screen.getByLabelText('个人网站'))
    await userAgent.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMocks.update).toHaveBeenCalledWith('7', {
        email: undefined,
        nickname: undefined,
        website_url: null,
        role: undefined,
        status: undefined,
        email_verified: true,
      })
    })
  })

  it('surfaces last-admin conflict from the backend', async () => {
    apiMocks.get.mockResolvedValue(admin)
    apiMocks.update.mockRejectedValue(
      new ApiError('不能移除最后一个管理员', 409, 'conflict'),
    )
    renderUsers()
    const userAgent = userEvent.setup()
    const editButtons = await screen.findAllByRole('button', { name: '编辑' })
    await userAgent.click(editButtons[1])

    await screen.findByLabelText('昵称')
    await userAgent.click(screen.getByRole('button', { name: '保存修改' }))

    expect(
      await screen.findByText('不能移除最后一个管理员'),
    ).toBeInTheDocument()
  })
})

describe('UsersPage reset password dialog', () => {
  it('rejects mismatched confirmation before submitting', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    const resetButtons = await screen.findAllByRole('button', {
      name: '重置密码',
    })
    await userAgent.click(resetButtons[0])

    await screen.findByLabelText('新密码')
    await userAgent.type(screen.getByLabelText('新密码'), 'password123')
    await userAgent.type(screen.getByLabelText('确认新密码'), 'password124')
    await userAgent.click(screen.getByRole('button', { name: '确认重置' }))

    expect(await screen.findByText('两次输入的密码不一致')).toBeInTheDocument()
    expect(apiMocks.resetPassword).not.toHaveBeenCalled()
  })

  it('submits the new password and closes on success', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    const resetButtons = await screen.findAllByRole('button', {
      name: '重置密码',
    })
    await userAgent.click(resetButtons[0])

    await screen.findByLabelText('新密码')
    await userAgent.type(screen.getByLabelText('新密码'), 'password123')
    await userAgent.type(screen.getByLabelText('确认新密码'), 'password123')
    await userAgent.click(screen.getByRole('button', { name: '确认重置' }))

    await waitFor(() => {
      expect(apiMocks.resetPassword).toHaveBeenCalledWith('7', {
        password: 'password123',
      })
    })
  })
})

describe('UsersPage list states', () => {
  it('requests desc by default and switches to asc', async () => {
    renderUsers()
    await waitFor(() => {
      expect(apiMocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'desc' }),
      )
    })
    const userAgent = userEvent.setup()
    const trigger = (await screen.findByText('最新优先')).closest('button')
    expect(trigger).not.toBeNull()
    await userAgent.click(trigger as HTMLElement)
    await userAgent.click(
      await screen.findByRole('option', { name: '最早优先' }),
    )
    await waitFor(() => {
      expect(apiMocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort: 'asc' }),
      )
    })
  })

  it('renders an empty state when no users match', async () => {
    apiMocks.list.mockResolvedValue({ users: [], total: 0 })
    renderUsers()
    expect(await screen.findByText('没有匹配的用户')).toBeInTheDocument()
  })

  it('renders a load error state', async () => {
    apiMocks.list.mockRejectedValue(new Error('网络错误'))
    renderUsers()
    expect(
      await screen.findByText('用户列表加载失败，请稍后重试。'),
    ).toBeInTheDocument()
  })

  it('renders verified and unverified email badges accurately', async () => {
    const unverifiedUser: AdminUser = {
      ...user,
      id: '8',
      email: 'unverified@example.com',
      email_verified: false,
    }
    apiMocks.list.mockResolvedValue({ users: [user, unverifiedUser], total: 2 })
    renderUsers()
    expect(await screen.findByText('已验证')).toBeInTheDocument()
    expect(await screen.findByText('未验证')).toBeInTheDocument()
    expect(screen.queryByText('待审核')).not.toBeInTheDocument()
    expect(screen.queryByText('已发布')).not.toBeInTheDocument()
  })
})

describe('UsersPage delete dialog', () => {
  it('soft-deletes by default and shows the selected mode', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    const deleteButtons = await screen.findAllByRole('button', { name: '删除' })
    await userAgent.click(deleteButtons[0])

    const dialog = await screen.findByRole('alertdialog')
    expect(await screen.findByText('软删除该用户？')).toBeInTheDocument()
    // 收起状态也必须显示中文语义标签，而不是原始 soft 值。
    expect(within(dialog).getByRole('combobox')).toHaveTextContent(
      '软删除（可恢复账号）',
    )

    await userAgent.click(screen.getByRole('button', { name: '确认软删除' }))
    await waitFor(() => {
      expect(apiMocks.remove).toHaveBeenCalledWith('7', 'soft')
    })
  })

  it('hard-deletes when the user selects the hard mode', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    const deleteButtons = await screen.findAllByRole('button', { name: '删除' })
    await userAgent.click(deleteButtons[0])

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('combobox')).toHaveTextContent(
      '软删除（可恢复账号）',
    )

    await userAgent.click(within(dialog).getByRole('combobox'))
    await userAgent.click(
      await screen.findByRole('option', { name: '硬删除（不可恢复）' }),
    )

    expect(await screen.findByText('永久删除该用户？')).toBeInTheDocument()
    // 切换后收起状态显示新的中文标签，而不是原始 hard 值。
    expect(within(dialog).getByRole('combobox')).toHaveTextContent(
      '硬删除（不可恢复）',
    )
    await userAgent.click(screen.getByRole('button', { name: '确认永久删除' }))
    await waitFor(() => {
      expect(apiMocks.remove).toHaveBeenCalledWith('7', 'hard')
    })
  })

  it('never shows raw soft/hard values in the closed trigger or menu', async () => {
    renderUsers()
    const userAgent = userEvent.setup()
    const deleteButtons = await screen.findAllByRole('button', { name: '删除' })
    await userAgent.click(deleteButtons[0])

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('combobox')).not.toHaveTextContent(
      /^soft$|^hard$/,
    )
    await userAgent.click(within(dialog).getByRole('combobox'))
    const softOption = await screen.findByRole('option', {
      name: '软删除（可恢复账号）',
    })
    const hardOption = await screen.findByRole('option', {
      name: '硬删除（不可恢复）',
    })
    expect(softOption).toHaveTextContent('软删除（可恢复账号）')
    expect(hardOption).toHaveTextContent('硬删除（不可恢复）')
    expect(
      screen.queryByRole('option', { name: 'soft' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'hard' }),
    ).not.toBeInTheDocument()
  })

  it('surfaces a last-admin conflict from the backend', async () => {
    apiMocks.remove.mockRejectedValue(
      new ApiError('不能移除最后一个管理员', 409, 'conflict'),
    )
    renderUsers()
    const userAgent = userEvent.setup()
    const deleteButtons = await screen.findAllByRole('button', { name: '删除' })
    await userAgent.click(deleteButtons[0])
    await userAgent.click(screen.getByRole('button', { name: '确认软删除' }))

    expect(
      await screen.findByText('不能移除最后一个管理员'),
    ).toBeInTheDocument()
  })
})

describe('UsersPage restore action', () => {
  it('shows restore only for deleted users and restores on click', async () => {
    const deletedUser: AdminUser = {
      ...user,
      id: '9',
      status: 'deleted',
      deleted_at: '2026-01-02T00:00:00Z',
    }
    apiMocks.list.mockResolvedValue({ users: [deletedUser], total: 1 })
    renderUsers()
    const userAgent = userEvent.setup()

    const restoreButtons = await screen.findAllByRole('button', {
      name: '恢复',
    })
    await userAgent.click(restoreButtons[0])

    await waitFor(() => {
      expect(apiMocks.restore).toHaveBeenCalledWith('9')
    })
  })
})
