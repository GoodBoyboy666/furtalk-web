import { http, passthrough } from 'msw'
import type { RequestHandler } from 'msw'
import { handleAuthAccount } from './handlers/auth-account'
import { handleComments } from './handlers/comments'
import { handlePublic } from './handlers/public'
import { handleSitesAndThreads } from './handlers/sites-threads'
import { handleUsersSettingsProviders } from './handlers/users-settings-providers'
import {
  apiError,
  createMockRequestContext,
  requiresAuthentication,
  unauthorized,
} from './handlers/context'

export const mockOperationInventory = [
  'GET /me',
  'POST /auth/password/login',
  'POST /auth/email-codes',
  'POST /auth/email-code/login',
  'POST /auth/logout',
  'POST /auth/passkeys/login/options',
  'POST /auth/passkeys/login/verify',
  'GET /me/identities',
  'DELETE /me/identities/{id}',
  'GET /auth/providers',
  'GET /auth/oauth/{key}/start',
  'POST /auth/oauth/{key}/complete',
  'POST /me/passkeys/options',
  'POST /me/passkeys',
  'DELETE /me/passkeys/{id}',
  'PATCH /me/passkeys/{id}',
  'PATCH /me',
  'PATCH /me/notification-preferences',
  'POST /me/password',
  'POST /me/sessions/revoke',
  'POST /auth/password/reset-codes',
  'POST /auth/password/reset',
  'GET /captcha/config',
  'GET /config',
  'GET /comment-authorizations/context',
  'POST /comment-authorizations',
  'GET /bootstrap/status',
  'POST /bootstrap/admin',
  'GET /admin/comments',
  'GET /admin/comments/trend',
  'POST /admin/comments/batch',
  'GET /admin/comments/{id}',
  'PATCH /admin/comments/{id}',
  'PUT /admin/comments/{id}/pin',
  'DELETE /admin/comments/{id}/pin',
  'POST /admin/comments/{id}/publish',
  'POST /admin/comments/{id}/pending',
  'POST /admin/comments/{id}/spam',
  'POST /admin/comments/{id}/restore',
  'DELETE /admin/comments/{id}',
  'GET /me/comments',
  'GET /me/comments/sites',
  'GET /me/comments/{id}',
  'POST /comments/{id}/replies',
  'DELETE /comments/{id}',
  'GET /admin/sites',
  'GET /admin/sites/{id}',
  'POST /admin/sites',
  'PATCH /admin/sites/{id}',
  'DELETE /admin/sites/{id}',
  'POST /admin/sites/{id}/origins',
  'PATCH /admin/sites/{id}/origins/{origin_id}',
  'DELETE /admin/sites/{id}/origins/{origin_id}',
  'GET /admin/sites/{id}/threads',
  'PATCH /admin/sites/{id}/threads/{thread_id}',
  'DELETE /admin/sites/{id}/threads/{thread_id}',
  'POST /admin/sites/{id}/threads/batch',
  'GET /admin/users',
  'POST /admin/users/batch',
  'GET /admin/users/{id}',
  'PATCH /admin/users/{id}',
  'POST /admin/users',
  'POST /admin/users/{id}/password',
  'DELETE /admin/users/{id}',
  'POST /admin/users/{id}/restore',
  'GET /admin/settings',
  'PATCH /admin/settings',
  'POST /admin/settings/legal-consent/reset',
  'GET /admin/providers',
  'PUT /admin/providers/{key}',
  'POST /admin/providers/{key}/test',
  'DELETE /admin/providers/{key}',
  'POST /notification-unsubscriptions',
] as const

async function dispatch(request: Request): Promise<Response> {
  const context = await createMockRequestContext(request)
  if (!context) return passthrough()
  if (requiresAuthentication(context.path) && !context.state.authenticated)
    return unauthorized()

  for (const handle of [
    handlePublic,
    handleAuthAccount,
    handleComments,
    handleSitesAndThreads,
    handleUsersSettingsProviders,
  ]) {
    const response = handle(context)
    if (response) return response
  }

  const message = `No MSW response is defined for ${context.method} ${context.path}. Add a mock for this Web API operation.`
  console.error(`[MSW mock] ${message}`)
  return apiError(501, 'mock_operation_unhandled', message)
}

export const handlers: RequestHandler[] = [
  http.all('*', ({ request }) => dispatch(request)),
]

export { resetMockState as resetMockHandlersState } from './state'
