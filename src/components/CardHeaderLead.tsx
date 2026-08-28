import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Provides the shared decorative icon and content lead used by card headers.
 * Card title and description semantics remain owned by each caller.
 */
export function CardHeaderLead({
  icon: Icon,
  children,
  iconClassName,
}: {
  icon: LucideIcon
  children: ReactNode
  iconClassName?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
          iconClassName,
        )}
      >
        <Icon aria-hidden="true" className="size-4.5" />
      </div>
      <div className="grid min-w-0 gap-1">{children}</div>
    </div>
  )
}
