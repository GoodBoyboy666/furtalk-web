import { useCallback, useEffect, useState } from 'react'

// PAGE_SIZES 是四个第一方列表共享的每页条数白名单；其他值一律回退到默认。
export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export const DEFAULT_PAGE_SIZE: PageSize = 25

// 存储键命名空间：每个列表使用独立的 scope 键，互不影响。
const STORAGE_PREFIX = 'furtalk:pagination'

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}:page-size`
}

// isValidPageSize 报告值是否属于 25|50|100 白名单。
export function isValidPageSize(value: unknown): value is PageSize {
  return PAGE_SIZES.includes(value as PageSize)
}

// readPageSize 读取某个列表持久化的每页条数偏好；localStorage 不可用、
// 值损坏或不属于白名单时安全回退到 25。
export function readPageSize(scope: string): PageSize {
  try {
    const raw = window.localStorage.getItem(storageKey(scope))
    const parsed = raw ? Number(raw) : Number.NaN
    return isValidPageSize(parsed) ? parsed : DEFAULT_PAGE_SIZE
  } catch {
    return DEFAULT_PAGE_SIZE
  }
}

// writePageSize 持久化某个列表的每页条数偏好；存储不可用时静默忽略。
export function writePageSize(scope: string, size: PageSize): void {
  try {
    window.localStorage.setItem(storageKey(scope), String(size))
  } catch {
    // 存储不可用：偏好不持久化，界面仍按本次选择工作。
  }
}

// usePageSize 返回某个列表的每页条数状态，读取并持久化独立于其他列表的偏好。
export function usePageSize(scope: string) {
  const [pageSize, setPageSize] = useState<PageSize>(() => readPageSize(scope))

  useEffect(() => {
    setPageSize(readPageSize(scope))
  }, [scope])

  const changePageSize = useCallback(
    (size: number) => {
      const next: PageSize = isValidPageSize(size) ? size : DEFAULT_PAGE_SIZE
      setPageSize(next)
      writePageSize(scope, next)
    },
    [scope],
  )

  return { pageSize, changePageSize }
}
