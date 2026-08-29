import { createFileRoute } from '@tanstack/react-router'

// Route 是公开的退订路由；search 校验只保留字符串 token，数组/非字符串一律
// 归一为空，由组件渲染无效链接态。
export const Route = createFileRoute('/unsubscribe')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
})
