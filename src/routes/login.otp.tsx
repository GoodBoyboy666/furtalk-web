import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Mail, RotateCcw, Shield } from 'lucide-react'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FadeIn } from '@/components/motion'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CaptchaDialog } from '@/components/CaptchaDialog'
import { authApi, captchaApi } from '@/lib/api/resources'
import * as apiResources from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'
import { resolvePostLoginTarget } from '@/lib/redirect'
import {
  clearOtpRecord,
  readOtpRecord,
  refreshOtpExpiry,
  safeOtpSessionStorage,
  writeOtpRecord,
  maskEmail,
} from '@/lib/otp'
import type { PendingOtpLogin } from '@/lib/otp'
import { defaultPublicConfig, publicConfigQueryKey } from '@/lib/public-config'
import { useLegalConsent } from '@/lib/legal-consent'

// 两个独立 CAPTCHA 业务 action：发送验证码与验证码登录，与后端策略键一致。
// 各自持有独立的 config 查询、对话框与一次性 pending 回调，token 绝不跨 action 串用。
const emailCodeAction = 'email_code'
const emailCodeLoginAction = 'email_code_login'

// LoginOtpPage 是邮箱验证码登录的独立 OTP 路由。
// 邮箱只来自 sessionStorage 中的 pending 记录，绝不出现在 URL 或 payload 之外；
// 验证码与 CAPTCHA token 只存在于组件 state，成功或卸载后即清空。
export function LoginOtpPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // 挂载时读取一次 pending 记录；缺失/损坏/过期由 readOtpRecord 自清并返回 null。
  const [record, setRecord] = useState<PendingOtpLogin | null>(() =>
    readOtpRecord(safeOtpSessionStorage()),
  )
  const hasPublicConfigApi = 'publicConfigApi' in apiResources
  const publicConfig = useQuery({
    queryKey: publicConfigQueryKey,
    queryFn: () => {
      if (!hasPublicConfigApi) return Promise.resolve(defaultPublicConfig)
      return apiResources.publicConfigApi.get()
    },
    retry: false,
    ...(hasPublicConfigApi ? {} : { initialData: defaultPublicConfig }),
  })
  const legalConsent = useLegalConsent(
    publicConfig.data,
    hasPublicConfigApi ? publicConfig.isSuccess : true,
  )
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [resendState, setResendState] = useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle')
  // 发送与验证各有一个独立对话框与一次性 pending 回调，关闭即丢弃。
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const pendingSendRef = useRef<((token: string) => void) | null>(null)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const pendingLoginRef = useRef<((token: string) => void) | null>(null)
  // 无有效记录时只回跳一次，避免 effect 反复触发。
  const redirectedRef = useRef(false)

  const sendCaptchaConfig = useQuery({
    queryKey: ['captcha-config', emailCodeAction],
    queryFn: () => captchaApi.config(emailCodeAction),
  })
  const sendCaptcha = sendCaptchaConfig.data?.required
    ? sendCaptchaConfig.data.captcha
    : null
  const sendRequired = sendCaptcha != null
  const loginCaptchaConfig = useQuery({
    queryKey: ['captcha-config', emailCodeLoginAction],
    queryFn: () => captchaApi.config(emailCodeLoginAction),
  })
  const loginCaptcha = loginCaptchaConfig.data?.required
    ? loginCaptchaConfig.data.captcha
    : null
  const loginRequired = loginCaptcha != null

  // 无有效记录：清除后安全返回登录页并带非敏感过期 marker，不展示任何邮箱。
  useEffect(() => {
    if (record || redirectedRef.current) return
    redirectedRef.current = true
    void navigate({ to: '/login', search: { otp: 'expired' } })
  }, [record, navigate])

  const email = record?.email ?? ''

  // completeLogin 在 Cookie 写入后刷新 /me，并按角色进入默认区域或记录中的安全回跳。
  // 授权流程的 redirect 指向 /authorize?…，authorize pending 记录由 lib/authorize.ts
  // 独立管理，一直留在 popup sessionStorage。
  async function completeLogin() {
    const me = await queryClient.fetchQuery({
      queryKey: ['me'],
      queryFn: authApi.me,
    })
    void navigate({ href: resolvePostLoginTarget(me.role, record?.redirect) })
  }

  const sendEmailCode = useMutation({
    mutationFn: (args: { email: string; token?: string }) =>
      authApi.emailCodeSend({
        email: args.email,
        captcha_token: args.token,
      }),
    onSuccess: () => {
      // 重新发送成功：刷新 5 分钟有效期并重写记录，清空验证码与错误。
      if (record) {
        const refreshed = refreshOtpExpiry(record)
        writeOtpRecord(safeOtpSessionStorage(), refreshed)
        setRecord(refreshed)
      }
      setCode('')
      setError('')
      setResendState('success')
    },
    onError: (cause) => {
      if (sendRequired) {
        void sendCaptchaConfig.refetch()
      }
      setResendState('error')
      setError(cause instanceof ApiError ? cause.message : t('otpResendFailed'))
    },
  })

  const emailCodeLogin = useMutation({
    mutationFn: (args: { email: string; code: string; token?: string }) =>
      authApi.emailCodeLogin({
        email: args.email,
        code: args.code,
        captcha_token: args.token,
      }),
    onSuccess: () => {
      // 登录成功：删除 pending 记录后再刷新 /me 并回跳。
      clearOtpRecord(safeOtpSessionStorage())
      void completeLogin()
    },
    onError: (cause) => {
      if (loginRequired) {
        void loginCaptchaConfig.refetch()
      }
      setError(cause instanceof ApiError ? cause.message : t('loginFailedCode'))
    },
  })

  function handleSendDialogChange(open: boolean) {
    setSendDialogOpen(open)
    if (!open) {
      pendingSendRef.current = null
    }
  }
  function handleSendSolved(token: string) {
    setSendDialogOpen(false)
    const run = pendingSendRef.current
    pendingSendRef.current = null
    run?.(token)
  }
  function handleLoginDialogChange(open: boolean) {
    setLoginDialogOpen(open)
    if (!open) {
      pendingLoginRef.current = null
    }
  }
  function handleLoginSolved(token: string) {
    setLoginDialogOpen(false)
    const run = pendingLoginRef.current
    pendingLoginRef.current = null
    run?.(token)
  }

  // verify 仅在六位验证码齐全后可用；email_code_login required 时先过对话框。
  function verify() {
    setError('')
    if (!legalConsent.canProceed) return
    if (loginRequired) {
      pendingLoginRef.current = (token) => {
        emailCodeLogin.mutate({ email, code, token })
      }
      setLoginDialogOpen(true)
      return
    }
    emailCodeLogin.mutate({ email, code, token: undefined })
  }

  // resend 使用独立的 email_code action；成功后刷新有效期。不发明后端不存在的
  // 客户端冷却期，只有请求 pending 期间禁用按钮。
  function resend() {
    setError('')
    if (!legalConsent.canProceed) return
    if (sendRequired) {
      pendingSendRef.current = (token) => {
        setResendState('pending')
        sendEmailCode.mutate({ email, token })
      }
      setSendDialogOpen(true)
      return
    }
    setResendState('pending')
    sendEmailCode.mutate({ email, token: undefined })
  }

  // changeEmail 只删除 OTP 记录并返回登录页；记录中的安全回跳与授权 marker
  // 原样带回（两者独立存在），邮箱绝不进入 URL。
  function changeEmail() {
    clearOtpRecord(safeOtpSessionStorage())
    const search: Record<string, unknown> = {}
    if (record?.authorize) {
      search.authorize = '1'
    }
    if (record?.redirect) {
      search.redirect = record.redirect
    }
    void navigate({ to: '/login', search })
  }

  // 无有效记录时等待回跳，仅渲染稳定 loading 态。
  if (!record) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const resendPending = resendState === 'pending' || sendEmailCode.isPending
  const legalLinks = [
    publicConfig.data?.user_agreement_url
      ? {
          label: t('userAgreement'),
          href: publicConfig.data.user_agreement_url,
        }
      : null,
    publicConfig.data?.privacy_policy_url
      ? {
          label: t('privacyPolicy'),
          href: publicConfig.data.privacy_policy_url,
        }
      : null,
  ].filter((link): link is { label: string; href: string } => link !== null)
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
              {t('otpSubtitle')}
            </p>
          </div>
        </div>
        <Card className="border-border/80 bg-card/95 shadow-md backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {t('otpTitle')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('otpDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="grid gap-1">
                <p className="m-0 text-sm text-muted-foreground">
                  {t('otpCodeSentTo', { email: maskEmail(record.email) })}
                </p>
                <p className="m-0 text-xs text-muted-foreground">
                  {t('otpValidMinutes')}
                </p>
              </div>
              {error ? (
                <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              {publicConfig.isError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="m-0">{t('publicConfigLoadFailed')}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-destructive"
                    onClick={() => void publicConfig.refetch()}
                  >
                    {t('retryConfig')}
                  </Button>
                </div>
              ) : null}
              {legalLinks.length > 0 ? (
                <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/30 p-3 text-xs">
                  <Checkbox
                    id="otp-legal-consent"
                    checked={legalConsent.accepted}
                    disabled={!publicConfig.isSuccess}
                    onCheckedChange={(checked) =>
                      legalConsent.setAccepted(checked === true)
                    }
                  />
                  <Label
                    htmlFor="otp-legal-consent"
                    className="cursor-pointer font-normal leading-5"
                  >
                    {t('legalConsentPrefix')}{' '}
                    {legalLinks.map((link, index) => (
                      <span key={link.href}>
                        {index > 0 ? ` ${t('legalConsentAnd')} ` : null}
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {link.label}
                        </a>
                      </span>
                    ))}
                  </Label>
                </div>
              ) : null}
              {resendState === 'success' ? (
                <p className="m-0 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                  {t('otpResent')}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="otp-code">{t('code')}</Label>
                <div className="flex justify-center py-2">
                  <InputOTP
                    id="otp-code"
                    maxLength={6}
                    value={code}
                    onChange={(value) => setCode(value)}
                    inputMode="numeric"
                    pattern={REGEXP_ONLY_DIGITS}
                    autoComplete="one-time-code"
                    aria-invalid={error ? 'true' : undefined}
                    containerClassName="gap-2 sm:gap-3"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={0}
                        className="size-11 text-lg font-semibold sm:size-12"
                      />
                      <InputOTPSlot
                        index={1}
                        className="size-11 text-lg font-semibold sm:size-12"
                      />
                      <InputOTPSlot
                        index={2}
                        className="size-11 text-lg font-semibold sm:size-12"
                      />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={3}
                        className="size-11 text-lg font-semibold sm:size-12"
                      />
                      <InputOTPSlot
                        index={4}
                        className="size-11 text-lg font-semibold sm:size-12"
                      />
                      <InputOTPSlot
                        index={5}
                        className="size-11 text-lg font-semibold sm:size-12"
                      />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={
                  !legalConsent.canProceed ||
                  emailCodeLogin.isPending ||
                  code.length !== 6
                }
                onClick={verify}
              >
                {emailCodeLogin.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Mail />
                )}
                {t('otpVerify')}
              </Button>
              <div className="flex items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  disabled={resendPending || !legalConsent.canProceed}
                  onClick={resend}
                >
                  {sendEmailCode.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RotateCcw />
                  )}
                  {resendPending ? t('otpResending') : t('otpResend')}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  disabled={resendPending || emailCodeLogin.isPending}
                  onClick={changeEmail}
                >
                  {t('otpChangeEmail')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
      <CaptchaDialog
        open={sendDialogOpen}
        onOpenChange={handleSendDialogChange}
        config={sendCaptcha}
        action={emailCodeAction}
        title={t('captchaDialogTitle')}
        description={t('captchaDialogSendHint')}
        onSolved={handleSendSolved}
        onError={(message) => setError(message)}
      />
      <CaptchaDialog
        open={loginDialogOpen}
        onOpenChange={handleLoginDialogChange}
        config={loginCaptcha}
        action={emailCodeLoginAction}
        title={t('captchaDialogTitle')}
        description={t('captchaDialogCodeLoginHint')}
        onSolved={handleLoginSolved}
        onError={(message) => setError(message)}
      />
    </main>
  )
}

// Route 是邮箱验证码登录的独立 OTP 路由。
export const Route = createFileRoute('/login/otp')({
  component: LoginOtpPage,
})
