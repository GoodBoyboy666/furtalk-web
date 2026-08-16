import type { QueryClient } from '@tanstack/react-query'

// threadsQueryKey 是全部线程查询共享的失效前缀。
// 任何成功 mutation 都必须调用 invalidateThreads，保证列表刷新。
export const threadsQueryKey = ['threads'] as const

// invalidateThreads 使全部线程查询失效并触发重新拉取。
export function invalidateThreads(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: threadsQueryKey })
}
