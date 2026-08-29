import { createLazyFileRoute } from '@tanstack/react-router'
import { CommentsPage } from '@/pages/account.comments'

export const Route = createLazyFileRoute('/account/comments')({
  component: CommentsPage,
})
