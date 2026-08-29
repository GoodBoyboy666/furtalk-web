// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from '@/pages/account.profile'
import type { Me } from '@/lib/api/types'

const apiMocks = vi.hoisted(() => ({
  me: vi.fn(),
  updateMe: vi.fn(),
  updateNotifications: vi.fn(),
}))

vi.mock('@/lib/api/resources', () => ({ authApi: apiMocks }))
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

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.me.mockResolvedValue(me)
})

describe('ProfilePage card headers', () => {
  it('renders decorative icons for both profile cards', async () => {
    renderProfile()
    await screen.findByText('基础信息')

    const cards = Array.from(document.querySelectorAll('[data-slot="card"]'))
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(card.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
      expect(card.querySelector('[data-slot="card-header"]')).toHaveClass(
        'border-b',
        'border-border/60',
      )
    }
  })
})
