import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Fingerprint,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  CardAction,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CardHeaderLead } from '@/components/CardHeaderLead'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/PageHeader'
import { ProviderIcon } from '@/components/provider/ProviderIcon'
import { StateFade, Stagger, StaggerItem } from '@/components/motion'
import { authApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'
import {
  isPasskeySupported,
  prepareCredentialCreationOptions,
  serializeCredential,
} from '@/lib/passkey'
import { toast } from 'sonner'

export const Route = createFileRoute('/account/security')({
  component: SecurityPage,
})

export function SecurityPage() {
  const { t } = useTranslation('account')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me })
  const identities = useQuery({
    queryKey: ['identities'],
    queryFn: authApi.identities,
  })
  const publicProviders = useQuery({
    queryKey: ['auth-providers'],
    queryFn: authApi.providers,
  })
  const [unbinding, setUnbinding] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  )
  // 密码表单只保留组件状态；成功时清空，离开页面时随组件卸载自动丢弃。
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [revokeConfirm, setRevokeConfirm] = useState(false)

  const hasPassword = me.data?.has_password ?? false
  const passwordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        current_password: hasPassword ? currentPassword : undefined,
        new_password: newPassword,
      }),
    onSuccess: async () => {
      toast.success(hasPassword ? t('passwordUpdated') : t('passwordSet'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
    onError: (error) => toast.error(passwordErrorMessage(error, t)),
  })
  const register = useMutation({
    mutationFn: async () => {
      if (!isPasskeySupported()) throw new Error(t('passkeyUnsupported'))
      const options = await authApi.passkeyRegistrationOptions()
      const credential = await navigator.credentials.create(
        prepareCredentialCreationOptions(options.options),
      )
      if (!credential) throw new Error(t('passkeyNotCreated'))
      return authApi.finishPasskeyRegistration({
        challenge: options.challenge,
        response: serializeCredential(credential as PublicKeyCredential),
      })
    },
    onSuccess: () => {
      toast.success(t('passkeyAdded'))
      void queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
    onError: (error) => toast.error(passwordErrorMessage(error, t)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => authApi.deletePasskey(id),
    onSuccess: () => {
      toast.success(t('passkeyRemoved'))
      void queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
    onError: (error) => toast.error(passwordErrorMessage(error, t)),
  })
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      authApi.renamePasskey(id, name),
    onSuccess: () => {
      toast.success(t('passkeyRenamed'))
      setRenaming(null)
      void queryClient.invalidateQueries({ queryKey: ['identities'] })
    },
    onError: (error) => toast.error(passwordErrorMessage(error, t)),
  })
  const oauthStart = useMutation({
    mutationFn: async (key: string) => {
      // 绑定流程在 OAuth 回调完成后由前端回调页跳回本页。
      const start = await authApi.oauthStart(key, 'bind', '/account/security')
      window.location.href = start.auth_url
    },
    onError: (error) => toast.error(passwordErrorMessage(error, t)),
  })
  const unbind = useMutation({
    mutationFn: (id: string) => authApi.deleteIdentity(id),
    onSuccess: () => {
      toast.success(t('unbound'))
      setUnbinding(null)
      void queryClient.invalidateQueries({ queryKey: ['identities'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (error) => {
      setUnbinding(null)
      toast.error(unbindErrorMessage(error, t))
    },
  })
  const revokeSessions = useMutation({
    mutationFn: authApi.revokeSessions,
    onSuccess: () => {
      toast.success(t('sessionsRevoked'))
      setRevokeConfirm(false)
      queryClient.clear()
      void navigate({ to: '/login' })
    },
    onError: (error) => {
      setRevokeConfirm(false)
      toast.error(passwordErrorMessage(error, t))
    },
  })

  const boundProviders = new Set(
    (identities.data?.identities ?? [])
      .filter((identity) => identity.kind === 'external')
      .map((identity) => identity.provider),
  )
  const availableProviders = (publicProviders.data?.providers ?? []).filter(
    (provider) => !boundProviders.has(provider.key),
  )

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.length < 8) {
      toast.error(t('passwordMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'))
      return
    }
    passwordMutation.mutate()
  }

  if (me.isPending || !me.data)
    return (
      <StateFade kind="loading" className="text-sm text-muted-foreground">
        {t('securityLoading')}
      </StateFade>
    )
  return (
    <>
      <PageHeader
        title={t('securityTitle')}
        description={t('securityDescription')}
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead icon={KeyRound}>
              <CardTitle className="text-base">
                {hasPassword ? t('changePassword') : t('setPassword')}
              </CardTitle>
              {hasPassword ? null : (
                <CardDescription>{t('setPasswordHint')}</CardDescription>
              )}
            </CardHeaderLead>
          </CardHeader>
          <CardContent>
            <form className="grid max-w-md gap-4" onSubmit={submitPassword}>
              {hasPassword ? (
                <div className="grid gap-2">
                  <Label htmlFor="current-password">
                    {t('currentPassword')}
                  </Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      className="pl-9"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="new-password">{t('newPassword')}</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    className="pl-9"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">
                  {t('confirmNewPassword')}
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-fit"
                disabled={passwordMutation.isPending}
              >
                <Save />
                {hasPassword ? t('updatePassword') : t('setPassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead icon={Fingerprint}>
              <CardTitle className="text-base">{t('loginMethods')}</CardTitle>
            </CardHeaderLead>
            <CardAction className="max-sm:col-start-1 max-sm:col-span-2 max-sm:row-start-2 max-sm:row-span-1 max-sm:justify-self-start">
              <Button
                variant="outline"
                onClick={() => register.mutate()}
                disabled={register.isPending}
              >
                <Fingerprint />
                {t('addPasskey')}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {identities.isPending ? (
              <StateFade
                kind="loading"
                className="text-sm text-muted-foreground"
              >
                {t('loadingLoginMethods')}
              </StateFade>
            ) : identities.data?.identities.length ? (
              <Stagger className="grid gap-2">
                {identities.data.identities.map((identity) => (
                  <StaggerItem key={identity.id}>
                    <div className="flex items-center justify-between rounded-md border px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Mail className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="m-0 truncate text-sm font-medium">
                            {identity.name ||
                              identity.provider ||
                              identity.kind}
                          </p>
                          <p className="m-0 truncate text-xs text-muted-foreground">
                            {t('lastUsed', {
                              value: identity.last_used_at || t('noRecord'),
                            })}
                          </p>
                        </div>
                      </div>
                      {identity.kind === 'passkey' ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('renamePasskey', {
                              name: identity.name || 'passkey',
                            })}
                            onClick={() =>
                              setRenaming({
                                id: identity.id,
                                name: identity.name || '',
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('removePasskey')}
                            onClick={() => remove.mutate(identity.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('noOtherLoginMethods')}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead icon={Link2}>
              <CardTitle className="text-base">
                {t('thirdPartyLogin')}
              </CardTitle>
            </CardHeaderLead>
          </CardHeader>
          <CardContent className="grid gap-4">
            {identities.data?.identities.some(
              (identity) => identity.kind === 'external',
            ) ? (
              <Stagger className="grid gap-2">
                <p className="m-0 text-xs font-medium">{t('boundAccounts')}</p>
                {identities.data.identities
                  .filter((identity) => identity.kind === 'external')
                  .map((identity) => (
                    <StaggerItem key={identity.id}>
                      <div className="flex items-center justify-between rounded-md border px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProviderIcon
                            providerKey={identity.provider ?? ''}
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                          <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium">
                              {identity.provider}
                            </p>
                            <p className="m-0 truncate text-xs text-muted-foreground">
                              {t('lastUsed', {
                                value: identity.last_used_at || t('noRecord'),
                              })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('unbindProvider', {
                            provider: identity.provider,
                          })}
                          onClick={() => setUnbinding(identity.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </StaggerItem>
                  ))}
              </Stagger>
            ) : null}
            {availableProviders.length ? (
              <div className="grid gap-2">
                <p className="m-0 text-xs font-medium">
                  {t('availableAccounts')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableProviders.map((provider) => (
                    <Button
                      key={provider.key}
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={oauthStart.isPending}
                      onClick={() => oauthStart.mutate(provider.key)}
                    >
                      {oauthStart.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <ProviderIcon
                          providerKey={provider.key}
                          className="size-4"
                        />
                      )}
                      {t('bindProvider', { provider: provider.name })}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {identities.data?.identities.some(
                  (identity) => identity.kind === 'external',
                )
                  ? t('noAvailableThirdParty')
                  : t('noConfiguredProviders')}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead
              icon={LogOut}
              iconClassName="bg-destructive/10 text-destructive"
            >
              <CardTitle className="text-base">{t('revokeSessions')}</CardTitle>
              <CardDescription>
                {t('revokeSessionsDescription')}
              </CardDescription>
            </CardHeaderLead>
          </CardHeader>
          <CardContent className="grid gap-3">
            {revokeSessions.isError ? (
              <p
                role="alert"
                className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {passwordErrorMessage(revokeSessions.error, t)}
              </p>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              className="w-fit"
              disabled={revokeSessions.isPending}
              onClick={() => setRevokeConfirm(true)}
            >
              {revokeSessions.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <LogOut />
              )}
              {t('revokeSessions')}
            </Button>
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={!!renaming}
        onOpenChange={(value) => !value && setRenaming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('passkeyRenameTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="passkey-name">{t('name')}</Label>
            <Input
              id="passkey-name"
              maxLength={100}
              value={renaming?.name ?? ''}
              onChange={(event) =>
                setRenaming((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              placeholder={t('nameExample')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              {t('action.cancel', { ns: 'common' })}
            </Button>
            <Button
              disabled={rename.isPending}
              onClick={() => {
                const current = renaming
                if (!current) return
                if (!current.name.trim() || current.name.trim().length > 100) {
                  toast.error(t('nameLength'))
                  return
                }
                rename.mutate({ id: current.id, name: current.name.trim() })
              }}
            >
              {rename.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.save', { ns: 'common' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!unbinding}
        onOpenChange={(value) => !value && setUnbinding(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unbindTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unbindDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unbind.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => unbinding && unbind.mutate(unbinding)}
            >
              {unbind.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('confirmUnbind')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={revokeConfirm}
        onOpenChange={(value) => !value && setRevokeConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revokeSessionsTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('revokeSessionsHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeSessions.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeSessions.mutate()}
            >
              {revokeSessions.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {t('confirmRevokeSessions')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function passwordErrorMessage(error: unknown, t: (key: string) => string) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error && error.message
      ? error.message
      : t('operationFailed')
}

function unbindErrorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError && error.code === 'conflict') {
    return t('cannotRemoveLastLoginMethod')
  }
  return passwordErrorMessage(error, t)
}
