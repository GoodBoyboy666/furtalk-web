import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { KeyRound, Loader2, Mail } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FadeIn } from '@/components/motion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CaptchaDialog } from '@/components/CaptchaDialog'
import { BrandMark } from '@/components/BrandMark'
import { authApi, captchaApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'

// passwordResetAction 是密码重置请求验证码的 CAPTCHA 业务 action，与后端策略键一致。
const passwordResetAction = 'password_reset'

// readEmailParam 从路由 search 参数中读取可选的预填邮箱。
function readEmailParam(search: Record<string, unknown>): string {
  return typeof search.email === 'string' ? search.email : ''
}

// ResetPasswordPage 是公开的密码重置页，覆盖请求验证码与提交新密码两个阶段。
// 请求阶段对已知/未知邮箱返回相同的通用文案，绝不暗示地址是否存在。
export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const [email, setEmail] = useState(readEmailParam(search))
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [stage, setStage] = useState<'request' | 'confirm' | 'done'>('request')
  const [error, setError] = useState('')
  // 请求验证码阶段的对话框与一次性 pending 回调；关闭即丢弃。
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const pendingRequestRef = useRef<((token: string) => void) | null>(null)
  const captchaConfig = useQuery({
    queryKey: ['captcha-config', passwordResetAction],
    queryFn: () => captchaApi.config(passwordResetAction),
  })
  const captcha = captchaConfig.data?.required
    ? captchaConfig.data.captcha
    : null
  const required = captcha != null

  const requestCode = useMutation({
    mutationFn: authApi.passwordResetCode,
    onSuccess: () => {
      setStage('confirm')
      setError('')
    },
    onError: (cause) => {
      if (required) {
        void captchaConfig.refetch()
      }
      setError(cause instanceof ApiError ? cause.message : t('resetSendFailed'))
    },
  })

  const confirmReset = useMutation({
    mutationFn: authApi.passwordResetConfirm,
    onSuccess: () => {
      setStage('done')
      setError('')
    },
    onError: (cause) =>
      setError(
        cause instanceof ApiError ? cause.message : t('resetConfirmFailed'),
      ),
  })

  function handleRequestDialogChange(open: boolean) {
    setRequestDialogOpen(open)
    if (!open) {
      pendingRequestRef.current = null
    }
  }
  function handleRequestSolved(token: string) {
    setRequestDialogOpen(false)
    const run = pendingRequestRef.current
    pendingRequestRef.current = null
    run?.(token)
  }

  function request(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (required) {
      pendingRequestRef.current = (token) => {
        requestCode.mutate({ email, captcha_token: token })
      }
      setRequestDialogOpen(true)
      return
    }
    requestCode.mutate({ email, captcha_token: undefined })
  }

  function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }
    confirmReset.mutate({ email, code, new_password: newPassword })
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center ambient-auth-bg bg-background/80 px-4 py-12">
      <FadeIn className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <BrandMark className="size-5.5" />
          </div>
          <div>
            <p className="m-0 text-xl font-bold tracking-tight">
              {t('app.name', { ns: 'common' })}
            </p>
            <p className="m-0 text-xs font-medium text-muted-foreground">
              {t('resetSubtitle')}
            </p>
          </div>
        </div>
        <Card className="border-border/80 bg-card/95 shadow-md backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {t('resetTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stage === 'request' ? (
              <form className="grid gap-4" onSubmit={request}>
                <div className="grid gap-2">
                  <Label htmlFor="reset-email">{t('email')}</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      className="pl-9"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>
                {error ? (
                  <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={requestCode.isPending}>
                  {requestCode.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {t('sendCode')}
                </Button>
              </form>
            ) : null}
            {stage === 'confirm' ? (
              <form className="grid gap-4" onSubmit={confirm}>
                <div className="grid gap-2">
                  <Label htmlFor="reset-code">{t('code')}</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reset-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="pl-9"
                      placeholder={t('codePlaceholder')}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reset-password">{t('newPassword')}</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reset-password"
                      type="password"
                      autoComplete="new-password"
                      className="pl-9"
                      placeholder={t('newPasswordPlaceholder')}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reset-confirm">{t('confirmPassword')}</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="reset-confirm"
                      type="password"
                      autoComplete="new-password"
                      className="pl-9"
                      placeholder={t('confirmPasswordPlaceholder')}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                    />
                  </div>
                </div>
                {error ? (
                  <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={confirmReset.isPending}>
                  {confirmReset.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {t('resetConfirm')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStage('request')
                    setCode('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setError('')
                  }}
                >
                  {t('sendCodeAgain')}
                </Button>
              </form>
            ) : null}
            {stage === 'done' ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                  {t('resetSuccess')}
                </p>
                <Button onClick={() => void navigate({ to: '/login' })}>
                  {t('backToLogin')}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </FadeIn>
      <CaptchaDialog
        open={requestDialogOpen}
        onOpenChange={handleRequestDialogChange}
        config={captcha}
        action={passwordResetAction}
        title={t('captchaDialogTitle')}
        description={t('captchaDialogResetHint')}
        onSolved={handleRequestSolved}
        onError={(message) => setError(message)}
      />
    </main>
  )
}
