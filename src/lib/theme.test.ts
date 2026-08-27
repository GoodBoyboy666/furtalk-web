// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { applyThemeTokens, deriveThemeTokens } from './theme'

describe('theme derivation', () => {
  it('derives both light and dark primary surfaces from one brand color', () => {
    const tokens = deriveThemeTokens('#6750a4')
    expect(tokens.light['--primary']).toMatch(/^#[0-9A-F]{6}$/)
    expect(tokens.dark['--primary']).toMatch(/^#[0-9A-F]{6}$/)
    expect(tokens.light['--primary-foreground']).toMatch(/^#(FFFFFF|18181B)$/)
    expect(tokens.dark['--primary-foreground']).toMatch(/^#(FFFFFF|18181B)$/)
    expect(tokens.light['--chart-1']).toBe(tokens.light['--primary'])
    expect(tokens.dark['--chart-1']).toBe(tokens.dark['--primary'])
  })

  it('applies and removes only Web brand variables', () => {
    const root = document.documentElement
    applyThemeTokens(root, deriveThemeTokens('#6750A4'))
    expect(root.style.getPropertyValue('--brand-primary-light')).toBeTruthy()
    expect(root.style.getPropertyValue('--brand-primary-dark')).toBeTruthy()
    applyThemeTokens(root, null)
    expect(root.style.getPropertyValue('--brand-primary-light')).toBe('')
    expect(root.style.getPropertyValue('--brand-primary-dark')).toBe('')
  })
})
