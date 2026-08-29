// CommentsSearch 是本人评论列表的 URL 筛选参数。
// page 使用页码替换旧 cursor：刷新、前进/后退与链接分享都保留分页位置。
export type CommentsSearch = {
  site_id?: string
  status?: string
  page?: number
}

// positiveInt 报告字符串是否为合法正整数页码。
function positiveInt(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[1-9]\d*$/.test(raw)
}

// parseCommentsPage 把 URL page 参数解析为正整数页码；缺失、非法或非正整数
// 一律返回 undefined（第 1 页），保证刷新/前进后退与链接分享语义稳定。
export function parseCommentsPage(raw: unknown): number | undefined {
  return positiveInt(raw) ? Number(raw) : undefined
}
