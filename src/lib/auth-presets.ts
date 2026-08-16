// 固定第三方登录提供商的预设目录（前端单一事实来源）。
// 与后端 internal/platform/oauth/catalog.go 的固定预设保持一致；
// 展示名、kind 与表单字段全部由本目录驱动，组件内不做按 key 的 switch。

export type AuthPresetField =
  'instance_url' | 'issuer_url' | 'team_id' | 'key_id'

export type AuthPreset = {
  /** 固定 provider key；custom 允许任意 key（自定义 OIDC）。 */
  value: string
  kind: 'oauth' | 'oidc'
  /** 展示名的 i18n key（admin 命名空间）。 */
  labelKey: string
  /** 表单额外展示的公开配置字段；client_id 始终展示。 */
  fields: readonly AuthPresetField[]
  /** 机密字段的 JSON key。 */
  secretField: 'client_secret' | 'private_key'
  /** 机密字段 label 的 i18n key。 */
  secretLabelKey: string
  /** client_id 字段 label 的 i18n key；缺省使用 clientId。 */
  clientIdLabelKey?: string
  /** 机密输入是否为多行文本域（Apple private_key）。 */
  secretMultiline?: boolean
  /** instance_url 默认值（GitLab 的 https://gitlab.com）。 */
  instanceUrlDefault?: string
  /** instance_url 是否必填（Gitea / Mastodon）。 */
  instanceUrlRequired?: boolean
  /** 预设级提示文案的 i18n key（GitHub / Google 固定端点提示）。 */
  hintKey?: string
  /** custom 是可重复创建的自定义 OIDC 条目。 */
  custom?: boolean
}

export const AUTH_PRESETS: readonly AuthPreset[] = [
  {
    value: 'github',
    kind: 'oauth',
    labelKey: 'provider.github',
    fields: [],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
    hintKey: 'githubHint',
  },
  {
    value: 'google',
    kind: 'oidc',
    labelKey: 'provider.google',
    fields: [],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
    hintKey: 'googleHint',
  },
  {
    value: 'gitlab',
    kind: 'oidc',
    labelKey: 'provider.gitlab',
    fields: ['instance_url'],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
    instanceUrlDefault: 'https://gitlab.com',
  },
  {
    value: 'gitea',
    kind: 'oidc',
    labelKey: 'provider.gitea',
    fields: ['instance_url'],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
    instanceUrlRequired: true,
  },
  {
    value: 'mastodon',
    kind: 'oauth',
    labelKey: 'provider.mastodon',
    fields: ['instance_url'],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
    instanceUrlRequired: true,
  },
  {
    value: 'microsoft',
    kind: 'oidc',
    labelKey: 'provider.microsoft',
    fields: [],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
  },
  {
    value: 'twitter',
    kind: 'oauth',
    labelKey: 'provider.twitter',
    fields: [],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
  },
  {
    value: 'discord',
    kind: 'oauth',
    labelKey: 'provider.discord',
    fields: [],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
  },
  {
    value: 'apple',
    kind: 'oidc',
    labelKey: 'provider.apple',
    fields: ['team_id', 'key_id'],
    secretField: 'private_key',
    secretLabelKey: 'applePrivateKey',
    clientIdLabelKey: 'appleServicesId',
    secretMultiline: true,
  },
  {
    value: 'line',
    kind: 'oidc',
    labelKey: 'provider.line',
    fields: [],
    secretField: 'client_secret',
    secretLabelKey: 'lineChannelSecret',
    clientIdLabelKey: 'lineChannelId',
  },
  {
    value: 'custom',
    kind: 'oidc',
    labelKey: 'customOidc',
    fields: ['issuer_url'],
    secretField: 'client_secret',
    secretLabelKey: 'clientSecret',
    custom: true,
  },
]

export const CUSTOM_AUTH_PRESET = AUTH_PRESETS.find(
  (preset) => preset.custom,
) as AuthPreset

export function findAuthPreset(value: string): AuthPreset | undefined {
  return AUTH_PRESETS.find((preset) => preset.value === value)
}

// authPresetLabel 把预设 value 映射为翻译后的展示名，未知值回落到原值。
export function authPresetLabel(
  t: (key: string) => string,
  value: string,
): string {
  const preset = findAuthPreset(value)
  return preset ? t(preset.labelKey) : value
}

// resolveAuthPreset 把已保存的 Provider 行映射到预设：key 与 kind 都匹配的固定
// 预设使用对应条目，其余（未知 key / kind 不符的历史行）按自定义 OIDC 处理。
export function resolveAuthPreset(provider: {
  provider_key: string
  kind: string
}): AuthPreset {
  const fixed = AUTH_PRESETS.find(
    (preset) => !preset.custom && preset.value === provider.provider_key,
  )
  if (fixed && fixed.kind === provider.kind) return fixed
  return CUSTOM_AUTH_PRESET
}
