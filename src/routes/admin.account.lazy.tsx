import { createLazyFileRoute } from '@tanstack/react-router'
import { AdminAccountRedirect } from '@/pages/admin.account'

export const Route = createLazyFileRoute('/admin/account')({
  component: AdminAccountRedirect,
})
