import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

const labelKeys: Record<string, string> = {
  pending: 'enums:status.pending',
  published: 'enums:status.published',
  spam: 'enums:status.spam',
  deleted: 'enums:status.deleted',
  active: 'enums:status.active',
  disabled: 'enums:status.disabled',
  admin: 'enums:status.admin',
  user: 'enums:status.user',
}

export function StatusBadge({ value }: { value: string }) {
  const { t } = useTranslation('enums')
  const tone =
    value === 'published' || value === 'active' || value === 'admin'
      ? 'default'
      : value === 'spam' || value === 'deleted'
        ? 'destructive'
        : 'secondary'
  return (
    <Badge variant={tone}>
      {labelKeys[value] ? t(labelKeys[value]) : value || t('status.unknown')}
    </Badge>
  )
}
