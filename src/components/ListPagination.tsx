import { useTranslation } from 'react-i18next'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SIZES } from '@/lib/pagination'

// PageItem 是页码窗口中的一项：具体页码或两侧的省略号占位。
export type PageItem = number | 'ellipsis-start' | 'ellipsis-end'

// buildPageItems 构造带省略号的紧凑页码窗口：始终保留首页与末页，
// 围绕当前页展示前后各 2 个页码，避免大列表铺满所有页码。
export function buildPageItems(
  current: number,
  totalPages: number,
): PageItem[] {
  if (totalPages <= 1) return []
  const pages = new Set<number>([1, totalPages])
  const lo = Math.max(2, current - 2)
  const hi = Math.min(totalPages - 1, current + 2)
  for (let i = lo; i <= hi; i++) pages.add(i)
  const sorted = [...pages].sort((a, b) => a - b)
  const out: PageItem[] = []
  let prev = 0
  for (const page of sorted) {
    if (page - prev > 1) {
      out.push(prev === 1 ? 'ellipsis-start' : 'ellipsis-end')
    }
    out.push(page)
    prev = page
  }
  return out
}

// ListPagination 是四个第一方列表共享的分页控件：总数摘要、带省略号的页码
// 窗口、上一页/下一页、可用的边界禁用态，以及 25/50/100 的每页条数选择器。
// 页码与每页条数由调用方持有并纳入请求参数；本组件只负责展示与回调。
export function ListPagination({
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const { t } = useTranslation('common')
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const current = Math.min(Math.max(1, page), totalPages)
  const items = buildPageItems(current, totalPages)
  const sizeOptions = PAGE_SIZES.map((size) => ({
    value: String(size),
    label: t('pagination.pageSizeOption', { count: size }),
  }))

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {t('pagination.total', { count: total })}
      </p>
      {totalPages > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                text={t('pagination.previous')}
                aria-label={t('pagination.previous')}
                aria-disabled={current <= 1 || undefined}
                className={
                  current <= 1 ? 'pointer-events-none opacity-50' : undefined
                }
                onClick={(event) => {
                  event.preventDefault()
                  if (current > 1) onPageChange(current - 1)
                }}
              />
            </PaginationItem>
            {items.map((item) =>
              item === 'ellipsis-start' || item === 'ellipsis-end' ? (
                <PaginationItem key={item}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === current}
                    aria-label={t('pagination.page', { page: item })}
                    onClick={(event) => {
                      event.preventDefault()
                      if (item !== current) onPageChange(item)
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                text={t('pagination.next')}
                aria-label={t('pagination.next')}
                aria-disabled={current >= totalPages || undefined}
                className={
                  current >= totalPages
                    ? 'pointer-events-none opacity-50'
                    : undefined
                }
                onClick={(event) => {
                  event.preventDefault()
                  if (current < totalPages) onPageChange(current + 1)
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
      <Select
        value={String(pageSize)}
        onValueChange={(value) => {
          const size = Number(value)
          if (PAGE_SIZES.includes(size as (typeof PAGE_SIZES)[number])) {
            onPageSizeChange(size)
          }
        }}
        items={sizeOptions}
      >
        <SelectTrigger aria-label={t('pagination.pageSize')} className="w-auto">
          <SelectValue placeholder={t('pagination.pageSize')}>
            {(value) =>
              t('pagination.pageSizeOption', {
                count: Number(value) || pageSize,
              })
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t('pagination.pageSizeOption', { count: size })}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
