import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AccountShell } from '@/components/AccountShell'
import { PageTransition } from '@/components/motion'

export const Route = createFileRoute('/account')({ component: AccountLayout })

function AccountLayout() {
  return (
    <AccountShell>
      {/* 路由级进入过渡：每次 pathname 变化时重播，壳层自身不重挂载。 */}
      <PageTransition>
        <Outlet />
      </PageTransition>
    </AccountShell>
  )
}
