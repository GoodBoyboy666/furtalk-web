import { createFileRoute } from '@tanstack/react-router'

// AuthorizeSearch 是授权页 URL 参数：site_id（十进制字符串）与 request_id（base64url）。
type AuthorizeSearch = {
  site_id?: string
  request_id?: string
}

export const Route = createFileRoute('/authorize')({
  validateSearch: (search: Record<string, unknown>): AuthorizeSearch => ({
    site_id: typeof search.site_id === 'string' ? search.site_id : undefined,
    request_id:
      typeof search.request_id === 'string' ? search.request_id : undefined,
  }),
})
