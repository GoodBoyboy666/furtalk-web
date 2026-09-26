import type { MockRequestContext } from './context'
import { apiError, empty, findItem, json } from './context'

function publicConfig(state: MockRequestContext['state']) {
  const value = (key: string, fallback: unknown) =>
    state.settings.find((item) => item.key === key)?.value ?? fallback
  return {
    user_agreement_url: value('user_agreement_url', ''),
    privacy_policy_url: value('privacy_policy_url', ''),
    legal_consent_version: value('legal_consent_version', 1),
    brand_primary_color: value('brand_primary_color', '#18181B'),
  }
}

export function handlePublic({
  method,
  path,
  url,
  state,
}: MockRequestContext): Response | undefined {
  if (method === 'GET' && path === '/config') return json(publicConfig(state))
  if (method === 'GET' && path === '/captcha/config')
    return json({ required: false })
  if (method === 'GET' && path === '/bootstrap/status')
    return json({ required: false })
  if (method === 'POST' && path === '/bootstrap/admin') return empty()

  const authComment = path.match(/^\/comment-authorizations\/context$/)
  if (method === 'GET' && authComment) {
    const siteId = url.searchParams.get('site_id') || ''
    const origin = url.searchParams.get('origin') || ''
    const site = findItem(state.sites, siteId)
    if (!site || !site.origins.some((item) => item.origin === origin))
      return apiError(
        404,
        'authorization_not_found',
        'This site and origin are not registered.',
      )
    return json({ site_id: site.id, site_name: site.name, origin })
  }
  if (method === 'POST' && path === '/comment-authorizations')
    return json({
      code: `demo-${state.nextId}`,
      request_id: `mock-request-${state.nextId}`,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    })

  if (method === 'POST' && path === '/notification-unsubscriptions')
    return empty()

  return undefined
}
