import { createLazyFileRoute } from '@tanstack/react-router'
import { SecurityPage } from '@/pages/account.security'

export const Route = createLazyFileRoute('/account/security')({
  component: SecurityPage,
})
