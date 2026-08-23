import { useCallback, useEffect, useMemo, useState } from 'react'

// useCurrentPageSelection 管理单个筛选/分页结果集中的选择。
// scopeKey 由调用方包含全部筛选、排序、页码和 pageSize，任何变化都会清空选择。
export function useCurrentPageSelection(
  visibleIds: readonly string[],
  scopeKey: string,
) {
  const [state, setState] = useState(() => ({
    scopeKey,
    selected: new Set<string>(),
  }))

  useEffect(() => {
    setState((current) =>
      current.scopeKey === scopeKey
        ? current
        : { scopeKey, selected: new Set<string>() },
    )
  }, [scopeKey])

  const visible = useMemo(() => new Set(visibleIds), [visibleIds])
  const selectedIds = useMemo(
    () =>
      state.scopeKey === scopeKey
        ? new Set([...state.selected].filter((id) => visible.has(id)))
        : new Set<string>(),
    [scopeKey, state.scopeKey, state.selected, visible],
  )
  const selectedCount = selectedIds.size
  const allSelected =
    visibleIds.length > 0 && selectedCount === visibleIds.length
  const someSelected = selectedCount > 0 && !allSelected

  const toggle = useCallback((id: string, checked: boolean) => {
    setState((current) => {
      const selected = new Set(current.selected)
      if (checked) selected.add(id)
      else selected.delete(id)
      return { ...current, selected }
    })
  }, [])

  const toggleAll = useCallback(
    (checked: boolean) => {
      setState((current) => ({
        ...current,
        selected: checked ? new Set(visibleIds) : new Set<string>(),
      }))
    },
    [visibleIds],
  )

  const clear = useCallback(() => {
    setState((current) => ({ ...current, selected: new Set<string>() }))
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  return {
    selectedIds,
    selectedCount,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clear,
    isSelected,
  }
}
