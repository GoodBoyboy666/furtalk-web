// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MotionConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FadeIn,
  PageTransition,
  Stagger,
  StaggerItem,
  StateFade,
} from './index'

// PageTransition 依赖 useRouterState 取当前 pathname，测试中提供固定值。
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select?: (s: unknown) => unknown }) =>
    select?.({ location: { pathname: '/admin/comments' } }) ??
    '/admin/comments',
}))

// matchMediaMock 让 jsdom 环境下 Motion 的 reduced-motion 检测可控。
const matchMediaMock = vi.hoisted(() => ({ matches: false }))

beforeEach(() => {
  cleanup()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: matchMediaMock.matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  matchMediaMock.matches = false
})

function renderWithConfig(
  ui: React.ReactNode,
  reducedMotion: 'user' | 'never' = 'user',
) {
  return render(<MotionConfig reducedMotion={reducedMotion}>{ui}</MotionConfig>)
}

describe('PageTransition route entry', () => {
  it('renders children inside a keyed container', () => {
    render(
      <MotionConfig reducedMotion="never">
        <PageTransition>
          <p>page content</p>
        </PageTransition>
      </MotionConfig>,
    )
    expect(screen.getByText('page content')).toBeInTheDocument()
  })
})

describe('StateFade state transitions', () => {
  it('renders the active state and keys by kind', () => {
    const { rerender } = renderWithConfig(
      <StateFade kind="loading">
        <p>loading</p>
      </StateFade>,
    )
    expect(screen.getByText('loading')).toBeInTheDocument()
    rerender(
      <MotionConfig reducedMotion="never">
        <StateFade kind="error">
          <p>error</p>
        </StateFade>
      </MotionConfig>,
    )
    expect(screen.getByText('error')).toBeInTheDocument()
    expect(screen.queryByText('loading')).not.toBeInTheDocument()
  })
})

describe('Stagger repeated content', () => {
  it('renders all staggered items', () => {
    renderWithConfig(
      <Stagger>
        <StaggerItem>
          <p>first</p>
        </StaggerItem>
        <StaggerItem>
          <p>second</p>
        </StaggerItem>
      </Stagger>,
    )
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
  })
})

describe('FadeIn content entry', () => {
  it('renders children', () => {
    renderWithConfig(
      <FadeIn>
        <p>faded in</p>
      </FadeIn>,
    )
    expect(screen.getByText('faded in')).toBeInTheDocument()
  })
})

describe('MotionConfig reduced motion policy', () => {
  it('honors prefers-reduced-motion via the root user policy', () => {
    matchMediaMock.matches = true
    renderWithConfig(
      <Stagger>
        <StaggerItem>
          <p>item</p>
        </StaggerItem>
      </Stagger>,
    )
    // 在 reduced 分支下内容仍然渲染，仅动画被 Motion 按 user 策略削弱。
    expect(screen.getByText('item')).toBeInTheDocument()
  })
})
