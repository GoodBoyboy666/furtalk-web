import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const labelKeys: Record<string, string> = {
  pending: 'enums:status.pending',
  published: 'enums:status.published',
  spam: 'enums:status.spam',
  deleted: 'enums:status.deleted',
  active: 'enums:status.active',
  disabled: 'enums:status.disabled',
  admin: 'enums:status.admin',
  user: 'enums:status.user',
  verified: 'enums:status.verified',
  unverified: 'enums:status.unverified',
}

const statusStyles: Partial<Record<string, { dot: string; badge: string }>> = {
  published: {
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
  active: {
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
  verified: {
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
  unverified: {
    dot: 'bg-amber-500',
    badge:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
  },
  pending: {
    dot: 'bg-amber-500 animate-pulse',
    badge:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
  },
  spam: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
  },
  deleted: {
    dot: 'bg-zinc-400 dark:bg-zinc-500',
    badge: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
  },
  disabled: {
    dot: 'bg-zinc-400 dark:bg-zinc-500',
    badge: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/25',
  },
  admin: {
    dot: 'bg-indigo-500',
    badge:
      'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
  },
  user: {
    dot: 'bg-sky-500',
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
  },
}

export function StatusBadge({ value }: { value: string }) {
  const { t } = useTranslation('enums')
  const style = statusStyles[value]
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 font-medium px-2 py-0.5 text-xs transition-colors',
        style?.badge,
      )}
    >
      {style ? (
        <span className={cn('size-1.5 rounded-full shrink-0', style.dot)} />
      ) : null}
      <span>
        {labelKeys[value] ? t(labelKeys[value]) : value || t('status.unknown')}
      </span>
    </Badge>
  )
}
