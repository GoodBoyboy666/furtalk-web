import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { Globe, Loader2, Shield, X } from 'lucide-react'
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
import { authorizationApi } from '@/lib/api/resources'
import { ApiError, isUnauthorized } from '@/lib/api/client'
import type { AuthorizationContext } from '@/lib/api/types'
import {
  acceptAuthorizationInit,
  clearPendingAuthorization,
  createPendingAuthorization,
  parseRequestId,
  parseSiteId,
  readPendingAuthorization,
  safeSessionStorage,
  sendAuthorizationMessage,
  writePendingAuthorization,
} from '@/lib/authorize'

// authorizeLoginRedirect 构造登录页回跳：只携带授权 marker 与本地 /authorize 回跳。
// 邮箱提示只作为登录预填，始终留在 popup 自己的 sessionStorage，绝不进入 URL。
export function authorizeLoginRedirect(
  siteId: string,
  requestId: string,
): string {
  return `/authorize?site_id=${siteId}&request_id=${encodeURIComponent(requestId)}`
}

// AuthorizePage 是 Widget 授权 popup 的第一方页面。
// 它只接受来自 window.opener 且 request_id 匹配的初始化握手，以浏览器提供的
// MessageEvent.origin 作为嵌入方 Origin；仅在用户显式点击「授权」后颁发授权码，
// 并通过精确 targetOrigin 的 postMessage 把 {code, request_id} 回传给 opener。
export function AuthorizePage() {
  const { t } = useTranslation('authorize')
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const siteId = parseSiteId(search.site_id)
  const requestId = parseRequestId(search.request_id)
  const [fatal, setFatal] = useState<string | null>(null)
  const [embeddingOrigin, setEmbeddingOrigin] = useState<string | null>(null)
  const [context, setContext] = useState<AuthorizationContext | null>(null)
  const [contextError, setContextError] = useState<string | null>(null)
  const [issueError, setIssueError] = useState<string | null>(null)
  const openerRef = useRef<Window | null>(null)

  // 打开时校验 URL 参数与可用的 window.opener；缺失即进入不可恢复错误态。
  useEffect(() => {
    if (!siteId || !requestId) {
      setFatal(t('invalidParams'))
      return
    }
    if (!window.opener) {
      setFatal(t('needsOpener'))
      return
    }
    openerRef.current = window.opener
  }, [siteId, requestId, t])

  // 恢复或完成握手：登录返回时从 sessionStorage 恢复 pending 记录；
  // 新 popup 则监听 opener 的 authorization-init 消息并只接受匹配来源/ID。
  useEffect(() => {
    if (fatal || !siteId || !requestId) return
    // 捕获已收窄的常量，供消息回调安全使用。
    const safeSiteId = siteId
    const safeRequestId = requestId
    const opener = openerRef.current
    if (!opener) return

    const storage = safeSessionStorage()
    const existing = readPendingAuthorization(storage, safeRequestId)
    if (existing) {
      setEmbeddingOrigin(existing.embedding_origin)
      sendAuthorizationMessage(opener, existing.embedding_origin, {
        type: 'furtalk:authorization-ready',
        request_id: safeRequestId,
      })
      return
    }

    function onMessage(event: MessageEvent) {
      const decoded = acceptAuthorizationInit(event, safeRequestId, opener)
      if (!decoded) return
      window.removeEventListener('message', onMessage)
      const record = createPendingAuthorization({
        site_id: safeSiteId,
        request_id: safeRequestId,
        embedding_origin: decoded.origin,
        email: decoded.email,
      })
      writePendingAuthorization(storage, record)
      setEmbeddingOrigin(decoded.origin)
      sendAuthorizationMessage(opener, decoded.origin, {
        type: 'furtalk:authorization-ready',
        request_id: safeRequestId,
      })
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [fatal, siteId, requestId])

  // 查询只读授权上下文。401 在同 popup 内导航到 /login（pending 记录保留在 sessionStorage，
  // 邮箱仅用于登录表单预填）；其余失败渲染可恢复错误态，绝不自动颁发授权码。
  useEffect(() => {
    if (!siteId || !requestId || !embeddingOrigin) return
    let cancelled = false
    setContextError(null)
    setContext(null)
    authorizationApi
      .context(siteId, embeddingOrigin)
      .then((result) => {
        if (cancelled) return
        setContext(result)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        if (isUnauthorized(cause)) {
          void navigate({
            to: '/login',
            search: {
              authorize: '1',
              redirect: authorizeLoginRedirect(siteId, requestId),
            },
          })
          return
        }
        setContextError(
          cause instanceof ApiError ? cause.message : t('contextLoadFailed'),
        )
      })
    return () => {
      cancelled = true
    }
  }, [siteId, requestId, embeddingOrigin, navigate, t])

  const issue = useMutation({
    mutationFn: () => {
      // 显式点击「授权」：授权主体始终是当前第一方登录会话，绝不根据 Widget 的
      // 邮箱提示更新 /me 资料或冒充提示邮箱。只向后端签发绑定站点/Origin/request_id
      // 的授权码。
      return authorizationApi.issue({
        site_id: siteId as string,
        origin: embeddingOrigin as string,
        request_id: requestId as string,
      })
    },
    onSuccess: (result) => {
      // 只有显式点击「授权」才可能走到这里：向 opener 精确 Origin 回发 code 并关闭。
      sendAuthorizationMessage(openerRef.current, embeddingOrigin ?? '', {
        type: 'furtalk:authorization-success',
        request_id: requestId as string,
        code: result.code,
      })
      clearPendingAuthorization(safeSessionStorage(), requestId as string)
      window.close()
    },
    onError: (cause) =>
      setIssueError(
        cause instanceof ApiError ? cause.message : t('issueFailed'),
      ),
  })

  function cancel() {
    if (requestId) {
      const origin = embeddingOrigin
      if (origin) {
        sendAuthorizationMessage(openerRef.current, origin, {
          type: 'furtalk:authorization-cancelled',
          request_id: requestId,
        })
      }
      clearPendingAuthorization(safeSessionStorage(), requestId)
    }
    window.close()
  }

  const waiting = !embeddingOrigin && !fatal && !contextError
  const loadingContext =
    embeddingOrigin !== null && context === null && !contextError
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
            <p className="m-0 text-xs text-muted-foreground">{t('title')}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('cardTitle')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {fatal ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {fatal}
                </p>
                <Button type="button" variant="outline" onClick={cancel}>
                  {t('action.close', { ns: 'common' })}
                </Button>
              </div>
            ) : null}
            {!fatal && waiting ? (
              <div className="grid gap-2 py-6 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                <p className="m-0 text-sm text-muted-foreground">
                  {t('handshakePending')}
                </p>
              </div>
            ) : null}
            {!fatal && loadingContext ? (
              <div className="grid gap-2 py-6 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                <p className="m-0 text-sm text-muted-foreground">
                  {t('contextLoading')}
                </p>
              </div>
            ) : null}
            {!fatal && contextError ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {contextError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (embeddingOrigin) {
                      setContextError(null)
                    }
                  }}
                >
                  {t('action.retry', { ns: 'common' })}
                </Button>
              </div>
            ) : null}
            {!fatal && context && !issue.isPending ? (
              <>
                <div className="grid gap-2 rounded-md border bg-muted/40 px-4 py-3">
                  <p className="m-0 flex items-center gap-2 text-sm font-medium">
                    <Shield className="size-4 shrink-0 text-primary" />
                    {t('site', { siteName: context.site_name })}
                  </p>
                  <p className="m-0 flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="size-4 shrink-0" />
                    {context.origin}
                  </p>
                </div>
                <p className="m-0 text-sm text-muted-foreground">
                  {t('scopeDescription')}
                </p>
                {issueError ? (
                  <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {issueError}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline" onClick={cancel}>
                    <X />
                    {t('action.cancel', { ns: 'common' })}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setIssueError('')
                      issue.mutate()
                    }}
                  >
                    {t('grant')}
                  </Button>
                </div>
              </>
            ) : null}
            {!fatal && context && issue.isPending ? (
              <div className="grid gap-2 py-6 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                <p className="m-0 text-sm text-muted-foreground">
                  {t('issuePending')}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </FadeIn>
    </main>
  )
}

// AuthorizeSearch 是授权页 URL 参数：site_id（十进制字符串）与 request_id（base64url）。
type AuthorizeSearch = {
  site_id?: string
  request_id?: string
}

export const Route = createFileRoute('/authorize')({
  validateSearch: (search: Record<string, unknown>): AuthorizeSearch => ({
    site_id: typeof search.site_id === 'string' ? search.site_id : undefined,
    request_id:
      typeof search.request_id === 'string' ? search.request_id : undefined,
  }),
  component: AuthorizePage,
})
