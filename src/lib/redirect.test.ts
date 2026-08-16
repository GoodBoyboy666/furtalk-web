import { describe, expect, it } from 'vitest'
import { isSafeLocalRedirect, resolvePostLoginTarget } from './redirect'

describe('isSafeLocalRedirect', () => {
  it('accepts same-origin relative paths', () => {
    expect(isSafeLocalRedirect('/admin')).toBe(true)
    expect(isSafeLocalRedirect('/account/comments')).toBe(true)
    expect(isSafeLocalRedirect('/a/b?c=1#d')).toBe(true)
  })

  it('rejects absolute, protocol-relative and scheme-prefixed values', () => {
    expect(isSafeLocalRedirect('https://evil.example')).toBe(false)
    expect(isSafeLocalRedirect('http://evil.example/path')).toBe(false)
    expect(isSafeLocalRedirect('//evil.example/path')).toBe(false)
    expect(isSafeLocalRedirect('javascript:alert(1)')).toBe(false)
    expect(isSafeLocalRedirect('admin')).toBe(false)
    expect(isSafeLocalRedirect('')).toBe(false)
  })

  it('rejects backslash variants that browsers normalize to cross-origin URLs', () => {
    expect(isSafeLocalRedirect('/\\evil.example')).toBe(false)
    expect(isSafeLocalRedirect('/\\/evil.example')).toBe(false)
    expect(isSafeLocalRedirect('\\evil.example')).toBe(false)
  })
})

describe('resolvePostLoginTarget', () => {
  it('prefers a validated explicit local redirect for admins and users', () => {
    expect(resolvePostLoginTarget('admin', '/account/profile')).toBe(
      '/account/profile',
    )
    expect(resolvePostLoginTarget('user', '/account/comments')).toBe(
      '/account/comments',
    )
  })

  it('ignores unsafe redirects and falls back to role defaults', () => {
    expect(resolvePostLoginTarget('admin', 'https://evil.example')).toBe(
      '/admin',
    )
    expect(resolvePostLoginTarget('admin', '//evil.example')).toBe('/admin')
    expect(resolvePostLoginTarget('user', 'https://evil.example')).toBe(
      '/account/comments',
    )
  })

  it('falls back to role defaults without a redirect', () => {
    expect(resolvePostLoginTarget('admin', undefined)).toBe('/admin')
    expect(resolvePostLoginTarget('admin', null)).toBe('/admin')
    expect(resolvePostLoginTarget('user', undefined)).toBe('/account/comments')
  })
})
