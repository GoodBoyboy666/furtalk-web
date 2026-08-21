import {
  createFileRoute,
  Link,
  Outlet,
  useMatch,
  useNavigate,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Clock,
  Eye,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { UserAvatar, initialsFrom } from '@/components/UserAvatar'
import { StateFade } from '@/components/motion'
import { ListPagination } from '@/components/ListPagination'
import { commentsApi } from '@/lib/api/resources'
import {
  commentStatusAction,
  commentStatusLabel,
  commentStatusOptions,
  otherCommentStatusTargets,
} from '@/lib/comment-status'
import type { CommentAction, CommentStatusTarget } from '@/lib/comment-status'
import { adminSortLabel, adminSortOptions } from '@/lib/admin-sort'
import type { AdminSort } from '@/lib/admin-sort'
import { selectItems } from '@/lib/i18n'
import { usePageSize } from '@/lib/pagination'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/comments')({
  component: CommentsPage,
})

// targetIcon 为状态目标菜单项返回稳定的行内图标。
function targetIcon(target: CommentStatusTarget) {
  const className = 'mr-2 size-4'
  switch (target) {
    case 'pending':
      return <Clock className={className} />
    case 'published':
      return <Check className={className} />
    case 'spam':
      return <ShieldAlert className={className} />
    default:
      return <Trash2 className={className} />
  }
}

// CommentsPage 是评论管理列表页，供测试直接使用。
// admin.comments 是 $commentId 详情子路由的父路由：当详情子路由匹配时，
// 本组件退化为纯布局并渲染子路由，避免评论列表与详情页同时出现。
export function CommentsPage() {
  const detail = useMatch({
    from: '/admin/comments/$commentId',
    shouldThrow: false,
  })
  if (detail) return <Outlet />
  return <CommentsList />
}

// CommentsList 是列表内容的实现组件；仅在无详情子路由匹配时挂载。
function CommentsList() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<AdminSort>('desc')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { pageSize, changePageSize } = usePageSize('admin-comments')
  const [confirm, setConfirm] = useState<{
    id: string
    action: 'delete' | 'hard'
  } | null>(null)
  const query = useQuery({
    queryKey: ['comments', { status, sort, q, page, pageSize }],
    queryFn: () =>
      commentsApi.list({
        status: status === 'all' ? undefined : status,
        sort,
        q: q || undefined,
        page,
        limit: pageSize,
      }),
  })
  const action = useMutation({
    mutationFn: async ({
      id,
      action: kind,
    }: {
      id: string
      action: CommentAction | 'hard'
    }) => {
      if (kind === 'pending') return commentsApi.pending(id)
      if (kind === 'publish') return commentsApi.publish(id)
      if (kind === 'spam') return commentsApi.spam(id)
      return commentsApi.remove(id, kind === 'hard')
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === 'delete' || variables.action === 'hard'
          ? t('commentDeleted')
          : t('operationCompleted'),
      )
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
      setConfirm(null)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('operationFailed'),
      ),
  })

  const total = query.isSuccess ? query.data.total : 0
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  useEffect(() => {
    if (query.isSuccess && page > totalPages) {
      setPage(totalPages)
    }
  }, [query.isSuccess, page, totalPages])

  return (
    <>
      <PageHeader title={t('commentsTitle')} />
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setQ(search.trim())
                setPage(1)
              }
            }}
            placeholder={t('searchHint')}
            className="pl-9 bg-card"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setQ(search.trim())
            setPage(1)
          }}
        >
          {t('action.search', { ns: 'common' })}
        </Button>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value || 'all')
            setPage(1)
          }}
          items={selectItems(commentStatusOptions, t)}
        >
          <SelectTrigger className="w-full sm:w-40 bg-card">
            <SelectValue placeholder={t('commentStatus.all', { ns: 'enums' })}>
              {commentStatusLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {commentStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.key)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={sort}
          onValueChange={(value) => {
            setSort(value ?? 'desc')
            setPage(1)
          }}
          items={selectItems(adminSortOptions, t)}
        >
          <SelectTrigger className="w-full sm:w-36 bg-card">
            <SelectValue placeholder={t('sort.desc', { ns: 'enums' })}>
              {adminSortLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {adminSortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.key)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        {query.isPending ? (
          <StateFade kind="loading">
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t('loadingComments')}
            </div>
          </StateFade>
        ) : query.isError ? (
          <StateFade kind="error">
            <div className="p-8 text-center text-sm text-destructive">
              {t('commentsLoadFailedReload')}
            </div>
          </StateFade>
        ) : query.data.comments.length === 0 ? (
          <div className="p-4">
            <EmptyState title={t('noMatchingComments')} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[42%] min-w-[200px]">
                  {t('content')}
                </TableHead>
                <TableHead className="w-[24%] min-w-[140px]">
                  {t('author')}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t('status')}
                </TableHead>
                <TableHead className="whitespace-nowrap">{t('time')}</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell className="max-w-xs sm:max-w-md lg:max-w-lg whitespace-normal">
                    <Link
                      to="/admin/comments/$commentId"
                      params={{ commentId: comment.id }}
                      className="block max-w-full no-underline"
                    >
                      <p
                        className="m-0 truncate text-sm font-medium text-foreground"
                        title={comment.body}
                      >
                        {comment.body}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        #{comment.id}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-48 whitespace-normal">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        avatarUrl={comment.avatar_url}
                        name={comment.author_nickname || comment.author_email}
                        fallback={initialsFrom(
                          comment.author_nickname,
                          comment.author_email,
                        )}
                        className="size-7 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="m-0 truncate text-sm"
                          title={comment.author_nickname || t('anonymous')}
                        >
                          {comment.author_nickname || t('anonymous')}
                        </p>
                        <p
                          className="m-0 truncate text-xs text-muted-foreground"
                          title={comment.author_email}
                        >
                          {comment.author_email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <StatusBadge value={comment.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(comment.created_at)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('commentActions')}
                          >
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            void navigate({
                              to: '/admin/comments/$commentId',
                              params: { commentId: comment.id },
                            })
                          }
                        >
                          <Eye className="mr-2 size-4" />
                          {t('viewDetail')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {otherCommentStatusTargets(comment.status).map(
                          (target) => (
                            <DropdownMenuItem
                              key={target.value}
                              onClick={() => {
                                if (target.value === 'deleted') {
                                  setConfirm({
                                    id: comment.id,
                                    action: 'delete',
                                  })
                                  return
                                }
                                action.mutate({
                                  id: comment.id,
                                  action: commentStatusAction(target.value),
                                })
                              }}
                            >
                              {targetIcon(target.value)}
                              {t(target.key)}
                            </DropdownMenuItem>
                          ),
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            setConfirm({ id: comment.id, action: 'hard' })
                          }
                        >
                          <Trash2 className="mr-2 size-4" />
                          {t('permanentDelete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {query.isSuccess ? (
          <ListPagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              changePageSize(size)
              setPage(1)
            }}
          />
        ) : null}
      </div>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === 'hard'
                ? t('permanentDeleteTitle')
                : t('softDeleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'hard'
                ? t('permanentDeleteHint')
                : t('softDeleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={action.isPending}
              onClick={() =>
                confirm &&
                action.mutate({ id: confirm.id, action: confirm.action })
              }
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
