import {
  Link,
  createFileRoute,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound,
  Loader2,
  Mail,
  Send,
  Shield,
  Fingerprint,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CaptchaDialog } from '@/components/CaptchaDialog'
import { authApi, captchaApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'
import { resolvePostLoginTarget } from '@/lib/redirect'
import {
  isPasskeySupported,
  prepareCredentialRequestOptions,
  serializeCredential,
} from '@/lib/passkey'
import {
  emailHintFromPending,
  readPendingAuthorizationFromRedirect,
  safeSessionStorage,
} from '@/lib/authorize'
import {
  createOtpRecord,
  safeOtpSessionStorage,
  writeOtpRecord,
} from '@/lib/otp'

// 两个登录方式的 CAPTCHA 业务 action，与后端策略键一致。
const passwordLoginAction = 'password_login'
const emailCodeAction = 'email_code'

// readRedirectParam 从路由 search 参数中读取显式业务回跳地址。
function readRedirectParam(
  search: Record<string, unknown>,
): string | undefined {
  return typeof search.redirect === 'string' ? search.redirect : undefined
}

// readAuthorizeMarker 判断是否处于 Widget 授权 popup 流程（authorize=1）。
function readAuthorizeMarker(search: Record<string, unknown>): boolean {
  return search.authorize === '1'
}

// readOtpExpiredMarker 读取 OTP 路由返回的过期 marker（?otp=expired）。
function readOtpExpiredMarker(search: Record<string, unknown>): boolean {
  return search.otp === 'expired'
}

// readLoginEmailHint 从 popup 自己的 sessionStorage 读取与回跳 /authorize 对应的
// pending 记录，返回邮箱预填。邮箱提示只用于预填登录表单，绝不进入 URL 或资料写入。
function readLoginEmailHint(redirect: string | undefined): string {
  const record = readPendingAuthorizationFromRedirect(
    safeSessionStorage(),
    redirect ?? '',
  )
  return emailHintFromPending(record)
}

// LoginPage 是登录页组件，供测试与路由直接使用。
export function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = useSearch({ strict: false })
  const redirect = readRedirectParam(search)
  const authorizeFlow = readAuthorizeMarker(search)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // OTP 路由返回的过期 marker：仅在 ?otp=expired 时展示一次性提示，交互后清除。
  const [showOtpExpired, setShowOtpExpired] = useState(
    readOtpExpiredMarker(search),
  )
  const captchaConfig = useQuery({
    queryKey: ['captcha-config', passwordLoginAction],
    queryFn: () => captchaApi.config(passwordLoginAction),
  })
  const captcha = captchaConfig.data?.required
    ? captchaConfig.data.captcha
    : null
  const required = captcha != null

  // 密码登录与邮箱发送各自持有独立的对话框状态与一次性 pending 回调，
  // 保证 token 与待提交回调不会跨 action 串用；对话框关闭即丢弃。
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const pendingPasswordRef = useRef<((token: string) => void) | null>(null)

  // 邮箱验证码登录：发送成功后跳转独立 OTP 路由，登录阶段不再留在本页。
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const pendingSendRef = useRef<((token: string) => void) | null>(null)
  const sendCaptchaConfig = useQuery({
    queryKey: ['captcha-config', emailCodeAction],
    queryFn: () => captchaApi.config(emailCodeAction),
  })
  const sendCaptcha = sendCaptchaConfig.data?.required
    ? sendCaptchaConfig.data.captcha
    : null
  const sendRequired = sendCaptcha != null

  // 授权 popup 流程：从 sessionStorage 恢复邮箱预填（绝不放进 URL）。
  // 只预填一次，用户清空后不会重新填入。
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (!authorizeFlow || prefilledRef.current) return
    const emailHint = readLoginEmailHint(redirect)
    if (emailHint) {
      prefilledRef.current = true
      setEmail(emailHint)
    }
  }, [authorizeFlow, redirect])

  // completeLogin 在 Cookie 写入后刷新 /me，并按角色进入默认区域或显式安全回跳。
  // 授权流程的 redirect 指向 /authorize?…，pending 记录一直留在 sessionStorage。
  async function completeLogin() {
    const me = await queryClient.fetchQuery({
      queryKey: ['me'],
      queryFn: authApi.me,
    })
    void navigate({ href: resolvePostLoginTarget(me.role, redirect) })
  }

  const passwordLogin = useMutation({
    mutationFn: authApi.passwordLogin,
    onSuccess: () => void completeLogin(),
    onError: (cause) => {
      if (required) {
        void captchaConfig.refetch()
      }
      setError(
        cause instanceof ApiError ? cause.message : t('loginFailedGeneric'),
      )
    },
  })
  const passkeyLogin = useMutation({
    mutationFn: async () => {
      const options = await authApi.passkeyOptions(email || undefined)
      const credential = await navigator.credentials.get(
        prepareCredentialRequestOptions(options.options),
      )
      if (!credential) throw new Error(t('passkeyNotSelected'))
      return authApi.passkeyVerify({
        challenge: options.challenge,
        response: serializeCredential(credential as PublicKeyCredential),
      })
    },
    onSuccess: () => void completeLogin(),
  })
  const sendEmailCode = useMutation({
    mutationFn: (args: { email: string; token?: string }) =>
      authApi.emailCodeSend({
        email: args.email,
        captcha_token: args.token,
      }),
    onSuccess: (_data, args) => {
      // 发送成功：把待登录上下文写入 sessionStorage 并跳转独立 OTP 路由。
      // 记录始终使用实际发送的邮箱，安全回跳与授权 marker 一并携带；邮箱不进 URL。
      writeOtpRecord(
        safeOtpSessionStorage(),
        createOtpRecord({
          email: args.email,
          redirect,
          authorize: authorizeFlow,
        }),
      )
      void navigate({ to: '/login/otp' })
      setError('')
    },
    onError: (cause) => {
      if (sendRequired) {
        void sendCaptchaConfig.refetch()
      }
      setError(cause instanceof ApiError ? cause.message : t('sendCodeFailed'))
    },
  })
  const publicProviders = useQuery({
    queryKey: ['auth-providers'],
    queryFn: authApi.providers,
  })
  const oauthStart = useMutation({
    mutationFn: async (key: string) => {
      const start = await authApi.oauthStart(key, 'login', redirect)
      // 同窗口导航到授权页；授权成功后由后端回调跳回业务回跳地址。
      window.location.href = start.auth_url
    },
    onError: (cause) =>
      setError(
        cause instanceof ApiError ? cause.message : t('providerUnavailable'),
      ),
  })

  // 每个 action 的对话框取消时丢弃 pending，避免一次取消后误提交。
  function handlePasswordDialogChange(open: boolean) {
    setPasswordDialogOpen(open)
    if (!open) {
      pendingPasswordRef.current = null
    }
  }
  function handlePasswordSolved(token: string) {
    setPasswordDialogOpen(false)
    const run = pendingPasswordRef.current
    pendingPasswordRef.current = null
    run?.(token)
  }
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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setShowOtpExpired(false)
    if (busy) return
    if (required) {
      pendingPasswordRef.current = (token) => {
        passwordLogin.mutate({ email, password, captcha_token: token })
      }
      setPasswordDialogOpen(true)
      return
    }
    passwordLogin.mutate({ email, password, captcha_token: undefined })
  }
  function usePasskey() {
    setError('')
    if (!isPasskeySupported()) {
      setError(t('passkeyUnsupported'))
      return
    }
    passkeyLogin.mutate(undefined, {
      onError: (cause) =>
        setError(
          cause instanceof ApiError ? cause.message : t('passkeyFailed'),
        ),
    })
  }
  // updateEmail 同时清除 OTP 过期提示：用户重新编辑邮箱即视为开始新会话。
  function updateEmail(value: string) {
    setEmail(value)
    setShowOtpExpired(false)
  }
  const busy =
    passwordLogin.isPending || passkeyLogin.isPending || sendEmailCode.isPending
  const passwordDisabled = busy
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <FadeIn className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="size-5" />
          </div>
          <div>
            <p className="m-0 text-lg font-semibold">
              {t('app.name', { ns: 'common' })}
            </p>
            <p className="m-0 text-xs text-muted-foreground">
              {authorizeFlow ? t('authorizeSubtitle') : t('brandSubtitle')}
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {showOtpExpired ? (
              <p className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                {t('otpSessionExpired')}
              </p>
            ) : null}
            {error ? (
              <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Tabs defaultValue="email-code">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email-code">
                  {t('emailCodeTab')}
                </TabsTrigger>
                <TabsTrigger value="password">
                  {t('passwordLoginTab')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="email-code">
                <div className="grid gap-4 pt-3">
                  <div className="grid gap-2">
                    <Label htmlFor="email-code-email">{t('email')}</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="email-code-email"
                        type="email"
                        autoComplete="email"
                        className="pl-9"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(event) => updateEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sendEmailCode.isPending}
                    onClick={() => {
                      setError('')
                      setShowOtpExpired(false)
                      if (!email) {
                        setError(t('emailRequired'))
                        return
                      }
                      if (sendRequired) {
                        pendingSendRef.current = (token) => {
                          sendEmailCode.mutate({ email, token })
                        }
                        setSendDialogOpen(true)
                        return
                      }
                      sendEmailCode.mutate({ email, token: undefined })
                    }}
                  >
                    {sendEmailCode.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Send />
                    )}
                    {t('sendCode')}
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="password">
                <form className="grid gap-4 pt-3" onSubmit={submit}>
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t('email')}</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        className="pl-9"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(event) => updateEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{t('password')}</Label>
                    </div>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        className="pl-9"
                        placeholder={t('passwordPlaceholder')}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </div>
                    <div className="flex justify-end">
                      <Link
                        to="/reset-password"
                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        {t('forgotPassword')}
                      </Link>
                    </div>
                  </div>
                  <Button type="submit" disabled={passwordDisabled}>
                    {passwordLogin.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : null}
                    {t('passwordLogin')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="my-5 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {t('orUseOtherMethod')}
              </span>
              <Separator className="flex-1" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={usePasskey}
            >
              {passkeyLogin.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Fingerprint />
              )}
              {t('passkey')}
            </Button>
            {publicProviders.data?.providers.length ? (
              <>
                <div className="my-5 flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {t('thirdPartyLogin')}
                  </span>
                  <Separator className="flex-1" />
                </div>
                <div className="grid gap-2">
                  {publicProviders.data.providers.map((provider) => (
                    <Button
                      key={provider.key}
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={busy || oauthStart.isPending}
                      onClick={() => oauthStart.mutate(provider.key)}
                    >
                      {oauthStart.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : null}
                      {t('providerLogin', { provider: provider.name })}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {t('loginNotice')}
        </p>
      </FadeIn>
      <CaptchaDialog
        open={passwordDialogOpen}
        onOpenChange={handlePasswordDialogChange}
        config={captcha}
        action={passwordLoginAction}
        title={t('captchaDialogTitle')}
        description={t('captchaDialogPasswordHint')}
        onSolved={handlePasswordSolved}
        onError={(message) => setError(message)}
      />
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
    </main>
  )
}

// Route 是登录页索引路由（/login）。
export const Route = createFileRoute('/login/')({ component: LoginPage })
