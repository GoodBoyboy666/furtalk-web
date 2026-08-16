import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import 'cap-widget'
import type { CapWidget } from 'cap-widget'
import { useTranslation } from 'react-i18next'
import { loadProviderScript } from '@/lib/captcha/loaders'
import type {
  CaptchaChallengeConfig,
  CaptchaProvider,
} from '@/lib/captcha/loaders'

// CaptchaChallengeHandle 暴露给父组件的命令式重置边界。
export type CaptchaChallengeHandle = {
  reset: () => void
}

type CaptchaChallengeProps = {
  config: CaptchaChallengeConfig
  action: string
  onToken: (token: string) => void
  onError: (message: string) => void
}

// supportedProviders 是组件可渲染的提供方集合，未知值不渲染控件。
const supportedProviders: ReadonlySet<string> = new Set([
  'turnstile',
  'recaptcha',
  'hcaptcha',
  'cap',
])

// CaptchaChallenge 是 provider-neutral 的验证码控件。
// 它拥有 provider 脚本/组件的生命周期；登录页负责表单提交与错误文案。
// 策略关闭时不渲染，宿主脚本只在配置端点选中 provider 后加载。
export const CaptchaChallenge = forwardRef<
  CaptchaChallengeHandle,
  CaptchaChallengeProps
>(function CaptchaChallenge({ config, action, onToken, onError }, ref) {
  const { t } = useTranslation('auth')
  const containerRef = useRef<HTMLDivElement>(null)
  const capRef = useRef<CapWidget>(null)
  const widgetIdRef = useRef<string | number | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  )

  const provider: CaptchaProvider = supportedProviders.has(config.provider)
    ? (config.provider as CaptchaProvider)
    : 'cap'

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    widgetIdRef.current = null
    loadProviderScript(provider)
      .then(() => {
        if (cancelled) return
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadState('failed')
        onError(error instanceof Error ? error.message : t('captchaLoadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [provider, onError, t])

  // 托管 provider 在容器内显式渲染；CAP 渲染自定义元素并监听事件。
  useEffect(() => {
    if (loadState !== 'ready') return
    const container = containerRef.current
    if (!container) return
    if (provider === 'cap') {
      return
    }
    const instance = providerInstance(provider)
    if (!instance) {
      onError(t('captchaUnavailable'))
      return
    }
    const id = instance.render(container, {
      sitekey: config.site_key,
      action,
      size: 'normal',
      callback: onToken,
      'expired-callback': () => onToken(''),
      'error-callback': () => onToken(''),
    })
    widgetIdRef.current = id
    return () => {
      if (typeof id === 'string' && window.turnstile?.remove) {
        window.turnstile.remove(id)
      }
    }
  }, [loadState, provider, config.site_key, t])

  // 监听 CAP 自定义元素的事件。
  useEffect(() => {
    if (provider !== 'cap' || loadState !== 'ready') return
    const element = capRef.current
    if (!element) return
    const onSolve = (event: Event) => {
      const token = (event as CustomEvent<{ token: string }>).detail.token
      if (token) onToken(token)
    }
    const onReset = () => onToken('')
    element.addEventListener('solve', onSolve)
    element.addEventListener('reset', onReset)
    element.addEventListener('error', onReset)
    return () => {
      element.removeEventListener('solve', onSolve)
      element.removeEventListener('reset', onReset)
      element.removeEventListener('error', onReset)
    }
  }, [provider, loadState])

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (provider === 'cap') {
          capRef.current?.reset()
          onToken('')
          return
        }
        const id = widgetIdRef.current
        if (id === null) return
        if (provider === 'turnstile' && typeof id === 'string') {
          window.turnstile?.reset(id)
        } else if (
          (provider === 'recaptcha' || provider === 'hcaptcha') &&
          typeof id === 'number'
        ) {
          if (provider === 'recaptcha') {
            window.grecaptcha?.reset(id)
          } else {
            window.hcaptcha?.reset(id)
          }
        }
        onToken('')
      },
    }),
    [provider, onToken],
  )

  if (loadState === 'failed') {
    return (
      <p className="m-0 text-left text-sm text-destructive">
        {t('captchaLoadFailedReload')}
      </p>
    )
  }
  if (provider === 'cap') {
    return (
      <div className="flex min-h-10 items-start justify-start">
        <cap-widget
          ref={capRef}
          data-cap-api-endpoint={config.api_endpoint}
          data-cap-worker-count="2"
        />
      </div>
    )
  }
  return (
    <div className="flex min-h-16 items-start justify-start">
      <div ref={containerRef} />
    </div>
  )
})

// providerInstance 返回对应提供方的全局渲染实例，CAP 不在此路径。
function providerInstance(provider: CaptchaProvider) {
  switch (provider) {
    case 'turnstile':
      return window.turnstile
    case 'recaptcha':
      return window.grecaptcha
    case 'hcaptcha':
      return window.hcaptcha
    default:
      return null
  }
}
