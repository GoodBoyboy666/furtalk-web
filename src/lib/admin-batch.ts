import type { ApiError } from './api/client'
import type { AdminBatchResult } from './api/types'

export type { AdminBatchResult } from './api/types'

// getFailedBatchId 只接受 ApiError 的结构化 details.failed_id，避免各页面
// 自己读取未经验证的后端错误 payload。
export function getFailedBatchId(error: unknown): string | undefined {
  const details = (error as Partial<ApiError> | null)?.details
  const value = details?.failed_id
  return typeof value === 'string' ? value : undefined
}

export function batchResultSummary(
  result: AdminBatchResult,
  format: (changed: number, unchanged: number) => string,
) {
  return format(result.changed_count, result.unchanged_count)
}
