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
    <FadeIn className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/50 text-muted-foreground">
        <Inbox className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="m-0 text-sm font-semibold text-foreground/90">
          {title ?? t('state.noData')}
        </p>
        <p className="m-0 text-xs text-muted-foreground max-w-sm">
          {description ?? t('state.adjustFilters')}
        </p>
      </div>
    </FadeIn>
  )
}
