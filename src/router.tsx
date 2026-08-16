import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { parseSearch, stringifySearch } from './lib/search-codec'

// getRouter 使用项目自有的字符串查询编解码器，保证十进制 ID、marker、cursor
// 等 HTTP 契约字符串在路由解析与序列化过程中始终保留浏览器级字符串语义。
// history 参数仅供集成测试注入 memory history，生产环境缺省使用浏览器历史。
export function getRouter(options?: { history?: RouterHistory }) {
  const router = createTanStackRouter({
    routeTree,
    history: options?.history,
    parseSearch,
    stringifySearch,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
