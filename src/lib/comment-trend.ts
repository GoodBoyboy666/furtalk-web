export const commentTrendTimezoneStorageKey =
  'furtalk:admin-comment-trend-timezone'

export const commentTrendDays = [7, 30] as const
export type CommentTrendDays = (typeof commentTrendDays)[number]

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

function safePreferenceStorage(): PreferenceStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function supportedCommentTrendTimezones(
  detected = detectBrowserTimeZone(),
): string[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : []
  return Array.from(
    new Set(
      [...supported, detected, 'UTC'].filter((value): value is string =>
        isValidTimeZone(value),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

export function detectBrowserTimeZone(): string | null {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isValidTimeZone(detected) ? detected : null
  } catch {
    return null
  }
}

export function resolveCommentTrendTimeZone(
  storage: PreferenceStorage | null = safePreferenceStorage(),
): string {
  try {
    const stored = storage?.getItem(commentTrendTimezoneStorageKey)
    if (isValidTimeZone(stored)) return stored
  } catch {
    // Restricted storage falls back to the browser's detected timezone.
  }
  return detectBrowserTimeZone() ?? 'UTC'
}

export function persistCommentTrendTimeZone(
  timezone: string,
  storage: PreferenceStorage | null = safePreferenceStorage(),
): boolean {
  if (!isValidTimeZone(timezone)) return false
  try {
    storage?.setItem(commentTrendTimezoneStorageKey, timezone)
    return storage !== null
  } catch {
    return false
  }
}

export function formatCommentTrendDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}
