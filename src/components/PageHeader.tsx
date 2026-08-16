import type { ReactNode } from 'react'
import { FadeIn } from '@/components/motion'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <FadeIn className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 mb-0 text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </FadeIn>
  )
}
