import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { api } from './client'
import { notificationApi } from './resources'

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

describe('notificationApi.unsubscribe', () => {
  it('POSTs the raw token to /notification-unsubscriptions without a CSRF header', async () => {
    setDocumentCookie('__Host-furtalk_csrf=current-token')
    const captured = installAdapter(undefined, 204)
    await notificationApi.unsubscribe('test-token')

    expect(captured[0].method).toBe('post')
    expect(captured[0].url).toBe('/notification-unsubscriptions')
    expect(JSON.parse(captured[0].data)).toEqual({ token: 'test-token' })
    expect(captured[0].headers.has('X-CSRF-Token')).toBe(false)
  })
})
