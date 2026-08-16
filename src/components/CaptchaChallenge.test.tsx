// @vitest-environment jsdom
import { render, act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptchaChallenge } from './CaptchaChallenge'
import type { CaptchaChallengeHandle } from './CaptchaChallenge'
import { loadProviderScript } from '@/lib/captcha/loaders'
import type { CaptchaChallengeConfig } from '@/lib/captcha/loaders'

// 模拟托管脚本加载：默认立即成功。
vi.mock('@/lib/captcha/loaders', () => ({
  loadProviderScript: vi.fn(async () => undefined),
}))

// 模拟 cap-widget 包，不加载真实 WASM 自定义元素。
vi.mock('cap-widget', () => ({}))

const mockedLoadProviderScript = vi.mocked(loadProviderScript)

afterEach(() => {
  vi.clearAllMocks()
  delete window.turnstile
  delete window.grecaptcha
  delete window.hcaptcha
  document.body.innerHTML = ''
})

beforeEach(() => {
  mockedLoadProviderScript.mockResolvedValue(undefined)
})

describe('CaptchaChallenge', () => {
  it('renders the CAP custom element with the official widget endpoint', async () => {
    const config: CaptchaChallengeConfig = {
      provider: 'cap',
      site_key: 'site-1',
      api_endpoint: 'https://cap.example.com/site-1/',
    }
    const { container } = render(
      <CaptchaChallenge
        config={config}
        action="password_login"
        onToken={() => undefined}
        onError={() => undefined}
      />,
    )
    const widget = container.querySelector('cap-widget')
    expect(widget).not.toBeNull()
    expect(widget?.getAttribute('data-cap-api-endpoint')).toBe(
      'https://cap.example.com/site-1/',
    )
    // 宿主容器左对齐：控件不与内部居中。
    const wrapper = widget?.parentElement
    expect(wrapper?.className).toContain('justify-start')
  })

  it('propagates the CAP solve token through the controlled callback', async () => {
    const config: CaptchaChallengeConfig = {
      provider: 'cap',
      site_key: 'site-1',
      api_endpoint: 'https://cap.example.com/site-1/',
    }
    const onToken = vi.fn()
    const { container } = render(
      <CaptchaChallenge
        config={config}
        action="password_login"
        onToken={onToken}
        onError={() => undefined}
      />,
    )
    await act(async () => {})
    const widget = container.querySelector('cap-widget') as HTMLElement
    act(() => {
      widget.dispatchEvent(
        new CustomEvent('solve', { detail: { token: 'cap-tok' } }),
      )
    })
    expect(onToken).toHaveBeenCalledWith('cap-tok')
  })

  it('clears the token when CAP emits an error or reset event', async () => {
    const config: CaptchaChallengeConfig = {
      provider: 'cap',
      site_key: 'site-1',
      api_endpoint: 'https://cap.example.com/site-1/',
    }
    const onToken = vi.fn()
    const { container } = render(
      <CaptchaChallenge
        config={config}
        action="password_login"
        onToken={onToken}
        onError={() => undefined}
      />,
    )
    await act(async () => {})
    const widget = container.querySelector('cap-widget') as HTMLElement
    act(() => {
      widget.dispatchEvent(
        new CustomEvent('error', { detail: { message: 'x' } }),
      )
    })
    expect(onToken).toHaveBeenLastCalledWith('')
  })

  it('does not require a token until a solve event fires', async () => {
    const config: CaptchaChallengeConfig = {
      provider: 'cap',
      site_key: 'site-1',
      api_endpoint: 'https://cap.example.com/site-1/',
    }
    const onToken = vi.fn()
    render(
      <CaptchaChallenge
        config={config}
        action="password_login"
        onToken={onToken}
        onError={() => undefined}
      />,
    )
    expect(onToken).not.toHaveBeenCalled()
  })

  it('calls the imperative reset handle and clears the token', async () => {
    const config: CaptchaChallengeConfig = {
      provider: 'cap',
      site_key: 'site-1',
      api_endpoint: 'https://cap.example.com/site-1/',
    }
    const onToken = vi.fn()
    const ref = { current: null as CaptchaChallengeHandle | null }
    const { container } = render(
      <CaptchaChallenge
        ref={ref}
        config={config}
        action="password_login"
        onToken={onToken}
        onError={() => undefined}
      />,
    )
    const widget = container.querySelector('cap-widget') as HTMLElement & {
      reset?: () => void
    }
    const reset = vi.fn()
    widget.reset = reset
    act(() => {
      ref.current?.reset()
    })
    expect(reset).toHaveBeenCalled()
    expect(onToken).toHaveBeenCalledWith('')
  })

  it('reports a provider script load failure and shows a failure message', async () => {
    mockedLoadProviderScript.mockRejectedValueOnce(new Error('script blocked'))
    const onError = vi.fn()
    const config: CaptchaChallengeConfig = {
      provider: 'turnstile',
      site_key: 'ts-site',
    }
    render(
      <CaptchaChallenge
        config={config}
        action="password_login"
        onToken={() => undefined}
        onError={onError}
      />,
    )
    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })

  it('renders a hosted provider container and loads its script on mount', async () => {
    const config: CaptchaChallengeConfig = {
      provider: 'hcaptcha',
      site_key: 'hc-site',
    }
    const { container } = render(
      <CaptchaChallenge
        config={config}
        action="password_login"
        onToken={() => undefined}
        onError={() => undefined}
      />,
    )
    expect(mockedLoadProviderScript).toHaveBeenCalledWith('hcaptcha')
    await waitFor(() => {
      expect(document.querySelector('div')).not.toBeNull()
    })
    // 托管容器左对齐：控件不与内部居中。
    const wrapper = container.querySelector('.flex')
    expect(wrapper?.className).toContain('justify-start')
  })

  it('keeps the failure message left-aligned', async () => {
    mockedLoadProviderScript.mockRejectedValueOnce(new Error('script blocked'))
    const config: CaptchaChallengeConfig = {
      provider: 'turnstile',
      site_key: 'ts-site',
    }
    const { container } = render(
      <CaptchaChallenge
        config={config}
        action="password_login"
        onToken={() => undefined}
        onError={() => undefined}
      />,
    )
    await waitFor(() => {
      expect(
        screen.getByText('验证码加载失败，请刷新页面重试。'),
      ).toBeInTheDocument()
    })
    const message = container.querySelector('p')
    expect(message?.className).toContain('text-left')
  })
})
