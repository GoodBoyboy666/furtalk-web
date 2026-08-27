import type { SettingItem, SettingType } from './types'
import i18n from '../i18n'

// privacyModeOptions 是 IP / UA 记录精度的共享选项。
// value 是与后端 privacy.ip_mode / privacy.ua_mode 一致的稳定枚举；
// key 是翻译键，渲染时用 t(key) 取本地化标签。
export const privacyModeOptions = [
  { value: 'none', key: 'enums:privacyMode.none' },
  { value: 'coarse', key: 'enums:privacyMode.coarse' },
  { value: 'full', key: 'enums:privacyMode.full' },
] as const

export type PrivacyMode = (typeof privacyModeOptions)[number]['value']

// privacyModeLabel 把稳定枚举值映射为翻译后的标签；未知值回落到原始值。
export function privacyModeLabel(value: string | null | undefined) {
  if (!value) return i18n.t('enums:privacyMode.unknown')
  const option = privacyModeOptions.find((item) => item.value === value)
  return option ? i18n.t(option.key) : value
}

// commentSortOptions 是 widget 默认排序的共享选项。
// value 是与后端 comment_sort 动态设置一致的受控枚举；
// key 是翻译键，渲染时用 t(key) 取本地化标签。
export const commentSortOptions = [
  { value: 'asc', key: 'enums:commentSort.asc' },
  { value: 'desc', key: 'enums:commentSort.desc' },
  { value: 'hot', key: 'enums:commentSort.hot' },
] as const

export type CommentSort = (typeof commentSortOptions)[number]['value']

// Settings 是设置页使用的类型化表单状态，由公开设置项列表转换而来。
export type Settings = {
  comment_mode: string
  comment_sort: string
  moderation: string
  user_delete_mode: string
  max_reply_depth: number
  public_registration: boolean
  privacy: { ip_mode: string; ua_mode: string }
  captcha_policy: Record<string, boolean>
  notifications: { moderation: boolean; replies: boolean }
  email_domain_whitelist: string[]
  email_domain_blacklist: string[]
  gravatar_base_url: string
  captcha_provider: string
  emoji_catalog_url: string
  user_agreement_url: string
  privacy_policy_url: string
  legal_consent_version: number
  brand_primary_color: string
}

// 已知顶层设置 key，保存时只对它们做变化比较。
export const knownSettingKeys = [
  'comment_mode',
  'comment_sort',
  'moderation',
  'user_delete_mode',
  'max_reply_depth',
  'public_registration',
  'privacy',
  'captcha_policy',
  'notifications',
  'email_domain_whitelist',
  'email_domain_blacklist',
  'gravatar_base_url',
  'captcha_provider',
  'emoji_catalog_url',
  'user_agreement_url',
  'privacy_policy_url',
  'legal_consent_version',
  'brand_primary_color',
] as const

export type KnownSettingKey = (typeof knownSettingKeys)[number]

// 默认设置与后端 DefaultSettings 保持一致，用于解码时缺失 key 的回落。
export const defaultSettings: Settings = {
  comment_mode: 'anonymous',
  comment_sort: 'asc',
  moderation: 'direct',
  user_delete_mode: 'soft',
  max_reply_depth: 3,
  public_registration: true,
  privacy: { ip_mode: 'coarse', ua_mode: 'coarse' },
  captcha_policy: {},
  notifications: { moderation: true, replies: true },
  email_domain_whitelist: [],
  email_domain_blacklist: [],
  gravatar_base_url: 'https://www.gravatar.com/avatar',
  captcha_provider: '',
  emoji_catalog_url: '',
  user_agreement_url: '',
  privacy_policy_url: '',
  legal_consent_version: 1,
  brand_primary_color: '#18181B',
}

// settingType 是每个已知 key 的固定公开类型。
const settingType: Record<KnownSettingKey, SettingType> = {
  comment_mode: 'string',
  comment_sort: 'string',
  moderation: 'string',
  user_delete_mode: 'string',
  max_reply_depth: 'integer',
  public_registration: 'boolean',
  privacy: 'json',
  captcha_policy: 'json',
  notifications: 'json',
  email_domain_whitelist: 'json',
  email_domain_blacklist: 'json',
  gravatar_base_url: 'string',
  captcha_provider: 'string',
  emoji_catalog_url: 'string',
  user_agreement_url: 'string',
  privacy_policy_url: 'string',
  legal_consent_version: 'integer',
  brand_primary_color: 'string',
}

// decodeSettings 把公开设置项列表转换为类型化表单状态。
// 未知 key 被忽略，缺失的已知 key 回落到默认值。
export function decodeSettings(items: SettingItem[]): Settings {
  const out: Settings = {
    ...defaultSettings,
    privacy: { ...defaultSettings.privacy },
    notifications: { ...defaultSettings.notifications },
    captcha_policy: {},
    email_domain_whitelist: [...defaultSettings.email_domain_whitelist],
    email_domain_blacklist: [...defaultSettings.email_domain_blacklist],
  }
  for (const item of items) {
    switch (item.key) {
      case 'comment_mode':
        out.comment_mode = item.value as string
        break
      case 'comment_sort':
        out.comment_sort = item.value as string
        break
      case 'moderation':
        out.moderation = item.value as string
        break
      case 'user_delete_mode':
        out.user_delete_mode = item.value as string
        break
      case 'max_reply_depth':
        out.max_reply_depth = item.value as number
        break
      case 'public_registration':
        out.public_registration = item.value as boolean
        break
      case 'privacy':
        out.privacy = item.value as Settings['privacy']
        break
      case 'captcha_policy':
        out.captcha_policy = item.value as Record<string, boolean>
        break
      case 'notifications':
        out.notifications = item.value as Settings['notifications']
        break
      case 'email_domain_whitelist':
        out.email_domain_whitelist = item.value as string[]
        break
      case 'email_domain_blacklist':
        out.email_domain_blacklist = item.value as string[]
        break
      case 'gravatar_base_url':
        out.gravatar_base_url = item.value as string
        break
      case 'captcha_provider':
        out.captcha_provider = item.value as string
        break
      case 'emoji_catalog_url':
        out.emoji_catalog_url = item.value as string
        break
      case 'user_agreement_url':
        out.user_agreement_url = item.value as string
        break
      case 'privacy_policy_url':
        out.privacy_policy_url = item.value as string
        break
      case 'legal_consent_version':
        out.legal_consent_version = item.value as number
        break
      case 'brand_primary_color':
        out.brand_primary_color = item.value as string
        break
    }
  }
  return out
}

// diffSettings 只编码相对基准快照发生变化的顶层设置 key；
// 无变化时返回空数组，调用方不应发起请求。
export function diffSettings(
  baseline: Settings,
  draft: Settings,
): SettingItem[] {
  const items: SettingItem[] = []
  for (const key of knownSettingKeys) {
    if (key === 'legal_consent_version') continue
    if (deepEqual(baseline[key], draft[key])) continue
    items.push({ key, type: settingType[key], value: draft[key] })
  }
  return items
}

// deepEqual 递归比较值；对象比较忽略键序。
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const aKeys = Object.keys(aRecord)
  const bKeys = Object.keys(bRecord)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => deepEqual(aRecord[key], bRecord[key]))
}

// parseDomainLines 把一行一个域名的文本转换为字符串数组：
// 忽略首尾空白与空行，保持原有顺序；大小写规范化由后端负责。
export function parseDomainLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
