// CAPTCHA 提供方托管脚本加载与全局类型声明。
// 仅在策略选中对应提供方后才加载脚本，并对并发加载去重。

export type CaptchaProvider = 'turnstile' | 'recaptcha' | 'hcaptcha' | 'cap'

export type CaptchaChallengeConfig = {
  provider: CaptchaProvider | (string & {})
  site_key: string
  api_endpoint?: string
}

// turnstile 的显式渲染接口。
type TurnstileInstance = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      action: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

// reCAPTCHA 的显式渲染接口。
type RecaptchaInstance = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      size: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => number
  reset: (widgetId: number) => void
}

// hCaptcha 的显式渲染接口。
type HcaptchaInstance = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      size: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => number
  reset: (widgetId: number) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileInstance
    grecaptcha?: RecaptchaInstance
    hcaptcha?: HcaptchaInstance
  }
}

// scriptURLs 是各托管提供方的显式渲染脚本地址。
const scriptURLs: Partial<Record<CaptchaProvider, string>> = {
  turnstile:
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  recaptcha: 'https://www.google.com/recaptcha/api.js?render=explicit',
  hcaptcha: 'https://hcaptcha.com/1/api.js?render=explicit',
}

// loading 记录正在加载的脚本 URL，避免并发重复注入。
const loading = new Map<string, Promise<void>>()

// loadProviderScript 加载 provider 的托管脚本并等待其可用。
// CAP 使用官方 cap-widget 包，由模块导入注册自定义元素，无需脚本加载。
// 未知 provider 与脚本加载失败都返回错误，不会在文档中留下半成品状态。
export function loadProviderScript(provider: CaptchaProvider): Promise<void> {
  if (provider === 'cap') return Promise.resolve()
  if (typeof document === 'undefined') {
    return Promise.reject(
      new Error('CAPTCHA scripts require a browser context'),
    )
  }
  const url = scriptURLs[provider]
  if (!url) {
    return Promise.reject(
      new Error(`CAPTCHA provider is not supported: ${provider}`),
    )
  }
  const existing = loading.get(url)
  if (existing) return existing
  const promise = injectScript(url).then(() => waitForGlobal(provider))
  loading.set(url, promise)
  promise.catch(() => loading.delete(url))
  return promise
}

// injectScript 向文档注入 provider 脚本标签并等待加载完成。
function injectScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error(`CAPTCHA provider script failed to load: ${url}`))
    document.head.appendChild(script)
  })
}

// waitForGlobal 轮询等待 provider 的全局渲染实例出现。
function waitForGlobal(
  provider: Exclude<CaptchaProvider, 'cap'>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000
    const poll = () => {
      if (globalPresent(provider)) {
        resolve()
        return
      }
      if (Date.now() > deadline) {
        reject(new Error(`CAPTCHA provider ${provider} failed to initialize`))
        return
      }
      setTimeout(poll, 50)
    }
    poll()
  })
}

function globalPresent(provider: Exclude<CaptchaProvider, 'cap'>): boolean {
  if (typeof window === 'undefined') return false
  switch (provider) {
    case 'turnstile':
      return Boolean(window.turnstile?.render)
    case 'recaptcha':
      return Boolean(window.grecaptcha?.render)
    case 'hcaptcha':
      return Boolean(window.hcaptcha?.render)
  }
}
