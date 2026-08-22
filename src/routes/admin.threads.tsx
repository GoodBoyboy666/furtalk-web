import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
import { StateFade } from '@/components/motion'
import { ListPagination } from '@/components/ListPagination'
import { sitesApi, threadsApi } from '@/lib/api/resources'
import { invalidateThreads } from '@/lib/api/threads'
import { adminSortLabel, adminSortOptions } from '@/lib/admin-sort'
import type { AdminSort } from '@/lib/admin-sort'
import { selectItems } from '@/lib/i18n'
import { usePageSize } from '@/lib/pagination'
import type { AdminThread } from '@/lib/api/types'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/threads')({
  component: ThreadsPage,
})

// editState 记录正在编辑的线程与表单输入。
type editState = {
  thread: AdminThread
  pageKey: string
  pageTitle: string
  pageUrl: string
} | null

export function ThreadsPage() {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const [siteId, setSiteId] = useState<string | undefined>()
  const [enabled, setEnabled] = useState('all')
  const [sort, setSort] = useState<AdminSort>('desc')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { pageSize, changePageSize } = usePageSize('admin-threads')
  const [pendingId, setPendingId] = useState('')
  const [editing, setEditing] = useState<editState>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const sites = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  })

  useEffect(() => {
    if (!siteId && sites.data && sites.data.sites.length > 0) {
      setSiteId(sites.data.sites[0].id)
    }
  }, [siteId, sites.data])

  const list = useQuery({
    queryKey: [
      'threads',
      { site_id: siteId, enabled, sort, q, page, pageSize },
    ],
    queryFn: () =>
      siteId
        ? threadsApi.list(siteId, {
            comments_enabled:
              enabled === 'all' ? undefined : enabled === 'enabled',
            q: q || undefined,
            sort,
            page,
            limit: pageSize,
          })
        : Promise.resolve({ threads: [], total: 0 }),
    enabled: !!siteId,
  })

  const toggle = useMutation({
    mutationFn: ({
      threadId,
      enabled: next,
    }: {
      threadId: string
      enabled: boolean
    }) => threadsApi.update(siteId!, threadId, { comments_enabled: next }),
    onMutate: (variables) => setPendingId(variables.threadId),
    onSettled: () => setPendingId(''),
    onSuccess: (_, variables) => {
      toast.success(
        variables.enabled ? t('threadsEnabled') : t('threadsDisabled'),
      )
      void invalidateThreads(queryClient)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('operationFailed'),
      ),
  })

  const edit = useMutation({
    mutationFn: ({
      threadId,
      pageKey,
      pageTitle,
      pageUrl,
    }: {
      threadId: string
      pageKey: string
      pageTitle: string
      pageUrl: string
    }) =>
      threadsApi.update(siteId!, threadId, {
        page_key: pageKey.trim(),
        page_title: pageTitle.trim() === '' ? null : pageTitle.trim(),
        page_url: pageUrl.trim() === '' ? null : pageUrl.trim(),
      }),
    onSuccess: () => {
      toast.success(t('pageInfoUpdated'))
      setEditing(null)
      void invalidateThreads(queryClient)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('updateFailed')),
  })

  const remove = useMutation({
    mutationFn: ({ threadId }: { threadId: string }) =>
      threadsApi.remove(siteId!, threadId),
    onMutate: () => setConfirmDeleteId(null),
    onSuccess: () => {
      toast.success(t('threadsDeleted'))
      void invalidateThreads(queryClient)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('deleteFailed')),
  })

  const total = list.isSuccess ? list.data.total : 0
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  useEffect(() => {
    if (list.isSuccess && page > totalPages) {
      setPage(totalPages)
    }
  }, [list.isSuccess, page, totalPages])

  return (
    <>
      <PageHeader title={t('threadsTitle')} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={siteId ?? 'all'}
          onValueChange={(value) => {
            setSiteId(value && value !== 'all' ? value : undefined)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t('chooseSite')}>
              {(value) => siteLabel(value, sites.data?.sites ?? [], t)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(sites.data?.sites ?? []).map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={enabled}
          onValueChange={(value) => {
            setEnabled(value || 'all')
            setPage(1)
          }}
          items={selectItems(statusOptions, t)}
        >
          <SelectTrigger className="w-full sm:w-40 bg-card">
            <SelectValue placeholder={t('threadStatus.all', { ns: 'enums' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {statusOptions.map((option) => (
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
            placeholder={t('searchThreadsHint')}
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
      </div>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        {!siteId ? (
          <div className="p-4">
            <EmptyState title={t('chooseSite')} description={t('noSiteHint')} />
          </div>
        ) : list.isPending ? (
          <StateFade kind="loading">
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t('loadingThreads')}
            </div>
          </StateFade>
        ) : list.isError ? (
          <StateFade kind="error">
            <div className="p-8 text-center text-sm text-destructive">
              {t('threadsLoadFailed')}
            </div>
          </StateFade>
        ) : list.data.threads.length === 0 ? (
          <div className="p-4">
            <EmptyState title={t('noMatchingThreads')} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%] min-w-[200px]">
                  {t('threadTitle')}
                </TableHead>
                <TableHead className="w-[22%] min-w-[140px]">
                  {t('threadSite')}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t('discoveredAt')}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {t('updatedAt')}
                </TableHead>
                <TableHead className="w-28 whitespace-nowrap">
                  {t('commentArea')}
                </TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.threads.map((thread) => (
                <TableRow key={thread.id}>
                  <TableCell className="max-w-xs sm:max-w-sm md:max-w-md whitespace-normal">
                    <p
                      className="m-0 truncate text-sm font-medium text-foreground"
                      title={threadTitle(thread)}
                    >
                      {threadTitle(thread)}
                    </p>
                    <p
                      className="m-0 truncate text-xs text-muted-foreground"
                      title={thread.page_key}
                    >
                      {thread.page_key}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-48 whitespace-normal">
                    <p
                      className="m-0 truncate text-sm"
                      title={thread.site_name}
                    >
                      {thread.site_name}
                    </p>
                    <p
                      className="m-0 truncate text-xs text-muted-foreground"
                      title={thread.page_url ?? '-'}
                    >
                      {thread.page_url ?? '-'}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(thread.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(thread.updated_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={thread.comments_enabled}
                        onCheckedChange={(next) =>
                          toggle.mutate({ threadId: thread.id, enabled: next })
                        }
                        disabled={pendingId === thread.id}
                        aria-label={
                          thread.comments_enabled
                            ? t('disableThread')
                            : t('enableThread')
                        }
                      />
                      {pendingId === thread.id ? (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {thread.comments_enabled
                            ? t('threadStatus.enabled', { ns: 'enums' })
                            : t('threadStatus.disabled', { ns: 'enums' })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('threadActions')}
                          >
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setEditing({
                              thread,
                              pageKey: thread.page_key,
                              pageTitle: thread.page_title ?? '',
                              pageUrl: thread.page_url ?? '',
                            })
                          }
                        >
                          <Pencil className="mr-2 size-4" />
                          {t('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setConfirmDeleteId(thread.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          {t('action.delete', { ns: 'common' })}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              changePageSize(size)
              setPage(1)
            }}
          />
        ) : null}
      </div>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editPageInfo')}</DialogTitle>
            <DialogDescription>{t('editPageInfoHint')}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="thread-page-key">{t('pageKey')}</Label>
                <Input
                  id="thread-page-key"
                  value={editing.pageKey}
                  onChange={(event) =>
                    setEditing({ ...editing, pageKey: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="thread-page-title">{t('pageTitle')}</Label>
                <Input
                  id="thread-page-title"
                  value={editing.pageTitle}
                  placeholder={t('pageTitleClearHint')}
                  onChange={(event) =>
                    setEditing({ ...editing, pageTitle: event.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="thread-page-url">{t('pageUrl')}</Label>
                <Input
                  id="thread-page-url"
                  value={editing.pageUrl}
                  placeholder={t('pageUrlClearHint')}
                  onChange={(event) =>
                    setEditing({ ...editing, pageUrl: event.target.value })
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('action.cancel', { ns: 'common' })}
            </Button>
            <Button
              disabled={
                edit.isPending || !editing || editing.pageKey.trim() === ''
              }
              onClick={() =>
                editing &&
                edit.mutate({
                  threadId: editing.thread.id,
                  pageKey: editing.pageKey,
                  pageTitle: editing.pageTitle,
                  pageUrl: editing.pageUrl,
                })
              }
            >
              {edit.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t('action.save', { ns: 'common' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteThreadTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteThreadHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() =>
                confirmDeleteId && remove.mutate({ threadId: confirmDeleteId })
              }
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.confirmDelete', { ns: 'common' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// statusOptions 是评论区开关筛选的可选项。
const statusOptions = [
  { value: 'all', key: 'enums:threadStatus.all' },
  { value: 'enabled', key: 'enums:threadStatus.enabled' },
  { value: 'disabled', key: 'enums:threadStatus.disabled' },
]

// threadTitle 优先展示页面标题，缺省时回落到页面标识或 URL。
function threadTitle(thread: {
  page_title: string | null
  page_key: string
  page_url: string | null
}) {
  if (thread.page_title && thread.page_title.trim() !== '') {
    return thread.page_title
  }
  if (thread.page_url && thread.page_url.trim() !== '') {
    return thread.page_url
  }
  return thread.page_key
}

// siteLabel 把站点筛选值映射为触发器上显示的站点名。
function siteLabel(
  value: string | null | undefined,
  sites: { id: string; name: string }[],
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!value || value === 'all') return t('chooseSite')
  return sites.find((site) => site.id === value)?.name ?? value
}
