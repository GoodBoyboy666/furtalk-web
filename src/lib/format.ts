import i18n from './i18n'

// formatDateTime 用当前 i18next 语言格式化日期时间。
// 缺失或非法值回落到 dash 占位符；非法日期回落到原始字符串。
export function formatDateTime(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(
    i18n.resolvedLanguage ?? 'zh-CN',
    options,
  ).format(date)
}

// formatDate 用当前 i18next 语言格式化纯日期。
export function formatDate(value: string | null | undefined): string {
  return formatDateTime(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// formatNumber 用当前 i18next 语言格式化数字。
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(i18n.resolvedLanguage ?? 'zh-CN').format(value)
}
