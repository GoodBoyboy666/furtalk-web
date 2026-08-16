// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearOtpRecord,
  createOtpRecord,
  isOtpExpired,
  maskEmail,
  otpRecordKey,
  otpRecordTTLMs,
  readOtpRecord,
  refreshOtpExpiry,
  safeOtpSessionStorage,
  writeOtpRecord,
} from './otp'
import type { PendingOtpLogin, StorageLike } from './otp'

afterEach(() => {
  sessionStorage.clear()
})

function sampleRecord(): PendingOtpLogin {
  return createOtpRecord({
    email: 'visitor@example.com',
    redirect: '/account/comments',
    authorize: false,
  })
}

describe('createOtpRecord', () => {
  it('creates a versioned record with a five-minute expiry', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const record = createOtpRecord({
      email: 'visitor@example.com',
      redirect: '/authorize?site_id=1&request_id=abc',
      authorize: true,
      now,
    })
    expect(record.version).toBe(1)
    expect(record.email).toBe('visitor@example.com')
    expect(record.redirect).toBe('/authorize?site_id=1&request_id=abc')
    expect(record.authorize).toBe(true)
    expect(record.created_at).toBe('2026-01-01T00:00:00.000Z')
    expect(record.expires_at).toBe('2026-01-01T00:05:00.000Z')
  })

  it('omits redirect when not provided', () => {
    const record = createOtpRecord({ email: 'a@b.com', authorize: false })
    expect(record.redirect).toBeUndefined()
  })
})

describe('isOtpExpired', () => {
  it('returns false within the TTL and true at/after expiry', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const record = createOtpRecord({ email: 'a@b.com', authorize: false, now })
    expect(isOtpExpired(record, new Date('2026-01-01T00:04:59Z'))).toBe(false)
    expect(isOtpExpired(record, new Date('2026-01-01T00:05:00Z'))).toBe(true)
    expect(isOtpExpired(record, new Date('2026-01-01T01:00:00Z'))).toBe(true)
  })
})

describe('refreshOtpExpiry', () => {
  it('keeps identity fields but replaces the expiry timestamp', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const record = createOtpRecord({
      email: 'visitor@example.com',
      redirect: '/admin',
      authorize: true,
      now,
    })
    const refreshed = refreshOtpExpiry(record, new Date('2026-01-01T00:03:00Z'))
    expect(refreshed.version).toBe(1)
    expect(refreshed.email).toBe('visitor@example.com')
    expect(refreshed.redirect).toBe('/admin')
    expect(refreshed.authorize).toBe(true)
    expect(refreshed.created_at).toBe(record.created_at)
    expect(refreshed.expires_at).toBe('2026-01-01T00:08:00.000Z')
    expect(refreshed).not.toBe(record)
  })
})

describe('write/read/clear round-trip', () => {
  it('persists and reads back a valid record', () => {
    const storage = safeOtpSessionStorage()
    const record = sampleRecord()
    writeOtpRecord(storage, record)
    expect(readOtpRecord(storage)).toEqual(record)
  })

  it('clears an expired record on read and returns null', () => {
    const storage = safeOtpSessionStorage()
    const expired = sampleRecord()
    expired.expires_at = new Date(Date.now() - 1000).toISOString()
    writeOtpRecord(storage, expired)
    expect(readOtpRecord(storage)).toBeNull()
    expect(storage?.getItem(otpRecordKey)).toBeNull()
  })

  it('clears a malformed record on read and returns null', () => {
    const storage = safeOtpSessionStorage()
    storage?.setItem(otpRecordKey, '{not-json')
    expect(readOtpRecord(storage)).toBeNull()
    expect(storage?.getItem(otpRecordKey)).toBeNull()
  })

  it('rejects records with a wrong version or missing fields', () => {
    const storage = safeOtpSessionStorage()
    storage?.setItem(
      otpRecordKey,
      JSON.stringify({ ...sampleRecord(), version: 99 }),
    )
    expect(readOtpRecord(storage)).toBeNull()
    storage?.setItem(otpRecordKey, JSON.stringify({ version: 1, email: 'x' }))
    expect(readOtpRecord(storage)).toBeNull()
    const emptyEmail = sampleRecord()
    emptyEmail.email = ''
    storage?.setItem(otpRecordKey, JSON.stringify(emptyEmail))
    expect(readOtpRecord(storage)).toBeNull()
  })

  it('clears the record explicitly', () => {
    const storage = safeOtpSessionStorage()
    writeOtpRecord(storage, sampleRecord())
    clearOtpRecord(storage)
    expect(storage?.getItem(otpRecordKey)).toBeNull()
  })
})

describe('storage fallback', () => {
  it('returns null when sessionStorage is unavailable and never throws', () => {
    const original = sessionStorage
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked')
      },
    })
    try {
      expect(safeOtpSessionStorage()).toBeNull()
      expect(readOtpRecord(null)).toBeNull()
      expect(() => writeOtpRecord(null, sampleRecord())).not.toThrow()
      expect(() => clearOtpRecord(null)).not.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: original,
      })
    }
  })

  it('ignores storage read/write errors', () => {
    const failing: StorageLike = {
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
    expect(readOtpRecord(failing)).toBeNull()
    expect(() => writeOtpRecord(failing, sampleRecord())).not.toThrow()
    expect(() => clearOtpRecord(failing)).not.toThrow()
  })
})

describe('maskEmail', () => {
  it('masks the local part and keeps the domain', () => {
    expect(maskEmail('visitor@example.com')).toBe('v***@example.com')
    expect(maskEmail('admin@example.com')).toBe('a***@example.com')
    expect(maskEmail('v@example.com')).toBe('v***@example.com')
    expect(maskEmail('ab@example.com')).toBe('a***@example.com')
  })

  it('falls back for missing delimiters', () => {
    expect(maskEmail('')).toBe('***')
    expect(maskEmail('no-domain')).toBe('***')
    expect(maskEmail('@example.com')).toBe('***')
  })
})

describe('privacy', () => {
  it('never serializes the email into a URL-shaped value', () => {
    const record = createOtpRecord({
      email: 'visitor@example.com',
      redirect: '/authorize?site_id=123&request_id=AQEBAQ',
      authorize: true,
    })
    // 记录 key 是固定非敏感字符串，不含邮箱。
    expect(otpRecordKey).not.toContain('visitor@example.com')
    // redirect 只携带站点/请求 id，绝不携带邮箱。
    expect(record.redirect).toBe('/authorize?site_id=123&request_id=AQEBAQ')
    expect(record.redirect).not.toContain('visitor@example.com')
    expect(otpRecordTTLMs).toBe(5 * 60 * 1000)
  })
})
