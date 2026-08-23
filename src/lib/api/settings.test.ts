import { describe, expect, it } from 'vitest'
import {
  commentSortOptions,
  decodeSettings,
  diffSettings,
  defaultSettings,
  parseDomainLines,
  privacyModeLabel,
  privacyModeOptions,
} from './settings'
import type { SettingItem } from './types'

const fullItems: SettingItem[] = [
  { key: 'comment_mode', type: 'string', value: 'authenticated' },
  { key: 'comment_sort', type: 'string', value: 'desc' },
  { key: 'moderation', type: 'string', value: 'review' },
  { key: 'user_delete_mode', type: 'string', value: 'hard' },
  { key: 'max_reply_depth', type: 'integer', value: 5 },
  { key: 'public_registration', type: 'boolean', value: false },
  {
    key: 'privacy',
    type: 'json',
    value: { ip_mode: 'none', ua_mode: 'full' },
  },
  { key: 'captcha_policy', type: 'json', value: { comment: true } },
  {
    key: 'notifications',
    type: 'json',
    value: { moderation: false, replies: true },
  },
  {
    key: 'email_domain_whitelist',
    type: 'json',
    value: ['example.com', 'sub.example.com'],
  },
  {
    key: 'email_domain_blacklist',
    type: 'json',
    value: ['blocked.com'],
  },
  {
    key: 'gravatar_base_url',
    type: 'string',
    value: 'https://avatars.example.com/avatar',
  },
  {
    key: 'captcha_provider',
    type: 'string',
    value: 'turnstile',
  },
  {
    key: 'emoji_catalog_url',
    type: 'string',
    value: 'https://cdn.example/emoji.json',
  },
]

describe('decodeSettings', () => {
  it('converts a complete public list into typed form state', () => {
    const decoded = decodeSettings(fullItems)
    expect(decoded).toEqual({
      comment_mode: 'authenticated',
      comment_sort: 'desc',
      moderation: 'review',
      user_delete_mode: 'hard',
      max_reply_depth: 5,
      public_registration: false,
      privacy: { ip_mode: 'none', ua_mode: 'full' },
      captcha_policy: { comment: true },
      notifications: { moderation: false, replies: true },
      email_domain_whitelist: ['example.com', 'sub.example.com'],
      email_domain_blacklist: ['blocked.com'],
      gravatar_base_url: 'https://avatars.example.com/avatar',
      captcha_provider: 'turnstile',
      emoji_catalog_url: 'https://cdn.example/emoji.json',
    })
  })

  it('falls back to defaults for missing known keys and ignores unknown keys', () => {
    const decoded = decodeSettings([
      { key: 'moderation', type: 'string', value: 'review' },
      { key: 'custom_flag', type: 'boolean', value: true },
    ])
    expect(decoded.moderation).toBe('review')
    expect(decoded.comment_mode).toBe(defaultSettings.comment_mode)
    expect(decoded.comment_sort).toBe(defaultSettings.comment_sort)
    expect(decoded.max_reply_depth).toBe(defaultSettings.max_reply_depth)
    expect(decoded.public_registration).toBe(
      defaultSettings.public_registration,
    )
    expect(decoded.email_domain_whitelist).toEqual([])
    expect(decoded.email_domain_blacklist).toEqual([])
    expect(decoded.gravatar_base_url).toBe(defaultSettings.gravatar_base_url)
    expect(decoded.emoji_catalog_url).toBe(defaultSettings.emoji_catalog_url)
  })

  it('does not mutate the shared default object via nested fields', () => {
    const decoded = decodeSettings(fullItems)
    expect(decoded.privacy).not.toBe(defaultSettings.privacy)
    expect(decoded.notifications).not.toBe(defaultSettings.notifications)
    expect(decoded.email_domain_whitelist).not.toBe(
      defaultSettings.email_domain_whitelist,
    )
    expect(defaultSettings.privacy).toEqual({
      ip_mode: 'coarse',
      ua_mode: 'coarse',
    })
    expect(defaultSettings.email_domain_whitelist).toEqual([])
  })
})

describe('diffSettings', () => {
  it('returns an empty list when nothing changed', () => {
    expect(diffSettings(defaultSettings, { ...defaultSettings })).toEqual([])
  })

  it('only encodes changed top-level keys', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      moderation: 'review',
      notifications: { ...defaultSettings.notifications, moderation: false },
    }
    const diff = diffSettings(defaultSettings, draft)
    expect(diff).toHaveLength(2)
    expect(diff).toContainEqual({
      key: 'moderation',
      type: 'string',
      value: 'review',
    })
    expect(diff).toContainEqual({
      key: 'notifications',
      type: 'json',
      value: { moderation: false, replies: true },
    })
  })

  it('treats object key order differences as no change', () => {
    const reordered: typeof defaultSettings = {
      ...defaultSettings,
      notifications: { replies: true, moderation: true },
    }
    expect(diffSettings(defaultSettings, reordered)).toEqual([])
  })

  it('encodes nested object changes for json keys', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      privacy: { ip_mode: 'none', ua_mode: 'coarse' },
    }
    expect(diffSettings(defaultSettings, draft)).toEqual([
      {
        key: 'privacy',
        type: 'json',
        value: { ip_mode: 'none', ua_mode: 'coarse' },
      },
    ])
  })

  it('encodes a password_reset captcha policy toggle alone', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      captcha_policy: {
        ...defaultSettings.captcha_policy,
        password_reset: true,
      },
    }
    expect(diffSettings(defaultSettings, draft)).toEqual([
      {
        key: 'captcha_policy',
        type: 'json',
        value: { password_reset: true },
      },
    ])
  })

  it('encodes email domain list and gravatar base changes', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      email_domain_whitelist: ['example.com'],
      gravatar_base_url: 'https://avatars.example.com',
    }
    const diff = diffSettings(defaultSettings, draft)
    expect(diff).toHaveLength(2)
    expect(diff).toContainEqual({
      key: 'email_domain_whitelist',
      type: 'json',
      value: ['example.com'],
    })
    expect(diff).toContainEqual({
      key: 'gravatar_base_url',
      type: 'string',
      value: 'https://avatars.example.com',
    })
  })

  it('encodes a captcha_provider change alone', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      captcha_provider: 'turnstile',
    }
    expect(diffSettings(defaultSettings, draft)).toEqual([
      {
        key: 'captcha_provider',
        type: 'string',
        value: 'turnstile',
      },
    ])
  })

  it('encodes a comment_sort change alone', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      comment_sort: 'desc',
    }
    expect(diffSettings(defaultSettings, draft)).toEqual([
      {
        key: 'comment_sort',
        type: 'string',
        value: 'desc',
      },
    ])
  })

  it('encodes an emoji_catalog_url change alone', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      emoji_catalog_url: 'https://cdn.example/emoji.json',
    }
    expect(diffSettings(defaultSettings, draft)).toEqual([
      {
        key: 'emoji_catalog_url',
        type: 'string',
        value: 'https://cdn.example/emoji.json',
      },
    ])
  })

  it('omits emoji_catalog_url when unchanged', () => {
    const draft: typeof defaultSettings = {
      ...defaultSettings,
      emoji_catalog_url: '',
    }
    expect(diffSettings(defaultSettings, draft)).toEqual([])
  })

  it('treats identical domain lists as no change regardless of order', () => {
    const baseline: typeof defaultSettings = {
      ...defaultSettings,
      email_domain_whitelist: ['example.com', 'sub.example.com'],
    }
    const reordered: typeof defaultSettings = {
      ...defaultSettings,
      email_domain_whitelist: ['sub.example.com', 'example.com'],
    }
    // 顺序属于内容，因此视为变化；空列表相同则无变化。
    expect(diffSettings(baseline, reordered)).toHaveLength(1)
    expect(diffSettings(defaultSettings, defaultSettings)).toEqual([])
  })
})

describe('parseDomainLines', () => {
  it('splits one domain per line and trims whitespace', () => {
    expect(parseDomainLines('example.com\n  sub.example.com \n')).toEqual([
      'example.com',
      'sub.example.com',
    ])
  })

  it('drops empty lines and preserves order', () => {
    expect(parseDomainLines('\nexample.com\n\nblocked.com\n')).toEqual([
      'example.com',
      'blocked.com',
    ])
  })

  it('returns an empty list for blank input', () => {
    expect(parseDomainLines('')).toEqual([])
    expect(parseDomainLines('   \n  \n')).toEqual([])
  })
})

describe('privacy mode options', () => {
  it('exposes the none|coarse|full contract with stable keys', () => {
    expect(privacyModeOptions).toEqual([
      { value: 'none', key: 'enums:privacyMode.none' },
      { value: 'coarse', key: 'enums:privacyMode.coarse' },
      { value: 'full', key: 'enums:privacyMode.full' },
    ])
  })

  it('maps stable values to labels and falls back for unknown values', () => {
    expect(privacyModeLabel('none')).toBe('不记录')
    expect(privacyModeLabel('coarse')).toBe('粗略记录')
    expect(privacyModeLabel('full')).toBe('完整记录')
    expect(privacyModeLabel('legacy')).toBe('legacy')
    expect(privacyModeLabel(null)).toBe('未知')
    expect(privacyModeLabel(undefined)).toBe('未知')
  })
})

describe('comment sort options', () => {
  it('exposes the asc|desc|hot contract with stable keys', () => {
    expect(commentSortOptions).toEqual([
      { value: 'asc', key: 'enums:commentSort.asc' },
      { value: 'desc', key: 'enums:commentSort.desc' },
      { value: 'hot', key: 'enums:commentSort.hot' },
    ])
  })
})
