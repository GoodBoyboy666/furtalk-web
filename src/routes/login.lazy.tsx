import { createLazyFileRoute } from '@tanstack/react-router'
import { LoginLayout } from '@/pages/login'

// Route 是登录路由树的布局路由。
export const Route = createLazyFileRoute('/login')({ component: LoginLayout })
