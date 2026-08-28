import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Globe2,
  Loader2,
  Mail,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Pencil,
  Pin,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/PageHeader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/StatusBadge'
import { StateFade } from '@/components/motion'
import { UserAvatar, initialsFrom } from '@/components/UserAvatar'
import { commentsApi } from '@/lib/api/resources'
import type { AdminComment } from '@/lib/api/types'
import {
  commentStatusAction,
  otherCommentStatusTargets,
} from '@/lib/comment-status'
import type { CommentStatusTarget } from '@/lib/comment-status'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/comments/$commentId')({
  component: CommentDetailPage,
})

// PLACEHOLDER 是缺失字段的统一占位符；不伪造未采集的数据。
const PLACEHOLDER = '-'

// targetIcon 为状态目标按钮返回稳定的行内图标。
function targetIcon(target: CommentStatusTarget) {
  switch (target) {
    case 'pending':
      return <Clock aria-hidden="true" />
    case 'published':
      return <Check aria-hidden="true" />
    case 'spam':
      return <ShieldAlert aria-hidden="true" />
    default:
      return <Trash2 aria-hidden="true" />
  }
}

// CommentDetailPage 是评论详情页，供测试直接使用。
export function CommentDetailPage() {
  const { t } = useTranslation('admin')
  const { commentId } = Route.useParams()
  const queryClient = useQueryClient()
  const comment = useQuery({
    queryKey: ['comment', commentId],
    queryFn: () => commentsApi.get(commentId),
  })
  const [body, setBody] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = useMutation({
    mutationFn: () => commentsApi.update(commentId, body ?? ''),
    onSuccess: () => {
      toast.success(t('commentUpdated'))
      setBody(null)
      setIsEditing(false)
      void queryClient.invalidateQueries({ queryKey: ['comment', commentId] })
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })
  const action = useMutation({
    mutationFn: (kind: 'pending' | 'publish' | 'spam' | 'delete') =>
      kind === 'pending'
        ? commentsApi.pending(commentId)
        : kind === 'publish'
          ? commentsApi.publish(commentId)
          : kind === 'spam'
            ? commentsApi.spam(commentId)
            : commentsApi.remove(commentId, false),
    onSuccess: () => {
      toast.success(t('operationCompleted'))
      setConfirmDelete(false)
      void queryClient.invalidateQueries({ queryKey: ['comment', commentId] })
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })
  const pinAction = useMutation({
    mutationFn: (pinned: boolean) =>
      pinned ? commentsApi.pin(commentId) : commentsApi.unpin(commentId),
    onSuccess: (_, pinned) => {
      toast.success(pinned ? t('commentPinned') : t('commentUnpinned'))
      void queryClient.invalidateQueries({ queryKey: ['comment', commentId] })
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('operationFailed'),
      ),
  })
  if (comment.isPending)
    return (
      <StateFade kind="loading" className="text-sm text-muted-foreground">
        {t('loadingComments')}
      </StateFade>
    )
  if (comment.isError)
    return (
      <StateFade kind="error" className="text-sm text-destructive">
        {t('commentNotFound')}
      </StateFade>
    )
  const item = comment.data
  const isBodyChanged = isEditing && body !== null && body !== item.body
  const displayName =
    item.author_nickname || item.author_email || t('anonymous')
  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
  return (
    <>
      <Link
        to="/admin/comments"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('backToComments')}
      </Link>
      <PageHeader
        title={t('commentDetailTitle')}
        description={t('commentNumber', { id: item.id })}
        action={<StatusBadge value={item.status} />}
      />
      <div className="grid gap-5">
        <Card>
          <CardHeader className="gap-5 border-b border-border/60 pb-5">
            <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 shrink-0 items-center gap-4">
                <UserAvatar
                  avatarUrl={item.avatar_url}
                  name={displayName}
                  fallback={initialsFrom(
                    item.author_nickname,
                    item.author_email,
                  )}
                  className="size-12 shrink-0"
                />
                <p className="m-0 min-w-0 break-words text-base font-semibold [overflow-wrap:anywhere]">
                  {displayName}
                </p>
              </div>
              <div className="grid min-w-0 flex-1 gap-x-5 gap-y-2 text-sm sm:grid-cols-3 md:max-w-3xl">
                <Info
                  icon={Mail}
                  label={t('email')}
                  value={formatValue(item.author_email)}
                />
                <Info
                  icon={Globe2}
                  label={t('website')}
                  value={formatValue(item.author_website)}
                />
                <Info
                  icon={CalendarClock}
                  label={t('createdAt')}
                  value={formatDateTime(item.created_at, dateTimeOptions)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t('body')}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!isEditing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBody(item.body)
                      setIsEditing(true)
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    {t('edit')}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => update.mutate()}
                      disabled={update.isPending || !isBodyChanged}
                    >
                      {update.isPending ? (
                        <Loader2 aria-hidden="true" className="animate-spin" />
                      ) : (
                        <Check aria-hidden="true" />
                      )}
                      {t('saveChanges')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBody(null)
                        setIsEditing(false)
                      }}
                    >
                      <X aria-hidden="true" />
                      {t('action.cancel', { ns: 'common' })}
                    </Button>
                  </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={t('commentActions')}
                      >
                        <MoreHorizontal aria-hidden="true" />
                        {t('commentActions')}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    {item.parent_id === null &&
                    (item.is_pinned || item.status === 'published') ? (
                      <DropdownMenuItem
                        disabled={pinAction.isPending}
                        onClick={() => pinAction.mutate(!item.is_pinned)}
                      >
                        {pinAction.isPending ? (
                          <Loader2
                            aria-hidden="true"
                            className="animate-spin"
                          />
                        ) : (
                          <Pin aria-hidden="true" />
                        )}
                        {item.is_pinned ? t('unpinComment') : t('pinComment')}
                      </DropdownMenuItem>
                    ) : null}
                    {item.parent_id === null &&
                    (item.is_pinned || item.status === 'published') ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {otherCommentStatusTargets(item.status).map((target) => (
                      <DropdownMenuItem
                        key={target.value}
                        variant={
                          target.value === 'deleted' ? 'destructive' : 'default'
                        }
                        disabled={action.isPending}
                        onClick={() => {
                          if (target.value === 'deleted') {
                            setConfirmDelete(true)
                            return
                          }
                          action.mutate(commentStatusAction(target.value))
                        }}
                      >
                        {targetIcon(target.value)}
                        {target.value === 'deleted'
                          ? t('action.delete', { ns: 'common' })
                          : target.value === 'spam'
                            ? t('markCommentSpam')
                            : t(target.key)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {isEditing ? (
              <Textarea
                id="comment-body"
                aria-label={t('body')}
                value={body ?? ''}
                onChange={(event) => setBody(event.target.value)}
                rows={8}
                className="resize-y"
              />
            ) : (
              <p className="m-0 min-w-0 whitespace-pre-wrap break-words text-[0.95rem] leading-7 [overflow-wrap:anywhere]">
                {item.body || PLACEHOLDER}
              </p>
            )}
          </CardContent>
        </Card>

        <details className="group overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare aria-hidden="true" className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1 font-medium">
              {t('commentInfoTitle')}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            <InfoCell label={t('commentId')} value={formatValue(item.id)} />
            <InfoCell label={t('userId')} value={formatValue(item.user_id)} />
            <InfoCell
              label={t('replyToUserId')}
              value={formatValue(item.reply_to_user_id)}
            />
            <InfoCell
              label={t('replyToNickname')}
              value={formatValue(item.reply_to_nickname)}
            />
            <InfoCell
              label={t('parentId')}
              value={formatValue(item.parent_id)}
            />
            <InfoCell label={t('rootId')} value={formatValue(item.root_id)} />
            <InfoCell label={t('depth')} value={String(item.depth)} />
            <InfoCell
              label={t('threadId')}
              value={formatValue(item.thread_id)}
            />
            <InfoCell label={t('siteId')} value={formatValue(item.site_id)} />
            <InfoCell
              label={t('pinStatus')}
              value={
                item.is_pinned ? t('commentPinned') : t('commentNotPinned')
              }
            />
            <InfoCell
              label={t('createdAt')}
              value={formatDateTime(item.created_at, dateTimeOptions)}
            />
            <InfoCell
              label={t('publishedAt')}
              value={formatDateTime(item.published_at, dateTimeOptions)}
            />
            <InfoCell
              label={t('deletedAt')}
              value={formatDateTime(item.deleted_at, dateTimeOptions)}
            />
          </div>
        </details>

        <details className="group overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Monitor aria-hidden="true" className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {t('technicalInfoTitle')}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t('technicalInfoDescription')}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-2">
            <InfoCell
              label={t('ipMode')}
              value={privacyModeLabel(item.ip_mode, t)}
            />
            <InfoCell label={t('ipValue')} value={ipValueText(item, t)} />
            <InfoCell
              label={t('uaMode')}
              value={privacyModeLabel(item.ua_mode, t)}
            />
            <InfoCell label={t('uaValue')} value={uaValueText(item, t)} />
          </div>
        </details>
      </div>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('softDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('softDeleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={action.isPending}
              onClick={() => {
                setConfirmDelete(false)
                action.mutate('delete')
              }}
            >
              {action.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.confirmAction', { ns: 'common' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// formatValue 统一处理 null / 空字符串，缺失时返回统一占位符。
function formatValue(value: string | null | undefined) {
  return value && value.trim() ? value : PLACEHOLDER
}

// privacyModeLabel 把隐私记录模式映射为翻译后的展示名；
// none 明确显示“未记录”，未知值显示“未知”。
function privacyModeLabel(
  mode: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  switch (mode) {
    case 'none':
      return t('privacyMode.notRecorded', { ns: 'enums' })
    case 'coarse':
      return t('privacyMode.coarse', { ns: 'enums' })
    case 'full':
      return t('privacyMode.full', { ns: 'enums' })
    default:
      return t('privacyMode.unknown', { ns: 'enums' })
  }
}

// ipValueText 按评论自身的 ip_mode 解释 IP 值：
// none 明确显示“未记录”；coarse / full 显示实际记录值，缺失时统一占位。
function ipValueText(
  item: AdminComment,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (item.ip_mode === 'none')
    return t('privacyMode.notRecorded', { ns: 'enums' })
  if (item.ip_mode === 'coarse' || item.ip_mode === 'full') {
    return formatValue(item.ip_value)
  }
  return PLACEHOLDER
}

// uaValueText 按评论自身的 ua_mode 解释 UA 信息：
// none 明确显示“未记录”；full 显示原始 User-Agent；coarse 拼接浏览器/系统/设备族。
function uaValueText(
  item: AdminComment,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (item.ua_mode === 'none')
    return t('privacyMode.notRecorded', { ns: 'enums' })
  if (item.ua_mode === 'full') return formatValue(item.ua_raw)
  if (item.ua_mode === 'coarse') {
    const parts = [item.ua_browser, item.ua_os, item.ua_device].filter(
      (part): part is string => Boolean(part),
    )
    return parts.length ? parts.join(' / ') : PLACEHOLDER
  }
  return PLACEHOLDER
}

function Info({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="min-w-0">
      <p className="m-0 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? (
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        ) : null}
        {label}
      </p>
      <div className="m-0 mt-1 min-w-0 break-words [overflow-wrap:anywhere]">
        {value}
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 bg-card p-4 sm:p-5">
      <Info label={label} value={value} />
    </div>
  )
}
