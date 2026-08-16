import { Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FadeIn } from '@/components/motion'

export function EmptyState({
  title,
  description,
}: {
  title?: string
  description?: string
}) {
  const { t } = useTranslation('common')
  return (
    <FadeIn className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-6 text-center">
      <Inbox className="size-8 text-muted-foreground" />
      <p className="m-0 text-sm font-medium">{title ?? t('state.noData')}</p>
      <p className="m-0 text-xs text-muted-foreground">
        {description ?? t('state.adjustFilters')}
      </p>
    </FadeIn>
  )
}
