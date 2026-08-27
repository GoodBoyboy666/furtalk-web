// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  clearAcceptedConsent,
  legalConsentRecordVersion,
  legalConsentStorageKey,
  readAcceptedConsentVersion,
  writeAcceptedConsent,
} from './legal-consent'

function storage(): Storage {
  return window.localStorage
}

describe('legal consent storage', () => {
  it('round-trips only the versioned consent record', () => {
    const target = storage()
    clearAcceptedConsent(target)
    expect(writeAcceptedConsent(target, 3)).toBe(true)
    expect(readAcceptedConsentVersion(target)).toBe(3)
    expect(JSON.parse(target.getItem(legalConsentStorageKey) ?? '')).toEqual({
      version: legalConsentRecordVersion,
      accepted_consent_version: 3,
    })
  })

  it('rejects malformed or stale records and clears them', () => {
    const target = storage()
    target.setItem(
      legalConsentStorageKey,
      JSON.stringify({ version: 99, accepted_consent_version: 3 }),
    )
    expect(readAcceptedConsentVersion(target)).toBeNull()
    expect(target.getItem(legalConsentStorageKey)).toBeNull()
  })

  it('fails closed when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readAcceptedConsentVersion(broken)).toBeNull()
    expect(writeAcceptedConsent(broken, 3)).toBe(false)
    expect(() => clearAcceptedConsent(broken)).not.toThrow()
  })
})
