import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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
import type { Provider, ProviderUpsertPayload } from '@/lib/api/types'
import { toast } from 'sonner'

export const spamProviderQueryKey = ['providers'] as const

// spamProviderOrder 是固定的垃圾检测渠道顺序，与后端执行顺序一致。
const spamProviderOrder = [
  { key: 'spam.local', titleKey: 'spamLocalTitle' },
  { key: 'spam.akismet', titleKey: 'spamAkismetTitle' },
  { key: 'spam.aliyun', titleKey: 'spamAliyunTitle' },
  { key: 'spam.tencent', titleKey: 'spamTencentTitle' },
] as const

export function SpamProviderSection() {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const providers = useQuery({
    queryKey: spamProviderQueryKey,
    queryFn: providersApi.list,
  })
  const [editing, setEditing] = useState<Provider | null>(null)
  const [deleting, setDeleting] = useState<Provider | null>(null)

  const spamByKey = new Map(
    (providers.data?.providers ?? [])
      .filter((provider) => provider.kind === 'spam')
      .map((provider) => [provider.provider_key, provider]),
  )
  const ordered = spamProviderOrder.map((spec) => ({
    spec,
    provider: spamByKey.get(spec.key),
  }))

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: spamProviderQueryKey })

  const toggle = useMutation({
    mutationFn: (provider: Provider) => {
      // 开关回传完整公开配置（含布尔字段），省略机密由后端保留语义处理。
      const config =
        provider.public_config as unknown as ProviderUpsertPayload['config']
      return providersApi.upsert(provider.provider_key, {
        kind: 'spam',
        enabled: !(provider.enabled ?? false),
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
  const remove = useMutation({
    mutationFn: (provider: Provider) =>
      providersApi.remove(provider.provider_key),
    onSuccess: () => {
      toast.success(t('providerDeleted'))
      setDeleting(null)
      invalidate()
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('deleteFailed')),
  })

  return (
    <div className="grid gap-4">
      {providers.isPending ? (
        <p className="text-sm text-muted-foreground">{t('loadingProviders')}</p>
      ) : (
        <div className="grid gap-3">
          {ordered.map(({ spec, provider }) => (
            <div
              key={spec.key}
              className="rounded-md border px-3 py-3"
              data-testid={`spam-provider-${spec.key}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ShieldCheck className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium">
                      {t(spec.titleKey)}
                    </p>
                    <p className="m-0 truncate text-xs text-muted-foreground">
                      {provider
                        ? provider.configured
                          ? t('configured')
                          : t('spamUnconfigured')
                        : t('spamNotCreated')}
                      {provider?.enabled ? ` · ${t('enabled')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={provider?.enabled ?? false}
                    disabled={!provider?.configured}
                    aria-label={t('enableSpamProvider', { key: spec.key })}
                    onCheckedChange={() => provider && toggle.mutate(provider)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('editProvider', { key: spec.key })}
                    onClick={() =>
                      setEditing(
                        provider ?? {
                          provider_key: spec.key,
                          kind: 'spam',
                          configured: false,
                          public_config: {},
                        },
                      )
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('deleteProvider', { key: spec.key })}
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
        <SpamProviderFormDialog
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
            <AlertDialogTitle>{t('spamDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? t('spamDeleteHint', { key: deleting.provider_key })
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

function readString(provider: Provider | undefined, field: string) {
  const value = provider?.public_config[field]
  return typeof value === 'string' ? value : ''
}

function readBool(provider: Provider | undefined, field: string) {
  return provider?.public_config[field] === true
}

// spamActionOptions 是二元渠道的命中动作。
const spamActionOptions = [
  { value: 'pending', key: 'spamActionPending' },
  { value: 'spam', key: 'spamActionSpam' },
] as const

function SpamProviderFormDialog({
  provider,
  onClose,
}: {
  provider: Provider
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const isEdit = Object.keys(provider.public_config).length > 0

  const [filePath, setFilePath] = useState(readString(provider, 'file_path'))
  const [checkNickname, setCheckNickname] = useState(
    readBool(provider, 'check_nickname'),
  )
  const [action, setAction] = useState(
    readString(provider, 'action') || 'pending',
  )
  const [apiKey, setApiKey] = useState('')
  const [region, setRegion] = useState(readString(provider, 'region'))
  const [bizType, setBizType] = useState(readString(provider, 'biz_type'))
  const [accessKeyId, setAccessKeyId] = useState('')
  const [accessKeySecret, setAccessKeySecret] = useState('')
  const [secretId, setSecretId] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [enabled, setEnabled] = useState(provider.enabled ?? false)

  const save = useMutation({
    mutationFn: async () => {
      const config: ProviderUpsertPayload['config'] = {}
      switch (provider.provider_key) {
        case 'spam.local': {
          if (!filePath.trim()) throw new Error(t('spamFilePathRequired'))
          config.file_path = filePath.trim()
          config.check_nickname = checkNickname
          config.action = action
          break
        }
        case 'spam.akismet': {
          config.action = action
          if (apiKey.trim()) {
            config.api_key = apiKey.trim()
          } else if (!isEdit) {
            throw new Error(t('spamSecretRequired'))
          }
          break
        }
        case 'spam.aliyun': {
          if (!region.trim()) throw new Error(t('spamRegionRequired'))
          config.region = region.trim()
          if (bizType.trim()) config.biz_type = bizType.trim()
          const hasId = accessKeyId.trim() !== ''
          const hasSecret = accessKeySecret.trim() !== ''
          if (hasId !== hasSecret) {
            throw new Error(t('spamSecretGroupRequired'))
          }
          if (hasId) {
            config.access_key_id = accessKeyId.trim()
            config.access_key_secret = accessKeySecret.trim()
          } else if (!isEdit) {
            throw new Error(t('spamSecretRequired'))
          }
          break
        }
        case 'spam.tencent': {
          if (!region.trim()) throw new Error(t('spamRegionRequired'))
          config.region = region.trim()
          if (bizType.trim()) config.biz_type = bizType.trim()
          const hasId = secretId.trim() !== ''
          const hasKey = secretKey.trim() !== ''
          if (hasId !== hasKey) {
            throw new Error(t('spamSecretGroupRequired'))
          }
          if (hasId) {
            config.secret_id = secretId.trim()
            config.secret_key = secretKey.trim()
          } else if (!isEdit) {
            throw new Error(t('spamSecretRequired'))
          }
          break
        }
      }
      await providersApi.upsert(provider.provider_key, {
        kind: 'spam',
        enabled,
        config,
      })
    },
    onSuccess: () => {
      toast.success(t('spamSaved'))
      void queryClient.invalidateQueries({ queryKey: spamProviderQueryKey })
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
            {t('spamEditTitle', { key: provider.provider_key })}
          </DialogTitle>
          {isEdit ? (
            <DialogDescription>{t('spamSecretKeepHint')}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {provider.provider_key === 'spam.local' ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="spam-file-path">{t('spamFilePath')}</Label>
                <Input
                  id="spam-file-path"
                  value={filePath}
                  onChange={(event) => setFilePath(event.target.value)}
                  placeholder="/var/lib/furtalk/keywords.txt"
                />
                <p className="text-xs text-muted-foreground">
                  {t('spamFilePathHint')}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="cursor-pointer">
                  {t('spamCheckNickname')}
                </Label>
                <Switch
                  aria-label={t('spamCheckNickname')}
                  checked={checkNickname}
                  onCheckedChange={setCheckNickname}
                />
              </div>
            </>
          ) : null}
          {provider.provider_key === 'spam.local' ||
          provider.provider_key === 'spam.akismet' ? (
            <div className="grid gap-2">
              <Label>{t('spamHitAction')}</Label>
              <Select
                value={action}
                onValueChange={(value) => value && setAction(value)}
              >
                <SelectTrigger aria-label={t('spamHitAction')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {spamActionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {provider.provider_key === 'spam.akismet' ? (
            <div className="grid gap-2">
              <Label htmlFor="spam-api-key">
                {t('spamApiKey')}
                {!isEdit ? ' *' : ''}
              </Label>
              <Input
                id="spam-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  isEdit
                    ? t('secretKeepPlaceholder', { secret: 'API Key' })
                    : ''
                }
              />
              <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {t('spamAkismetWarning')}
              </p>
            </div>
          ) : null}
          {provider.provider_key === 'spam.aliyun' ||
          provider.provider_key === 'spam.tencent' ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="spam-region">{t('spamRegion')}</Label>
                <Input
                  id="spam-region"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  placeholder={
                    provider.provider_key === 'spam.aliyun'
                      ? 'cn-shanghai'
                      : 'ap-guangzhou'
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t('spamRegionHint')}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="spam-biz-type">{t('spamBizType')}</Label>
                <Input
                  id="spam-biz-type"
                  value={bizType}
                  onChange={(event) => setBizType(event.target.value)}
                  placeholder={t('spamBizTypePlaceholder')}
                />
              </div>
              {provider.provider_key === 'spam.aliyun' ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="spam-ak-id">{t('spamAccessKeyId')}</Label>
                    <Input
                      id="spam-ak-id"
                      value={accessKeyId}
                      onChange={(event) => setAccessKeyId(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="spam-ak-secret">
                      {t('spamAccessKeySecret')}
                      {!isEdit ? ' *' : ''}
                    </Label>
                    <Input
                      id="spam-ak-secret"
                      type="password"
                      value={accessKeySecret}
                      onChange={(event) =>
                        setAccessKeySecret(event.target.value)
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="spam-secret-id">{t('spamSecretId')}</Label>
                    <Input
                      id="spam-secret-id"
                      value={secretId}
                      onChange={(event) => setSecretId(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="spam-secret-key">
                      {t('spamSecretKey')}
                      {!isEdit ? ' *' : ''}
                    </Label>
                    <Input
                      id="spam-secret-key"
                      type="password"
                      value={secretKey}
                      onChange={(event) => setSecretKey(event.target.value)}
                    />
                  </div>
                </>
              )}
              <p className="m-0 text-xs text-muted-foreground">
                {t('spamCloudBodyNotice')}
              </p>
            </>
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
            {t('action.saveChanges', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
