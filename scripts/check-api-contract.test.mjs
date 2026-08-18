import { describe, expect, it } from 'vitest'
import {
  checkSource,
  collectOperations,
  normalizePath,
} from './check-api-contract.mjs'

// 构造包含多个操作的最小 swagger 文档。
const swagger = {
  paths: {
    '/api/v1/admin/comments/{comment_id}': {
      get: { tags: ['admin-comments'] },
      patch: { tags: ['admin-comments'] },
      delete: { tags: ['admin-comments'] },
    },
    '/api/v1/captcha/config': {
      get: { tags: ['captcha'] },
    },
    '/api/v1/me': {
      get: { tags: ['me'] },
    },
    '/api/v1/me/passkeys/{passkey_id}': {
      delete: { tags: ['me'] },
    },
  },
}

describe('collectOperations', () => {
  it('normalizes swagger path parameters to {} placeholders', () => {
    const operations = collectOperations(swagger)
    expect(operations.get('get')).toContain('/api/v1/admin/comments/{}')
    expect(operations.get('get')).toContain('/api/v1/captcha/config')
    expect(operations.get('delete')).toContain('/api/v1/me/passkeys/{}')
  })

  it('ignores non-HTTP operations', () => {
    const withExtra = {
      paths: {
        '/api/v1/admin/comments': {
          options: { tags: ['admin-comments'] },
          get: { tags: ['admin-comments'] },
        },
      },
    }
    const operations = collectOperations(withExtra)
    expect(operations.get('options')).toBeUndefined()
    expect(operations.get('get')).toContain('/api/v1/admin/comments')
  })
})

describe('extractStaticPath', () => {
  it('accepts a plain string literal', () => {
    // 从真实 AST 中提取字符串字面量参数。
    const source = "api.get('/me')"
    const operations = collectOperations(swagger)
    const result = checkSource('fake.ts', source, operations, 'fake.ts')
    expect(result.issues).toHaveLength(0)
    expect(result.checked).toBe(1)
  })

  it('extracts identifier placeholders from template literals', () => {
    const source = 'api.get(`/admin/comments/${id}`)'
    const operations = collectOperations(swagger)
    const result = checkSource('fake.ts', source, operations, 'fake.ts')
    expect(result.issues).toHaveLength(0)
    expect(result.checked).toBe(1)
  })
})

describe('normalizePath', () => {
  it('prefixes the api base for relative paths', () => {
    expect(normalizePath('/me')).toBe('/api/v1/me')
    expect(normalizePath('me')).toBe('/api/v1/me')
    expect(normalizePath('/api/v1/me')).toBe('/api/v1/me')
  })

  it('normalizes template placeholders to {}', () => {
    expect(normalizePath('/admin/comments/${id}')).toBe(
      '/api/v1/admin/comments/{}',
    )
    expect(normalizePath('/admin/sites/${siteId}/origins/${originId}')).toBe(
      '/api/v1/admin/sites/{}/origins/{}',
    )
  })

  it('rejects absolute URLs as not checkable', () => {
    expect(normalizePath('https://other.example/admin')).toBeNull()
  })
})

describe('checkSource', () => {
  it('reports a missing swagger operation', () => {
    const operations = collectOperations(swagger)
    const result = checkSource(
      'fake.ts',
      "api.get('/admin/comments/does-not-exist')",
      operations,
      'fake.ts',
    )
    expect(result.checked).toBe(1)
    expect(result.issues.join()).toContain(
      'missing swagger operation: GET /api/v1/admin/comments/does-not-exist',
    )
  })

  it('rejects dynamic URLs that cannot be statically normalized', () => {
    const operations = collectOperations(swagger)
    const result = checkSource(
      'fake.ts',
      'api.get(`/admin/comments/${id + 1}`)',
      operations,
      'fake.ts',
    )
    expect(result.issues.join()).toContain('cannot be statically checked')
    expect(result.checked).toBe(0)
  })

  it('passes a valid template call with matching swagger params', () => {
    const operations = collectOperations(swagger)
    const result = checkSource(
      'fake.ts',
      'api.delete(`/admin/comments/${id}`)',
      operations,
      'fake.ts',
    )
    expect(result.issues).toHaveLength(0)
    expect(result.checked).toBe(1)
  })

  it('rejects an absolute cross-origin call', () => {
    const operations = collectOperations(swagger)
    const result = checkSource(
      'fake.ts',
      "api.get('https://other.example/admin/settings')",
      operations,
      'fake.ts',
    )
    expect(result.issues.join()).toContain('not checkable')
  })

  it('rejects dynamic first arguments', () => {
    const operations = collectOperations(swagger)
    const result = checkSource(
      'fake.ts',
      'api.get(buildPath())',
      operations,
      'fake.ts',
    )
    expect(result.issues.join()).toContain('cannot be statically checked')
  })
})
