export type ApiErrorBody = {
  code?: string
  message?: string
  details?: Record<string, unknown>
  request_id?: string
}

export type ApiErrorResponse = { error?: ApiErrorBody }

export type Me = {
  id: string
  email: string
  nickname: string
  website_url: string | null
  avatar_url: string
  role: string
  status: string
  email_verified: boolean
  has_password: boolean
  created_at: string
  updated_at: string
  notification_preferences: NotificationPreferences
}

export type NotificationPreferences = {
  moderation_enabled: boolean
  reply_enabled: boolean
}

export type Identity = {
  id: string
  kind: string
  name?: string
  provider?: string
  created_at?: string
  last_used_at?: string | null
}

// WebAuthnEnvelope 是后端 go-webauthn 输出的顶层浏览器选项包装对象。
// 字节字段（challenge、user.id、credential ids）在 HTTP 边界是 base64url 字符串，
// 由 passkey helper 在调用 navigator.credentials 前转换为 ArrayBuffer。
export type WebAuthnEnvelope = {
  publicKey: Record<string, unknown>
  mediation?: 'optional' | 'required' | 'silent'
}

export type PasskeyOptionsResponse = {
  challenge: string
  options: WebAuthnEnvelope
}

export type AdminComment = {
  id: string
  site_id: string
  thread_id: string
  root_id: string | null
  parent_id: string | null
  user_id: string
  author_email: string
  author_nickname: string
  author_website: string | null
  avatar_url: string
  body: string
  status: string
  is_pinned: boolean
  depth: number
  /** 被回复作者的 id；根评论为 nil，被回复者注销后也为 nil。 */
  reply_to_user_id: string | null
  /** 被回复作者的当前昵称；缺失或已注销时为 null。 */
  reply_to_nickname: string | null
  created_at: string
  published_at: string | null
  deleted_at: string | null
  ip_mode: string
  ip_value: string | null
  ua_browser: string | null
  ua_device: string | null
  ua_os: string | null
  ua_mode: string
  ua_raw?: string | null
}

export type AdminCommentList = {
  comments: AdminComment[]
  total: number
}

// AdminThread 是管理端线程视图：页面级评论开关与生命周期时间戳。
export type AdminThread = {
  id: string
  site_id: string
  site_name: string
  page_key: string
  page_url: string | null
  page_title: string | null
  comments_enabled: boolean
  created_at: string
  updated_at: string
}

export type AdminThreadList = {
  threads: AdminThread[]
  total: number
}

export type AdminThreadUpdatePayload = {
  /** 可选；省略保持现状。 */
  page_key?: string
  /** 可选；省略保持现状，显式 null/空白清空，非空值覆盖。 */
  page_title?: string | null
  /** 可选；省略保持现状，显式 null/空白清空，非空值覆盖。 */
  page_url?: string | null
  comments_enabled?: boolean
}

// MeComment 是本人评论的展示视图，不含邮箱/IP/UA 等管理字段。
export type MeComment = {
  id: string
  site_id: string
  site_name: string
  thread_id: string
  page_key: string
  page_url: string | null
  page_title: string | null
  user_id: string
  parent_id: string | null
  root_id: string | null
  depth: number
  body: string
  status: string
  author_nickname: string
  author_website: string | null
  avatar_url: string
  /** 被回复作者的 id；根评论为 nil，被回复者注销后也为 nil。 */
  reply_to_user_id: string | null
  /** 被回复作者的当前昵称；缺失或已注销时为 null。 */
  reply_to_nickname: string | null
  created_at: string
  published_at: string | null
  deleted_at: string | null
}

export type MeCommentList = {
  comments: MeComment[]
  total: number
  user_delete_mode: string
}

export type MeCommentDetail = MeComment & {
  user_delete_mode: string
}

export type MeCommentSite = {
  id: string
  name: string
}

export type SiteOrigin = {
  id: string
  origin: string
}

export type Site = {
  id: string
  name: string
  canonical_url: string
  status: string
  origins: SiteOrigin[]
  created_at: string
  updated_at: string
}

export type SiteRequest = { name: string; canonical_url: string }
export type SiteUpdateRequest = Partial<SiteRequest> & { status?: string }
export type OriginRequest = { origin: string }

export type AdminUser = {
  id: string
  email: string
  nickname: string
  website_url: string | null
  avatar_url: string
  role: string
  status: string
  email_verified: boolean
  has_password: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// 角色与状态枚举与后端常量一一对应；moderator/suspended 不是合法值。
export const USER_ROLES = ['admin', 'user'] as const
export const USER_STATUSES = ['active', 'disabled'] as const
export type UserRole = (typeof USER_ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]

export type AdminUserList = {
  users: AdminUser[]
  total: number
}

export type AdminUserDeletePayload = {
  mode: 'soft' | 'hard'
  confirm?: boolean
}

export type AdminUserCreatePayload = {
  email: string
  nickname: string
  website_url?: string | null
  role: UserRole
  /** 可选初始密码；设置密码不会自动验证邮箱。 */
  password?: string
  email_verified?: boolean
}

export type AdminUserUpdatePayload = {
  email?: string
  nickname?: string
  /** 省略保留现有值；显式 null 清除网站。 */
  website_url?: string | null
  role?: UserRole
  status?: UserStatus
  email_verified?: boolean
}

export type AdminUserResetPasswordPayload = {
  password: string
}

export type SettingType = 'string' | 'integer' | 'boolean' | 'json'

export type SettingItem = {
  key: string
  type: SettingType
  value: unknown
}

export type SettingsResponse = {
  settings: SettingItem[]
}

export type Provider = {
  provider_key: string
  kind: string
  /** 仅 OAuth/OIDC/Spam 返回；CAPTCHA 提供商没有启用语义。 */
  enabled?: boolean
  configured: boolean
  public_config: Record<string, unknown>
}

/** ProviderKind 与后端 domain.ProviderKind 一致。 */
export const PROVIDER_KINDS = ['captcha', 'oauth', 'oidc', 'spam'] as const
export type ProviderKind = (typeof PROVIDER_KINDS)[number]

/**
 * ProviderUpsertPayload 是 Provider 新增/更新请求。
 * CAPTCHA 不允许携带 enabled；新建 OAuth/OIDC 必须提供机密字段
 * （client_secret 或 Apple private_key），编辑已配置项省略或留空表示保留现有机密。
 * Spam 必须携带 enabled，只接受固定 key（spam.local / spam.akismet / spam.aliyun / spam.tencent）。
 */
export type ProviderUpsertPayload = {
  kind: ProviderKind
  enabled?: boolean
  config: {
    /** 所有 OAuth/OIDC 预设与自定义 OIDC 必填。 */
    client_id?: string
    /** 新建必填；编辑留空保留，非空替换。 */
    client_secret?: string
    /** 仅自定义 OIDC；GitHub/Google 使用固定预设。 */
    issuer_url?: string
    /** GitLab（默认 https://gitlab.com）/ Gitea / Mastodon 实例地址。 */
    instance_url?: string
    /** Apple Sign in with Apple 专用：Team ID。 */
    team_id?: string
    /** Apple Sign in with Apple 专用：Key ID。 */
    key_id?: string
    /** Apple 专用：P-256 .p8 私钥；新建必填，编辑留空保留。 */
    private_key?: string
    /** CAPTCHA 专用；Spam 腾讯云凭据组的 SecretKey 也复用该字段。 */
    provider?: string
    site_key?: string
    secret_key?: string
    endpoint?: string
    /** Spam 本地词库专用：绝对路径与昵称检测开关。 */
    file_path?: string
    check_nickname?: boolean
    /** Spam 二元渠道（本地/Akismet）命中动作。 */
    action?: string
    /** Spam Akismet 专用：API key；新建必填，编辑留空保留。 */
    api_key?: string
    /** Spam 云渠道专用：区域与可选业务策略。 */
    region?: string
    biz_type?: string
    /** Spam 阿里云专用：AccessKey 凭据组。 */
    access_key_id?: string
    access_key_secret?: string
    /** Spam 腾讯云专用：SecretId；SecretKey 复用上面的 secret_key 字段。 */
    secret_id?: string
  }
}

/** PublicProvider 是登录页/绑定页使用的公共 Provider 元数据。 */
export type PublicProvider = {
  key: string
  kind: string
  name: string
}

export type OAuthStartResponse = {
  auth_url: string
}

/** OAuthCompletePayload 是登录完成端点的请求；handoff 与直接回调参数互斥。 */
export type OAuthCompletePayload = {
  handoff?: string
  state?: string
  code?: string
  error?: string
}

/** OAuthCompleteResponse 是登录完成端点的成功响应，redirect 为站内回跳地址。 */
export type OAuthCompleteResponse = {
  redirect: string
}

export type CaptchaConfig = {
  provider: string
  site_key: string
  api_endpoint?: string
}

export type CaptchaConfigResponse =
  { required: false } | { required: true; captcha: CaptchaConfig }

// AuthorizationContext 是 /authorize 授权页展示所需的只读上下文。
export type AuthorizationContext = {
  site_id: string
  site_name: string
  origin: string
}

// AuthorizationIssueResponse 是一次性 widget 授权码颁发响应。
export type AuthorizationIssueResponse = {
  code: string
  request_id: string
  expires_at: string
}

export type ListParams = Record<string, string | number | boolean | undefined>

export type BootstrapStatus = {
  required: boolean
}

export type BootstrapAdminPayload = {
  setup_token: string
  email: string
  nickname: string
  password: string
}
