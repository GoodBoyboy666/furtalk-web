// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setI18nLanguage } from '@/lib/i18n-test'
import { StatusBadge } from './StatusBadge'

beforeEach(async () => {
  cleanup()
  await setI18nLanguage('zh-CN')
})

afterEach(() => {
  cleanup()
})

describe('StatusBadge', () => {
  it('renders verified and unverified statuses with correct labels in zh-CN', () => {
    const { rerender } = render(<StatusBadge value="verified" />)
    expect(screen.getByText('已验证')).toBeInTheDocument()

    rerender(<StatusBadge value="unverified" />)
    expect(screen.getByText('未验证')).toBeInTheDocument()
  })

  it('renders verified and unverified statuses with correct labels in en', async () => {
    await setI18nLanguage('en')
    const { rerender } = render(<StatusBadge value="verified" />)
    expect(screen.getByText('Verified')).toBeInTheDocument()

    rerender(<StatusBadge value="unverified" />)
    expect(screen.getByText('Unverified')).toBeInTheDocument()
  })

  it('renders comment and user statuses correctly', () => {
    const { rerender } = render(<StatusBadge value="pending" />)
    expect(screen.getByText('待审核')).toBeInTheDocument()

    rerender(<StatusBadge value="published" />)
    expect(screen.getByText('已发布')).toBeInTheDocument()

    rerender(<StatusBadge value="admin" />)
    expect(screen.getByText('管理员')).toBeInTheDocument()

    rerender(<StatusBadge value="user" />)
    expect(screen.getByText('用户')).toBeInTheDocument()
  })
})
