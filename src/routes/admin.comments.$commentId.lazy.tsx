import { createLazyFileRoute } from '@tanstack/react-router'
import { CommentDetailPage } from '@/pages/admin.comments.$commentId'

export const Route = createLazyFileRoute('/admin/comments/$commentId')({
  component: CommentDetailPage,
})
