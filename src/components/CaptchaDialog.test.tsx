// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptchaDialog } from './CaptchaDialog'
import { loadProviderScript } from '@/lib/captcha/loaders'
import type { CaptchaChallengeConfig } from '@/lib/captcha/loaders'

// 模拟托管脚本加载：默认立即成功。
vi.mock('@/lib/captcha/loaders', () => ({
  loadProviderScript: vi.fn(async () => undefined),
}))

// 模拟 cap-widget 包，不加载真实 WASM 自定义元素。
vi.mock('cap-widget', () => ({}))

const mockedLoadProviderScript = vi.mocked(loadProviderScript)

const config: CaptchaChallengeConfig = {
  provider: 'cap',
  site_key: 'site-1',
  api_endpoint: 'https://cap.example.com/site-1/',
}

function renderDialog(open: boolean) {
  const onSolved = vi.fn()
  const onOpenChange = vi.fn()
  const onError = vi.fn()
  render(
    <CaptchaDialog
      open={open}
      onOpenChange={onOpenChange}
      config={config}
      action="password_login"
      title="人机验证"
      description="完成验证后即可登录"
      onSolved={onSolved}
      onError={onError}
    />,
  )
  return { onSolved, onOpenChange, onError }
}

beforeEach(() => {
  mockedLoadProviderScript.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('CaptchaDialog', () => {
  it('renders title, description and the challenge while open', () => {
    renderDialog(true)
    expect(screen.getByText('人机验证')).toBeInTheDocument()
    expect(screen.getByText('完成验证后即可登录')).toBeInTheDocument()
    // 挑战只在对话框打开时挂载。
    expect(document.querySelector('cap-widget')).not.toBeNull()
  })

  it('renders nothing while closed', () => {
    renderDialog(false)
    expect(screen.queryByText('人机验证')).not.toBeInTheDocument()
    expect(document.querySelector('cap-widget')).toBeNull()
  })

  it('calls onSolved exactly once with a non-empty token', async () => {
    const { onSolved } = renderDialog(true)
    await act(async () => {})
    const widget = document.querySelector('cap-widget') as HTMLElement
    act(() => {
      widget.dispatchEvent(
        new CustomEvent('solve', { detail: { token: 'cap-tok' } }),
      )
    })
    expect(onSolved).toHaveBeenCalledTimes(1)
    expect(onSolved).toHaveBeenCalledWith('cap-tok')
    // 重复回调只提交一次。
    act(() => {
      widget.dispatchEvent(
        new CustomEvent('solve', { detail: { token: 'cap-tok' } }),
      )
    })
    expect(onSolved).toHaveBeenCalledTimes(1)
  })

  it('closes via the cancel button and never solves', async () => {
    const { onSolved, onOpenChange } = renderDialog(true)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSolved).not.toHaveBeenCalled()
  })

  it('closes via Escape and never solves', async () => {
    const { onSolved, onOpenChange } = renderDialog(true)
    const user = userEvent.setup()
    screen.getByRole('dialog').focus()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalled()
    expect(onOpenChange.mock.calls[0][0]).toBe(false)
    expect(onSolved).not.toHaveBeenCalled()
  })

  it('ignores empty tokens from reset and expiry events', async () => {
    const { onSolved } = renderDialog(true)
    await act(async () => {})
    const widget = document.querySelector('cap-widget') as HTMLElement
    act(() => {
      widget.dispatchEvent(new CustomEvent('reset', {}))
    })
    act(() => {
      widget.dispatchEvent(
        new CustomEvent('error', { detail: { message: 'x' } }),
      )
    })
    expect(onSolved).not.toHaveBeenCalled()
  })

  it('applies a narrow-width friendly dialog class', () => {
    renderDialog(true)
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('sm:max-w-[420px]')
  })
})
