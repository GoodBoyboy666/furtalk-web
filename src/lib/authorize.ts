/**
 * First-party authorization popup protocol.
 *
 * The Widget opens a fresh unnamed popup at `/authorize?site_id=<decimal>&request_id=<base64url>`
 * and sends a validated `furtalk:authorization-init` message carrying the visitor's optional
 * email hint. The popup accepts the message only from `window.opener` with a matching
 * `request_id` and a valid schema; it takes the browser-provided `MessageEvent.origin` as the
 * embedding origin (never a string from message data, URL, or Referer), stores a versioned
 * pending record in its own `sessionStorage`, and acknowledges to that exact origin.
 *
 * Every sent message uses an exact `targetOrigin`; `*` is forbidden. The email hint is never
 * placed in a URL — it crosses origins only through the handshake, lives in popup
 * sessionStorage for the duration of the pending flow, and only ever prefills the first-party
 * login form. It is never an authoritative identity or profile input.
 */

export const pendingRecordVersion = 2
/** Pending records expire after a short bounded interval (10 minutes). */
export const pendingRecordTTLMs = 10 * 60 * 1000
export const pendingRecordKeyPrefix = 'furtalk:authorization:'

export const authorizationMessageTypes = {
  init: 'furtalk:authorization-init',
  ready: 'furtalk:authorization-ready',
  success: 'furtalk:authorization-success',
  cancelled: 'furtalk:authorization-cancelled',
} as const

export type AuthorizationMessage =
  | {
      type: typeof authorizationMessageTypes.init
      request_id: string
      email?: string
    }
  | { type: typeof authorizationMessageTypes.ready; request_id: string }
  | {
      type: typeof authorizationMessageTypes.success
      request_id: string
      code: string
    }
  | { type: typeof authorizationMessageTypes.cancelled; request_id: string }

/** Discriminated type guard for the popup protocol; rejects unknown shapes. */
export function isAuthorizationMessage(
  value: unknown,
): value is AuthorizationMessage {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.type !== 'string') return false
  if (typeof candidate.request_id !== 'string' || candidate.request_id === '')
    return false
  switch (candidate.type) {
    case authorizationMessageTypes.init:
      return (
        candidate.email === undefined || typeof candidate.email === 'string'
      )
    case authorizationMessageTypes.ready:
      return true
    case authorizationMessageTypes.success:
      return typeof candidate.code === 'string' && candidate.code !== ''
    case authorizationMessageTypes.cancelled:
      return true
    default:
      return false
  }
}

/**
 * Versioned pending authorization record stored in the popup's own sessionStorage,
 * keyed by the high-entropy request_id.
 */
export interface PendingAuthorization {
  version: typeof pendingRecordVersion
  site_id: string
  request_id: string
  embedding_origin: string
  email?: string
  expires_at: string
}

/** The sessionStorage key for a pending request id. */
export function pendingRecordKey(requestId: string): string {
  return `${pendingRecordKeyPrefix}${requestId}`
}

/**
 * Parses a decimal int64 site id from a URL parameter.
 * Accepts only positive decimal values that fit a signed 64-bit integer.
 */
export function parseSiteId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!/^[1-9]\d{0,18}$/.test(raw)) return null
  if (BigInt(raw) > BigInt('9223372036854775807')) return null
  return raw
}

/**
 * Parses a high-entropy base64url request id from a URL parameter.
 * The Widget generates 16 random bytes (22 base64url characters); the parser accepts
 * a bounded window so manual/corrupted values are rejected without blocking valid ones.
 */
export function parseRequestId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length < 16 || raw.length > 128) return null
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null
  return raw
}

/**
 * Reports whether the value is an exact origin the popup may bind to: https
 * origins plus http localhost/127.0.0.1/::1 for development. Mirrors the
 * backend `httpx.CanonicalOrigin` rules so invalid values fail before storage.
 */
export function isSafeEmbeddingOrigin(raw: string): boolean {
  const origin = raw.trim()
  if (origin === '' || origin === 'null') return false
  if (/[\s,]/.test(origin) || origin.includes('*')) return false
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    return false
  }
  if (url.protocol !== 'https:') {
    const host = url.hostname.toLowerCase()
    if (
      url.protocol !== 'http:' ||
      (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1')
    ) {
      return false
    }
  }
  return true
}

export interface InitHandshake {
  origin: string
  email?: string
}

/**
 * Validates an `authorization-init` message from the opener.
 * Returns the browser-provided `MessageEvent.origin` and optional email hint only when
 * the source is exactly `window.opener`, the schema is valid, and the `request_id`
 * matches the URL value. Any mismatch returns null and the message is ignored.
 */
export function acceptAuthorizationInit(
  event: MessageEvent,
  requestId: string,
  opener: Window | null,
): InitHandshake | null {
  if (!opener || event.source !== opener) return null
  if (!isAuthorizationMessage(event.data)) return null
  if (event.data.type !== authorizationMessageTypes.init) return null
  if (event.data.request_id !== requestId) return null
  if (!isSafeEmbeddingOrigin(event.origin)) return null
  return {
    origin: event.origin,
    email: event.data.email,
  }
}

/** Builds a pending record with a bounded expiry. */
export function createPendingAuthorization(input: {
  site_id: string
  request_id: string
  embedding_origin: string
  email?: string
  now?: Date
}): PendingAuthorization {
  const now = input.now ?? new Date()
  return {
    version: pendingRecordVersion,
    site_id: input.site_id,
    request_id: input.request_id,
    embedding_origin: input.embedding_origin,
    email: input.email,
    expires_at: new Date(now.getTime() + pendingRecordTTLMs).toISOString(),
  }
}

export function isPendingExpired(
  record: PendingAuthorization,
  now?: Date,
): boolean {
  const at = now ?? new Date()
  return at.getTime() >= Date.parse(record.expires_at)
}

/** Parses a stored JSON payload defensively, never throwing. */
export function parsePendingAuthorization(
  raw: string | null,
): PendingAuthorization | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAuthorization>
    if (
      parsed.version !== pendingRecordVersion ||
      typeof parsed.site_id !== 'string' ||
      typeof parsed.request_id !== 'string' ||
      typeof parsed.embedding_origin !== 'string' ||
      typeof parsed.expires_at !== 'string'
    ) {
      return null
    }
    return {
      version: pendingRecordVersion,
      site_id: parsed.site_id,
      request_id: parsed.request_id,
      embedding_origin: parsed.embedding_origin,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      expires_at: parsed.expires_at,
    }
  } catch {
    return null
  }
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Returns the popup's own sessionStorage or null when unavailable. */
export function safeSessionStorage(): StorageLike | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

/** Reads a pending record, clearing it when expired. */
export function readPendingAuthorization(
  storage: StorageLike | null,
  requestId: string,
): PendingAuthorization | null {
  if (!storage) return null
  let raw: string | null = null
  try {
    raw = storage.getItem(pendingRecordKey(requestId))
  } catch {
    return null
  }
  const record = parsePendingAuthorization(raw)
  if (!record) return null
  if (isPendingExpired(record)) {
    clearPendingAuthorization(storage, requestId)
    return null
  }
  return record
}

export function writePendingAuthorization(
  storage: StorageLike | null,
  record: PendingAuthorization,
): void {
  if (!storage) return
  try {
    storage.setItem(pendingRecordKey(record.request_id), JSON.stringify(record))
  } catch {
    // sessionStorage unavailable: the flow continues without persistence.
  }
}

export function clearPendingAuthorization(
  storage: StorageLike | null,
  requestId: string,
): void {
  if (!storage) return
  try {
    storage.removeItem(pendingRecordKey(requestId))
  } catch {
    // Ignore; the record is short-lived and expires anyway.
  }
}

/** Extracts the request_id from a local /authorize redirect target. */
export function requestIdFromAuthorizeRedirect(
  redirect: string,
): string | null {
  let url: URL
  try {
    url = new URL(redirect, 'http://furtalk.local')
  } catch {
    return null
  }
  return parseRequestId(url.searchParams.get('request_id'))
}

/** Reads the pending record referenced by a login redirect, if any. */
export function readPendingAuthorizationFromRedirect(
  storage: StorageLike | null,
  redirect: string,
): PendingAuthorization | null {
  const requestId = requestIdFromAuthorizeRedirect(redirect)
  if (!requestId) return null
  return readPendingAuthorization(storage, requestId)
}

/** Returns the email prefill hint from a pending record, if any. */
export function emailHintFromPending(
  record: PendingAuthorization | null,
): string {
  if (!record) return ''
  return typeof record.email === 'string' ? record.email : ''
}

/** Sends a protocol message to the opener with an exact target origin. */
export function sendAuthorizationMessage(
  opener: Window | null,
  targetOrigin: string,
  message: AuthorizationMessage,
): void {
  if (!opener || targetOrigin === '') return
  opener.postMessage(message, targetOrigin)
}
