import { getRouteApi, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
import { CaptchaDialog } from '@/components/CaptchaDialog'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { StateFade } from '@/components/motion'
import { UserAvatar, initialsFrom } from '@/components/UserAvatar'
import { meCommentsApi, captchaApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'

// replyAction 是评论回复的 CAPTCHA 业务 action，与后端策略键一致。
const replyAction = 'comment'
const routeApi = getRouteApi('/account/comments/$commentId')

// CommentDetailPage 是本人评论详情页，支持已发布回复与策略化删除。
export function CommentDetailPage() {
  const { t } = useTranslation('account')
  const { commentId } = routeApi.useParams()
  const queryClient = useQueryClient()
  const comment = useQuery({
    queryKey: ['my-comment', commentId],
    queryFn: () => meCommentsApi.get(commentId),
  })
  const captchaConfig = useQuery({
    queryKey: ['captcha-config', replyAction],
    queryFn: () => captchaApi.config(replyAction),
  })
  const captcha = captchaConfig.data?.required
    ? captchaConfig.data.captcha
    : null
  const required = captcha != null

  const [replyBody, setReplyBody] = useState('')
  const [replyError, setReplyError] = useState('')
  const [confirm, setConfirm] = useState(false)
  // 回复对话框与一次性 pending 回调；关闭即丢弃，保证不重复提交。
  const [replyDialogOpen, setReplyDialogOpen] = useState(false)
  const pendingReplyRef = useRef<((token: string) => void) | null>(null)

  const reply = useMutation({
    mutationFn: (args: { body: string; token?: string }) =>
      meCommentsApi.reply(commentId, args.body, args.token),
    onSuccess: () => {
      toast.success(t('replyPublished'))
      setReplyBody('')
      void queryClient.invalidateQueries({
        queryKey: ['my-comment', commentId],
      })
      void queryClient.invalidateQueries({ queryKey: ['my-comments'] })
    },
    onError: (cause) => {
      if (required) {
        void captchaConfig.refetch()
      }
      setReplyError(
        cause instanceof ApiError ? cause.message : t('replyFailed'),
      )
    },
  })

  function handleReplyDialogChange(open: boolean) {
    setReplyDialogOpen(open)
    if (!open) {
      pendingReplyRef.current = null
    }
  }
  function handleReplySolved(token: string) {
    setReplyDialogOpen(false)
    const run = pendingReplyRef.current
    pendingReplyRef.current = null
    run?.(token)
  }

  const remove = useMutation({
    mutationFn: () => meCommentsApi.remove(commentId),
    onSuccess: (result) => {
      toast.success(result.hard ? t('commentHardDeleted') : t('commentDeleted'))
      void queryClient.invalidateQueries({ queryKey: ['my-comments'] })
      void queryClient.invalidateQueries({
        queryKey: ['my-comment', commentId],
      })
      setConfirm(false)
    },
    onError: (error) => {
      setConfirm(false)
      toast.error(error instanceof Error ? error.message : t('deleteFailed'))
    },
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
  const canReply = item.status === 'published'
  const deleteMode = item.user_delete_mode

  return (
    <>
      <Link
        to="/account/comments"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('backToMyComments')}
      </Link>
      <PageHeader
        title={t('commentDetailTitle')}
        description={t('commentNumber', { id: item.id })}
        action={<StatusBadge value={item.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('body')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="m-0 whitespace-pre-wrap text-sm">{item.body}</p>
            <Info label={t('site')} value={item.site_name || '-'} />
            <Info
              label={t('page')}
              value={item.page_title || item.page_key || '-'}
            />
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('authorInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatarUrl={item.avatar_url}
                  name={item.author_nickname || item.user_id}
                  fallback={initialsFrom(item.author_nickname, item.user_id)}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0">
                  <p className="m-0 font-medium">
                    {item.author_nickname || t('anonymous')}
                  </p>
                  <p className="m-0 truncate text-xs text-muted-foreground">
                    {t('authorId', { id: item.user_id })}
                  </p>
                </div>
              </div>
              <Info
                label={t('createdAt')}
                value={formatDateTime(item.created_at)}
              />
            </CardContent>
          </Card>
          {canReply ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('reply')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="reply-body">{t('replyBody')}</Label>
                  <Textarea
                    id="reply-body"
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    rows={4}
                    className="resize-y"
                  />
                </div>
                {replyError ? (
                  <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {replyError}
                  </p>
                ) : null}
                <Button
                  onClick={() => {
                    if (required) {
                      pendingReplyRef.current = (token) => {
                        reply.mutate({ body: replyBody, token })
                      }
                      setReplyDialogOpen(true)
                      return
                    }
                    reply.mutate({ body: replyBody, token: undefined })
                  }}
                  disabled={reply.isPending || !replyBody.trim()}
                >
                  {reply.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <MessageSquarePlus />
                  )}
                  {t('publishReply')}
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('deleteComment')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="m-0 text-sm text-muted-foreground">
                {t('deleteCommentHint')}
              </p>
              <Button
                variant="destructive"
                className="mt-3 w-full"
                disabled={remove.isPending}
                onClick={() => setConfirm(true)}
              >
                <Trash2 />
                {t('deleteThisComment')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <AlertDialog
        open={confirm}
        onOpenChange={(open) => !open && setConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteModeHint(deleteMode, t)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.confirmDelete', { ns: 'common' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CaptchaDialog
        open={replyDialogOpen}
        onOpenChange={handleReplyDialogChange}
        config={captcha}
        action={replyAction}
        title={t('captchaDialogTitle', { ns: 'auth' })}
        description={t('captchaDialogReplyHint', { ns: 'auth' })}
        onSolved={handleReplySolved}
        onError={(message) => setReplyError(message)}
      />
    </>
  )
}

// deleteModeHint 根据实例策略返回删除确认的说明文案。
// 软删与硬删都只作用于本条评论，其回复不受影响；用户不能自行选择方式。
function deleteModeHint(deleteMode: string, t: (key: string) => string) {
  if (deleteMode === 'hard') {
    return t('deleteModeHard')
  }
  return t('deleteModeSoft')
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 break-words">{value}</p>
    </div>
  )
}
