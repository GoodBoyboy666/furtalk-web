import {
  getRouteApi,
  Link,
  Outlet,
  useMatch,
  useNavigate,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { StateFade } from '@/components/motion'
import { ListPagination } from '@/components/ListPagination'
import { meCommentsApi } from '@/lib/api/resources'
import {
  commentStatusLabel,
  ownerCommentStatusOptions,
} from '@/lib/comment-status'
import { usePageSize } from '@/lib/pagination'
import { formatDateTime } from '@/lib/format'
import type { CommentsSearch } from '@/lib/account-comments-search'

const routeApi = getRouteApi('/account/comments')

export function CommentsPage() {
  const detail = useMatch({
    from: '/account/comments/$commentId',
    shouldThrow: false,
  })
  if (detail) return <Outlet />
  return <CommentsList />
}

// CommentsList 仅在没有详情子路由匹配时挂载，避免列表与详情同时渲染。
function CommentsList() {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const search = routeApi.useSearch()
  const siteId = search.site_id
  const status = search.status ?? 'all'
  const page = search.page ?? 1
  const { pageSize, changePageSize } = usePageSize('account-comments')

  const sites = useQuery({
    queryKey: ['my-comment-sites'],
    queryFn: meCommentsApi.sites,
  })
  const list = useQuery({
    queryKey: ['my-comments', { site_id: siteId, status, page, pageSize }],
    queryFn: () =>
      meCommentsApi.list({
        site_id: siteId,
        status: status === 'all' ? undefined : status,
        page,
        limit: pageSize,
      }),
  })

  // setFilter 切换站点/状态筛选时回到第 1 页。
  function setFilter(patch: Partial<CommentsSearch>) {
    void navigate({
      to: '/account/comments',
      search: { ...search, ...patch, page: undefined },
    })
  }

  // changePage 更新 URL 页码；第 1 页不保留冗余 page 参数。
  function changePage(next: number) {
    void navigate({
      to: '/account/comments',
      search: { ...search, page: next > 1 ? next : undefined },
    })
  }

  const total = list.isSuccess ? list.data.total : 0
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  useEffect(() => {
    if (list.isSuccess && page > totalPages) {
      void navigate({
        to: '/account/comments',
        search: {
          ...search,
          page: totalPages > 1 ? totalPages : undefined,
        },
      })
    }
  }, [list.isSuccess, page, totalPages, navigate, search])

  return (
    <>
      <PageHeader title={t('commentsTitle')} />
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3.5 shadow-xs sm:flex-row sm:items-center">
        <Select
          value={siteId ?? 'all'}
          onValueChange={(value) =>
            setFilter({ site_id: value && value !== 'all' ? value : undefined })
          }
        >
          <SelectTrigger className="w-full sm:w-48 bg-card">
            <SelectValue placeholder={t('allSites')}>
              {(value) => siteLabel(value, sites.data?.sites ?? [], t)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{t('allSites')}</SelectItem>
              {(sites.data?.sites ?? []).map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) =>
            setFilter({ status: value && value !== 'all' ? value : undefined })
          }
        >
          <SelectTrigger className="w-full sm:w-40 bg-card">
            <SelectValue placeholder={t('allSites')}>
              {commentStatusLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ownerCommentStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.key)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        {list.isPending ? (
          <StateFade kind="loading">
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t('loadingComments')}
            </div>
          </StateFade>
        ) : list.isError ? (
          <StateFade kind="error">
            <div className="p-8 text-center text-sm text-destructive">
              {t('commentsLoadFailed')}
            </div>
          </StateFade>
        ) : list.data.comments.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={t('noMatchingComments')}
              description={t('noMatchingCommentsHint')}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%] min-w-[200px]">
                  {t('content')}
                </TableHead>
                <TableHead className="w-[20%] min-w-[120px]">
                  {t('site')}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t('status')}
                </TableHead>
                <TableHead className="whitespace-nowrap">{t('time')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell className="max-w-xs sm:max-w-md lg:max-w-lg whitespace-normal">
                    <Link
                      to="/account/comments/$commentId"
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
                  <TableCell className="max-w-40 whitespace-normal">
                    <span
                      className="block truncate text-sm"
                      title={comment.site_name || '-'}
                    >
                      {comment.site_name || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <StatusBadge value={comment.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(comment.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {list.isSuccess ? (
          <ListPagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={changePage}
            onPageSizeChange={(size) => {
              changePageSize(size)
              setFilter({})
            }}
          />
        ) : null}
      </div>
    </>
  )
}

// siteLabel 把站点筛选值映射为触发器上显示的站点名；
// 空值或 all 显示「全部站点」，未知值回落到原值。
function siteLabel(
  value: string | null | undefined,
  sites: { id: string; name: string }[],
  t: (key: string) => string,
) {
  if (!value || value === 'all') return t('allSites')
  return sites.find((site) => site.id === value)?.name ?? value
}
