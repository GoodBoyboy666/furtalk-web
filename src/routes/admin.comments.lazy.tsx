import { createLazyFileRoute } from '@tanstack/react-router'
import { CommentsPage } from '@/pages/admin.comments'

export const Route = createLazyFileRoute('/admin/comments')({
  component: CommentsPage,
})
