import i18n from './i18n'

// userDeleteModeOptions 是管理端用户删除对话框使用的删除方式选项。
// value 是提交给 API 的稳定枚举；key 是翻译键，渲染时用 t(key) 取本地化标签，
// 避免直接向管理员展示原始 soft / hard 值。
export const userDeleteModeOptions = [
  { value: 'soft', key: 'enums:userDeleteMode.soft' },
  { value: 'hard', key: 'enums:userDeleteMode.hard' },
] as const

export type UserDeleteMode = (typeof userDeleteModeOptions)[number]['value']

// userDeleteModeLabel 把稳定枚举值映射为翻译后的标签；
// 空值回落到空串，未知值回落到原始值。
export function userDeleteModeLabel(value: string | null | undefined) {
  if (!value) return ''
  const option = userDeleteModeOptions.find((item) => item.value === value)
  return option ? i18n.t(option.key) : value
}
