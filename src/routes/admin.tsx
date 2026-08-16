import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AdminShell } from '@/components/AdminShell'
import { PageTransition } from '@/components/motion'

export const Route = createFileRoute('/admin')({ component: AdminLayout })

function AdminLayout() {
  return (
    <AdminShell>
      {/* 路由级进入过渡：每次 pathname 变化时重播，壳层自身不重挂载。 */}
      <PageTransition>
        <Outlet />
      </PageTransition>
    </AdminShell>
  )
}
