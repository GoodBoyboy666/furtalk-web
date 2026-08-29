import { createLazyFileRoute } from '@tanstack/react-router'
import { UnsubscribePage } from '@/pages/unsubscribe'

export const Route = createLazyFileRoute('/unsubscribe')({
  component: UnsubscribePage,
})
