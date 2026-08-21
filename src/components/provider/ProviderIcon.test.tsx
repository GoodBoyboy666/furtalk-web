// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProviderIcon } from './ProviderIcon'

afterEach(() => {
  cleanup()
})

describe('ProviderIcon', () => {
  it.each([
    ['github', 'provider-icon-github'],
    ['google', 'provider-icon-google'],
    ['gitlab', 'provider-icon-gitlab'],
    ['gitea', 'provider-icon-gitea'],
    ['mastodon', 'provider-icon-mastodon'],
    ['microsoft', 'provider-icon-microsoft'],
    ['twitter', 'provider-icon-twitter'],
    ['x', 'provider-icon-twitter'],
    ['discord', 'provider-icon-discord'],
    ['apple', 'provider-icon-apple'],
    ['line', 'provider-icon-line'],
  ])('renders correct icon for %s', (providerKey, expectedTestId) => {
    render(<ProviderIcon providerKey={providerKey} />)
    expect(screen.getByTestId(expectedTestId)).toBeInTheDocument()
  })

  it('renders fallback icon for unknown provider keys', () => {
    render(<ProviderIcon providerKey="custom-provider" />)
    expect(screen.getByTestId('provider-icon-fallback')).toBeInTheDocument()
  })

  it('merges custom className correctly', () => {
    render(
      <ProviderIcon providerKey="github" className="size-6 custom-class" />,
    )
    const icon = screen.getByTestId('provider-icon-github')
    expect(icon).toHaveClass('size-6', 'custom-class')
  })
})
