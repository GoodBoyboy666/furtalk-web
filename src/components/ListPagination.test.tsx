// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ListPagination, buildPageItems } from './ListPagination'

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('buildPageItems', () => {
  it('renders no page numbers for a single page', () => {
    expect(buildPageItems(1, 1)).toEqual([])
  })

  it('renders all pages when the total is small', () => {
    expect(buildPageItems(1, 3)).toEqual([1, 2, 3])
  })

  it('shows the leading window with a trailing ellipsis', () => {
    expect(buildPageItems(1, 10)).toEqual([1, 2, 3, 'ellipsis-end', 10])
  })

  it('shows a compact window around the current page', () => {
    expect(buildPageItems(5, 10)).toEqual([
      1,
      'ellipsis-start',
      3,
      4,
      5,
      6,
      7,
      'ellipsis-end',
      10,
    ])
  })

  it('shows the trailing window with a leading ellipsis', () => {
    expect(buildPageItems(10, 10)).toEqual([1, 'ellipsis-start', 8, 9, 10])
  })
})

describe('ListPagination', () => {
  it('renders the total summary, page numbers and boundaries', () => {
    const onPageChange = vi.fn()
    render(
      <ListPagination
        page={1}
        total={50}
        pageSize={25}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )
    expect(screen.getByText('共 50 条')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 1 页' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '第 2 页' })).toBeInTheDocument()
    // 首页没有上一页；下一页可用。
    expect(screen.getByRole('button', { name: '上一页' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: '下一页' })).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it('navigates via the next button', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ListPagination
        page={1}
        total={50}
        pageSize={25}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('hides the pagination nav on a single page but keeps the summary', () => {
    const { container } = render(
      <ListPagination
        page={1}
        total={3}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-slot="pagination"]')).toBeNull()
    expect(screen.getByText('共 3 条')).toBeInTheDocument()
  })

  it('disables the next button on the last page', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ListPagination
        page={2}
        total={50}
        pageSize={25}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    )
    const next = screen.getByRole('button', { name: '下一页' })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    await user.click(next)
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('notifies the page-size change without triggering navigation', async () => {
    const onPageSizeChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ListPagination
        page={2}
        total={60}
        pageSize={25}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('每页 25 条')).toBeInTheDocument()
    })
    await user.click(
      screen.getByText('每页 25 条').closest('button') as HTMLElement,
    )
    await user.click(await screen.findByRole('option', { name: '每页 50 条' }))
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })
})
