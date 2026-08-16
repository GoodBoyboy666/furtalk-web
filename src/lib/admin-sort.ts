import i18n from './i18n'

// adminSortOptions 是管理列表共享的排序方向选项。
// value 与后端受控枚举一致：desc 表示最新优先（缺省），asc 表示最早优先；
// key 是翻译键，渲染时用 t(key) 取本地化标签。
export const adminSortOptions = [
  { value: 'desc', key: 'enums:sort.desc' },
  { value: 'asc', key: 'enums:sort.asc' },
] as const

export type AdminSort = (typeof adminSortOptions)[number]['value']

// adminSortLabel 把排序方向映射为翻译后的标签。
export function adminSortLabel(value: string) {
  const option = adminSortOptions.find((item) => item.value === value)
  return option ? i18n.t(option.key) : value
}
