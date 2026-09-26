import type { AdminUser, Provider, SettingItem } from '../../lib/api/types'
import type { MockRequestContext } from './context'
import { apiError, empty, findItem, json, list } from './context'
import { writeMockState } from '../state'

export function handleUsersSettingsProviders({
  method,
  path,
  url,
  payload,
  state,
}: MockRequestContext): Response | undefined {
  if (method === 'GET' && path === '/admin/users') {
    const result = list(
      state.users.filter((item) => !item.deleted_at),
      url,
    )
    return json({ users: result.rows, total: result.total })
  }
  if (method === 'POST' && path === '/admin/users/batch') {
    const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : []
    const action = String(payload.action || '')
    const actions: Record<string, (user: AdminUser) => void> = {
      enable: (user) => {
        user.status = 'active'
      },
      disable: (user) => {
        user.status = 'disabled'
      },
      verify_email: (user) => {
        user.email_verified = true
      },
      unverify_email: (user) => {
        user.email_verified = false
      },
      soft_delete: (user) => {
        user.deleted_at = new Date().toISOString()
      },
      restore: (user) => {
        user.deleted_at = null
      },
    }
    let changed = 0
    for (const user of state.users.filter((item) => ids.includes(item.id))) {
      if (action === 'hard_delete')
        state.users = state.users.filter((item) => item.id !== user.id)
      else if (Object.hasOwn(actions, action)) actions[action](user)
      changed++
    }
    writeMockState(state)
    return json({
      action,
      requested_count: ids.length,
      changed_count: changed,
      unchanged_count: Math.max(0, ids.length - changed),
    })
  }
  if (method === 'POST' && path === '/admin/users') {
    const created: AdminUser = {
      id: String(state.nextId++),
      email: String(payload.email || ''),
      nickname: String(payload.nickname || ''),
      website_url: (payload.website_url as string | null) ?? null,
      avatar_url: `https://www.gravatar.com/avatar/mock-${state.nextId}`,
      role: String(payload.role || 'user'),
      status: 'active',
      email_verified: Boolean(payload.email_verified),
      has_password: Boolean(payload.password),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
    state.users.push(created)
    writeMockState(state)
    return json(created, 201)
  }
  const userPath = path.match(
    /^\/admin\/users\/([^/]+)(?:\/(password|restore))?$/,
  )
  if (userPath) {
    const user = findItem(state.users, userPath[1])
    if (!user) return apiError(404, 'user_not_found', 'User was not found.')
    const action = userPath[2]
    if (method === 'GET' && !action) return json(user)
    if (method === 'PATCH' && !action) {
      Object.assign(user, payload, { updated_at: new Date().toISOString() })
      writeMockState(state)
      return json(user)
    }
    if (method === 'POST' && action === 'password') return empty()
    if (method === 'POST' && action === 'restore') {
      user.deleted_at = null
      writeMockState(state)
      return json(user)
    }
    if (method === 'DELETE' && !action) {
      if (url.searchParams.get('mode') === 'hard')
        state.users = state.users.filter((item) => item.id !== user.id)
      else user.deleted_at = new Date().toISOString()
      writeMockState(state)
      return empty()
    }
  }

  if (method === 'GET' && path === '/admin/settings')
    return json({ settings: state.settings })
  if (method === 'PATCH' && path === '/admin/settings') {
    const changes = Array.isArray(payload.settings)
      ? (payload.settings as SettingItem[])
      : []
    for (const change of changes) {
      const index = state.settings.findIndex((item) => item.key === change.key)
      if (index === -1) state.settings.push(change)
      else state.settings[index] = change
    }
    writeMockState(state)
    return json({ settings: state.settings })
  }
  if (method === 'POST' && path === '/admin/settings/legal-consent/reset') {
    const item = state.settings.find(
      (entry) => entry.key === 'legal_consent_version',
    )
    if (item) item.value = Number(item.value) + 1
    writeMockState(state)
    return json({ legal_consent_version: Number(item?.value ?? 1) })
  }
  if (method === 'GET' && path === '/admin/providers')
    return json({ providers: state.providers })
  const providerPath = path.match(/^\/admin\/providers\/([^/]+)(\/test)?$/)
  if (providerPath) {
    const key = decodeURIComponent(providerPath[1])
    const providerIndex = state.providers.findIndex(
      (item) => item.provider_key === key,
    )
    if (method === 'POST' && providerPath[2] === '/test')
      return json({ success: true, message: 'Mock provider check succeeded.' })
    if (method === 'PUT') {
      const providerPayload = payload as {
        kind?: unknown
        enabled?: unknown
        config?: Record<string, unknown>
      }
      const config = providerPayload.config || {}
      const safeConfig: Record<string, unknown> = {}
      for (const field of [
        'client_id',
        'issuer_url',
        'instance_url',
        'provider',
        'site_key',
        'endpoint',
        'check_nickname',
        'action',
        'region',
        'biz_type',
        'chat_id',
        'server_url',
        'target_id',
      ]) {
        if (Object.hasOwn(config, field)) safeConfig[field] = config[field]
      }
      const item: Provider = {
        provider_key: key,
        kind: String(providerPayload.kind || 'oauth'),
        enabled: providerPayload.enabled !== false,
        configured: true,
        public_config: safeConfig,
      }
      if (providerIndex === -1) state.providers.push(item)
      else state.providers[providerIndex] = item
      writeMockState(state)
      return empty()
    }
    if (method === 'DELETE') {
      state.providers = state.providers.filter(
        (item) => item.provider_key !== key,
      )
      writeMockState(state)
      return empty()
    }
  }
  if (method === 'POST' && path === '/notification-unsubscriptions')
    return empty()

  return undefined
}
