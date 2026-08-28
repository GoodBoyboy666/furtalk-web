import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Palette, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { PageHeader } from '@/components/PageHeader'
import { SettingsHint } from '@/components/SettingsHint'
import { StateFade } from '@/components/motion'
import {
  captchaProviderTypeLabel,
  ProviderSection,
} from '@/components/provider/ProviderSection'
import { SpamProviderSection } from '@/components/provider/SpamProviderSection'
import { NotificationProviderSection } from '@/components/provider/NotificationProviderSection'
import { providersApi, settingsApi } from '@/lib/api/resources'
import {
  commentSortOptions,
  decodeSettings,
  diffSettings,
  parseDomainLines,
  privacyModeOptions,
} from '@/lib/api/settings'
import { selectItems } from '@/lib/i18n'
import { publicConfigQueryKey } from '@/lib/public-config'
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

const settingsCardClassName = 'border-border/80 bg-card shadow-xs'
const settingsCardHeaderClassName = 'border-b border-border/60 pb-3'
const settingsCardTitleClassName = 'text-base font-semibold'

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
      void queryClient.invalidateQueries({ queryKey: publicConfigQueryKey })
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('saveFailed')),
  })
  const resetConsent = useMutation({
    mutationFn: settingsApi.resetLegalConsent,
    onSuccess: () => {
      toast.success(t('legalConsentReset'))
      void queryClient.invalidateQueries({ queryKey: publicConfigQueryKey })
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('resetFailed')),
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
  const brandColorValid = /^#[0-9a-fA-F]{6}$/.test(draft.brand_primary_color)
  return (
    <>
      <PageHeader
        title={t('settingsTitle')}
        action={
          <Button
            onClick={() => update.mutate()}
            disabled={update.isPending || !brandColorValid}
          >
            <Save />
            {update.isPending ? t('saving') : t('saveSettings')}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className={`${settingsCardClassName} xl:col-span-7`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
              {t('legalSettingsTitle')}
            </CardTitle>
            <CardAction className="max-sm:col-start-1 max-sm:col-span-2 max-sm:row-start-2 max-sm:row-span-1 max-sm:justify-self-start">
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button type="button" variant="outline" />}
                >
                  {t('requireReconsentAction')}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('requireReconsentTitle')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('requireReconsentDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {t('cancel', { ns: 'common' })}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={resetConsent.isPending}
                      onClick={() => resetConsent.mutate()}
                    >
                      {t('requireReconsentAction')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="user-agreement-url">
                  {t('userAgreementUrl')}
                </Label>
                <SettingsHint
                  label={t('settingsHintLabel', {
                    field: t('userAgreementUrl'),
                  })}
                >
                  {t('legalUrlHint')}
                </SettingsHint>
              </div>
              <Input
                id="user-agreement-url"
                type="url"
                placeholder="https://example.com/terms"
                value={draft.user_agreement_url}
                onChange={(event) =>
                  set('user_agreement_url', event.target.value)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="privacy-policy-url">
                {t('privacyPolicyUrl')}
              </Label>
              <Input
                id="privacy-policy-url"
                type="url"
                placeholder="https://example.com/privacy"
                value={draft.privacy_policy_url}
                onChange={(event) =>
                  set('privacy_policy_url', event.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-5`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
              {t('brandingSettingsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="brand-primary-color">
                  {t('brandPrimaryColor')}
                </Label>
                <SettingsHint
                  label={t('settingsHintLabel', {
                    field: t('brandPrimaryColor'),
                  })}
                >
                  {t('brandPrimaryColorHint')}
                </SettingsHint>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="brand-primary-color-picker"
                  aria-label={t('brandPrimaryColorPicker')}
                  type="color"
                  value={
                    brandColorValid ? draft.brand_primary_color : '#18181B'
                  }
                  onChange={(event) =>
                    set('brand_primary_color', event.target.value.toUpperCase())
                  }
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input
                  id="brand-primary-color"
                  value={draft.brand_primary_color}
                  aria-invalid={!brandColorValid}
                  onChange={(event) =>
                    set('brand_primary_color', event.target.value)
                  }
                  className="w-36 font-mono uppercase"
                  placeholder="#18181B"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => set('brand_primary_color', '#18181B')}
                >
                  <Palette />
                  {t('restoreDefaultBrandColor')}
                </Button>
              </div>
              {!brandColorValid ? (
                <p className="m-0 text-xs text-destructive">
                  {t('brandColorInvalid')}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-7`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
              {t('commentPolicy')}
            </CardTitle>
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
              <div className="flex items-center gap-2">
                <Label htmlFor="emoji-catalog-url">
                  {t('emojiCatalogUrl')}
                </Label>
                <SettingsHint
                  label={t('settingsHintLabel', {
                    field: t('emojiCatalogUrl'),
                  })}
                >
                  {t('emojiCatalogUrlHint')}
                </SettingsHint>
              </div>
              <Input
                id="emoji-catalog-url"
                type="url"
                placeholder="https://example.com/emoji.json"
                value={draft.emoji_catalog_url}
                onChange={(event) =>
                  set('emoji_catalog_url', event.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-5`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
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
              <div className="flex items-center gap-2">
                <Label>{t('userDeleteModeSetting')}</Label>
                <SettingsHint
                  label={t('settingsHintLabel', {
                    field: t('userDeleteModeSetting'),
                  })}
                >
                  {t('userDeleteModeHint')}
                </SettingsHint>
              </div>
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
            </div>
          </CardContent>
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-5`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
              {t('privacyRecording')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label>{t('ipRecording')}</Label>
                <SettingsHint
                  label={t('settingsHintLabel', {
                    field: t('privacyRecording'),
                  })}
                >
                  {t('privacyApplyHint')}
                </SettingsHint>
              </div>
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
          </CardContent>
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-7`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
              {t('emailAndAvatar')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <DomainListEditor
                label={t('domainWhitelist')}
                hintLabel={t('settingsHintLabel', {
                  field: t('domainWhitelist'),
                })}
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
                hintLabel={t('settingsHintLabel', {
                  field: t('domainBlacklist'),
                })}
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
              <div className="flex items-center gap-2">
                <Label htmlFor="gravatar-base">{t('gravatarBase')}</Label>
                <SettingsHint
                  label={t('settingsHintLabel', { field: t('gravatarBase') })}
                >
                  {t('gravatarBaseHint')}
                </SettingsHint>
              </div>
              <Input
                id="gravatar-base"
                type="url"
                placeholder="https://www.gravatar.com/avatar"
                value={draft.gravatar_base_url}
                onChange={(event) =>
                  set('gravatar_base_url', event.target.value)
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-5`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
              {t('captchaPolicy')}
            </CardTitle>
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
        <Card className={`${settingsCardClassName} xl:col-span-7`}>
          <ProviderSection mode="auth" />
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-5`}>
          <ProviderSection mode="captcha" />
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-7`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <div className="flex items-center gap-2">
              <CardTitle className={settingsCardTitleClassName}>
                {t('spamDetectionTitle')}
              </CardTitle>
              <SettingsHint
                label={t('settingsHintLabel', {
                  field: t('spamDetectionTitle'),
                })}
              >
                {t('spamDetectionHint')}
              </SettingsHint>
            </div>
          </CardHeader>
          <CardContent>
            <SpamProviderSection />
          </CardContent>
        </Card>
        <Card className={`${settingsCardClassName} xl:col-span-7`}>
          <CardHeader className={settingsCardHeaderClassName}>
            <CardTitle className={settingsCardTitleClassName}>
              {t('notificationChannelsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationProviderSection hideHeader />
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
  hintLabel,
  description,
  placeholder,
  value,
  onChange,
}: {
  label: string
  hintLabel: string
  description: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        <SettingsHint label={hintLabel}>{description}</SettingsHint>
      </div>
      <Textarea
        rows={6}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="resize-y font-mono text-sm"
      />
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
