import type { Site } from '../../lib/api/types'
import type { MockRequestContext } from './context'
import { apiError, empty, findItem, json, list } from './context'
import { writeMockState } from '../state'

export function handleSitesAndThreads({
  method,
  path,
  url,
  payload,
  state,
}: MockRequestContext): Response | undefined {
  if (method === 'GET' && path === '/admin/sites')
    return json({ sites: state.sites })
  const siteOrigin = path.match(
    /^\/admin\/sites\/([^/]+)\/origins(?:\/([^/]+))?$/,
  )
  const siteThreads = path.match(
    /^\/admin\/sites\/([^/]+)\/threads(?:\/([^/]+))?$/,
  )
  const threadBatch = path.match(/^\/admin\/sites\/([^/]+)\/threads\/batch$/)
  if (siteOrigin) {
    const site = findItem(state.sites, siteOrigin[1])
    if (!site) return apiError(404, 'site_not_found', 'Site was not found.')
    if (!siteOrigin[2] && method === 'POST') {
      const origin = {
        id: String(state.nextId++),
        origin: String(payload.origin || ''),
      }
      site.origins.push(origin)
      writeMockState(state)
      return json(origin)
    }
    const originIndex = site.origins.findIndex(
      (item) => item.id === siteOrigin[2],
    )
    if (originIndex < 0)
      return apiError(404, 'origin_not_found', 'Origin was not found.')
    if (method === 'PATCH') {
      site.origins[originIndex] = {
        ...site.origins[originIndex],
        origin: String(payload.origin || ''),
      }
      writeMockState(state)
      return json(site.origins[originIndex])
    }
    if (method === 'DELETE') {
      site.origins.splice(originIndex, 1)
      writeMockState(state)
      return empty()
    }
  }
  if (threadBatch && method === 'POST') {
    const ids = Array.isArray(payload.ids) ? payload.ids.map(String) : []
    const action = String(payload.action || '')
    let changed = 0
    if (action === 'hard_delete') {
      state.threads = state.threads.filter(
        (item) => !ids.includes(item.id) || item.site_id !== threadBatch[1],
      )
      state.comments = state.comments.filter(
        (item) =>
          !ids.includes(item.thread_id) || item.site_id !== threadBatch[1],
      )
    } else
      for (const thread of state.threads.filter(
        (item) => item.site_id === threadBatch[1] && ids.includes(item.id),
      )) {
        if (action === 'enable') thread.comments_enabled = true
        if (action === 'disable') thread.comments_enabled = false
        changed++
      }
    if (action === 'hard_delete') changed = ids.length
    writeMockState(state)
    return json({
      action,
      requested_count: ids.length,
      changed_count: changed,
      unchanged_count: Math.max(0, ids.length - changed),
    })
  }
  if (siteThreads) {
    const site = findItem(state.sites, siteThreads[1])
    if (!site) return apiError(404, 'site_not_found', 'Site was not found.')
    const threads = state.threads.filter((item) => item.site_id === site.id)
    if (!siteThreads[2] && method === 'GET') {
      const result = list(threads, url)
      return json({ threads: result.rows, total: result.total })
    }
    const thread = findItem(threads, siteThreads[2])
    if (!thread)
      return apiError(404, 'thread_not_found', 'Thread was not found.')
    if (method === 'PATCH') {
      Object.assign(thread, payload, { updated_at: new Date().toISOString() })
      writeMockState(state)
      return json(thread)
    }
    if (method === 'DELETE') {
      state.threads = state.threads.filter((item) => item.id !== thread.id)
      state.comments = state.comments.filter(
        (item) => item.thread_id !== thread.id,
      )
      writeMockState(state)
      return empty()
    }
  }
  if (method === 'POST' && path === '/admin/sites') {
    const created: Site = {
      id: String(state.nextId++),
      name: String(payload.name || 'New site'),
      canonical_url: String(payload.canonical_url || ''),
      status: 'active',
      origins: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    state.sites.push(created)
    writeMockState(state)
    return json(created, 201)
  }
  const sitePath = path.match(/^\/admin\/sites\/([^/]+)$/)
  if (sitePath) {
    const site = findItem(state.sites, sitePath[1])
    if (!site && method !== 'POST')
      return apiError(404, 'site_not_found', 'Site was not found.')
    if (method === 'GET' && site) return json(site)
    if (method === 'PATCH' && site) {
      Object.assign(site, payload, { updated_at: new Date().toISOString() })
      writeMockState(state)
      return json(site)
    }
    if (method === 'DELETE' && site) {
      state.sites = state.sites.filter((item) => item.id !== site.id)
      state.threads = state.threads.filter((item) => item.site_id !== site.id)
      state.comments = state.comments.filter((item) => item.site_id !== site.id)
      writeMockState(state)
      return empty()
    }
  }

  return undefined
}
