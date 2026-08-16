import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { api } from './client'

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

function captureAdapter(captured: InternalAxiosRequestConfig[]): AxiosAdapter {
  return async (config) => {
    captured.push(config)
    return {
      config,
      data: undefined,
      headers: {},
      status: 204,
      statusText: 'No Content',
    } satisfies AxiosResponse
  }
}

afterEach(() => setDocumentCookie(undefined))

describe('CSRF request interceptor', () => {
  it.each([
    '/me',
    '/me/passkeys',
    '/me/passkeys/42',
    '/comments/42',
    '/comment-authorizations',
    '/api/v1/comment-authorizations',
    '/admin/settings',
    '/auth/logout',
    '/api/v1/admin/users',
  ])('adds the current cookie to protected unsafe request %s', async (url) => {
    setDocumentCookie('other=value; __Host-furtalk_csrf=current-token')
    const captured: InternalAxiosRequestConfig[] = []

    await api.request({
      method: 'post',
      url,
      adapter: captureAdapter(captured),
    })

    expect(captured[0].headers.get('X-CSRF-Token')).toBe('current-token')
  })

  it.each([
    ['get', '/admin/settings'],
    ['post', '/auth/password/login'],
    ['post', '/auth/email-code/login'],
    ['post', '/auth/passkeys/login/verify'],
    ['post', '/widget/sites/1/comments'],
    ['post', '/widget/comment-authorizations/exchange'],
    ['post', '/notification-unsubscriptions'],
  ])('does not add the header to exempt %s %s', async (method, url) => {
    setDocumentCookie('__Host-furtalk_csrf=current-token')
    const captured: InternalAxiosRequestConfig[] = []

    await api.request({ method, url, adapter: captureAdapter(captured) })

    expect(captured[0].headers.has('X-CSRF-Token')).toBe(false)
  })

  it('reads the cookie for every request instead of retaining a login-era value', async () => {
    const captured: InternalAxiosRequestConfig[] = []
    const adapter = captureAdapter(captured)
    setDocumentCookie('__Host-furtalk_csrf=first-login')
    await api.request({ method: 'patch', url: '/me', adapter })

    setDocumentCookie('__Host-furtalk_csrf=second-login')
    await api.request({ method: 'post', url: '/auth/logout', adapter })

    expect(captured[0].headers.get('X-CSRF-Token')).toBe('first-login')
    expect(captured[1].headers.get('X-CSRF-Token')).toBe('second-login')
  })

  it('rejects a protected unsafe request locally without a browser context', async () => {
    setDocumentCookie(undefined)
    const captured: InternalAxiosRequestConfig[] = []

    await expect(
      api.request({
        method: 'delete',
        url: '/admin/sites/1',
        adapter: captureAdapter(captured),
      }),
    ).rejects.toMatchObject({
      message: 'CSRF-protected requests require a browser context',
    })

    expect(captured).toHaveLength(0)
  })

  it('does not expose the token to an absolute cross-origin URL', async () => {
    setDocumentCookie('__Host-furtalk_csrf=current-token')
    const captured: InternalAxiosRequestConfig[] = []

    await api.request({
      method: 'delete',
      url: 'https://other.example/admin/sites/1',
      adapter: captureAdapter(captured),
    })

    expect(captured[0].headers.has('X-CSRF-Token')).toBe(false)
  })
})
