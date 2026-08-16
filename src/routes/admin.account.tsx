import { Navigate, createFileRoute } from '@tanstack/react-router'

// /admin/account 已迁移到个人中心 /account/*。
// 此路由只做显式安全重定向，不再维护第二套账户页面。
export const Route = createFileRoute('/admin/account')({
  component: AdminAccountRedirect,
})

function AdminAccountRedirect() {
  return <Navigate to="/account/profile" replace />
}
