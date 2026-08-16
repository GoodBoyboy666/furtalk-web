import { initReactI18next } from 'react-i18next'
import i18n, { BASE_I18N_OPTIONS, SUPPORTED_LANGUAGES } from './i18n'
import type { Resource, ResourceLanguage } from 'i18next'

import zhCommon from '../../public/locales/zh-CN/common.json'
import zhAuth from '../../public/locales/zh-CN/auth.json'
import zhAccount from '../../public/locales/zh-CN/account.json'
import zhAdmin from '../../public/locales/zh-CN/admin.json'
import zhAuthorize from '../../public/locales/zh-CN/authorize.json'
import zhEnums from '../../public/locales/zh-CN/enums.json'
import zhUnsubscribe from '../../public/locales/zh-CN/unsubscribe.json'
import enCommon from '../../public/locales/en/common.json'
import enAuth from '../../public/locales/en/auth.json'
import enAccount from '../../public/locales/en/account.json'
import enAdmin from '../../public/locales/en/admin.json'
import enAuthorize from '../../public/locales/en/authorize.json'
import enEnums from '../../public/locales/en/enums.json'
import enUnsubscribe from '../../public/locales/en/unsubscribe.json'

function buildResources(): Resource {
  const zh: ResourceLanguage = {
    common: zhCommon,
    auth: zhAuth,
    account: zhAccount,
    admin: zhAdmin,
    authorize: zhAuthorize,
    enums: zhEnums,
    unsubscribe: zhUnsubscribe,
  }
  const en: ResourceLanguage = {
    common: enCommon,
    auth: enAuth,
    account: enAccount,
    admin: enAdmin,
    authorize: enAuthorize,
    enums: enEnums,
    unsubscribe: enUnsubscribe,
  }
  return {
    'zh-CN': zh,
    en,
  }
}

// initI18nForTests 用打包的静态目录同步初始化 i18next，避免测试依赖网络请求。
// 默认语言固定为 zh-CN，使既有断言中文文案的测试保持通过。
export function initI18nForTests(language = 'zh-CN') {
  return i18n.use(initReactI18next).init({
    ...BASE_I18N_OPTIONS,
    lng: language,
    resources: buildResources(),
    initAsync: false,
    react: { useSuspense: false },
  })
}

// resetI18nLanguage 在测试内切换活动语言。
export function setI18nLanguage(language: string) {
  return i18n.changeLanguage(language)
}

export function supportedLanguages(): readonly string[] {
  return SUPPORTED_LANGUAGES
}
