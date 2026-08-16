import type { QueryClient } from '@tanstack/react-query'
import type { Site } from './types'
import i18n from '../i18n'

// sitesQueryKey 是所有站点查询共享的失效键。
// 任何成功 mutation 都必须调用 invalidateSites，保证列表与详情刷新。
export const sitesQueryKey = ['sites'] as const

// invalidateSites 使全部站点查询失效并触发重新拉取。
export function invalidateSites(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: sitesQueryKey })
}

export type SitesView =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'list'; sites: Site[] }

// sitesView 把查询状态归约成页面渲染决策。
// 查询失败必须归约为 error 状态，绝不能落入 empty 空态误导管理员。
export function sitesView(state: {
  isPending: boolean
  isError: boolean
  error: unknown
  sites: Site[] | undefined
}): SitesView {
  if (state.isPending) return { kind: 'loading' }
  if (state.isError) {
    const message =
      state.error instanceof Error
        ? state.error.message
        : i18n.t('common:state.loadingError')
    return { kind: 'error', message }
  }
  if (!state.sites || state.sites.length === 0) return { kind: 'empty' }
  return { kind: 'list', sites: state.sites }
}
