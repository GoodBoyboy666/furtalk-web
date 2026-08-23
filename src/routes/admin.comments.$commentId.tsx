import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  Pin,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      return <Clock />
    case 'published':
      return <Check />
    case 'spam':
      return <ShieldAlert />
    default:
      return <Trash2 />
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = useMutation({
    mutationFn: () => commentsApi.update(commentId, body ?? ''),
    onSuccess: () => {
      toast.success(t('commentUpdated'))
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
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="text-base">{t('body')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Textarea
              value={body ?? item.body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              className="resize-y"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => update.mutate()}
                disabled={
                  update.isPending || body === null || body === item.body
                }
              >
                {update.isPending ? <Loader2 className="animate-spin" /> : null}
                {t('saveChanges')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('authorInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatarUrl={item.avatar_url}
                  name={item.author_nickname || item.author_email}
                  fallback={initialsFrom(
                    item.author_nickname,
                    item.author_email,
                  )}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0">
                  <p className="m-0 font-medium">
                    {item.author_nickname || t('anonymous')}
                  </p>
                  <p className="m-0 truncate text-xs text-muted-foreground">
                    {t('userNumber', { id: item.user_id })}
                  </p>
                </div>
              </div>
              <Info label={t('userId')} value={formatValue(item.user_id)} />
              <Info
                label={t('nickname')}
                value={formatValue(item.author_nickname)}
              />
              <Info label={t('email')} value={formatValue(item.author_email)} />
              <Info
                label={t('website')}
                value={formatValue(item.author_website)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('relationsAndIds')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label={t('commentId')} value={formatValue(item.id)} />
              <Info label={t('siteId')} value={formatValue(item.site_id)} />
              <Info label={t('threadId')} value={formatValue(item.thread_id)} />
              <Info label={t('parentId')} value={formatValue(item.parent_id)} />
              <Info label={t('rootId')} value={formatValue(item.root_id)} />
              <Info label={t('depth')} value={String(item.depth)} />
              <Info
                label={t('replyToUserId')}
                value={formatValue(item.reply_to_user_id)}
              />
              <Info
                label={t('replyToNickname')}
                value={formatValue(item.reply_to_nickname)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('requestInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Info
                label={t('ipMode')}
                value={privacyModeLabel(item.ip_mode, t)}
              />
              <Info label={t('ipValue')} value={ipValueText(item, t)} />
              <Info
                label={t('uaMode')}
                value={privacyModeLabel(item.ua_mode, t)}
              />
              <Info label={t('uaValue')} value={uaValueText(item, t)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('lifecycle')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Info
                label={t('status')}
                value={<StatusBadge value={item.status} />}
              />
              <Info
                label={t('pinStatus')}
                value={
                  item.is_pinned ? t('commentPinned') : t('commentNotPinned')
                }
              />
              <Info
                label={t('createdAt')}
                value={formatDateTime(item.created_at, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
              <Info
                label={t('publishedAt')}
                value={formatDateTime(item.published_at, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
              <Info
                label={t('deletedAt')}
                value={formatDateTime(item.deleted_at, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('statusActions')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {item.parent_id === null &&
              (item.is_pinned || item.status === 'published') ? (
                <Button
                  variant="outline"
                  disabled={pinAction.isPending}
                  onClick={() => pinAction.mutate(!item.is_pinned)}
                >
                  {pinAction.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Pin />
                  )}
                  {item.is_pinned ? t('unpinComment') : t('pinComment')}
                </Button>
              ) : null}
              {otherCommentStatusTargets(item.status).map((target) => (
                <Button
                  key={target.value}
                  variant="outline"
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
                  {t(target.key)}
                </Button>
              ))}
              <Button variant="destructive" disabled>
                <Trash2 />
                {t('permanentDeleteFromList')}
              </Button>
            </CardContent>
          </Card>
        </div>
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

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 break-words">{value}</p>
    </div>
  )
}
