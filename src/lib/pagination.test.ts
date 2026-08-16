// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  isValidPageSize,
  readPageSize,
  usePageSize,
  writePageSize,
} from './pagination'

describe('pagination page-size helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('accepts only the 25|50|100 whitelist', () => {
    for (const size of PAGE_SIZES) {
      expect(isValidPageSize(size)).toBe(true)
    }
    expect(isValidPageSize(10)).toBe(false)
    expect(isValidPageSize(0)).toBe(false)
    expect(isValidPageSize('50')).toBe(false)
  })

  it('defaults to 25 when nothing is stored', () => {
    expect(readPageSize('admin-comments')).toBe(DEFAULT_PAGE_SIZE)
  })

  it('round-trips a stored preference', () => {
    writePageSize('admin-comments', 50)
    expect(readPageSize('admin-comments')).toBe(50)
    expect(
      window.localStorage.getItem(
        'furtalk:pagination:admin-comments:page-size',
      ),
    ).toBe('50')
  })

  it('keeps scopes independent', () => {
    writePageSize('admin-comments', 100)
    expect(readPageSize('admin-threads')).toBe(DEFAULT_PAGE_SIZE)
  })

  it('falls back to 25 for corrupted or out-of-whitelist values', () => {
    window.localStorage.setItem(
      'furtalk:pagination:admin-comments:page-size',
      'abc',
    )
    expect(readPageSize('admin-comments')).toBe(DEFAULT_PAGE_SIZE)
    window.localStorage.setItem(
      'furtalk:pagination:admin-comments:page-size',
      '999',
    )
    expect(readPageSize('admin-comments')).toBe(DEFAULT_PAGE_SIZE)
  })

  it('tolerates unavailable storage on read and write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })
    expect(readPageSize('admin-comments')).toBe(DEFAULT_PAGE_SIZE)
    expect(() => writePageSize('admin-comments', 50)).not.toThrow()
  })
})

describe('usePageSize', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('reads a persisted preference and persists changes', () => {
    writePageSize('account-comments', 50)
    const { result } = renderHook(() => usePageSize('account-comments'))
    expect(result.current.pageSize).toBe(50)
    act(() => result.current.changePageSize(100))
    expect(result.current.pageSize).toBe(100)
    expect(readPageSize('account-comments')).toBe(100)
  })

  it('falls back to 25 for an invalid requested size', () => {
    const { result } = renderHook(() => usePageSize('admin-users'))
    act(() => result.current.changePageSize(10))
    expect(result.current.pageSize).toBe(DEFAULT_PAGE_SIZE)
  })
})
