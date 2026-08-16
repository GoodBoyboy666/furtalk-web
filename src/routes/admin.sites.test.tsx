// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SitesPage } from './admin.sites'
import type { Site } from '@/lib/api/types'

const apiMocks = vi.hoisted(() => ({
  sitesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    addOrigin: vi.fn(),
    updateOrigin: vi.fn(),
    removeOrigin: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: null }),
}))
vi.mock('@/lib/api/resources', () => ({
  sitesApi: apiMocks.sitesApi,
}))
vi.mock('@/lib/api/sites', () => ({
  invalidateSites: () => undefined,
  sitesView: ({
    isPending,
    isError,
    error,
    sites,
  }: {
    isPending: boolean
    isError: boolean
    error: Error | null
    sites?: Site[]
  }) => {
    if (isPending) return { kind: 'loading' as const }
    if (isError)
      return { kind: 'error' as const, message: error?.message ?? '' }
    if (!sites || sites.length === 0) return { kind: 'empty' as const }
    return { kind: 'ready' as const, sites }
  },
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const sampleSite: Site = {
  id: '42',
  name: '产品文档',
  canonical_url: 'https://docs.example.com',
  status: 'active',
  origins: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderSites() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SitesPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  apiMocks.sitesApi.list.mockResolvedValue({ sites: [sampleSite] })
})

describe('SitesPage site identity', () => {
  it('renders the decimal-string site ID for every listed site', async () => {
    renderSites()
    expect(await screen.findByText('产品文档')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('ID: 42')).toBeInTheDocument()
    })
  })
})
