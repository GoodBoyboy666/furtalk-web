import { describe, expect, it } from 'vitest'
import {
  commentStatusAction,
  commentStatusLabel,
  commentStatusOptions,
  commentStatusTargetLabel,
  commentStatusTargets,
  otherCommentStatusTargets,
} from './comment-status'

describe('commentStatusOptions', () => {
  it('exposes the stable enum value with a stable translation key', () => {
    expect(commentStatusOptions.find((o) => o.value === 'all')?.key).toBe(
      'enums:commentStatus.all',
    )
    expect(commentStatusOptions.find((o) => o.value === 'pending')?.key).toBe(
      'enums:commentStatus.pending',
    )
  })
})

describe('commentStatusLabel', () => {
  it('maps a raw enum value to its localized label', () => {
    expect(commentStatusLabel('pending')).toBe('待审核')
    expect(commentStatusLabel('published')).toBe('已发布')
    expect(commentStatusLabel('all')).toBe('全部状态')
  })

  it('falls back to the all-status label for empty values', () => {
    expect(commentStatusLabel('')).toBe('全部状态')
    expect(commentStatusLabel(undefined)).toBe('全部状态')
    expect(commentStatusLabel(null)).toBe('全部状态')
  })

  it('falls back to the raw value for unknown enums', () => {
    expect(commentStatusLabel('unknown')).toBe('unknown')
  })
})

describe('commentStatusTargets', () => {
  it('exposes exactly the four selectable states with action labels', () => {
    expect(commentStatusTargets.map((t) => t.value)).toEqual([
      'pending',
      'published',
      'spam',
      'deleted',
    ])
    expect(commentStatusTargetLabel('pending')).toBe('移入待审核')
    expect(commentStatusTargetLabel('published')).toBe('发布评论')
    expect(commentStatusTargetLabel('spam')).toBe('标记垃圾')
    expect(commentStatusTargetLabel('deleted')).toBe('软删除')
  })

  it('falls back to the raw value for unknown target labels', () => {
    expect(commentStatusTargetLabel('unknown')).toBe('unknown')
    expect(commentStatusTargetLabel('')).toBe('')
  })
})

describe('otherCommentStatusTargets', () => {
  it('offers the other three states for every current state', () => {
    for (const current of ['pending', 'published', 'spam', 'deleted']) {
      const targets = otherCommentStatusTargets(current)
      expect(targets.map((t) => t.value)).not.toContain(current)
      expect(targets).toHaveLength(3)
    }
  })
})

describe('commentStatusAction', () => {
  it('maps published and deleted to their endpoint suffixes', () => {
    expect(commentStatusAction('pending')).toBe('pending')
    expect(commentStatusAction('published')).toBe('publish')
    expect(commentStatusAction('spam')).toBe('spam')
    expect(commentStatusAction('deleted')).toBe('delete')
  })
})
