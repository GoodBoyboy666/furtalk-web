import i18n from './i18n'

// commentStatusOptions 是管理端与用户评论列表共用的状态筛选选项。
// value 是 URL/API 的稳定枚举；key 是翻译键，渲染时用 t(key) 取本地化标签。
export const commentStatusOptions = [
  { value: 'all', key: 'enums:commentStatus.all' },
  { value: 'pending', key: 'enums:commentStatus.pending' },
  { value: 'published', key: 'enums:commentStatus.published' },
  { value: 'spam', key: 'enums:commentStatus.spam' },
  { value: 'deleted', key: 'enums:commentStatus.deleted' },
] as const

// ownerCommentStatusOptions 是普通用户评论列表可见的状态筛选投影：
// 软删除（deleted）对普通用户不可见，因此从管理端完整列表派生并移除 deleted。
// 管理端继续使用完整的 commentStatusOptions。
export const ownerCommentStatusOptions = commentStatusOptions.filter(
  (option) => option.value !== 'deleted',
)

// commentStatusLabel 把稳定枚举值映射为翻译后的标签；
// 空值或未知值回落到占位文案。
export function commentStatusLabel(value: string | null | undefined) {
  if (!value) return i18n.t('enums:commentStatus.all')
  const option = commentStatusOptions.find((item) => item.value === value)
  return option ? i18n.t(option.key) : value
}

// commentStatusTargets 是管理端把评论显式移动到某个状态的动作选项。
// value 是稳定枚举；key 是翻译键。deleted 不是永久删除，
// 永久删除始终是独立的破坏性命令。
export const commentStatusTargets = [
  { value: 'pending', key: 'enums:commentStatusTarget.pending' },
  { value: 'published', key: 'enums:commentStatusTarget.published' },
  { value: 'spam', key: 'enums:commentStatusTarget.spam' },
  { value: 'deleted', key: 'enums:commentStatusTarget.deleted' },
] as const

export type CommentStatusTarget = (typeof commentStatusTargets)[number]['value']

// commentStatusTargetLabel 把目标枚举映射为动作文案；未知值回落到原始值。
export function commentStatusTargetLabel(value: string | null | undefined) {
  if (!value) return ''
  const option = commentStatusTargets.find((item) => item.value === value)
  return option ? i18n.t(option.key) : value
}

// otherCommentStatusTargets 返回当前状态之外的三个可移动目标，
// 供管理端评论列表与详情页共用同一份状态矩阵。
export function otherCommentStatusTargets(current: string) {
  return commentStatusTargets.filter((target) => target.value !== current)
}

// CommentAction 是状态目标对应的后端动作端点后缀。
export type CommentAction = 'pending' | 'publish' | 'spam' | 'delete'

// commentStatusAction 把状态目标映射为后端动作端点名称：
// published -> publish、deleted -> delete，其余枚举与端点一致。
export function commentStatusAction(
  target: CommentStatusTarget,
): CommentAction {
  switch (target) {
    case 'published':
      return 'publish'
    case 'deleted':
      return 'delete'
    default:
      return target
  }
}
