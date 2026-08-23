import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type AdminBatchActionDefinition = {
  value: string
  label: string
  icon?: ReactNode
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost'
}

export type AdminBatchToolbarProps = {
  selectedCount: number
  actions: readonly AdminBatchActionDefinition[]
  pending?: boolean
  onAction: (action: AdminBatchActionDefinition) => void
  label?: ReactNode
}

// AdminBatchToolbar 只负责呈现选择数量和资源方提供的动作定义。
// 资源资格、确认和请求语义全部由调用方决定，以便评论区和用户页复用。
export function AdminBatchToolbar({
  selectedCount,
  actions,
  pending = false,
  onAction,
  label,
}: AdminBatchToolbarProps) {
  if (selectedCount < 1) return null
  return (
    <div
      role="toolbar"
      aria-label={typeof label === 'string' ? label : undefined}
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-muted/40 p-2"
    >
      <span className="mr-1 text-sm text-muted-foreground">
        {label ?? selectedCount}
      </span>
      {actions.map((action) => (
        <Button
          key={action.value}
          type="button"
          size="sm"
          variant={action.variant ?? 'outline'}
          disabled={pending}
          onClick={() => onAction(action)}
        >
          {pending ? <Loader2 className="animate-spin" /> : action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  )
}
