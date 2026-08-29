import { createLazyFileRoute } from '@tanstack/react-router'
import { LoginPage } from '@/pages/login.index'

// Route 是登录页索引路由（/login）。
export const Route = createLazyFileRoute('/login/')({ component: LoginPage })
