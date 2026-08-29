import { createLazyFileRoute } from '@tanstack/react-router'
import { AccountLayout } from '@/pages/account'

export const Route = createLazyFileRoute('/account')({
  component: AccountLayout,
})
