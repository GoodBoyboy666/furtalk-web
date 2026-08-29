import { Outlet } from '@tanstack/react-router'
import { AccountShell } from '@/components/AccountShell'

export function AccountLayout() {
  return (
    <AccountShell>
      <Outlet />
    </AccountShell>
  )
}
