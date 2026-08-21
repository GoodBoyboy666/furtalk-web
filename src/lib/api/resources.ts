import { api, toQuery } from './client'
import type {
  AdminComment,
  AdminCommentList,
  AdminThread,
  AdminThreadList,
  AdminThreadUpdatePayload,
  AdminUser,
  AdminUserCreatePayload,
  AdminUserList,
  AdminUserResetPasswordPayload,
  AdminUserUpdatePayload,
  AuthorizationContext,
  AuthorizationIssueResponse,
  BootstrapAdminPayload,
  BootstrapStatus,
  CaptchaConfigResponse,
  Identity,
  ListParams,
  Me,
  MeCommentDetail,
  MeCommentList,
  MeCommentSite,
  NotificationPreferences,
  OAuthCompletePayload,
  OAuthCompleteResponse,
  OAuthStartResponse,
  PasskeyOptionsResponse,
  Provider,
  ProviderUpsertPayload,
  PublicProvider,
  SettingItem,
  SettingsResponse,
  Site,
  SiteOrigin,
  SiteRequest,
  SiteUpdateRequest,
} from './types'

export const authApi = {
  me: () => api.get<Me>('/me').then((response) => response.data),
  passwordLogin: (payload: {
    email: string
    password: string
    captcha_token?: string
  }) => api.post('/auth/password/login', payload),
  emailCodeSend: (payload: { email: string; captcha_token?: string }) =>
    api.post('/auth/email-codes', payload),
  emailCodeLogin: (payload: {
    email: string
    code: string
    captcha_token?: string
  }) => api.post('/auth/email-code/login', payload),
  logout: () => api.post('/auth/logout'),
  passkeyOptions: (user_handle?: string) =>
    api
      .post<PasskeyOptionsResponse>('/auth/passkeys/login/options', {
        user_handle,
      })
      .then((response) => response.data),
  passkeyVerify: (payload: {
    challenge: string
    response: Record<string, unknown>
  }) => api.post('/auth/passkeys/login/verify', payload),
  identities: () =>
    api
      .get<{ identities: Identity[] }>('/me/identities')
      .then((response) => response.data),
  deleteIdentity: (id: string) => api.delete(`/me/identities/${id}`),
  providers: () =>
    api
      .get<{ providers: PublicProvider[] }>('/auth/providers')
      .then((response) => response.data),
  oauthStart: (key: string, purpose: 'login' | 'bind', redirect?: string) =>
    api
      .get<OAuthStartResponse>(`/auth/oauth/${key}/start`, {
        params: { purpose, redirect },
      })
      .then((response) => response.data),
  oauthComplete: (key: string, payload: OAuthCompletePayload) =>
    api
      .post<OAuthCompleteResponse>(`/auth/oauth/${key}/complete`, payload)
      .then((response) => response.data),
  passkeyRegistrationOptions: () =>
    api
      .post<PasskeyOptionsResponse>('/me/passkeys/options')
      .then((response) => response.data),
  finishPasskeyRegistration: (payload: {
    challenge: string
    response: Record<string, unknown>
  }) => api.post('/me/passkeys', payload),
  deletePasskey: (id: string) => api.delete(`/me/passkeys/${id}`),
  renamePasskey: (id: string, name: string) =>
    api.patch(`/me/passkeys/${id}`, { name }),
  updateMe: (payload: { nickname?: string; website_url?: string | null }) =>
    api.patch<Me>('/me', payload).then((response) => response.data),
  updateNotifications: (payload: NotificationPreferences) =>
    api
      .patch<NotificationPreferences>('/me/notification-preferences', payload)
      .then((response) => response.data),
  changePassword: (payload: {
    current_password?: string
    new_password: string
  }) => api.post('/me/password', payload),
  revokeSessions: () => api.post('/me/sessions/revoke'),
  passwordResetCode: (payload: { email: string; captcha_token?: string }) =>
    api.post('/auth/password/reset-codes', payload),
  passwordResetConfirm: (payload: {
    email: string
    code: string
    new_password: string
  }) => api.post('/auth/password/reset', payload),
}

export const captchaApi = {
  config: (action: string) =>
    api
      .get<CaptchaConfigResponse>('/captcha/config', { params: { action } })
      .then((response) => response.data),
}

export const authorizationApi = {
  context: (siteId: string, origin: string) =>
    api
      .get<AuthorizationContext>('/comment-authorizations/context', {
        params: { site_id: siteId, origin },
      })
      .then((response) => response.data),
  issue: (payload: { site_id: string; origin: string; request_id: string }) =>
    api
      .post<AuthorizationIssueResponse>('/comment-authorizations', payload)
      .then((response) => response.data),
}

export const bootstrapApi = {
  status: () =>
    api
      .get<BootstrapStatus>('/bootstrap/status')
      .then((response) => response.data),
  createAdmin: (payload: BootstrapAdminPayload) =>
    api.post('/bootstrap/admin', payload),
}

export const commentsApi = {
  list: (params: ListParams) =>
    api
      .get<AdminCommentList>('/admin/comments', { params: toQuery(params) })
      .then((response) => response.data),
  get: (id: string) =>
    api
      .get<AdminComment>(`/admin/comments/${id}`)
      .then((response) => response.data),
  update: (id: string, body: string) =>
    api
      .patch(`/admin/comments/${id}`, { body })
      .then((response) => response.data),
  publish: (id: string) => api.post(`/admin/comments/${id}/publish`),
  pending: (id: string) => api.post(`/admin/comments/${id}/pending`),
  spam: (id: string) => api.post(`/admin/comments/${id}/spam`),
  restore: (id: string) => api.post(`/admin/comments/${id}/restore`),
  remove: (id: string, hard: boolean) =>
    api.delete(`/admin/comments/${id}`, { params: { hard, confirm: true } }),
}

export const meCommentsApi = {
  list: (params: ListParams) =>
    api
      .get<MeCommentList>('/me/comments', { params: toQuery(params) })
      .then((response) => response.data),
  sites: () =>
    api
      .get<{ sites: MeCommentSite[] }>('/me/comments/sites')
      .then((response) => response.data),
  get: (id: string) =>
    api
      .get<MeCommentDetail>(`/me/comments/${id}`)
      .then((response) => response.data),
  reply: (id: string, body: string, captchaToken?: string) =>
    api
      .post(`/comments/${id}/replies`, { body, captcha_token: captchaToken })
      .then((response) => response.data),
  remove: (id: string) =>
    api
      .delete<{ deleted_root_id: string; hard: boolean }>(`/comments/${id}`)
      .then((response) => response.data),
}

export const sitesApi = {
  list: () =>
    api
      .get<{ sites: Site[] }>('/admin/sites')
      .then((response) => response.data),
  get: (id: string) =>
    api.get<Site>(`/admin/sites/${id}`).then((response) => response.data),
  create: (payload: SiteRequest) =>
    api.post<Site>('/admin/sites', payload).then((response) => response.data),
  update: (id: string, payload: SiteUpdateRequest) =>
    api
      .patch<Site>(`/admin/sites/${id}`, payload)
      .then((response) => response.data),
  remove: (id: string) =>
    api.delete(`/admin/sites/${id}`, { params: { confirm: true } }),
  addOrigin: (id: string, origin: string) =>
    api
      .post<SiteOrigin>(`/admin/sites/${id}/origins`, { origin })
      .then((response) => response.data),
  updateOrigin: (siteId: string, originId: string, origin: string) =>
    api
      .patch<SiteOrigin>(`/admin/sites/${siteId}/origins/${originId}`, {
        origin,
      })
      .then((response) => response.data),
  removeOrigin: (siteId: string, originId: string) =>
    api.delete(`/admin/sites/${siteId}/origins/${originId}`),
}

export const threadsApi = {
  list: (siteId: string, params: ListParams) =>
    api
      .get<AdminThreadList>(`/admin/sites/${siteId}/threads`, {
        params: toQuery(params),
      })
      .then((response) => response.data),
  update: (
    siteId: string,
    threadId: string,
    payload: AdminThreadUpdatePayload,
  ) =>
    api
      .patch<AdminThread>(`/admin/sites/${siteId}/threads/${threadId}`, payload)
      .then((response) => response.data),
  remove: (siteId: string, threadId: string) =>
    api.delete(`/admin/sites/${siteId}/threads/${threadId}`, {
      params: { confirm: true },
    }),
}

export const usersApi = {
  list: (params: ListParams) =>
    api
      .get<AdminUserList>('/admin/users', { params: toQuery(params) })
      .then((response) => response.data),
  get: (id: string) =>
    api.get<AdminUser>(`/admin/users/${id}`).then((response) => response.data),
  update: (id: string, payload: AdminUserUpdatePayload) =>
    api
      .patch<AdminUser>(`/admin/users/${id}`, payload)
      .then((response) => response.data),
  create: (payload: AdminUserCreatePayload) =>
    api
      .post<AdminUser>('/admin/users', payload)
      .then((response) => response.data),
  resetPassword: (id: string, payload: AdminUserResetPasswordPayload) =>
    api.post(`/admin/users/${id}/password`, payload),
  remove: (id: string, mode: 'soft' | 'hard') =>
    api.delete(`/admin/users/${id}`, {
      params: { mode, confirm: mode === 'hard' },
    }),
  restore: (id: string) =>
    api
      .post<AdminUser>(`/admin/users/${id}/restore`)
      .then((response) => response.data),
}

export const settingsApi = {
  get: () =>
    api
      .get<SettingsResponse>('/admin/settings')
      .then((response) => response.data),
  patch: (settings: SettingItem[]) =>
    api
      .patch<SettingsResponse>('/admin/settings', { settings })
      .then((response) => response.data),
}

export const providersApi = {
  list: () =>
    api
      .get<{ providers: Provider[] }>('/admin/providers')
      .then((response) => response.data),
  upsert: (key: string, payload: ProviderUpsertPayload) =>
    api.put(`/admin/providers/${key}`, payload),
  test: (key: string) => api.post(`/admin/providers/${key}/test`),
  remove: (key: string) => api.delete(`/admin/providers/${key}`),
}

// notificationApi 是公开的邮件通知操作；退订端点 CSRF 豁免，token 只提交
// 给后端验证，前端绝不展示或记录原始值。
export const notificationApi = {
  unsubscribe: (token: string) =>
    api.post('/notification-unsubscriptions', { token }),
}
