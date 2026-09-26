import { HttpResponse } from 'msw'
import type { JsonBodyType } from 'msw'
import type { MockState } from '../state'
import { readMockState } from '../state'

export type JsonObject = Record<string, unknown>

export type MockRequestContext = {
  method: string
  path: string
  url: URL
  payload: JsonObject
  state: MockState
}

const configuredBase = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const referenceOrigin =
  typeof location === 'undefined' ? 'http://localhost' : location.origin
const apiBase = new URL(configuredBase, referenceOrigin)
const apiPrefix = apiBase.pathname.replace(/\/$/, '')

export async function createMockRequestContext(
  request: Request,
): Promise<MockRequestContext | undefined> {
  const url = new URL(request.url)
  const matchesApi = apiPrefix
    ? url.pathname.startsWith(`${apiPrefix}/`) || url.pathname === apiPrefix
    : true
  if (apiBase.origin !== url.origin || !matchesApi) return undefined

  let payload: JsonObject = {}
  try {
    const body: unknown = await request.clone().json()
    if (body && typeof body === 'object') payload = body as JsonObject
  } catch {
    // Empty request bodies are expected for several command operations.
  }

  return {
    method: request.method.toUpperCase(),
    path: url.pathname.slice(apiPrefix.length) || '/',
    url,
    payload,
    state: readMockState(),
  }
}

export function json(data: unknown, status = 200): Response {
  return HttpResponse.json(data as JsonBodyType, { status })
}

export function empty(status = 204): Response {
  return new HttpResponse(null, { status })
}

export function apiError(
  status: number,
  code: string,
  message: string,
): Response {
  return json(
    { error: { code, message, request_id: 'mock-request-0001' } },
    status,
  )
}

export function unauthorized(): Response {
  return apiError(401, 'unauthorized', 'Please sign in to continue.')
}

export function requiresAuthentication(path: string): boolean {
  return (
    path === '/auth/logout' ||
    path === '/me' ||
    path.startsWith('/me/') ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/comments' ||
    path.startsWith('/comments/') ||
    path === '/comment-authorizations' ||
    path.startsWith('/comment-authorizations/')
  )
}

export function findItem<T extends { id: string }>(
  items: T[],
  id: string,
): T | undefined {
  return items.find((item) => item.id === id)
}

export function list<T extends object>(items: T[], url: URL) {
  const q = url.searchParams.get('q')?.toLocaleLowerCase()
  const status = url.searchParams.get('status')
  const siteId = url.searchParams.get('site_id')
  const commentsEnabled = url.searchParams.get('comments_enabled')
  const filtered = items.filter((item) => {
    const record = item as Record<string, unknown>
    if (q && !JSON.stringify(item).toLocaleLowerCase().includes(q)) return false
    if (status && status !== 'all' && record.status !== status) return false
    if (siteId && record.site_id !== siteId) return false
    if (
      commentsEnabled !== null &&
      String(record.comments_enabled) !== commentsEnabled
    )
      return false
    return true
  })

  const sort = url.searchParams.get('sort')
  if (sort) {
    const [key, direction] =
      sort === 'asc' || sort === 'desc'
        ? ['created_at', sort]
        : sort.startsWith('-')
          ? [sort.slice(1), 'desc']
          : [sort, 'asc']
    filtered.sort((left, right) => {
      const a = String((left as Record<string, unknown>)[key] ?? '')
      const b = String((right as Record<string, unknown>)[key] ?? '')
      return a.localeCompare(b) * (direction === 'desc' ? -1 : 1)
    })
  }

  const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('limit') || '10')),
  )
  return {
    rows: filtered.slice((page - 1) * limit, page * limit),
    total: filtered.length,
  }
}

export function setCommentStatus(state: MockState, id: string, status: string) {
  const item = findItem(state.comments, id)
  if (!item) return undefined
  item.status = status
  item.published_at =
    status === 'published' ? new Date().toISOString() : item.published_at
  item.deleted_at = status === 'deleted' ? new Date().toISOString() : null
  return item
}

export function setting(state: MockState, key: string, fallback: unknown) {
  return state.settings.find((item) => item.key === key)?.value ?? fallback
}
