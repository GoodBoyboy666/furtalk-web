import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FadeIn } from '@/components/motion'
import { authApi } from '@/lib/api/resources'
import { resolvePostLoginTarget } from '@/lib/redirect'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const session = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    retry: false,
  })
  useEffect(() => {
    if (session.isSuccess)
      void navigate({
        href: resolvePostLoginTarget(session.data.role),
      })
    if (session.isError) void navigate({ to: '/login' })
  }, [
    navigate,
    session.data,
    session.error,
    session.isError,
    session.isSuccess,
  ])
  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      <FadeIn>{t('state.openingAccountCenter')}</FadeIn>
    </main>
  )
}
