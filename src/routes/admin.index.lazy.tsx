import { createLazyFileRoute } from '@tanstack/react-router'
import { OverviewPage } from '@/pages/admin.index'

export const Route = createLazyFileRoute('/admin/')({
  component: OverviewPage,
})
