// @vitest-environment jsdom
import { createMemoryHistory } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { getRouter } from '@/router'
import { parseRequestId, parseSiteId } from '@/lib/authorize'

const REQUEST_ID = 'AQEBAQEBAQEBAQEBAQEBAQ'
const MAX_INT64 = '9223372036854775807'

async function loadLocation(url: string) {
  const router = getRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  return router.state.location
}

describe('router external-entry search parsing', () => {
  it('keeps site_id and request_id on /authorize after Router initialization', async () => {
    const location = await loadLocation(
      `/authorize?site_id=1&request_id=${REQUEST_ID}`,
    )
    const search = location.search as Record<string, unknown>

    expect(location.pathname).toBe('/authorize')
    expect(search.site_id).toBe('1')
    expect(search.request_id).toBe(REQUEST_ID)
    expect(location.searchStr).toContain('site_id=1')
    expect(location.searchStr).toContain(`request_id=${REQUEST_ID}`)
    expect(parseSiteId(search.site_id)).toBe('1')
    expect(parseRequestId(search.request_id)).toBe(REQUEST_ID)
  })

  it('preserves max-int64 site_id text without precision loss', async () => {
    const location = await loadLocation(
      `/authorize?site_id=${MAX_INT64}&request_id=${REQUEST_ID}`,
    )
    const search = location.search as Record<string, unknown>

    expect(search.site_id).toBe(MAX_INT64)
    expect(parseSiteId(search.site_id)).toBe(MAX_INT64)
    expect(location.searchStr).toContain(`site_id=${MAX_INT64}`)
  })

  it('exposes login authorize marker and redirect as raw strings', async () => {
    const redirect = '/authorize?site_id=1&request_id=xyz'
    const location = await loadLocation(
      `/login?authorize=1&redirect=${encodeURIComponent(redirect)}`,
    )
    const search = location.search as Record<string, unknown>

    expect(search.authorize).toBe('1')
    expect(search.redirect).toBe(redirect)
    expect(location.searchStr).toContain('authorize=1')
    expect(location.searchStr).toContain(
      `redirect=${encodeURIComponent(redirect)}`,
    )
  })

  it('exposes account-comment site_id filter as the string "1"', async () => {
    const location = await loadLocation('/account/comments?site_id=1')
    const search = location.search as Record<string, unknown>

    expect(search.site_id).toBe('1')
    expect(location.searchStr).toContain('site_id=1')
  })

  it('still rejects malformed authorization parameters via the strict parsers', async () => {
    const location = await loadLocation(
      `/authorize?site_id=0&request_id=${encodeURIComponent('bad id!')}`,
    )
    const search = location.search as Record<string, unknown>

    expect(parseSiteId(search.site_id)).toBeNull()
    expect(parseRequestId(search.request_id)).toBeNull()
  })
})

describe('router internal navigation serialization', () => {
  it('serializes numeric-looking strings without JSON quote characters', async () => {
    const router = getRouter({
      history: createMemoryHistory({ initialEntries: ['/account/comments'] }),
    })
    await router.load()
    await router.navigate({
      to: '/account/comments',
      search: { site_id: MAX_INT64 },
    })
    const location = router.state.location
    const search = location.search as Record<string, unknown>

    expect(location.searchStr).toContain(`site_id=${MAX_INT64}`)
    expect(location.searchStr).not.toContain('"')
    expect(search.site_id).toBe(MAX_INT64)
  })

  it('omits undefined search keys from the canonical URL', async () => {
    const router = getRouter({
      history: createMemoryHistory({ initialEntries: ['/account/comments'] }),
    })
    await router.load()
    await router.navigate({
      to: '/account/comments',
      search: { site_id: '1', status: undefined },
    })
    const location = router.state.location

    expect(location.searchStr).toBe('?site_id=1')
  })
})

describe('router external-entry search for the remaining search-reading routes', () => {
  it('exposes the reset-password email prefill as a decoded string', async () => {
    const location = await loadLocation(
      '/reset-password?email=user%40example.com',
    )
    const search = location.search as Record<string, unknown>

    expect(search.email).toBe('user@example.com')
  })

  it('keeps the authorize search strict when the widget URL is replayed exactly', async () => {
    const generated = `/authorize?site_id=${MAX_INT64}&request_id=${REQUEST_ID}`
    const location = await loadLocation(generated)

    expect(location.href).toBe(generated)
  })
})

describe('router login layout route matching', () => {
  it('matches /login/otp to the OTP route under the login layout', async () => {
    const router = getRouter({
      history: createMemoryHistory({ initialEntries: ['/login/otp'] }),
    })
    await router.load()
    // 路由树必须把 /login/otp 解析为 LoginOtpRoute（id 含 /otp），
    // 而不是停留在 /login 的 index；这样父布局渲染 Outlet 后页面才会切换。
    const ids = router.state.matches.map((match) => match.routeId)
    expect(ids).toContain('/login/otp')
    expect(ids).not.toContain('/login/')
  })

  it('matches /login to the index route under the login layout', async () => {
    const router = getRouter({
      history: createMemoryHistory({ initialEntries: ['/login'] }),
    })
    await router.load()
    const ids = router.state.matches.map((match) => match.routeId)
    expect(ids).toContain('/login/')
  })
})
