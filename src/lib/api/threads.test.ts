import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { api } from './client'
import { threadsApi } from './resources'

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

describe('threadsApi remove', () => {
  it('DELETEs the site-scoped thread with an explicit hard-delete confirm', async () => {
    setDocumentCookie('__Host-furtalk_csrf=token')
    const captured = installAdapter(undefined, 204)

    await threadsApi.remove('9', '1')

    expect(captured).toHaveLength(1)
    expect(captured[0].method).toBe('delete')
    expect(captured[0].url).toBe('/admin/sites/9/threads/1')
    expect(captured[0].params).toEqual({ confirm: true })
    expect(captured[0].headers.get('X-CSRF-Token')).toBe('token')
  })
})
