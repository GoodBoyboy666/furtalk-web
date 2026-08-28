import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  BellRing,
  Bird,
  FlaskConical,
  Hash,
  Headphones,
  Loader2,
  MessageCircle,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  Webhook,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { providersApi } from '@/lib/api/resources'
import type { Provider } from '@/lib/api/types'
import { toast } from 'sonner'

export const notificationProviderQueryKey = ['providers'] as const

/**
 * 通知字段分三类：
 * - secret：必填机密。新建必填；编辑留空表示保留现值，非空替换。绝不从后端回显。
 * - optional-secret：可选机密。编辑三态：省略/留空保留、非空替换、显式"清除"发送 null。
 * - public：必填非机密（目标 ID 等）。新建必填；编辑留空保留（目标同样加密、列表不回传）。
 */
type FieldKind = 'secret' | 'optional-secret' | 'public'

type NotificationChannelField = {
  name: string
  labelKey: string
  kind: FieldKind
  required: boolean
  placeholderKey?: string
  hintKey?: string
  url?: boolean
}

type NotificationChannelSpec = {
  key: string
  titleKey: string
  hintKey?: string
  icon: ComponentType<{ className?: string }>
  /** Bark / 通用 WebHook 允许任意 http(s)（含内网）目标，卡片显示可信管理员出站风险提示。 */
  outboundWarning?: boolean
  fields: NotificationChannelField[]
}

// notificationChannels 是固定 8 通道目录：顺序即渲染顺序，任何情况下都渲染全部插槽；
// 卡片 key 只来自目录，即使后端列表出现重复 key 也不会渲染重复实例。
const notificationChannels: NotificationChannelSpec[] = [
  {
    key: 'notification.telegram',
    titleKey: 'notificationTelegramTitle',
    hintKey: 'notificationTelegramHint',
    icon: Send,
    fields: [
      {
        name: 'bot_token',
        labelKey: 'notificationBotToken',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationBotTokenPlaceholder',
      },
      {
        name: 'chat_id',
        labelKey: 'notificationChatId',
        kind: 'public',
        required: true,
        placeholderKey: 'notificationChatIdPlaceholder',
      },
    ],
  },
  {
    key: 'notification.feishu',
    titleKey: 'notificationFeishuTitle',
    hintKey: 'notificationFeishuHint',
    icon: Bird,
    fields: [
      {
        name: 'webhook_url',
        labelKey: 'notificationWebhookUrl',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationWebhookUrlPlaceholder',
        url: true,
      },
      {
        name: 'signing_secret',
        labelKey: 'notificationSigningSecret',
        kind: 'optional-secret',
        required: false,
        placeholderKey: 'notificationSigningSecretPlaceholder',
      },
    ],
  },
  {
    key: 'notification.dingtalk',
    titleKey: 'notificationDingtalkTitle',
    hintKey: 'notificationDingtalkHint',
    icon: Sparkles,
    fields: [
      {
        name: 'webhook_url',
        labelKey: 'notificationWebhookUrl',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationWebhookUrlPlaceholder',
        url: true,
      },
      {
        name: 'signing_secret',
        labelKey: 'notificationSigningSecret',
        kind: 'optional-secret',
        required: false,
        placeholderKey: 'notificationSigningSecretPlaceholder',
      },
    ],
  },
  {
    key: 'notification.bark',
    titleKey: 'notificationBarkTitle',
    hintKey: 'notificationBarkHint',
    icon: BellRing,
    outboundWarning: true,
    fields: [
      {
        name: 'server_url',
        labelKey: 'notificationServerUrl',
        kind: 'public',
        required: true,
        placeholderKey: 'notificationServerUrlPlaceholder',
        url: true,
      },
      {
        name: 'device_key',
        labelKey: 'notificationDeviceKey',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationDeviceKeyPlaceholder',
      },
    ],
  },
  {
    key: 'notification.slack',
    titleKey: 'notificationSlackTitle',
    hintKey: 'notificationSlackHint',
    icon: Hash,
    fields: [
      {
        name: 'webhook_url',
        labelKey: 'notificationWebhookUrl',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationWebhookUrlPlaceholder',
        url: true,
      },
    ],
  },
  {
    key: 'notification.line',
    titleKey: 'notificationLineTitle',
    hintKey: 'notificationLineHint',
    icon: MessageCircle,
    fields: [
      {
        name: 'channel_access_token',
        labelKey: 'notificationChannelAccessToken',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationChannelAccessTokenPlaceholder',
      },
      {
        name: 'target_id',
        labelKey: 'notificationTargetId',
        kind: 'public',
        required: true,
        placeholderKey: 'notificationTargetIdPlaceholder',
      },
    ],
  },
  {
    key: 'notification.webhook',
    titleKey: 'notificationWebhookTitle',
    hintKey: 'notificationWebhookHint',
    icon: Webhook,
    outboundWarning: true,
    fields: [
      {
        name: 'webhook_url',
        labelKey: 'notificationWebhookUrl',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationWebhookUrlPlaceholder',
        url: true,
      },
      {
        name: 'signing_secret',
        labelKey: 'notificationSigningSecret',
        kind: 'optional-secret',
        required: false,
        placeholderKey: 'notificationSigningSecretPlaceholder',
      },
    ],
  },
  {
    key: 'notification.discord',
    titleKey: 'notificationDiscordTitle',
    hintKey: 'notificationDiscordHint',
    icon: Headphones,
    fields: [
      {
        name: 'webhook_url',
        labelKey: 'notificationWebhookUrl',
        kind: 'secret',
        required: true,
        placeholderKey: 'notificationWebhookUrlPlaceholder',
        url: true,
      },
    ],
  },
]

function readString(provider: Provider | undefined, field: string) {
  const value = provider?.public_config[field]
  return typeof value === 'string' ? value : ''
}

export function NotificationProviderSection() {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const providers = useQuery({
    queryKey: notificationProviderQueryKey,
    queryFn: providersApi.list,
  })
  const [editing, setEditing] = useState<{
    spec: NotificationChannelSpec
    provider: Provider | undefined
  } | null>(null)
  const [testing, setTesting] = useState<Provider | null>(null)
  const [deleting, setDeleting] = useState<Provider | null>(null)

  // 只按固定目录取通知通道；后端列表里的重复 key 由 Map 收敛，绝不会产生第二个实例。
  const notificationByKey = new Map(
    (providers.data?.providers ?? [])
      .filter((provider) => provider.kind === 'notification')
      .map((provider) => [provider.provider_key, provider]),
  )
  const ordered = notificationChannels.map((spec) => ({
    spec,
    provider: notificationByKey.get(spec.key),
  }))

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: notificationProviderQueryKey,
    })

  const toggle = useMutation({
    mutationFn: (provider: Provider) =>
      providersApi.upsert(provider.provider_key, {
        kind: 'notification',
        enabled: !(provider.enabled ?? false),
        // 通道目标与凭据全部留在服务端密文信封，开关只翻转 enabled。
        config: {},
      }),
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
    onSuccess: () => {
      toast.success(t('notificationTestPassed'))
      setTesting(null)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('notificationTestFailed'),
      )
      setTesting(null)
    },
  })
  const remove = useMutation({
    mutationFn: (provider: Provider) =>
      providersApi.remove(provider.provider_key),
    onSuccess: () => {
      toast.success(t('notificationDeleted'))
      setDeleting(null)
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('deleteFailed')),
  })

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-base font-semibold">
            {t('notificationChannelsTitle')}
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {t('notificationChannelsHint')}
          </p>
        </div>
      </div>
      {providers.isPending ? (
        <p className="text-sm text-muted-foreground">{t('loadingProviders')}</p>
      ) : providers.isError ? (
        <p className="text-sm text-destructive">
          {providers.error instanceof Error
            ? providers.error.message
            : t('providersLoadFailed')}
        </p>
      ) : (
        <div className="grid gap-3">
          {ordered.map(({ spec, provider }) => (
            <div
              key={spec.key}
              className="rounded-md border px-3 py-3"
              data-testid={`notification-provider-${spec.key}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <spec.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium">
                      {t(spec.titleKey)}
                    </p>
                    <p className="m-0 truncate text-xs text-muted-foreground">
                      {provider?.configured
                        ? t('configured')
                        : t('notificationUnconfigured')}
                      {provider?.enabled ? ` · ${t('enabled')}` : ''}
                    </p>
                    {spec.hintKey ? (
                      <p className="m-0 truncate text-xs text-muted-foreground/80">
                        {t(spec.hintKey)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={provider?.enabled ?? false}
                    disabled={!provider?.configured}
                    aria-label={t('enableNotificationChannel', {
                      key: spec.key,
                    })}
                    title={
                      provider?.configured
                        ? undefined
                        : t('notificationConfigureFirstHint')
                    }
                    onCheckedChange={() => provider && toggle.mutate(provider)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('testNotificationChannel', { key: spec.key })}
                    disabled={!provider?.configured}
                    onClick={() => provider && setTesting(provider)}
                  >
                    <FlaskConical className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('configureNotificationChannel', {
                      key: spec.key,
                    })}
                    onClick={() => setEditing({ spec, provider })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('deleteNotificationChannel', {
                      key: spec.key,
                    })}
                    disabled={!provider}
                    onClick={() => provider && setDeleting(provider)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing ? (
        <NotificationChannelFormDialog
          channel={editing.spec}
          provider={editing.provider}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <AlertDialog
        open={!!testing}
        onOpenChange={(value) => !value && setTesting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('notificationTestTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {testing
                ? t('notificationTestHint', { key: testing.provider_key })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={test.isPending}
              onClick={() => testing && test.mutate(testing)}
            >
              {test.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('notificationTestConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(value) => !value && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('notificationDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? t('notificationDeleteHint', { key: deleting.provider_key })
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
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.confirmDelete', { ns: 'common' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function NotificationChannelFormDialog({
  channel,
  provider,
  onClose,
}: {
  channel: NotificationChannelSpec
  provider: Provider | undefined
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const isEdit = !!provider

  // 公开（非机密）字段若有后端回显则预填；机密字段永不回显，一律从空开始。
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const field of channel.fields) {
      if (field.kind === 'public') {
        const value = readString(provider, field.name)
        if (value) init[field.name] = value
      }
    }
    return init
  })
  const [cleared, setCleared] = useState<ReadonlySet<string>>(new Set())
  const [enabled, setEnabled] = useState(provider?.enabled ?? false)

  const save = useMutation({
    mutationFn: async () => {
      // 字段名来自固定目录，用 Record 承载 string / null / boolean，交由 ProviderUpsertPayload 兼容。
      const config: Record<string, string | null | boolean> = {}
      for (const field of channel.fields) {
        const value = (values[field.name] ?? '').trim()
        if (field.kind === 'optional-secret') {
          if (cleared.has(field.name)) {
            // 显式清除：发送 null，服务端移除已保存签名密钥。
            config[field.name] = null
          } else if (value) {
            config[field.name] = value
          }
          // 留空且未清除 = 保留现值（省略）。
        } else if (value) {
          config[field.name] = value
        } else if (!isEdit) {
          throw new Error(
            t('notificationFieldRequired', { field: t(field.labelKey) }),
          )
        }
      }
      await providersApi.upsert(channel.key, {
        kind: 'notification',
        enabled,
        config,
      })
    },
    onSuccess: () => {
      toast.success(t('notificationSaved'))
      void queryClient.invalidateQueries({
        queryKey: notificationProviderQueryKey,
      })
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
          <DialogTitle>
            {t('notificationEditTitle', { key: channel.key })}
          </DialogTitle>
          {isEdit ? (
            <DialogDescription>
              {t('notificationSecretKeepHint')}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {channel.hintKey ? (
            <p className="m-0 text-xs text-muted-foreground">
              {t(channel.hintKey)}
            </p>
          ) : null}
          {channel.fields.map((field) => (
            <div className="grid gap-2" key={field.name}>
              <Label htmlFor={`notification-${channel.key}-${field.name}`}>
                {t(field.labelKey)}
                {field.required && !isEdit ? ' *' : ''}
              </Label>
              <Input
                id={`notification-${channel.key}-${field.name}`}
                type={
                  field.url
                    ? 'url'
                    : field.kind === 'public'
                      ? 'text'
                      : 'password'
                }
                value={values[field.name] ?? ''}
                disabled={
                  field.kind === 'optional-secret' && cleared.has(field.name)
                }
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                placeholder={
                  isEdit
                    ? t('secretKeepPlaceholder', {
                        secret: t(field.labelKey),
                      })
                    : field.placeholderKey
                      ? t(field.placeholderKey)
                      : undefined
                }
              />
              {field.kind === 'optional-secret' && isEdit ? (
                <label
                  className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                  htmlFor={`notification-clear-${channel.key}-${field.name}`}
                >
                  <input
                    id={`notification-clear-${channel.key}-${field.name}`}
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={cleared.has(field.name)}
                    onChange={(event) =>
                      setCleared((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(field.name)
                        else next.delete(field.name)
                        return next
                      })
                    }
                  />
                  {t('notificationClearSigningSecret')}
                </label>
              ) : null}
              {field.hintKey ? (
                <p className="m-0 text-xs text-muted-foreground">
                  {t(field.hintKey)}
                </p>
              ) : null}
            </div>
          ))}
          {channel.outboundWarning ? (
            <p className="m-0 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs break-words text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {t(
                channel.key === 'notification.bark'
                  ? 'notificationBarkOutboundWarning'
                  : 'notificationWebhookOutboundWarning',
              )}
            </p>
          ) : null}
          <p className="m-0 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t('notificationTestRealDeliveryHint')}
          </p>
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
            {t('action.saveChanges', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
