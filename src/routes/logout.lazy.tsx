import { createLazyFileRoute } from '@tanstack/react-router'
import { LogoutPage } from '@/pages/logout'

export const Route = createLazyFileRoute('/logout')({ component: LogoutPage })
