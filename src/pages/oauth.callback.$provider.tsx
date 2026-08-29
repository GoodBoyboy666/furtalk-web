import { getRouteApi, Link, useSearch } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ProviderIcon } from '@/components/provider/ProviderIcon'
import type { ApiError } from '@/lib/api/client'
import { authApi } from '@/lib/api/resources'
import type {
  OAuthCompletePayload,
  OAuthCompleteResponse,
} from '@/lib/api/types'
import { isSafeLocalRedirect } from '@/lib/redirect'

const routeApi = getRouteApi('/oauth/callback/$provider')

// snapshotParams 从路由 search 参数中提取回调载荷，只保留实际出现的字段。
// handoff 与 (state, code, error) 互斥；Apple 经 handoff 透传，其余走直接参数。
function snapshotParams(search: Record<string, unknown>): OAuthCompletePayload {
  const read = (key: string) =>
    typeof search[key] === 'string' ? search[key] : undefined
  const payload: OAuthCompletePayload = {}
  const handoff = read('handoff')
  const state = read('state')
  const code = read('code')
  const error = read('error')
  if (handoff) payload.handoff = handoff
  if (state) payload.state = state
  if (code) payload.code = code
  if (error) payload.error = error
  return payload
}

// scrubCallbackUrl 从 URL 与历史记录中移除回调参数，避免 state/授权码被回放或留存。
function scrubCallbackUrl() {
  if (typeof window === 'undefined') return
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname,
  )
}

// OAuthCallbackPage 处理第三方 OAuth 回调：抓取一次性参数、调用后端完成登录，
// 并展示处理中/成功/失败状态。每次装载只提交一次，避免重复消费授权码。
export function OAuthCallbackPage() {
  const { t } = useTranslation('auth')
  const { provider } = routeApi.useParams()
  const search = useSearch({ strict: false })
  const firedRef = useRef(false)

  const complete = useMutation<
    OAuthCompleteResponse,
    ApiError,
    OAuthCompletePayload
  >({
    mutationFn: (payload: OAuthCompletePayload) =>
      authApi.oauthComplete(provider, payload),
    onSuccess: (data) => {
      const target = isSafeLocalRedirect(data.redirect) ? data.redirect : '/'
      window.location.replace(target)
    },
  })

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    const payload = snapshotParams(search)
    scrubCallbackUrl()
    complete.mutate(payload)
  }, [])

  if (complete.isPending) {
    return (
      <CallbackShell provider={provider}>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t('callbackProcessing')}
          </p>
        </div>
      </CallbackShell>
    )
  }

  if (complete.isSuccess) {
    return (
      <CallbackShell provider={provider}>
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t('callbackRedirecting')}
          </p>
        </div>
      </CallbackShell>
    )
  }

  const error = complete.error
  const detailRedirect = error?.details?.redirect
  const failureTarget = isSafeLocalRedirect(String(detailRedirect ?? ''))
    ? String(detailRedirect)
    : '/login'

  return (
    <CallbackShell provider={provider}>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium">{t('callbackFailed')}</p>
          <p className="text-sm text-muted-foreground">
            {error?.message ?? t('callbackGenericError')}
          </p>
          {error?.requestId ? (
            <p className="text-xs text-muted-foreground">
              {t('callbackRequestId', { requestId: error.requestId })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {t('callbackGoToLogin')}
          </Link>
          <Link to={failureTarget} className={buttonVariants({ size: 'sm' })}>
            {t('callbackReturn')}
          </Link>
        </div>
      </div>
    </CallbackShell>
  )
}

// CallbackShell 提供回调页的卡片布局与提供商标识。
function CallbackShell({
  provider,
  children,
}: {
  provider: string
  children: React.ReactNode
}) {
  const { t } = useTranslation('auth')
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ProviderIcon providerKey={provider} className="h-8 w-8" />
            <div>
              <CardTitle>{t('callbackTitle')}</CardTitle>
              <CardDescription>{provider}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
