import { createLazyFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/pages/account.profile'

export const Route = createLazyFileRoute('/account/profile')({
  component: ProfilePage,
})
