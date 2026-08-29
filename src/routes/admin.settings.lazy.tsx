import { createLazyFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/pages/admin.settings'

export const Route = createLazyFileRoute('/admin/settings')({
  component: SettingsPage,
})
