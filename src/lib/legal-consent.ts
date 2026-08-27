import { useEffect, useState } from 'react'
import type { PublicConfig } from './api/types'

export const legalConsentRecordVersion = 1
export const legalConsentStorageKey = 'furtalk:legal-consent'

type LegalConsentRecord = {
  version: typeof legalConsentRecordVersion
  accepted_consent_version: number
}

export type ConsentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function safeLegalConsentStorage(): ConsentStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readAcceptedConsentVersion(
  storage: ConsentStorage | null,
): number | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(legalConsentStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LegalConsentRecord>
    if (
      parsed.version !== legalConsentRecordVersion ||
      typeof parsed.accepted_consent_version !== 'number' ||
      !Number.isSafeInteger(parsed.accepted_consent_version) ||
      parsed.accepted_consent_version <= 0
    ) {
      clearAcceptedConsent(storage)
      return null
    }
    return parsed.accepted_consent_version
  } catch {
    return null
  }
}

export function writeAcceptedConsent(
  storage: ConsentStorage | null,
  consentVersion: number,
): boolean {
  if (!storage || !Number.isSafeInteger(consentVersion) || consentVersion <= 0)
    return false
  const record: LegalConsentRecord = {
    version: legalConsentRecordVersion,
    accepted_consent_version: consentVersion,
  }
  try {
    storage.setItem(legalConsentStorageKey, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

export function clearAcceptedConsent(storage: ConsentStorage | null): void {
  if (!storage) return
  try {
    storage.removeItem(legalConsentStorageKey)
  } catch {
    // Restricted privacy-mode storage is treated as unavailable.
  }
}

export type LegalConsentState = {
  requiresConsent: boolean
  accepted: boolean
  canProceed: boolean
  setAccepted: (accepted: boolean) => void
}

// useLegalConsent owns the browser-only preference and never sends it to the
// server. A failed or unavailable storage implementation remains unchecked.
export function useLegalConsent(
  config: PublicConfig | undefined,
  ready = config !== undefined,
): LegalConsentState {
  const requiresConsent = Boolean(
    config?.user_agreement_url || config?.privacy_policy_url,
  )
  const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null)

  useEffect(() => {
    if (!ready || !config) {
      setAcceptedVersion(null)
      return
    }
    if (!requiresConsent) {
      setAcceptedVersion(config.legal_consent_version)
      return
    }
    const accepted = readAcceptedConsentVersion(safeLegalConsentStorage())
    setAcceptedVersion(
      accepted === config.legal_consent_version ? accepted : null,
    )
  }, [config, ready, requiresConsent])

  function setAccepted(accepted: boolean) {
    if (!config || !requiresConsent) return
    if (!accepted) {
      clearAcceptedConsent(safeLegalConsentStorage())
      setAcceptedVersion(null)
      return
    }
    const stored = writeAcceptedConsent(
      safeLegalConsentStorage(),
      config.legal_consent_version,
    )
    setAcceptedVersion(stored ? config.legal_consent_version : null)
  }

  return {
    requiresConsent,
    accepted:
      requiresConsent && acceptedVersion === config?.legal_consent_version,
    canProceed:
      ready &&
      config !== undefined &&
      (!requiresConsent || acceptedVersion === config.legal_consent_version),
    setAccepted,
  }
}
