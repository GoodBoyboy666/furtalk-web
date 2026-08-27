import { describe, expect, it } from 'vitest'
import { decodePublicConfig } from './public-config'

const valid = {
  user_agreement_url: 'https://example.com/terms',
  privacy_policy_url: '',
  legal_consent_version: 2,
  brand_primary_color: '#6750a4',
}

describe('decodePublicConfig', () => {
  it('accepts the allowlisted public fields and normalizes the color', () => {
    expect(decodePublicConfig(valid)).toEqual({
      ...valid,
      brand_primary_color: '#6750A4',
    })
  })

  it('rejects relative, non-HTTPS, malformed and incomplete values', () => {
    for (const value of [
      { ...valid, user_agreement_url: '/terms' },
      { ...valid, user_agreement_url: 'http://example.com/terms' },
      { ...valid, brand_primary_color: '#12345' },
      { ...valid, legal_consent_version: 0 },
      { ...valid, privacy_policy_url: undefined },
    ]) {
      expect(() => decodePublicConfig(value)).toThrow()
    }
  })
})
