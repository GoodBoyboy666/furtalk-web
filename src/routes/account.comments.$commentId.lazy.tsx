import { createLazyFileRoute } from '@tanstack/react-router'
import { CommentDetailPage } from '@/pages/account.comments.$commentId'

export const Route = createLazyFileRoute('/account/comments/$commentId')({
  component: CommentDetailPage,
})
