import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
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
import { commentStatusLabel, commentStatusOptions } from '@/lib/comment-status'
import { usePageSize } from '@/lib/pagination'
import { formatDateTime } from '@/lib/format'

// commentsSearch 是本人评论列表的 URL 筛选参数。
// page 使用页码替换旧 cursor：刷新、前进/后退与链接分享都保留分页位置。
type CommentsSearch = {
  site_id?: string
  status?: string
  page?: number
}

// positiveInt 报告字符串是否为合法正整数页码。
function positiveInt(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[1-9]\d*$/.test(raw)
}

// parseCommentsPage 把 URL page 参数解析为正整数页码；缺失、非法或非正整数
// 一律返回 undefined（第 1 页），保证刷新/前进后退与链接分享语义稳定。
export function parseCommentsPage(raw: unknown): number | undefined {
  return positiveInt(raw) ? Number(raw) : undefined
}

export const Route = createFileRoute('/account/comments')({
  validateSearch: (search: Record<string, unknown>): CommentsSearch => ({
    site_id:
      typeof search.site_id === 'string' && search.site_id
        ? search.site_id
        : undefined,
    status:
      typeof search.status === 'string' && search.status !== 'all'
        ? search.status
        : undefined,
    page: parseCommentsPage(search.page),
  }),
  component: CommentsPage,
})

export function CommentsPage() {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const search = useSearch({ from: Route.id })
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
      <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center">
        <Select
          value={siteId ?? 'all'}
          onValueChange={(value) =>
            setFilter({ site_id: value && value !== 'all' ? value : undefined })
          }
        >
          <SelectTrigger className="w-full sm:w-48">
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
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('allSites')}>
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
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
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
                <TableHead className="w-[42%]">{t('content')}</TableHead>
                <TableHead>{t('site')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('time')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.comments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell>
                    <Link
                      to="/account/comments/$commentId"
                      params={{ commentId: comment.id }}
                      className="block max-w-lg no-underline"
                    >
                      <p className="m-0 line-clamp-2 text-sm font-medium text-foreground">
                        {comment.body}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        #{comment.id}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40">
                    <span className="block truncate text-sm">
                      {comment.site_name || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
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
