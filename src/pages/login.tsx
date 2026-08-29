import { Outlet } from '@tanstack/react-router'

// LoginLayout 是 /login 路由树的布局：把 /login 的 index 页与 /login/otp
// 子路由都渲染在同一个 Outlet 中，确保子路由导航后页面真正切换。
export function LoginLayout() {
  return <Outlet />
}
