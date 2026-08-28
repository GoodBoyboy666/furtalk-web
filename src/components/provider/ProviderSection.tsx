import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ProviderIcon } from './ProviderIcon'
import {
  AUTH_PRESETS,
  CUSTOM_AUTH_PRESET,
  authPresetLabel,
  findAuthPreset,
  resolveAuthPreset,
} from '@/lib/auth-presets'
import type { AuthPreset } from '@/lib/auth-presets'
import { providersApi } from '@/lib/api/resources'
import type { Provider } from '@/lib/api/types'
import { toast } from 'sonner'

export const providerQueryKey = ['providers'] as const

type ProviderSectionMode = 'all' | 'auth' | 'captcha'

export function ProviderSection({
  mode = 'all',
}: {
  mode?: ProviderSectionMode
} = {}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const providers = useQuery({
    queryKey: providerQueryKey,
    queryFn: providersApi.list,
  })
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Provider | null>(null)
  const [deleting, setDeleting] = useState<Provider | null>(null)
  const [creatingCaptcha, setCreatingCaptcha] = useState(false)
  const [editingCaptcha, setEditingCaptcha] = useState<Provider | null>(null)
  const [deletingCaptcha, setDeletingCaptcha] = useState<Provider | null>(null)

  const authProviders = (providers.data?.providers ?? []).filter(
    (provider) => provider.kind === 'oauth' || provider.kind === 'oidc',
  )
  const captchaProviders = (providers.data?.providers ?? []).filter(
    (provider) => provider.kind === 'captcha',
  )
  // 已配置的固定登录类型与验证码类型：新建下拉需要排除它们。
  const configuredAuthKeys = new Set(
    authProviders.map((provider) => provider.provider_key),
  )
  const configuredCaptchaTypes = new Set(
    captchaProviders.map((provider) => readPublicString(provider, 'provider')),
  )
  const showAuth = mode !== 'captcha'
  const showCaptcha = mode !== 'auth'

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: providerQueryKey })

  const toggle = useMutation({
    mutationFn: (provider: Provider) => {
      const current = provider.enabled ?? false
      // 启用开关必须回传全部字符串型公开配置字段，避免 instance_url /
      // Apple team_id/key_id 等元数据在一次启停后被清空。
      const config: Record<string, string> = {}
      for (const [field, value] of Object.entries(provider.public_config)) {
        if (typeof value === 'string') config[field] = value
      }
      return providersApi.upsert(provider.provider_key, {
        kind: provider.kind as 'oauth' | 'oidc',
        enabled: !current,
        config,
      })
    },
    onSuccess: () => {
      toast.success(t('enableStatusUpdated'))
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('updateFailed')),
  })
  const test = useMutation({
    mutationFn: (provider: Provider) =>
      providersApi.test(provider.provider_key),
    onSuccess: () => toast.success(t('connectivityPassed')),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('testFailed')),
  })
  const remove = useMutation({
    mutationFn: (provider: Provider) =>
      providersApi.remove(provider.provider_key),
    onSuccess: () => {
      toast.success(t('providerDeleted'))
      setDeleting(null)
      setDeletingCaptcha(null)
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('deleteFailed')),
  })

  const sections = (
    <>
      {showAuth ? (
        <>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base font-semibold">
              {t('providerTitle')}
            </CardTitle>
            <CardAction className="max-sm:col-start-1 max-sm:col-span-2 max-sm:row-start-2 max-sm:row-span-1 max-sm:justify-self-start">
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(true)
                }}
              >
                <Plus />
                {t('createLoginEntry')}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            {providers.isPending ? (
              <p className="text-sm text-muted-foreground">
                {t('loadingProviders')}
              </p>
            ) : providers.isError ? (
              <p className="text-sm text-destructive">
                {providers.error instanceof Error
                  ? providers.error.message
                  : t('providersLoadFailed')}
              </p>
            ) : authProviders.length ? (
              <div className="grid gap-3">
                {authProviders.map((provider) => (
                  <div
                    key={provider.provider_key}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <ProviderIcon
                          providerKey={provider.provider_key}
                          className="size-4 text-muted-foreground"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-medium">
                          {presetLabel(t, provider.provider_key, provider.kind)}
                        </p>
                        <p className="m-0 truncate text-xs text-muted-foreground">
                          {provider.configured
                            ? t('configured')
                            : t('unconfiguredSecret')}
                          {provider.enabled
                            ? ` · ${t('enabled')}`
                            : ` · ${t('disabled')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={provider.enabled ?? false}
                        disabled={!provider.configured}
                        aria-label={t('enableProvider', {
                          key: provider.provider_key,
                        })}
                        title={
                          provider.configured
                            ? undefined
                            : t('configureSecretHint')
                        }
                        onCheckedChange={() => toggle.mutate(provider)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('testProvider', {
                          key: provider.provider_key,
                        })}
                        onClick={() => test.mutate(provider)}
                      >
                        <FlaskConical className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('editProvider', {
                          key: provider.provider_key,
                        })}
                        onClick={() => setEditing(provider)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('deleteProvider', {
                          key: provider.provider_key,
                        })}
                        onClick={() => setDeleting(provider)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-2 rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center">
                <p className="m-0 text-sm font-medium">{t('noLoginEntries')}</p>
                <p className="m-0 text-xs text-muted-foreground">
                  {t('noLoginEntriesHint')}
                </p>
              </div>
            )}
            {creating ? (
              <ProviderFormDialog
                title={t('createLoginEntryTitle')}
                configuredKeys={configuredAuthKeys}
                onClose={() => setCreating(false)}
              />
            ) : null}
            {editing ? (
              <ProviderFormDialog
                title={t('editLoginEntryTitle')}
                provider={editing}
                onClose={() => setEditing(null)}
              />
            ) : null}
            <AlertDialog
              open={!!deleting}
              onOpenChange={(value) => !value && setDeleting(null)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('deleteLoginEntryTitle')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {deleting
                      ? t('deleteLoginEntryHint', {
                          key: deleting.provider_key,
                        })
                      : ''}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('action.cancel', { ns: 'common' })}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={remove.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleting && remove.mutate(deleting)}
                  >
                    {remove.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : null}
                    {t('action.confirmDelete', { ns: 'common' })}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </>
      ) : null}

      {showCaptcha ? (
        <>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base font-semibold">
              {t('captchaProviderTitle')}
            </CardTitle>
            <CardAction className="max-sm:col-start-1 max-sm:col-span-2 max-sm:row-start-2 max-sm:row-span-1 max-sm:justify-self-start">
              <Button
                variant="outline"
                disabled={captchaProviderTypes.every((option) =>
                  configuredCaptchaTypes.has(option.value),
                )}
                title={
                  captchaProviderTypes.every((option) =>
                    configuredCaptchaTypes.has(option.value),
                  )
                    ? t('allCaptchaTypesConfigured')
                    : undefined
                }
                onClick={() => setCreatingCaptcha(true)}
              >
                <Plus />
                {t('createCaptchaProvider')}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            {captchaProviders.length ? (
              <div className="grid gap-3">
                {captchaProviders.map((provider) => (
                  <div
                    key={provider.provider_key}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <ShieldCheck className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-medium">
                          {captchaProviderLabel(provider)}
                        </p>
                        <p className="m-0 truncate text-xs text-muted-foreground">
                          {provider.configured
                            ? t('configured')
                            : t('unconfiguredSecretKey')}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('testProvider', {
                          key: provider.provider_key,
                        })}
                        onClick={() => test.mutate(provider)}
                      >
                        <FlaskConical className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('editProvider', {
                          key: provider.provider_key,
                        })}
                        onClick={() => setEditingCaptcha(provider)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('deleteProvider', {
                          key: provider.provider_key,
                        })}
                        onClick={() => setDeletingCaptcha(provider)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-2 rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center">
                <p className="m-0 text-sm font-medium">
                  {t('noCaptchaProviders')}
                </p>
                <p className="m-0 text-xs text-muted-foreground">
                  {t('noCaptchaProvidersHint')}
                </p>
              </div>
            )}
            {creatingCaptcha ? (
              <CaptchaProviderFormDialog
                title={t('createCaptchaProviderTitle')}
                configuredTypes={configuredCaptchaTypes}
                onClose={() => setCreatingCaptcha(false)}
              />
            ) : null}
            {editingCaptcha ? (
              <CaptchaProviderFormDialog
                title={t('editCaptchaProviderTitle')}
                provider={editingCaptcha}
                onClose={() => setEditingCaptcha(null)}
              />
            ) : null}
            <AlertDialog
              open={!!deletingCaptcha}
              onOpenChange={(value) => !value && setDeletingCaptcha(null)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('deleteCaptchaProviderTitle')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {deletingCaptcha
                      ? t('deleteCaptchaProviderHint', {
                          key: deletingCaptcha.provider_key,
                        })
                      : ''}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('action.cancel', { ns: 'common' })}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={remove.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() =>
                      deletingCaptcha && remove.mutate(deletingCaptcha)
                    }
                  >
                    {remove.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : null}
                    {t('action.confirmDelete', { ns: 'common' })}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </>
      ) : null}
    </>
  )
  return mode === 'all' ? (
    <div className="grid gap-4">{sections}</div>
  ) : (
    sections
  )
}

function captchaProviderLabel(provider: Provider) {
  const kind = readPublicString(provider, 'provider')
  return `${captchaProviderTypeLabel(kind) || kind} · ${provider.provider_key}`
}

function presetLabel(t: (key: string) => string, key: string, kind: string) {
  const preset = AUTH_PRESETS.find((item) => !item.custom && item.value === key)
  if (preset && preset.kind === kind) return t(preset.labelKey)
  return kind === 'oidc' ? `OIDC · ${key}` : key
}

function readPublicString(provider: Provider | undefined, field: string) {
  const value = provider?.public_config[field]
  return typeof value === 'string' ? value : ''
}

function ProviderFormDialog({
  title,
  provider,
  configuredKeys,
  onClose,
}: {
  title: string
  provider?: Provider
  /** 已配置的登录提供商 key；新建时排除这些固定预设，编辑时忽略。 */
  configuredKeys?: ReadonlySet<string>
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const isEdit = !!provider
  // 新建时隐藏已配置的固定预设，自定义 OIDC 始终可选；编辑时锁定当前预设/key。
  const availablePresets = provider
    ? [resolveAuthPreset(provider)]
    : AUTH_PRESETS.filter(
        (option) => option.custom || !configuredKeys?.has(option.value),
      )
  const [preset, setPreset] = useState<AuthPreset>(
    () => availablePresets[0] ?? CUSTOM_AUTH_PRESET,
  )
  const [customKey, setCustomKey] = useState(() => {
    if (provider) {
      const resolved = resolveAuthPreset(provider)
      return resolved.custom ? provider.provider_key : ''
    }
    return ''
  })
  const [clientId, setClientId] = useState<string>(
    readPublicString(provider, 'client_id'),
  )
  const [clientSecret, setClientSecret] = useState('')
  const [issuerUrl, setIssuerUrl] = useState<string>(
    readPublicString(provider, 'issuer_url'),
  )
  const [instanceUrl, setInstanceUrl] = useState<string>(
    readPublicString(provider, 'instance_url'),
  )
  const [teamId, setTeamId] = useState<string>(
    readPublicString(provider, 'team_id'),
  )
  const [keyId, setKeyId] = useState<string>(
    readPublicString(provider, 'key_id'),
  )
  const [enabled, setEnabled] = useState(provider?.enabled ?? false)

  const save = useMutation({
    mutationFn: async () => {
      const key = preset.custom ? customKey.trim() : preset.value
      if (!key) throw new Error(t('providerKeyRequired'))
      if (!clientId.trim()) throw new Error(t('clientIdRequired'))
      const config: Record<string, string> = { client_id: clientId.trim() }
      if (preset.fields.includes('instance_url')) {
        const value = instanceUrl.trim() || preset.instanceUrlDefault || ''
        if (!value) throw new Error(t('instanceUrlRequired'))
        config.instance_url = value
      }
      if (preset.fields.includes('team_id')) {
        if (!teamId.trim()) throw new Error(t('teamIdRequired'))
        config.team_id = teamId.trim()
      }
      if (preset.fields.includes('key_id')) {
        if (!keyId.trim()) throw new Error(t('keyIdRequired'))
        config.key_id = keyId.trim()
      }
      if (preset.fields.includes('issuer_url')) {
        if (!issuerUrl.trim()) throw new Error(t('issuerRequired'))
        config.issuer_url = issuerUrl.trim()
      }
      if (clientSecret.trim()) {
        config[preset.secretField] = clientSecret.trim()
      } else if (!isEdit) {
        throw new Error(
          t('newSecretRequired', { secret: t(preset.secretLabelKey) }),
        )
      }
      await providersApi.upsert(key, {
        kind: preset.kind,
        enabled,
        config,
      })
    },
    onSuccess: () => {
      toast.success(isEdit ? t('loginEntryUpdated') : t('loginEntryCreated'))
      void queryClient.invalidateQueries({ queryKey: providerQueryKey })
      onClose()
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('providerSaveFailed'),
      ),
  })

  const clientIdLabel = t(preset.clientIdLabelKey ?? 'clientId')
  const secretLabel = t(preset.secretLabelKey)
  const secretPlaceholder = isEdit
    ? t('secretKeepPlaceholder', { secret: secretLabel })
    : t('secretCreatePlaceholder', { secret: secretLabel })

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {isEdit ? (
            <DialogDescription>{t('editSecretKeepHint')}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>{t('loginMethod')}</Label>
            <Select
              value={preset.value}
              disabled={isEdit}
              onValueChange={(value) => {
                if (!value) return
                const next = findAuthPreset(value)
                if (next) setPreset(next)
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value) => authPresetLabel(t, value as string)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availablePresets.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {preset.custom ? (
            <div className="grid gap-2">
              <Label htmlFor="provider-key">{t('providerKeyLabel')}</Label>
              <Input
                id="provider-key"
                value={customKey}
                disabled={isEdit}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="my-oidc"
              />
              <p className="text-xs text-muted-foreground">
                {t('providerKeyHint')}
              </p>
            </div>
          ) : preset.hintKey ? (
            <p className="m-0 text-xs text-muted-foreground">
              {t(preset.hintKey)}
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="client-id">{clientIdLabel}</Label>
            <Input
              id="client-id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder={t('clientIdPlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="provider-secret">
              {secretLabel}
              {!isEdit ? ' *' : ''}
            </Label>
            {preset.secretMultiline ? (
              <Textarea
                id="provider-secret"
                rows={5}
                className="resize-y font-mono text-sm"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                placeholder={secretPlaceholder}
              />
            ) : (
              <Input
                id="provider-secret"
                type="password"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                placeholder={secretPlaceholder}
              />
            )}
            {preset.secretMultiline ? (
              <p className="text-xs text-muted-foreground">
                {t('applePrivateKeyHint')}
              </p>
            ) : null}
          </div>
          {preset.fields.includes('instance_url') ? (
            <div className="grid gap-2">
              <Label htmlFor="instance-url">
                {t('instanceUrl')}
                {preset.instanceUrlRequired ? ' *' : ''}
              </Label>
              <Input
                id="instance-url"
                type="url"
                value={instanceUrl}
                onChange={(event) => setInstanceUrl(event.target.value)}
                placeholder={
                  preset.instanceUrlDefault ?? 'https://instance.example.com'
                }
              />
              <p className="text-xs text-muted-foreground">
                {preset.instanceUrlDefault
                  ? t('gitlabInstanceDefaultHint')
                  : t('instanceUrlRequiredHint')}
              </p>
            </div>
          ) : null}
          {preset.fields.includes('team_id') ? (
            <div className="grid gap-2">
              <Label htmlFor="team-id">{t('teamId')}</Label>
              <Input
                id="team-id"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              />
            </div>
          ) : null}
          {preset.fields.includes('key_id') ? (
            <div className="grid gap-2">
              <Label htmlFor="key-id">{t('keyId')}</Label>
              <Input
                id="key-id"
                value={keyId}
                onChange={(event) => setKeyId(event.target.value)}
              />
            </div>
          ) : null}
          {preset.fields.includes('issuer_url') ? (
            <div className="grid gap-2">
              <Label htmlFor="issuer-url">{t('issuerUrl')}</Label>
              <Input
                id="issuer-url"
                type="url"
                value={issuerUrl}
                onChange={(event) => setIssuerUrl(event.target.value)}
                placeholder="https://issuer.example.com"
              />
              <p className="text-xs text-muted-foreground">{t('issuerHint')}</p>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <Label className="cursor-pointer">{t('enableLabel')}</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('action.cancel', { ns: 'common' })}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {isEdit
              ? t('action.saveChanges', { ns: 'common' })
              : t('action.create', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// captchaProviderTypes 是可配置的验证码提供商类型与展示名。
const captchaProviderTypes = [
  { value: 'turnstile', label: 'Cloudflare Turnstile' },
  { value: 'recaptcha', label: 'Google reCAPTCHA' },
  { value: 'hcaptcha', label: 'hCaptcha' },
  { value: 'cap', label: 'CAP' },
] as const

// captchaProviderTypeLabel 把验证码类型枚举映射为翻译后的展示名，未知值回落到原值。
export function captchaProviderTypeLabel(value: string | null | undefined) {
  if (!value) return ''
  const option = captchaProviderTypes.find((item) => item.value === value)
  return option ? option.label : value
}

function CaptchaProviderFormDialog({
  title,
  provider,
  configuredTypes,
  onClose,
}: {
  title: string
  provider?: Provider
  /** 已配置的验证码类型；新建时排除这些固定类型，编辑时忽略。 */
  configuredTypes?: ReadonlySet<string>
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const isEdit = !!provider

  // 新建时隐藏已配置的固定类型；编辑时保留全部并锁定当前类型。
  const availableTypes = provider
    ? captchaProviderTypes
    : captchaProviderTypes.filter(
        (option) => !configuredTypes?.has(option.value),
      )

  const [type, setType] = useState(
    () =>
      readPublicString(provider, 'provider') ||
      (availableTypes[0]?.value ?? 'turnstile'),
  )
  const [siteKey, setSiteKey] = useState(readPublicString(provider, 'site_key'))
  const [secretKey, setSecretKey] = useState('')
  const [endpoint, setEndpoint] = useState(
    readPublicString(provider, 'endpoint'),
  )

  const save = useMutation({
    mutationFn: async () => {
      // 每种验证码类型只能配置一个实例，provider key 即类型。
      const providerKey = type
      if (!siteKey.trim()) throw new Error(t('captchaSiteKeyRequired'))
      if (type === 'cap' && !endpoint.trim()) {
        throw new Error(t('capEndpointRequired'))
      }
      const config: Record<string, string> = {
        provider: type,
        site_key: siteKey.trim(),
      }
      if (endpoint.trim()) {
        config.endpoint = endpoint.trim()
      }
      if (secretKey.trim()) {
        config.secret_key = secretKey.trim()
      } else if (!isEdit) {
        throw new Error(t('captchaSecretKeyRequired'))
      }
      await providersApi.upsert(providerKey, {
        kind: 'captcha',
        config,
      })
    },
    onSuccess: () => {
      toast.success(
        isEdit ? t('captchaProviderUpdated') : t('captchaProviderCreated'),
      )
      void queryClient.invalidateQueries({ queryKey: providerQueryKey })
      onClose()
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('providerSaveFailed'),
      ),
  })

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {isEdit ? (
            <DialogDescription>{t('editSecretKeepHint')}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>{t('captchaType')}</Label>
            <Select
              value={type}
              disabled={isEdit}
              onValueChange={(value) => value && setType(value)}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value) => captchaProviderTypeLabel(value as string)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableTypes.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {isEdit ? (
              <p className="text-xs text-muted-foreground">
                {t('captchaTypeLockedHint')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('captchaTypeOnePerHint')}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="captcha-site-key">{t('siteKey')}</Label>
            <Input
              id="captcha-site-key"
              value={siteKey}
              onChange={(event) => setSiteKey(event.target.value)}
              placeholder="0x4AAAAAAA..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="captcha-secret-key">
              {t('secretKey')}
              {!isEdit ? ' *' : ''}
            </Label>
            <Input
              id="captcha-secret-key"
              type="password"
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
              placeholder={
                isEdit
                  ? t('secretKeyKeepPlaceholder')
                  : t('secretKeyCreatePlaceholder')
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="captcha-endpoint">
              {t('endpoint')}
              {type === 'cap' ? ' *' : ''}
            </Label>
            <Input
              id="captcha-endpoint"
              type="url"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://captcha.example.com"
            />
            <p className="text-xs text-muted-foreground">
              {type === 'cap'
                ? t('capEndpointHint')
                : t('optionalEndpointHint')}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('action.cancel', { ns: 'common' })}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {isEdit
              ? t('action.saveChanges', { ns: 'common' })
              : t('action.create', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
