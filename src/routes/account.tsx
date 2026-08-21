import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AccountShell } from '@/components/AccountShell'

export const Route = createFileRoute('/account')({ component: AccountLayout })

function AccountLayout() {
  return (
    <AccountShell>
      <Outlet />
    </AccountShell>
  )
}
