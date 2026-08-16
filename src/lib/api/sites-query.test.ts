import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { invalidateSites, sitesQueryKey, sitesView } from './sites'
import type { Site } from './types'

const sampleSite: Site = {
  id: '1',
  name: 'Site A',
  canonical_url: 'https://example.com',
  status: 'active',
  origins: [{ id: '3', origin: 'https://app.example.com' }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('sitesView', () => {
  it('maps a pending query to the loading state', () => {
    expect(
      sitesView({
        isPending: true,
        isError: false,
        error: null,
        sites: undefined,
      }),
    ).toEqual({ kind: 'loading' })
  })

  it('maps a failed query to the error state even with stale empty data', () => {
    const view = sitesView({
      isPending: false,
      isError: true,
      error: new Error('资源不存在'),
      sites: [],
    })
    expect(view.kind).toBe('error')
    if (view.kind === 'error') {
      expect(view.message).toBe('资源不存在')
    }
  })

  it('keeps the backend message when the query error is an ApiError', () => {
    const error = new ApiError('资源状态冲突', 409, 'conflict', 'r1')
    const view = sitesView({
      isPending: false,
      isError: true,
      error,
      sites: undefined,
    })
    expect(view).toEqual({ kind: 'error', message: '资源状态冲突' })
  })

  it('maps an empty successful list to the empty state, never to an error', () => {
    expect(
      sitesView({
        isPending: false,
        isError: false,
        error: null,
        sites: [],
      }),
    ).toEqual({ kind: 'empty' })
  })

  it('maps a successful list to the list state', () => {
    expect(
      sitesView({
        isPending: false,
        isError: false,
        error: null,
        sites: [sampleSite],
      }),
    ).toEqual({ kind: 'list', sites: [sampleSite] })
  })
})

describe('invalidateSites', () => {
  it('triggers a refetch of the sites query after a mutation', async () => {
    const client = new QueryClient()
    let fetches = 0
    const queryFn = async () => {
      fetches += 1
      return { sites: [sampleSite] }
    }

    // invalidateQueries 默认只重拉活跃观察者的查询；
    // 用 QueryObserver 模拟页面订阅，与真实页面行为一致。
    const observer = new QueryObserver(client, {
      queryKey: sitesQueryKey,
      queryFn,
    })
    const unsubscribe = observer.subscribe(() => {})
    try {
      await client.fetchQuery({ queryKey: sitesQueryKey, queryFn })
      expect(fetches).toBe(1)

      await invalidateSites(client)
      expect(fetches).toBe(2)
    } finally {
      unsubscribe()
    }
  })

  it('invalidates the exact shared key so other query keys stay untouched', async () => {
    const client = new QueryClient()
    let sitesFetches = 0
    let otherFetches = 0
    const observer = new QueryObserver(client, {
      queryKey: sitesQueryKey,
      queryFn: async () => {
        sitesFetches += 1
        return { sites: [sampleSite] }
      },
    })
    const unsubscribe = observer.subscribe(() => {})
    try {
      await client.fetchQuery({
        queryKey: sitesQueryKey,
        queryFn: async () => {
          sitesFetches += 1
          return { sites: [sampleSite] }
        },
      })
      await client.fetchQuery({
        queryKey: ['comments'],
        queryFn: async () => {
          otherFetches += 1
          return { comments: [] }
        },
      })

      await invalidateSites(client)

      expect(sitesFetches).toBe(2)
      expect(otherFetches).toBe(1)
    } finally {
      unsubscribe()
    }
  })
})
