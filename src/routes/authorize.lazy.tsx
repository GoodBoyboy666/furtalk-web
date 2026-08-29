import { createLazyFileRoute } from '@tanstack/react-router'
import { AuthorizePage } from '@/pages/authorize'

export const Route = createLazyFileRoute('/authorize')({
  component: AuthorizePage,
})
