import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, LogOut } from 'lucide-react'
import { useEffect } from 'react'
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
import { authApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'

// LogoutPage 是第一方登出页。它不接受任何回跳地址参数，也不通过 URL 或
// postMessage 传递凭据/邮箱/资料；挂载后自动调用现有 POST /auth/logout
// （Web API 客户端附加 CSRF 头），成功后清空 QueryClient 数据、展示成功态并
// 尝试关闭由 Widget 打开的标签页；无法自动关闭时成功页保留为回退。
export function LogoutPage() {
  const { t } = useTranslation('auth')
  const queryClient = useQueryClient()

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear()
      try {
        window.close()
      } catch {
        // 浏览器拒绝脚本关闭时，成功页面保持可见。
      }
    },
  })

  useEffect(() => {
    if (!logout.isIdle) return
    logout.mutate()
  }, [logout])

  const failed = logout.isError
  const errorText =
    logout.error instanceof ApiError ? logout.error.message : t('logoutFailed')
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <FadeIn className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LogOut className="size-5" />
          </div>
          <div>
            <p className="m-0 text-lg font-semibold">
              {t('app.name', { ns: 'common' })}
            </p>
            <p className="m-0 text-xs text-muted-foreground">
              {t('logoutSubtitle')}
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('logoutTitle')}</CardTitle>
            <CardDescription>{t('logoutDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {failed ? (
              <div className="grid gap-4">
                <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorText}
                </p>
                <Button type="button" onClick={() => logout.mutate()}>
                  {t('action.retry', { ns: 'common' })}
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 py-4 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                <p className="m-0 text-sm text-muted-foreground">
                  {logout.isSuccess ? t('logoutSuccess') : t('logoutProgress')}
                </p>
                {logout.isSuccess ? (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      render={<Link to="/login" />}
                    >
                      {t('backToLogin')}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </main>
  )
}

export const Route = createFileRoute('/logout')({ component: LogoutPage })
