// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCurrentPageSelection } from './use-current-page-selection'

describe('useCurrentPageSelection', () => {
  it('selects individual rows and exposes all/indeterminate state', () => {
    const { result } = renderHook(
      ({ ids, scope }) => useCurrentPageSelection(ids, scope),
      {
        initialProps: { ids: ['1', '2'], scope: 'first' },
      },
    )

    expect(result.current.allSelected).toBe(false)
    act(() => result.current.toggle('1', true))
    expect(result.current.selectedCount).toBe(1)
    expect(result.current.someSelected).toBe(true)
    act(() => result.current.toggleAll(true))
    expect(result.current.allSelected).toBe(true)
    expect([...result.current.selectedIds]).toEqual(['1', '2'])
  })

  it('clears the current page selection when scope changes', () => {
    const { result, rerender } = renderHook(
      ({ ids, scope }) => useCurrentPageSelection(ids, scope),
      { initialProps: { ids: ['1'], scope: 'page-1' } },
    )
    act(() => result.current.toggle('1', true))
    rerender({ ids: ['2'], scope: 'page-2' })
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.allSelected).toBe(false)
  })

  it('does not expose a stale selection during a scope change with a shared id', () => {
    const { result, rerender } = renderHook(
      ({ ids, scope }) => useCurrentPageSelection(ids, scope),
      { initialProps: { ids: ['1'], scope: 'page-1' } },
    )
    act(() => result.current.toggle('1', true))
    rerender({ ids: ['1'], scope: 'page-2' })
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.allSelected).toBe(false)
  })
})
