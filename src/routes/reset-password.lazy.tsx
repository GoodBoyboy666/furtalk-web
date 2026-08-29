import { createLazyFileRoute } from '@tanstack/react-router'
import { ResetPasswordPage } from '@/pages/reset-password'

// Route 是密码重置路由。
export const Route = createLazyFileRoute('/reset-password')({
  component: ResetPasswordPage,
})
