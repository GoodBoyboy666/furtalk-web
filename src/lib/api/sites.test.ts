import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { api, normalizeApiError } from './client'
import { sitesApi } from './resources'

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

describe('sitesApi origin endpoints', () => {
  it('addOrigin POSTs to the site origin collection and resolves the created record', async () => {
    setDocumentCookie('__Host-furtalk_csrf=token')
    const captured = installAdapter(
      { id: '7', origin: 'https://app.example.com' },
      201,
    )

    const result = await sitesApi.addOrigin('1', 'https://app.example.com')

    expect(captured).toHaveLength(1)
    expect(captured[0].method).toBe('post')
    expect(captured[0].url).toBe('/admin/sites/1/origins')
    expect(JSON.parse(captured[0].data)).toEqual({
      origin: 'https://app.example.com',
    })
    expect(captured[0].headers.get('X-CSRF-Token')).toBe('token')
    expect(result).toEqual({ id: '7', origin: 'https://app.example.com' })
  })

  it('updateOrigin PATCHes the exact origin and resolves the updated record', async () => {
    setDocumentCookie('__Host-furtalk_csrf=token')
    const captured = installAdapter({
      id: '7',
      origin: 'https://cdn.example.com',
    })

    const result = await sitesApi.updateOrigin(
      '1',
      '7',
      'https://cdn.example.com',
    )

    expect(captured).toHaveLength(1)
    expect(captured[0].method).toBe('patch')
    expect(captured[0].url).toBe('/admin/sites/1/origins/7')
    expect(JSON.parse(captured[0].data)).toEqual({
      origin: 'https://cdn.example.com',
    })
    expect(captured[0].headers.get('X-CSRF-Token')).toBe('token')
    expect(result).toEqual({ id: '7', origin: 'https://cdn.example.com' })
  })

  it('removeOrigin DELETEs the exact site origin by id', async () => {
    setDocumentCookie('__Host-furtalk_csrf=token')
    const captured = installAdapter(undefined, 204)

    await sitesApi.removeOrigin('1', '7')

    expect(captured).toHaveLength(1)
    expect(captured[0].method).toBe('delete')
    expect(captured[0].url).toBe('/admin/sites/1/origins/7')
    expect(captured[0].headers.get('X-CSRF-Token')).toBe('token')
  })

  it('list resolves sites with origin records carrying stable ids', async () => {
    const captured = installAdapter({
      sites: [
        {
          id: '1',
          name: 'Site A',
          canonical_url: 'https://example.com',
          status: 'active',
          origins: [{ id: '3', origin: 'https://app.example.com' }],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    })

    const result = await sitesApi.list()

    expect(captured[0].method).toBe('get')
    expect(captured[0].url).toBe('/admin/sites')
    expect(result.sites[0].origins[0]).toEqual({
      id: '3',
      origin: 'https://app.example.com',
    })
  })
})

describe('normalizeApiError surfaces backend messages', () => {
  it('keeps the backend conflict message for duplicate origins', () => {
    const error = normalizeApiError({
      message: 'Request failed with status code 409',
      response: {
        status: 409,
        data: {
          error: {
            code: 'conflict',
            message: '资源状态冲突',
            request_id: 'r1',
          },
        },
      },
    })
    expect(error.message).toBe('资源状态冲突')
    expect(error.code).toBe('conflict')
    expect(error.status).toBe(409)
  })

  it('keeps the backend validation message for invalid origins', () => {
    const error = normalizeApiError({
      message: 'Request failed with status code 422',
      response: {
        status: 422,
        data: {
          error: { code: 'invalid_input', message: '请求参数无效' },
        },
      },
    })
    expect(error.message).toBe('请求参数无效')
    expect(error.status).toBe(422)
  })

  it('keeps the backend not-found message for cross-site or missing records', () => {
    const error = normalizeApiError({
      message: 'Request failed with status code 404',
      response: {
        status: 404,
        data: { error: { code: 'not_found', message: '资源不存在' } },
      },
    })
    expect(error.message).toBe('资源不存在')
    expect(error.status).toBe(404)
  })
})
