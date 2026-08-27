import type { PublicConfig } from './api/types'

export const publicConfigQueryKey = ['public-config'] as const

export const defaultPublicConfig: PublicConfig = {
  user_agreement_url: '',
  privacy_policy_url: '',
  legal_consent_version: 1,
  brand_primary_color: '#18181B',
}

function validateOptionalHTTPSURL(value: unknown, field: string): string {
  if (typeof value !== 'string')
    throw new Error(`invalid public config ${field}`)
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (
    trimmed.length > 2048 ||
    Array.from(trimmed).some((char) => {
      const code = char.codePointAt(0) ?? 0
      return code <= 0x1f || code === 0x7f
    })
  ) {
    throw new Error(`invalid public config ${field}`)
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`invalid public config ${field}`)
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error(`invalid public config ${field}`)
  }
  return trimmed
}

export function normalizeHexColor(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    throw new Error('invalid public config brand_primary_color')
  }
  return value.trim().toUpperCase()
}

export function decodePublicConfig(value: unknown): PublicConfig {
  if (!value || typeof value !== 'object') {
    throw new Error('invalid public config')
  }
  const raw = value as Record<string, unknown>
  const version = raw.legal_consent_version
  if (
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version <= 0
  ) {
    throw new Error('invalid public config legal_consent_version')
  }
  return {
    user_agreement_url: validateOptionalHTTPSURL(
      raw.user_agreement_url,
      'user_agreement_url',
    ),
    privacy_policy_url: validateOptionalHTTPSURL(
      raw.privacy_policy_url,
      'privacy_policy_url',
    ),
    legal_consent_version: version,
    brand_primary_color: normalizeHexColor(raw.brand_primary_color),
  }
}
