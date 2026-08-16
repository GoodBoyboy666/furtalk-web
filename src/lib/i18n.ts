import i18n from 'i18next'
import HttpBackend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export const FALLBACK_LANGUAGE = 'zh-CN'
export const NAMESPACES = [
  'common',
  'auth',
  'account',
  'admin',
  'authorize',
  'enums',
  'unsubscribe',
] as const
export const DEFAULT_NAMESPACE = 'common'

export const BASE_I18N_OPTIONS = {
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  ns: [...NAMESPACES],
  defaultNS: DEFAULT_NAMESPACE,
  interpolation: { escapeValue: false },
} as const

// initI18n 在生产与开发环境中初始化 i18next：
// HTTP 后端从静态目录加载命名空间目录，浏览器语言检测器决定初始语言。
export function initI18n() {
  return i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      ...BASE_I18N_OPTIONS,
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      detection: {
        order: ['querystring', 'localStorage', 'navigator'],
        lookupQuerystring: 'lng',
        lookupLocalStorage: 'i18nextLng',
        caches: ['localStorage'],
      },
      react: { useSuspense: false },
    })
}

// updateDocumentLocale 把解析后的语言同步到 <html lang> 与文档标题。
export function updateDocumentLocale() {
  if (typeof document === 'undefined') return
  const language = i18n.resolvedLanguage ?? FALLBACK_LANGUAGE
  document.documentElement.lang = language
  document.title = i18n.t('common:app.title')
}

i18n.on('languageChanged', () => {
  updateDocumentLocale()
})

// selectItems 把带稳定 key 的选项数组转换为 base-ui Select 需要的
// {value, label} 形状，label 由调用方传入的 t() 取当前语言的翻译。
export function selectItems<T extends { value: string; key: string }>(
  options: readonly T[],
  t: (key: string) => string,
): { value: string; label: string }[] {
  return options.map((option) => ({
    value: option.value,
    label: t(option.key),
  }))
}

export default i18n
