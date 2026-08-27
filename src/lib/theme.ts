import { normalizeHexColor } from './public-config'

export type ThemeTokenSet = Record<string, string>

export type DerivedThemeTokens = {
  light: ThemeTokenSet
  dark: ThemeTokenSet
}

type RGB = { r: number; g: number; b: number }

function parseHex(value: string): RGB {
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  }
}

function toHex({ r, g, b }: RGB): string {
  return `#${[r, g, b]
    .map((part) =>
      Math.max(0, Math.min(255, Math.round(part)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase()
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  }
}

function luminance({ r, g, b }: RGB): number {
  const channel = (part: number) => {
    const value = part / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: RGB, b: RGB): number {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function readablePrimary(color: RGB, background: RGB): RGB {
  if (contrast(color, background) >= 4.5) return color
  const target =
    luminance(background) > 0.5
      ? { r: 0, g: 0, b: 0 }
      : { r: 255, g: 255, b: 255 }
  let candidate = color
  for (let amount = 0.05; amount <= 0.9; amount += 0.05) {
    candidate = mix(color, target, amount)
    if (contrast(candidate, background) >= 4.5) return candidate
  }
  return candidate
}

function foreground(color: RGB): string {
  const white = { r: 255, g: 255, b: 255 }
  const ink = { r: 24, g: 24, b: 27 }
  return contrast(color, white) >= contrast(color, ink) ? '#FFFFFF' : '#18181B'
}

function tokenSet(primary: RGB, background: RGB): ThemeTokenSet {
  const primaryHex = toHex(primary)
  const primaryForeground = foreground(primary)
  const ring = toHex(mix(primary, background, 0.2))
  return {
    '--primary': primaryHex,
    '--primary-foreground': primaryForeground,
    '--ring': ring,
    '--sidebar-primary': primaryHex,
    '--sidebar-primary-foreground': primaryForeground,
    '--sidebar-ring': ring,
    '--chart-1': primaryHex,
  }
}

export function deriveThemeTokens(value: string): DerivedThemeTokens {
  const normalized = normalizeHexColor(value)
  const color = parseHex(normalized)
  const lightBackground = { r: 255, g: 255, b: 255 }
  const darkBackground = { r: 22, g: 22, b: 27 }
  return {
    light: tokenSet(readablePrimary(color, lightBackground), lightBackground),
    dark: tokenSet(readablePrimary(color, darkBackground), darkBackground),
  }
}

export function applyThemeTokens(
  root: HTMLElement,
  tokens: DerivedThemeTokens | null,
): void {
  const names = [
    '--primary',
    '--primary-foreground',
    '--ring',
    '--sidebar-primary',
    '--sidebar-primary-foreground',
    '--sidebar-ring',
    '--chart-1',
  ]
  for (const name of names) {
    const suffix = name.slice(2)
    root.style.removeProperty(`--brand-${suffix}-light`)
    root.style.removeProperty(`--brand-${suffix}-dark`)
  }
  if (!tokens) return
  for (const [name, value] of Object.entries(tokens.light)) {
    root.style.setProperty(`--brand-${name.slice(2)}-light`, value)
  }
  for (const [name, value] of Object.entries(tokens.dark)) {
    root.style.setProperty(`--brand-${name.slice(2)}-dark`, value)
  }
}
