import { createLazyFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '@/pages/admin'

export const Route = createLazyFileRoute('/admin')({
  component: AdminLayout,
})
