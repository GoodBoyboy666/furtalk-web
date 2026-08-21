import axios from 'axios'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from './types'
import i18n from '../i18n'

const csrfCookieName = '__Host-furtalk_csrf'
const csrfHeaderName = 'X-CSRF-Token'
const unsafeMethods = new Set(['post', 'put', 'patch', 'delete'])

function readCSRFCookie() {
  if (typeof document === 'undefined') return undefined
  const prefix = `${csrfCookieName}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return cookie?.slice(prefix.length) || undefined
}

function isCSRFProtectedPath(rawUrl?: string) {
  if (!rawUrl) return false
  const base = new URL('http://furtalk.local')
  const url = new URL(rawUrl, base)
  if (url.origin !== base.origin) return false
  const path = url.pathname
  const apiPath = path.startsWith('/api/v1/')
    ? path.slice('/api/v1'.length)
    : path
  return (
    apiPath === '/auth/logout' ||
    apiPath === '/me' ||
    apiPath.startsWith('/me/') ||
    apiPath === '/comments' ||
    apiPath.startsWith('/comments/') ||
    apiPath === '/comment-authorizations' ||
    apiPath === '/admin' ||
    apiPath.startsWith('/admin/')
  )
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase() || 'get'
  if (!unsafeMethods.has(method) || !isCSRFProtectedPath(config.url)) {
    return config
  }
  if (typeof document === 'undefined') {
    throw new Error('CSRF-protected requests require a browser context')
  }
  const token = readCSRFCookie()
  if (token) config.headers.set(csrfHeaderName, token)
  return config
})

export class ApiError extends Error {
  code?: string
  status?: number
  requestId?: string
  details?: Record<string, unknown>

  constructor(
    message: string,
    status?: number,
    code?: string,
    requestId?: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const axiosError = error as AxiosError<ApiErrorResponse>
  const response = axiosError.response
  const body = response ? response.data.error : undefined
  return new ApiError(
    body?.message || axiosError.message || i18n.t('common:error.generic'),
    response ? response.status : undefined,
    body?.code,
    body?.request_id,
    body?.details,
  )
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeApiError(error)),
)

export function toQuery(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '',
    ),
  )
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}
