import { createLazyFileRoute } from '@tanstack/react-router'
import { LoginOtpPage } from '@/pages/login.otp'

// Route 是邮箱验证码登录的独立 OTP 路由。
export const Route = createLazyFileRoute('/login/otp')({
  component: LoginOtpPage,
})
