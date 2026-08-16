// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UserAvatar, initialsFrom } from './UserAvatar'

describe('UserAvatar', () => {
  it('renders initials fallback when the avatar image is unavailable', () => {
    render(
      <UserAvatar
        avatarUrl="https://invalid.example/avatar/hash"
        name="Alice"
        fallback="AL"
      />,
    )
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('renders initials fallback without an avatar url', () => {
    render(<UserAvatar fallback="ZZ" />)
    expect(screen.getByText('ZZ')).toBeInTheDocument()
  })
})

describe('initialsFrom', () => {
  it('prefers nickname over email', () => {
    expect(initialsFrom('Alice', 'alice@example.com')).toBe('AL')
  })

  it('falls back to the email prefix when the nickname is empty', () => {
    expect(initialsFrom('', 'bob@example.com')).toBe('BO')
  })
})
