// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

import {
  acceptAuthorizationInit,
  clearPendingAuthorization,
  createPendingAuthorization,
  emailHintFromPending,
  isAuthorizationMessage,
  isPendingExpired,
  isSafeEmbeddingOrigin,
  parsePendingAuthorization,
  parseRequestId,
  parseSiteId,
  pendingRecordKey,
  pendingRecordTTLMs,
  readPendingAuthorization,
  readPendingAuthorizationFromRedirect,
  requestIdFromAuthorizeRedirect,
  sendAuthorizationMessage,
  writePendingAuthorization,
} from './authorize'
import type { PendingAuthorization, StorageLike } from './authorize'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

const pendingRecord: PendingAuthorization = {
  version: 2,
  site_id: '123',
  request_id: 'AQEBAQEBAQEBAQEBAQEBAQ',
  embedding_origin: 'https://embed.example',
  email: 'visitor@example.com',
  expires_at: new Date(Date.now() + pendingRecordTTLMs).toISOString(),
}

describe('parseSiteId', () => {
  it('accepts positive decimal int64 values', () => {
    expect(parseSiteId('1')).toBe('1')
    expect(parseSiteId('9223372036854775807')).toBe('9223372036854775807')
  })

  it('rejects non-decimal, negative, zero, and oversized values', () => {
    expect(parseSiteId('0')).toBeNull()
    expect(parseSiteId('-1')).toBeNull()
    expect(parseSiteId('12a')).toBeNull()
    expect(parseSiteId('1.5')).toBeNull()
    expect(parseSiteId('9223372036854775808')).toBeNull()
    expect(parseSiteId(undefined)).toBeNull()
    expect(parseSiteId(123)).toBeNull()
  })
})

describe('parseRequestId', () => {
  it('accepts high-entropy base64url values', () => {
    expect(parseRequestId('AQEBAQEBAQEBAQEBAQEBAQ')).toBe(
      'AQEBAQEBAQEBAQEBAQEBAQ',
    )
  })

  it('rejects short, empty, or out-of-alphabet values', () => {
    expect(parseRequestId('')).toBeNull()
    expect(parseRequestId('short')).toBeNull()
    expect(parseRequestId('has+plus')).toBeNull()
    expect(parseRequestId('has/slash')).toBeNull()
    expect(parseRequestId('has=padding')).toBeNull()
    expect(parseRequestId(undefined)).toBeNull()
    expect(parseRequestId('x'.repeat(200))).toBeNull()
  })
})

describe('isSafeEmbeddingOrigin', () => {
  it('accepts exact https origins', () => {
    expect(isSafeEmbeddingOrigin('https://embed.example')).toBe(true)
    expect(isSafeEmbeddingOrigin('https://sub.example.com:8443')).toBe(true)
  })

  it('accepts http localhost for development', () => {
    expect(isSafeEmbeddingOrigin('http://localhost:3000')).toBe(true)
    expect(isSafeEmbeddingOrigin('http://127.0.0.1')).toBe(true)
  })

  it('rejects non-origin values', () => {
    expect(isSafeEmbeddingOrigin('http://evil.example')).toBe(false)
    expect(isSafeEmbeddingOrigin('https://embed.example/path')).toBe(false)
    expect(isSafeEmbeddingOrigin('https://embed.example?q=1')).toBe(false)
    expect(isSafeEmbeddingOrigin('null')).toBe(false)
    expect(isSafeEmbeddingOrigin('')).toBe(false)
    expect(isSafeEmbeddingOrigin('https://*.example')).toBe(false)
    expect(isSafeEmbeddingOrigin('https://a.example,https://b.example')).toBe(
      false,
    )
  })
})

describe('isAuthorizationMessage', () => {
  it('accepts each protocol message shape', () => {
    expect(
      isAuthorizationMessage({
        type: 'furtalk:authorization-init',
        request_id: 'r',
        email: 'a@b.example',
      }),
    ).toBe(true)
    expect(
      isAuthorizationMessage({
        type: 'furtalk:authorization-ready',
        request_id: 'r',
      }),
    ).toBe(true)
    expect(
      isAuthorizationMessage({
        type: 'furtalk:authorization-success',
        request_id: 'r',
        code: 'code',
      }),
    ).toBe(true)
    expect(
      isAuthorizationMessage({
        type: 'furtalk:authorization-cancelled',
        request_id: 'r',
      }),
    ).toBe(true)
  })

  it('rejects unknown types, missing request ids, and malformed shapes', () => {
    expect(
      isAuthorizationMessage({ type: 'furtalk:evil', request_id: 'r' }),
    ).toBe(false)
    expect(isAuthorizationMessage({ type: 'furtalk:authorization-init' })).toBe(
      false,
    )
    expect(
      isAuthorizationMessage({
        type: 'furtalk:authorization-success',
        request_id: 'r',
      }),
    ).toBe(false)
    expect(isAuthorizationMessage(null)).toBe(false)
    expect(isAuthorizationMessage('hello')).toBe(false)
  })
})

describe('acceptAuthorizationInit', () => {
  function event(
    data: unknown,
    origin: string,
    source: MessageEventSource | null,
  ): MessageEvent {
    return { data, origin, source } as MessageEvent
  }

  const opener = {} as Window

  it('accepts a matching init message and returns the browser origin', () => {
    const decoded = acceptAuthorizationInit(
      event(
        {
          type: 'furtalk:authorization-init',
          request_id: 'req-1',
          email: 'a@b.example',
        },
        'https://embed.example',
        opener,
      ),
      'req-1',
      opener,
    )
    expect(decoded).toEqual({
      origin: 'https://embed.example',
      email: 'a@b.example',
    })
  })

  it('accepts an init message without any hints', () => {
    const decoded = acceptAuthorizationInit(
      event(
        { type: 'furtalk:authorization-init', request_id: 'req-1' },
        'https://embed.example',
        opener,
      ),
      'req-1',
      opener,
    )
    expect(decoded).toEqual({ origin: 'https://embed.example' })
  })

  it('rejects a non-opener source', () => {
    expect(
      acceptAuthorizationInit(
        event(
          { type: 'furtalk:authorization-init', request_id: 'req-1' },
          'https://embed.example',
          {} as Window,
        ),
        'req-1',
        opener,
      ),
    ).toBeNull()
  })

  it('rejects a mismatched request id', () => {
    expect(
      acceptAuthorizationInit(
        event(
          { type: 'furtalk:authorization-init', request_id: 'other' },
          'https://embed.example',
          opener,
        ),
        'req-1',
        opener,
      ),
    ).toBeNull()
  })

  it('rejects an invalid schema or non-init type', () => {
    expect(
      acceptAuthorizationInit(
        event(
          { type: 'furtalk:evil', request_id: 'req-1' },
          'https://embed.example',
          opener,
        ),
        'req-1',
        opener,
      ),
    ).toBeNull()
    expect(
      acceptAuthorizationInit(
        event(
          { type: 'furtalk:authorization-ready', request_id: 'req-1' },
          'https://embed.example',
          opener,
        ),
        'req-1',
        opener,
      ),
    ).toBeNull()
  })

  it('rejects an unsafe embedding origin', () => {
    expect(
      acceptAuthorizationInit(
        event(
          { type: 'furtalk:authorization-init', request_id: 'req-1' },
          'http://evil.example',
          opener,
        ),
        'req-1',
        opener,
      ),
    ).toBeNull()
  })
})

describe('pending record storage', () => {
  it('round-trips a versioned record under the request-id key', () => {
    const storage = memoryStorage()
    writePendingAuthorization(storage, pendingRecord)
    expect(storage.data.has(pendingRecordKey(pendingRecord.request_id))).toBe(
      true,
    )
    expect(readPendingAuthorization(storage, pendingRecord.request_id)).toEqual(
      pendingRecord,
    )
  })

  it('clears the record explicitly', () => {
    const storage = memoryStorage()
    writePendingAuthorization(storage, pendingRecord)
    clearPendingAuthorization(storage, pendingRecord.request_id)
    expect(
      readPendingAuthorization(storage, pendingRecord.request_id),
    ).toBeNull()
  })

  it('treats expired records as missing and clears them', () => {
    const storage = memoryStorage()
    const expired = createPendingAuthorization({
      site_id: '123',
      request_id: 'req-expired',
      embedding_origin: 'https://embed.example',
      now: new Date(Date.now() - pendingRecordTTLMs - 1000),
    })
    writePendingAuthorization(storage, expired)
    expect(readPendingAuthorization(storage, 'req-expired')).toBeNull()
    expect(storage.data.has(pendingRecordKey('req-expired'))).toBe(false)
  })

  it('rejects malformed or unversioned records', () => {
    const storage = memoryStorage()
    storage.setItem(pendingRecordKey('req-bad'), '{"version":99}')
    expect(readPendingAuthorization(storage, 'req-bad')).toBeNull()
    // 旧版 pending 记录（含 nickname/website 提示的 v1 schema）必须视为无效。
    storage.setItem(
      pendingRecordKey('req-old'),
      JSON.stringify({
        version: 1,
        site_id: '123',
        request_id: 'req-old',
        embedding_origin: 'https://embed.example',
        email: 'a@b.example',
        nickname: 'Old',
        website_url: 'https://blog.example',
        expires_at: new Date(Date.now() + pendingRecordTTLMs).toISOString(),
      }),
    )
    expect(readPendingAuthorization(storage, 'req-old')).toBeNull()
    storage.setItem(pendingRecordKey('req-json'), 'not-json')
    expect(readPendingAuthorization(storage, 'req-json')).toBeNull()
  })

  it('tolerates unavailable storage', () => {
    expect(readPendingAuthorization(null, 'req-1')).toBeNull()
    writePendingAuthorization(null, pendingRecord)
    clearPendingAuthorization(null, 'req-1')
  })

  it('creates records with a bounded expiry', () => {
    const now = new Date('2026-08-11T00:00:00.000Z')
    const record = createPendingAuthorization({
      site_id: '1',
      request_id: 'req-now',
      embedding_origin: 'https://embed.example',
      now,
    })
    expect(record.expires_at).toBe('2026-08-11T00:10:00.000Z')
    expect(isPendingExpired(record, new Date(record.expires_at))).toBe(true)
    expect(isPendingExpired(record, new Date('2026-08-11T00:09:59.000Z'))).toBe(
      false,
    )
  })
})

describe('redirect-derived pending records', () => {
  it('extracts a valid request id from a local /authorize redirect', () => {
    expect(
      requestIdFromAuthorizeRedirect(
        '/authorize?site_id=123&request_id=AQEBAQEBAQEBAQEBAQEBAQ',
      ),
    ).toBe('AQEBAQEBAQEBAQEBAQEBAQ')
    expect(requestIdFromAuthorizeRedirect('/admin')).toBeNull()
    expect(
      requestIdFromAuthorizeRedirect('https://evil.example/authorize'),
    ).toBe(null)
  })

  it('reads the pending record referenced by a login redirect', () => {
    const storage = memoryStorage()
    writePendingAuthorization(storage, pendingRecord)
    expect(
      readPendingAuthorizationFromRedirect(
        storage,
        `/authorize?site_id=123&request_id=${pendingRecord.request_id}`,
      ),
    ).toEqual(pendingRecord)
  })

  it('returns an empty email hint when no pending record exists', () => {
    expect(
      emailHintFromPending(
        readPendingAuthorizationFromRedirect(memoryStorage(), '/authorize'),
      ),
    ).toBe('')
  })

  it('projects the email hint defensively', () => {
    const record = parsePendingAuthorization(
      JSON.stringify({
        ...pendingRecord,
        email: 42,
      }),
    )
    expect(emailHintFromPending(record)).toBe('')
    const withEmail = parsePendingAuthorization(
      JSON.stringify({ ...pendingRecord, email: 'visitor@example.com' }),
    )
    expect(emailHintFromPending(withEmail)).toBe('visitor@example.com')
  })
})

describe('sendAuthorizationMessage', () => {
  it('posts to the exact target origin', () => {
    const opener = { postMessage: vi.fn() } as unknown as Window
    sendAuthorizationMessage(opener, 'https://embed.example', {
      type: 'furtalk:authorization-ready',
      request_id: 'req-1',
    })
    expect(opener.postMessage).toHaveBeenCalledWith(
      { type: 'furtalk:authorization-ready', request_id: 'req-1' },
      'https://embed.example',
    )
  })

  it('never posts when opener or origin is missing', () => {
    const opener = { postMessage: vi.fn() } as unknown as Window
    sendAuthorizationMessage(null, 'https://embed.example', {
      type: 'furtalk:authorization-cancelled',
      request_id: 'req-1',
    })
    sendAuthorizationMessage(opener, '', {
      type: 'furtalk:authorization-cancelled',
      request_id: 'req-1',
    })
    expect(opener.postMessage).not.toHaveBeenCalled()
  })
})
