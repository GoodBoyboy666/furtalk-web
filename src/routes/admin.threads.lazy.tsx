import { createLazyFileRoute } from '@tanstack/react-router'
import { ThreadsPage } from '@/pages/admin.threads'

export const Route = createLazyFileRoute('/admin/threads')({
  component: ThreadsPage,
})
