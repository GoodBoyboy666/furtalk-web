import { createLazyFileRoute } from '@tanstack/react-router'
import { SitesPage } from '@/pages/admin.sites'

export const Route = createLazyFileRoute('/admin/sites')({
  component: SitesPage,
})
