// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { api, normalizeApiError } from '../lib/api/client'
import {
  authApi,
  settingsApi,
  sitesApi,
  threadsApi,
  usersApi,
} from '../lib/api/resources'
import {
  handlers,
  mockOperationInventory,
  resetMockHandlersState,
} from './handlers'
import { demoCredentials, updateMockState } from './state'

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockHandlersState()
})
afterAll(() => server.close())

describe('MSW Web API mocks', () => {
  it('starts unauthenticated, signs in with the documented demo account, and logs out', async () => {
    await expect(authApi.me()).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    })

    await authApi.passwordLogin(demoCredentials)
    await expect(authApi.me()).resolves.toMatchObject({
      email: demoCredentials.email,
      role: 'admin',
    })

    await authApi.logout()
    await expect(authApi.me()).rejects.toMatchObject({ status: 401 })
  })

  it('keeps Node test state in memory instead of sessionStorage', async () => {
    await authApi.passwordLogin(demoCredentials)

    expect(window.sessionStorage.getItem('furtalk:msw:session:v1')).toBeNull()
  })

  it('keeps site and origin mutations visible to later reads', async () => {
    await authApi.passwordLogin(demoCredentials)
    const site = await sitesApi.create({
      name: 'Integration site',
      canonical_url: 'https://new.example.test',
    })
    expect(site.name).toBe('Integration site')

    const origin = await sitesApi.addOrigin(site.id, 'https://new.example.test')
    await sitesApi.updateOrigin(
      site.id,
      origin.id,
      'https://app.new.example.test',
    )
    await expect(sitesApi.get(site.id)).resolves.toMatchObject({
      origins: [{ id: origin.id, origin: 'https://app.new.example.test' }],
    })

    await sitesApi.removeOrigin(site.id, origin.id)
    await expect(sitesApi.get(site.id)).resolves.toMatchObject({ origins: [] })
  })

  it('filters and sorts thread lists using the console query parameters', async () => {
    await authApi.passwordLogin(demoCredentials)
    updateMockState((state) => {
      const older = state.threads.find((thread) => thread.id === '1')!
      const newer = state.threads.find((thread) => thread.id === '2')!
      older.created_at = '2026-08-01T09:00:00.000Z'
      newer.created_at = '2026-08-02T09:00:00.000Z'
    })

    await expect(
      threadsApi.list('1', { comments_enabled: true, sort: 'desc' }),
    ).resolves.toMatchObject({
      threads: [{ id: '2' }, { id: '1' }],
      total: 2,
    })
    await expect(
      threadsApi.list('2', { comments_enabled: false, sort: 'asc' }),
    ).resolves.toMatchObject({
      threads: [{ id: '3' }],
      total: 1,
    })
  })

  it('reflects user and settings changes across reads', async () => {
    await authApi.passwordLogin(demoCredentials)
    const created = await usersApi.create({
      email: 'new@example.test',
      nickname: 'New User',
      role: 'user',
    })
    await usersApi.update(created.id, { nickname: 'Renamed User' })
    await expect(usersApi.get(created.id)).resolves.toMatchObject({
      nickname: 'Renamed User',
    })

    const updated = await settingsApi.patch([
      { key: 'public_registration', type: 'boolean', value: false },
    ])
    expect(updated.settings).toContainEqual({
      key: 'public_registration',
      type: 'boolean',
      value: false,
    })
    await expect(settingsApi.get()).resolves.toMatchObject({
      settings: expect.arrayContaining([
        { key: 'public_registration', type: 'boolean', value: false },
      ]),
    })
  })

  it('returns a contract error for an uncovered Web API operation', async () => {
    await expect(api.get('/not-implemented')).rejects.toMatchObject({
      status: 501,
      code: 'mock_operation_unhandled',
    })
  })

  it('keeps an operation inventory for all resources functions', () => {
    expect(mockOperationInventory.length).toBeGreaterThanOrEqual(70)
    expect(new Set(mockOperationInventory).size).toBe(
      mockOperationInventory.length,
    )
    expect(mockOperationInventory).toContain('POST /admin/sites')
    expect(mockOperationInventory).toContain('POST /admin/providers/{key}/test')
    expect(mockOperationInventory).toContain(
      'POST /notification-unsubscriptions',
    )
  })

  it('dispatches every operation in the Web API inventory', async () => {
    const payload = {
      email: demoCredentials.email,
      password: demoCredentials.password,
      code: '123456',
      challenge: 'ZGVtby1jaGFsbGVuZ2U',
      response: {},
      ids: ['1'],
      action: 'publish',
      name: 'Coverage site',
      canonical_url: 'https://coverage.example.test',
      origin: 'https://coverage.example.test',
      body: 'Coverage reply',
      settings: [],
      kind: 'oauth',
      config: { client_id: 'coverage' },
      token: 'mock-token',
      mode: 'soft',
      hard: false,
      confirm: true,
    }

    for (const operation of mockOperationInventory) {
      resetMockHandlersState()
      updateMockState((state) => {
        state.authenticated = true
      })

      const [method, template] = operation.split(' ', 2)
      const url = template.replace(/\{([^}]+)\}/g, (_, name: string) =>
        name === 'key' ? 'github' : '1',
      )
      let status: number | undefined
      try {
        const response = await api.request({
          method: method.toLowerCase(),
          url,
          ...(method === 'GET' ? {} : { data: payload }),
        })
        status = response.status
      } catch (error) {
        status = normalizeApiError(error).status
      }

      expect(status, operation).toBeDefined()
      expect(status, operation).not.toBe(501)
    }
  })
})
