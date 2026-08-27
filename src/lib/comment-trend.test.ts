// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  commentTrendTimezoneStorageKey,
  formatCommentTrendDate,
  isValidTimeZone,
  persistCommentTrendTimeZone,
  resolveCommentTrendTimeZone,
  supportedCommentTrendTimezones,
} from './comment-trend'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('comment trend timezone preferences', () => {
  it('uses a valid stored timezone before browser detection', () => {
    window.localStorage.setItem(commentTrendTimezoneStorageKey, 'Asia/Shanghai')
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'America/New_York',
    })
    expect(resolveCommentTrendTimeZone()).toBe('Asia/Shanghai')
  })

  it('falls back from invalid storage to detected timezone and then UTC', () => {
    window.localStorage.setItem(commentTrendTimezoneStorageKey, 'Not/AZone')
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Europe/Berlin',
    })
    expect(resolveCommentTrendTimeZone()).toBe('Europe/Berlin')

    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Not/AZone',
    })
    expect(resolveCommentTrendTimeZone()).toBe('UTC')
  })

  it('persists only valid IANA timezone values and keeps UTC available', () => {
    expect(persistCommentTrendTimeZone('Not/AZone')).toBe(false)
    expect(persistCommentTrendTimeZone('Asia/Tokyo')).toBe(true)
    expect(window.localStorage.getItem(commentTrendTimezoneStorageKey)).toBe(
      'Asia/Tokyo',
    )
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(supportedCommentTrendTimezones('Asia/Tokyo')).toContain('UTC')
    expect(supportedCommentTrendTimezones('Asia/Tokyo')).toContain('Asia/Tokyo')
  })

  it('formats API calendar dates without shifting them across timezones', () => {
    expect(formatCommentTrendDate('2026-08-27', 'en-US')).toMatch(/Aug 27/)
  })
})
