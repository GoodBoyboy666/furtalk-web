import type {
  AdminComment,
  AdminThread,
  AdminUser,
  Identity,
  Me,
  MeComment,
  Provider,
  SettingItem,
  Site,
} from '../lib/api/types'

const storageKey = 'furtalk:msw:session:v1'
const now = '2026-09-01T09:00:00.000Z'

export const demoCredentials = {
  email: 'admin@example.test',
  password: 'Furtalk-Demo-2026!',
} as const

export type MockState = {
  authenticated: boolean
  me: Me
  identities: Identity[]
  users: AdminUser[]
  sites: Site[]
  threads: AdminThread[]
  comments: AdminComment[]
  settings: SettingItem[]
  providers: Provider[]
  nextId: number
}

export function createInitialMockState(): MockState {
  const admin: AdminUser = {
    id: '1',
    email: demoCredentials.email,
    nickname: 'Demo Admin',
    website_url: null,
    avatar_url: 'https://www.gravatar.com/avatar/demo-admin',
    role: 'admin',
    status: 'active',
    email_verified: true,
    has_password: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  const users: AdminUser[] = [
    admin,
    {
      id: '2',
      email: 'alex@example.test',
      nickname: 'Alex Chen',
      website_url: 'https://alex.example.test',
      avatar_url: 'https://www.gravatar.com/avatar/alex',
      role: 'user',
      status: 'active',
      email_verified: true,
      has_password: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    {
      id: '3',
      email: 'sam@example.test',
      nickname: 'Sam Rivera',
      website_url: null,
      avatar_url: 'https://www.gravatar.com/avatar/sam',
      role: 'user',
      status: 'disabled',
      email_verified: false,
      has_password: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  ]
  const sites: Site[] = [
    {
      id: '1',
      name: 'Furtalk Demo',
      canonical_url: 'https://demo.example.test',
      status: 'active',
      origins: [
        { id: '1', origin: 'https://demo.example.test' },
        { id: '2', origin: 'http://localhost:5173' },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: '2',
      name: 'Docs Preview',
      canonical_url: 'https://docs.example.test',
      status: 'active',
      origins: [{ id: '3', origin: 'https://docs.example.test' }],
      created_at: now,
      updated_at: now,
    },
  ]
  const threads: AdminThread[] = [
    {
      id: '1',
      site_id: '1',
      site_name: sites[0].name,
      page_key: '/',
      page_url: 'https://demo.example.test/',
      page_title: 'Welcome',
      comments_enabled: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '2',
      site_id: '1',
      site_name: sites[0].name,
      page_key: '/guide',
      page_url: 'https://demo.example.test/guide',
      page_title: 'Getting started',
      comments_enabled: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: '3',
      site_id: '2',
      site_name: sites[1].name,
      page_key: '/intro',
      page_url: 'https://docs.example.test/intro',
      page_title: 'Introduction',
      comments_enabled: false,
      created_at: now,
      updated_at: now,
    },
  ]
  const comments: AdminComment[] = [
    comment('1', '1', '1', 'This is a useful demo comment.', 'published', 1),
    comment('2', '3', '1', 'Could you add one more example?', 'pending', 1),
    comment('3', '2', '2', 'The guide was easy to follow.', 'published', 1),
    comment('4', '3', '3', 'I found a small typo.', 'spam', 3),
  ]
  const me: Me = {
    id: admin.id,
    email: admin.email,
    nickname: admin.nickname,
    website_url: admin.website_url,
    avatar_url: admin.avatar_url,
    role: admin.role,
    status: admin.status,
    email_verified: admin.email_verified,
    has_password: admin.has_password,
    created_at: admin.created_at,
    updated_at: admin.updated_at,
    notification_preferences: { moderation_enabled: true, reply_enabled: true },
  }
  const settings: SettingItem[] = [
    { key: 'comment_mode', type: 'string', value: 'anonymous' },
    { key: 'comment_sort', type: 'string', value: 'asc' },
    { key: 'moderation', type: 'string', value: 'direct' },
    { key: 'user_delete_mode', type: 'string', value: 'soft' },
    { key: 'max_reply_depth', type: 'integer', value: 3 },
    { key: 'public_registration', type: 'boolean', value: true },
    {
      key: 'privacy',
      type: 'json',
      value: { ip_mode: 'coarse', ua_mode: 'coarse' },
    },
    { key: 'captcha_policy', type: 'json', value: {} },
    {
      key: 'notifications',
      type: 'json',
      value: { moderation: true, replies: true },
    },
    { key: 'email_domain_whitelist', type: 'json', value: [] },
    { key: 'email_domain_blacklist', type: 'json', value: [] },
    {
      key: 'gravatar_base_url',
      type: 'string',
      value: 'https://www.gravatar.com/avatar',
    },
    { key: 'captcha_provider', type: 'string', value: '' },
    { key: 'emoji_catalog_url', type: 'string', value: '' },
    { key: 'user_agreement_url', type: 'string', value: '' },
    { key: 'privacy_policy_url', type: 'string', value: '' },
    { key: 'legal_consent_version', type: 'integer', value: 1 },
    { key: 'brand_primary_color', type: 'string', value: '#18181B' },
  ]
  const providers: Provider[] = []
  return {
    authenticated: false,
    me,
    identities: [],
    users,
    sites,
    threads,
    comments,
    settings,
    providers,
    nextId: 10,
  }
}

function comment(
  id: string,
  userId: string,
  threadId: string,
  body: string,
  status: string,
  siteId: number,
): AdminComment {
  const user =
    userId === '1'
      ? {
          email: 'admin@example.test',
          nickname: 'Demo Admin',
          avatar: 'demo-admin',
        }
      : userId === '2'
        ? { email: 'alex@example.test', nickname: 'Alex Chen', avatar: 'alex' }
        : { email: 'sam@example.test', nickname: 'Sam Rivera', avatar: 'sam' }
  const site = siteId === 1 ? '1' : '2'
  return {
    id,
    site_id: site,
    thread_id: threadId,
    root_id: null,
    parent_id: null,
    user_id: userId,
    author_email: user.email,
    author_nickname: user.nickname,
    author_website: null,
    avatar_url: `https://www.gravatar.com/avatar/${user.avatar}`,
    body,
    status,
    is_pinned: false,
    depth: 0,
    reply_to_user_id: null,
    reply_to_nickname: null,
    created_at: now,
    published_at: status === 'published' ? now : null,
    deleted_at: null,
    ip_mode: 'coarse',
    ip_value: '192.0.2.0/24',
    ua_browser: 'Firefox',
    ua_device: 'Desktop',
    ua_os: 'Linux',
    ua_mode: 'coarse',
  }
}

let memoryState: MockState | undefined

function sessionStorageOrUndefined(): Storage | undefined {
  try {
    return import.meta.env.MODE === 'test' || typeof window === 'undefined'
      ? undefined
      : window.sessionStorage
  } catch {
    return undefined
  }
}

export function resetMockState() {
  memoryState = createInitialMockState()
  sessionStorageOrUndefined()?.removeItem(storageKey)
  return structuredClone(memoryState)
}

export function readMockState(): MockState {
  const storage = sessionStorageOrUndefined()
  if (storage) {
    try {
      const stored = storage.getItem(storageKey)
      if (stored) return JSON.parse(stored) as MockState
    } catch {
      storage.removeItem(storageKey)
    }
  }
  if (!memoryState) memoryState = createInitialMockState()
  return structuredClone(memoryState)
}

export function writeMockState(state: MockState) {
  memoryState = structuredClone(state)
  sessionStorageOrUndefined()?.setItem(storageKey, JSON.stringify(state))
  return state
}

export function updateMockState<T>(update: (state: MockState) => T): T {
  const state = readMockState()
  const result = update(state)
  writeMockState(state)
  return result
}

export function toMeComment(item: AdminComment): MeComment {
  const site = readMockState().sites.find(
    (siteItem) => siteItem.id === item.site_id,
  )
  const thread = readMockState().threads.find(
    (threadItem) => threadItem.id === item.thread_id,
  )
  return {
    id: item.id,
    site_id: item.site_id,
    site_name: site?.name ?? 'Demo site',
    thread_id: item.thread_id,
    page_key: thread?.page_key ?? '/',
    page_url: thread?.page_url ?? null,
    page_title: thread?.page_title ?? null,
    user_id: item.user_id,
    parent_id: item.parent_id,
    root_id: item.root_id,
    depth: item.depth,
    body: item.body,
    status: item.status,
    author_nickname: item.author_nickname,
    author_website: item.author_website,
    avatar_url: item.avatar_url,
    reply_to_user_id: item.reply_to_user_id,
    reply_to_nickname: item.reply_to_nickname,
    created_at: item.created_at,
    published_at: item.published_at,
    deleted_at: item.deleted_at,
  }
}
