import type { MockRequestContext } from './context'
import { apiError, empty, findItem, json, unauthorized } from './context'
import { updateMockState, writeMockState } from '../state'

function passkeyOptions() {
  return {
    challenge: 'ZGVtby1jaGFsbGVuZ2U',
    options: {
      publicKey: {
        challenge: 'ZGVtby1jaGFsbGVuZ2U',
        rp: { name: 'Furtalk Demo', id: 'localhost' },
        user: {
          id: 'MQ',
          name: 'admin@example.test',
          displayName: 'Demo Admin',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        timeout: 60000,
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
        },
        userVerification: 'required',
      },
    },
  }
}

export function handleAuthAccount({
  method,
  path,
  payload,
  state,
}: MockRequestContext): Response | undefined {
  if (method === 'GET' && path === '/me')
    return state.authenticated ? json(state.me) : unauthorized()
  if (method === 'POST' && path === '/auth/password/login') {
    if (
      payload.email !== 'admin@example.test' ||
      payload.password !== 'Furtalk-Demo-2026!'
    )
      return apiError(
        401,
        'invalid_credentials',
        'Email or password is incorrect.',
      )
    updateMockState((current) => {
      current.authenticated = true
    })
    return empty()
  }
  if (method === 'POST' && path === '/auth/email-codes') return empty()
  if (method === 'POST' && path === '/auth/email-code/login') {
    if (payload.code !== '123456')
      return apiError(422, 'invalid_code', 'Use the mock email code 123456.')
    updateMockState((current) => {
      current.authenticated = true
    })
    return empty()
  }
  if (method === 'POST' && path === '/auth/logout') {
    updateMockState((current) => {
      current.authenticated = false
    })
    return empty()
  }
  if (method === 'POST' && path === '/auth/password/reset-codes') return empty()
  if (method === 'POST' && path === '/auth/password/reset') return empty()
  if (method === 'POST' && path === '/auth/passkeys/login/options')
    return json(passkeyOptions())
  if (method === 'POST' && path === '/auth/passkeys/login/verify') {
    updateMockState((current) => {
      current.authenticated = true
    })
    return empty()
  }
  if (method === 'GET' && path === '/auth/providers') {
    const providers = state.providers
      .filter(
        (provider) =>
          provider.configured &&
          provider.enabled &&
          ['oauth', 'oidc'].includes(provider.kind),
      )
      .map((provider) => ({
        key: provider.provider_key,
        kind: provider.kind,
        name: provider.provider_key,
      }))
    return json({ providers })
  }
  const oauthStart = path.match(/^\/auth\/oauth\/([^/]+)\/start$/)
  if (method === 'GET' && oauthStart)
    return json({ auth_url: `/oauth/mock/${oauthStart[1]}` })
  const oauthComplete = path.match(/^\/auth\/oauth\/([^/]+)\/complete$/)
  if (method === 'POST' && oauthComplete) {
    updateMockState((current) => {
      current.authenticated = true
    })
    return json({ redirect: '/admin' })
  }

  if (method === 'GET' && path === '/me/identities')
    return json({ identities: state.identities })
  const identityPath = path.match(/^\/me\/identities\/([^/]+)$/)
  if (method === 'DELETE' && identityPath) {
    updateMockState((current) => {
      current.identities = current.identities.filter(
        (item) => item.id !== identityPath[1],
      )
    })
    return empty()
  }
  if (method === 'POST' && path === '/me/passkeys/options')
    return json(passkeyOptions())
  if (method === 'POST' && path === '/me/passkeys') {
    updateMockState((current) =>
      current.identities.push({
        id: String(current.nextId++),
        kind: 'passkey',
        name: 'Demo passkey',
        created_at: new Date().toISOString(),
      }),
    )
    return empty()
  }
  const passkeyPath = path.match(/^\/me\/passkeys\/([^/]+)$/)
  if (passkeyPath && method === 'DELETE') {
    updateMockState((current) => {
      current.identities = current.identities.filter(
        (item) => item.id !== passkeyPath[1],
      )
    })
    return empty()
  }
  if (passkeyPath && method === 'PATCH') {
    const identity = state.identities.find((item) => item.id === passkeyPath[1])
    if (!identity) return apiError(404, 'not_found', 'Passkey was not found.')
    identity.name = String(payload.name || identity.name || 'Demo passkey')
    writeMockState(state)
    return empty()
  }
  if (method === 'PATCH' && path === '/me') {
    state.me = {
      ...state.me,
      nickname:
        typeof payload.nickname === 'string'
          ? payload.nickname
          : state.me.nickname,
      website_url: Object.hasOwn(payload, 'website_url')
        ? (payload.website_url as string | null)
        : state.me.website_url,
      updated_at: new Date().toISOString(),
    }
    const user = findItem(state.users, state.me.id)
    if (user)
      Object.assign(user, {
        nickname: state.me.nickname,
        website_url: state.me.website_url,
        updated_at: state.me.updated_at,
      })
    writeMockState(state)
    return json(state.me)
  }
  if (method === 'PATCH' && path === '/me/notification-preferences') {
    state.me.notification_preferences = {
      moderation_enabled: Boolean(payload.moderation_enabled),
      reply_enabled: Boolean(payload.reply_enabled),
    }
    writeMockState(state)
    return json(state.me.notification_preferences)
  }
  if (method === 'POST' && path === '/me/password') {
    state.me.has_password = true
    writeMockState(state)
    return empty()
  }
  if (method === 'POST' && path === '/me/sessions/revoke') return empty()

  return undefined
}
