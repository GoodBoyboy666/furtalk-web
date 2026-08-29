import { useSearch } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { BellOff, Loader2, Shield } from 'lucide-react'
import { useState } from 'react'
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
import { notificationApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'

// readTokenParam 严格读取可选的 token 查询值为原始字符串；缺失、空值或
// 重复（被 search-codec 解析为数组）一律视为无效链接，绝不发起请求。
function readTokenParam(search: Record<string, unknown>): string {
  return typeof search.token === 'string' ? search.token : ''
}

// UnsubscribePage 是公开的退订页：链接加载只读，仅在用户显式点击确认后才
// 发送 POST /notification-unsubscriptions。token 只存在于组件提交载荷中，
// 绝不渲染到 UI、测试错误输出或日志。
export function UnsubscribePage() {
  const { t } = useTranslation('unsubscribe')
  const search = useSearch({ strict: false })
  const token = readTokenParam(search)
  const invalid = token === ''
  const [result, setResult] = useState<
    'ready' | 'success' | 'invalid-token' | 'error'
  >('ready')
  const [errorMessage, setErrorMessage] = useState('')

  const unsubscribe = useMutation({
    mutationFn: () => notificationApi.unsubscribe(token),
    onSuccess: () => setResult('success'),
    onError: (cause) => {
      if (
        cause instanceof ApiError &&
        cause.code === 'invalid_unsubscribe_token'
      ) {
        setResult('invalid-token')
        return
      }
      setResult('error')
      setErrorMessage(
        cause instanceof ApiError ? cause.message : t('errorGeneric'),
      )
    },
  })

  const pending = unsubscribe.isPending

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <FadeIn className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BellOff className="size-5" />
          </div>
          <div>
            <p className="m-0 text-lg font-semibold">
              {t('app.name', { ns: 'common' })}
            </p>
            <p className="m-0 text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {invalid ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {t('invalidDescription')}
                </p>
              </div>
            ) : null}
            {!invalid && result === 'ready' ? (
              <div className="grid gap-4">
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => unsubscribe.mutate()}
                >
                  {pending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Shield className="size-4" />
                  )}
                  {pending ? t('pendingLabel') : t('confirmLabel')}
                </Button>
              </div>
            ) : null}
            {!invalid && result === 'success' ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
                  {t('successDescription')}
                </p>
              </div>
            ) : null}
            {!invalid && result === 'invalid-token' ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {t('invalidTokenDescription')}
                </p>
              </div>
            ) : null}
            {!invalid && result === 'error' ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => unsubscribe.mutate()}
                >
                  {pending ? <Loader2 className="animate-spin" /> : null}
                  {t('action.retry', { ns: 'common' })}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </FadeIn>
    </main>
  )
}
