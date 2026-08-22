import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/PageHeader'
import { StateFade } from '@/components/motion'
import {
  captchaProviderTypeLabel,
  ProviderSection,
} from '@/components/provider/ProviderSection'
import { providersApi, settingsApi } from '@/lib/api/resources'
import {
  commentSortOptions,
  decodeSettings,
  diffSettings,
  parseDomainLines,
  privacyModeOptions,
} from '@/lib/api/settings'
import { selectItems } from '@/lib/i18n'
import type { Settings } from '@/lib/api/settings'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/settings')({
  component: SettingsPage,
})

// captchaActions 是人机验证策略页面可独立开关的 action 与展示名。
const captchaActions = [
  { key: 'email_code', labelKey: 'sendEmailCode' },
  { key: 'email_code_login', labelKey: 'emailCodeLogin' },
  { key: 'password_login', labelKey: 'passwordLogin' },
  { key: 'password_reset', labelKey: 'forgotPasswordReset' },
  { key: 'comment', labelKey: 'postComment' },
] as const

// SettingsPage 是系统设置页，供测试直接使用。
export function SettingsPage() {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })
  const providers = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  })
  const [draft, setDraft] = useState<Settings | null>(null)
  const [baseline, setBaseline] = useState<Settings | null>(null)
  const [whitelistText, setWhitelistText] = useState('')
  const [blacklistText, setBlacklistText] = useState('')
  useEffect(() => {
    if (settings.data) {
      const decoded = decodeSettings(settings.data.settings)
      setDraft(decoded)
      setBaseline(decoded)
      setWhitelistText(decoded.email_domain_whitelist.join('\n'))
      setBlacklistText(decoded.email_domain_blacklist.join('\n'))
    }
  }, [settings.data])
  const update = useMutation({
    mutationFn: () => {
      if (!baseline || !draft) {
        return Promise.reject(new Error(t('settingsNotLoaded')))
      }
      const changed = diffSettings(baseline, draft)
      if (changed.length === 0) return Promise.resolve(null)
      return settingsApi.patch(changed)
    },
    onSuccess: (data) => {
      if (!data) {
        toast.success(t('noChangesToSave'))
        return
      }
      toast.success(t('settingsSaved'))
      void queryClient.setQueryData(['settings'], data)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('saveFailed')),
  })
  if (settings.isPending || !draft)
    return (
      <StateFade kind="loading" className="text-sm text-muted-foreground">
        {t('settingsLoading')}
      </StateFade>
    )
  if (settings.isError)
    return (
      <StateFade kind="error" className="text-sm text-destructive">
        {t('settingsLoadFailed')}
      </StateFade>
    )
  const set = <TKey extends keyof Settings>(key: TKey, value: Settings[TKey]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  // updatePrivacy 不可变地更新 privacy 子对象的单个字段，保留另一字段。
  const updatePrivacy = (mode: 'ip_mode' | 'ua_mode', value: string) =>
    setDraft((current) =>
      current
        ? { ...current, privacy: { ...current.privacy, [mode]: value } }
        : current,
    )
  return (
    <>
      <PageHeader
        title={t('settingsTitle')}
        action={
          <Button onClick={() => update.mutate()} disabled={update.isPending}>
            <Save />
            {update.isPending ? t('saving') : t('saveSettings')}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">{t('commentPolicy')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>{t('commentMode')}</Label>
              <Select
                value={draft.comment_mode}
                onValueChange={(value) => value && set('comment_mode', value)}
                items={selectItems(commentModeOptions, t)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {commentModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('moderationPolicy')}</Label>
              <Select
                value={draft.moderation}
                onValueChange={(value) => value && set('moderation', value)}
                items={selectItems(moderationOptions, t)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {moderationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('commentDefaultSort')}</Label>
              <Select
                value={draft.comment_sort}
                onValueChange={(value) => value && set('comment_sort', value)}
                items={selectItems(commentSortOptions, t)}
              >
                <SelectTrigger aria-label={t('commentDefaultSort')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {commentSortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reply-depth">{t('maxReplyDepth')}</Label>
              <Input
                id="reply-depth"
                type="number"
                min={0}
                max={20}
                value={draft.max_reply_depth}
                onChange={(event) =>
                  set('max_reply_depth', Number(event.target.value))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emoji-catalog-url">{t('emojiCatalogUrl')}</Label>
              <Input
                id="emoji-catalog-url"
                type="url"
                placeholder="https://example.com/emoji.json"
                value={draft.emoji_catalog_url}
                onChange={(event) =>
                  set('emoji_catalog_url', event.target.value)
                }
              />
              <p className="m-0 text-xs text-muted-foreground">
                {t('emojiCatalogUrlHint')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">
              {t('usersAndNotifications')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <SettingSwitch
              label={t('allowPublicRegistration')}
              checked={draft.public_registration}
              onCheckedChange={(value) => set('public_registration', value)}
            />
            <SettingSwitch
              label={t('moderationNotifications')}
              checked={draft.notifications.moderation}
              onCheckedChange={(value) =>
                set('notifications', {
                  ...draft.notifications,
                  moderation: value,
                })
              }
            />
            <SettingSwitch
              label={t('replyNotifications')}
              checked={draft.notifications.replies}
              onCheckedChange={(value) =>
                set('notifications', { ...draft.notifications, replies: value })
              }
            />
            <div className="grid gap-2">
              <Label>{t('userDeleteModeSetting')}</Label>
              <Select
                value={draft.user_delete_mode}
                onValueChange={(value) =>
                  value && set('user_delete_mode', value)
                }
                items={selectItems(userDeleteModeOptions, t)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {userDeleteModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="m-0 text-xs text-muted-foreground">
                {t('userDeleteModeHint')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">{t('privacyRecording')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>{t('ipRecording')}</Label>
              <Select
                value={draft.privacy.ip_mode}
                onValueChange={(value) =>
                  value && updatePrivacy('ip_mode', value)
                }
                items={selectItems(privacyModeOptions, t)}
              >
                <SelectTrigger aria-label={t('ipRecordingPrecision')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {privacyModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('uaRecording')}</Label>
              <Select
                value={draft.privacy.ua_mode}
                onValueChange={(value) =>
                  value && updatePrivacy('ua_mode', value)
                }
                items={selectItems(privacyModeOptions, t)}
              >
                <SelectTrigger aria-label={t('uaRecordingPrecision')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {privacyModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              {t('privacyApplyHint')}
            </p>
          </CardContent>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">{t('emailAndAvatar')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <DomainListEditor
                label={t('domainWhitelist')}
                description={t('domainWhitelistHint')}
                placeholder={t('domainWhitelistPlaceholder')}
                value={whitelistText}
                onChange={(text) => {
                  setWhitelistText(text)
                  set('email_domain_whitelist', parseDomainLines(text))
                }}
              />
              <DomainListEditor
                label={t('domainBlacklist')}
                description={t('domainBlacklistHint')}
                placeholder={t('domainBlacklistPlaceholder')}
                value={blacklistText}
                onChange={(text) => {
                  setBlacklistText(text)
                  set('email_domain_blacklist', parseDomainLines(text))
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gravatar-base">{t('gravatarBase')}</Label>
              <Input
                id="gravatar-base"
                type="url"
                placeholder="https://www.gravatar.com/avatar"
                value={draft.gravatar_base_url}
                onChange={(event) =>
                  set('gravatar_base_url', event.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('gravatarBaseHint')}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="text-base">{t('captchaPolicy')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {captchaActions.map((action) => (
              <SettingSwitch
                key={action.key}
                label={t(action.labelKey)}
                checked={draft.captcha_policy[action.key] ?? false}
                onCheckedChange={(value) =>
                  set('captcha_policy', {
                    ...draft.captcha_policy,
                    [action.key]: value,
                  })
                }
              />
            ))}
            <div className="grid gap-2">
              <Label>{t('currentCaptchaProvider')}</Label>
              <Select
                value={draft.captcha_provider}
                onValueChange={(value) => set('captcha_provider', value ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('notSelected')}>
                    {(value) =>
                      value
                        ? captchaProviderTypeLabel(value as string)
                        : t('notSelected')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="">{t('notSelected')}</SelectItem>
                    {(providers.data?.providers ?? [])
                      .filter(
                        (provider) =>
                          provider.kind === 'captcha' && provider.configured,
                      )
                      .map((provider) => (
                        <SelectItem
                          key={provider.provider_key}
                          value={provider.provider_key}
                        >
                          {captchaProviderTypeLabel(
                            readPublicProviderType(provider),
                          )}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="text-base">{t('thirdPartyLogin')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProviderSection />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

const commentModeOptions = [
  { value: 'anonymous', key: 'enums:commentMode.anonymous' },
  { value: 'authenticated', key: 'enums:commentMode.authenticated' },
] as const

const moderationOptions = [
  { value: 'review', key: 'enums:moderation.review' },
  { value: 'direct', key: 'enums:moderation.direct' },
] as const

const userDeleteModeOptions = [
  { value: 'soft', key: 'enums:userDeleteModeShort.soft' },
  { value: 'hard', key: 'enums:userDeleteModeShort.hard' },
] as const

function DomainListEditor({
  label,
  description,
  placeholder,
  value,
  onChange,
}: {
  label: string
  description: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Textarea
        rows={6}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="resize-y font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
function SettingSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <Label className="cursor-pointer font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

// readPublicProviderType 读取 provider 公开配置中的 provider 类型字段。
function readPublicProviderType(provider: {
  public_config: Record<string, unknown>
}) {
  const value = provider.public_config['provider']
  return typeof value === 'string' ? value : ''
}
