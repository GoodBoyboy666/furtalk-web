import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound, Loader2, Mail, RotateCcw, Shield, User } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FadeIn } from '@/components/motion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bootstrapApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'

// minPasswordLength 与后端密码策略保持一致，服务端仍是最终权威。
const minPasswordLength = 8

// SetupForm 是首次初始化表单的状态。
function SetupForm() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [setupToken, setSetupToken] = useState('')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const createAdmin = useMutation({
    mutationFn: bootstrapApi.createAdmin,
    onSuccess: () => {
      // 成功即清空敏感表单状态，避免残留在组件树中。
      setSetupToken('')
      setEmail('')
      setNickname('')
      setPassword('')
      setConfirm('')
      void navigate({ to: '/login' })
    },
    onError: (cause) => {
      if (cause instanceof ApiError && cause.code === 'bootstrap_unavailable') {
        setUnavailable(true)
        setSubmitError('')
        return
      }
      setSubmitError(
        cause instanceof ApiError ? cause.message : t('setupFailedGeneric'),
      )
    },
  })

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!setupToken.trim()) errors.setupToken = t('setupTokenRequired')
    if (!email.trim()) {
      errors.email = t('adminEmailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t('adminEmailInvalid')
    }
    if (!nickname.trim()) errors.nickname = t('adminNicknameRequired')
    if (!password) {
      errors.password = t('passwordRequired')
    } else if (password.length < minPasswordLength) {
      errors.password = t('passwordMinLength', { minPasswordLength })
    }
    if (confirm !== password) errors.confirm = t('confirmMismatch')
    return errors
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    setUnavailable(false)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    createAdmin.mutate({
      setup_token: setupToken.trim(),
      email: email.trim(),
      nickname: nickname.trim(),
      password,
    })
  }

  if (unavailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('setupUnavailableTitle')}</CardTitle>
          <CardDescription>{t('setupUnavailableDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setUnavailable(false)
              setSubmitError('')
            }}
          >
            <RotateCcw />
            {t('refill')}
          </Button>
          <Link to="/login" className={buttonVariants({ variant: 'ghost' })}>
            {t('goToLogin')}
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setupTitle')}</CardTitle>
        <CardDescription>{t('setupDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* noValidate：自定义校验负责必填/邮箱/密码长度/确认一致，避免原生 HTML5
            校验在无效邮箱等场景静默拦截 submit 事件。 */}
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <div className="grid gap-2">
            <Label htmlFor="setup-token">{t('setupToken')}</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="setup-token"
                type="password"
                autoComplete="off"
                className="pl-9"
                placeholder={t('setupTokenPlaceholder')}
                value={setupToken}
                onChange={(event) => setSetupToken(event.target.value)}
              />
            </div>
            {fieldErrors.setupToken ? (
              <p className="m-0 text-xs text-destructive">
                {fieldErrors.setupToken}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t('adminEmail')}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="pl-9"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {fieldErrors.email ? (
              <p className="m-0 text-xs text-destructive">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nickname">{t('adminNickname')}</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="nickname"
                autoComplete="nickname"
                className="pl-9"
                placeholder={t('adminNicknamePlaceholder')}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </div>
            {fieldErrors.nickname ? (
              <p className="m-0 text-xs text-destructive">
                {fieldErrors.nickname}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t('passwordPlaceholderMin', { minPasswordLength })}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {fieldErrors.password ? (
              <p className="m-0 text-xs text-destructive">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">{t('setupConfirmPassword')}</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder={t('confirmPlaceholder')}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            {fieldErrors.confirm ? (
              <p className="m-0 text-xs text-destructive">
                {fieldErrors.confirm}
              </p>
            ) : null}
          </div>
          {submitError ? (
            <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}
          <Button type="submit" disabled={createAdmin.isPending}>
            {createAdmin.isPending ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {t('createAdminAndFinish')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// SetupPage 是首次运行的手动初始化页面。
export function SetupPage() {
  const { t } = useTranslation('auth')
  const status = useQuery({
    queryKey: ['bootstrap-status'],
    queryFn: bootstrapApi.status,
    retry: false,
  })

  return (
    <main className="relative flex min-h-screen items-center justify-center ambient-auth-bg bg-background/80 px-4 py-12">
      <FadeIn className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Shield className="size-5.5" />
          </div>
          <div>
            <p className="m-0 text-xl font-bold tracking-tight">
              {t('app.name', { ns: 'common' })}
            </p>
            <p className="m-0 text-xs font-medium text-muted-foreground">
              {t('setupSubtitle')}
            </p>
          </div>
        </div>
        {status.isPending ? (
          <Card className="border-border/80 bg-card/95 shadow-md backdrop-blur-sm">
            <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" />
              {t('checkingStatus')}
            </CardContent>
          </Card>
        ) : status.isError ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('cannotConnectTitle')}</CardTitle>
              <CardDescription>{t('cannotConnectDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => void status.refetch()}>
                <RotateCcw />
                {t('action.retry', { ns: 'common' })}
              </Button>
            </CardContent>
          </Card>
        ) : status.data.required ? (
          <SetupForm />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('alreadyInitializedTitle')}</CardTitle>
              <CardDescription>
                {t('alreadyInitializedDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/login"
                className={buttonVariants({ variant: 'default' })}
              >
                {t('goToLogin')}
              </Link>
            </CardContent>
          </Card>
        )}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {t('tokenNotice')}
        </p>
      </FadeIn>
    </main>
  )
}

// Route 是首次初始化路由，由用户手动访问 /setup。
export const Route = createFileRoute('/setup')({ component: SetupPage })
