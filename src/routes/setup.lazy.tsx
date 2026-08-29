import { createLazyFileRoute } from '@tanstack/react-router'
import { SetupPage } from '@/pages/setup'

// Route 是首次初始化路由，由用户手动访问 /setup。
export const Route = createLazyFileRoute('/setup')({ component: SetupPage })
