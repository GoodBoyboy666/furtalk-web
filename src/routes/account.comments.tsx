import { createFileRoute } from '@tanstack/react-router'
import { ownerCommentStatusOptions } from '@/lib/comment-status'
import { parseCommentsPage } from '@/lib/account-comments-search'
import type { CommentsSearch } from '@/lib/account-comments-search'

export const Route = createFileRoute('/account/comments')({
  validateSearch: (search: Record<string, unknown>): CommentsSearch => ({
    site_id:
      typeof search.site_id === 'string' && search.site_id
        ? search.site_id
        : undefined,
    status:
      typeof search.status === 'string' &&
      search.status !== 'all' &&
      ownerCommentStatusOptions.some((option) => option.value === search.status)
        ? search.status
        : undefined,
    page: parseCommentsPage(search.page),
  }),
})
