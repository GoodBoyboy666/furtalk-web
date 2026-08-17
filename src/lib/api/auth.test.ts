import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { api } from './client'
import { authApi, captchaApi } from './resources'
import type { Me } from './types'

function setDocumentCookie(cookie: string | undefined) {
  if (cookie === undefined) {
    Reflect.deleteProperty(globalThis, 'document')
    return
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie },
  })
}

// installAdapter 替换 api 实例的默认 adapter，返回捕获的请求配置。
function installAdapter(
  data: unknown,
  status = 200,
): InternalAxiosRequestConfig[] {
  const captured: InternalAxiosRequestConfig[] = []
  api.defaults.adapter = (async (config) => {
    captured.push(config)
    return {
      config,
      data,
      headers: {},
      status,
      statusText: 'OK',
    } satisfies AxiosResponse
  }) as AxiosAdapter
  return captured
}

afterEach(() => {
  setDocumentCookie(undefined)
  delete api.defaults.adapter
})

describe('authApi.passwordLogin', () => {
  it('POSTs email and password to /auth/password/login without a token when policy off', async () => {
    const captured = installAdapter(undefined, 204)
    await authApi.passwordLogin({ email: 'a@b.com', password: 'pw' })

    expect(captured[0].method).toBe('post')
    expect(captured[0].url).toBe('/auth/password/login')
    expect(JSON.parse(captured[0].data)).toEqual({
      email: 'a@b.com',
      password: 'pw',
    })
  })

  it('sends captcha_token when provided and keeps login path outside CSRF scope', async () => {
    setDocumentCookie('__Host-furtalk_csrf=token')
    const captured = installAdapter(undefined, 204)
    await authApi.passwordLogin({
      email: 'a@b.com',
      password: 'pw',
      captcha_token: 'captcha-tok',
    })

    expect(JSON.parse(captured[0].data).captcha_token).toBe('captcha-tok')
    expect(captured[0].headers.has('X-CSRF-Token')).toBe(false)
  })
})

describe('authApi.revokeSessions', () => {
  it('POSTs the revoke-all endpoint with the current CSRF cookie', async () => {
    setDocumentCookie('__Host-furtalk_csrf=csrf-token')
    const captured = installAdapter(undefined, 204)

    await authApi.revokeSessions()

    expect(captured[0].method).toBe('post')
    expect(captured[0].url).toBe('/me/sessions/revoke')
    expect(captured[0].headers.get('X-CSRF-Token')).toBe('csrf-token')
  })
})

describe('captchaApi.config', () => {
  it('GETs /captcha/config with the action query parameter', async () => {
    const captured = installAdapter({ required: false })
    const result = await captchaApi.config('password_login')

    expect(captured[0].method).toBe('get')
    expect(captured[0].url).toBe('/captcha/config')
    expect(captured[0].params).toEqual({ action: 'password_login' })
    expect(result).toEqual({ required: false })
  })

  it('resolves the enabled CAP provider public configuration', async () => {
    installAdapter({
      required: true,
      captcha: {
        provider: 'cap',
        site_key: 'site-1',
        api_endpoint: 'https://cap.example.com/site-1/',
      },
    })
    const result = await captchaApi.config('password_login')
    expect(result.required).toBe(true)
    if (result.required) {
      expect(result.captcha.api_endpoint).toMatch(/site-1\/$/)
    }
  })
})

describe('null-safe consumer regressions', () => {
  it('keeps a null website_url usable in profile forms', async () => {
    const me: Me = {
      id: '1',
      email: 'a@b.com',
      nickname: 'n',
      website_url: null,
      avatar_url: 'https://www.gravatar.com/avatar/hash',
      role: 'admin',
      status: 'active',
      email_verified: true,
      has_password: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      notification_preferences: {
        moderation_enabled: true,
        reply_enabled: false,
      },
    }
    expect(me.website_url ?? '').toBe('')
  })

  it('allows sending a cleared website_url back to the backend', async () => {
    setDocumentCookie('__Host-furtalk_csrf=token')
    const captured = installAdapter({})
    await authApi.updateMe({ nickname: 'n', website_url: null })

    expect(JSON.parse(captured[0].data)).toEqual({
      nickname: 'n',
      website_url: null,
    })
  })
})
