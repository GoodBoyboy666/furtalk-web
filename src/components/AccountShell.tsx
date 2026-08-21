import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, LogOut, Menu, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { UserAvatar, initialsFrom } from '@/components/UserAvatar'
import LanguageToggle from './LanguageToggle'
import ThemeToggle from './ThemeToggle'
import { StateFade } from '@/components/motion'
import { authApi } from '@/lib/api/resources'
import { isUnauthorized } from '@/lib/api/client'

// accountNavigation 是个人中心导航项，普通用户与管理员共享。
const accountNavigation = [
  { to: '/account/profile', labelKey: 'navigation.profile' },
  { to: '/account/security', labelKey: 'navigation.security' },
  { to: '/account/comments', labelKey: 'navigation.myComments' },
] as const

function AccountNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('common')
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <nav className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
      {accountNavigation.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {t(item.labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}

// AccountShell 是 /account/* 的个人中心壳层。
// 它复用 ['me'] query，但拥有独立导航与 401/非 401 状态，不导入 AdminShell。
export function AccountShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const session = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    retry: false,
  })
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear()
      void navigate({ to: '/login' })
    },
  })
  useEffect(() => {
    if (session.isError && isUnauthorized(session.error)) {
      void navigate({ to: '/login' })
    }
  }, [navigate, session.error, session.isError])

  if (session.isPending)
    return (
      <StateFade
        kind="session-pending"
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      >
        {t('session.verifying')}
      </StateFade>
    )
  if (session.isError && isUnauthorized(session.error))
    return (
      <StateFade
        kind="session-unauthorized"
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      >
        {t('session.returningToLogin')}
      </StateFade>
    )
  if (session.isError)
    return (
      <StateFade
        kind="session-error"
        className="flex min-h-screen items-center justify-center"
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {t('session.verificationFailed')}
          </p>
          <Button className="mt-3" onClick={() => void session.refetch()}>
            {t('action.retry')}
          </Button>
        </div>
      </StateFade>
    )
  const user = session.data
  const initials = initialsFrom(user.nickname, user.email)
  const isAdmin = user.role === 'admin'
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="glass-header">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden"
                    aria-label={t('accountMenu.openNavigation')}
                  >
                    <Menu />
                  </Button>
                }
              />
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b px-6 py-5">
                  <SheetTitle className="flex items-center gap-2">
                    <UserRound className="size-4" />
                    {t('app.name')}
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <AccountNav onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link
              to="/account/profile"
              className="flex min-w-0 items-center gap-3 text-foreground no-underline"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <UserRound className="size-4.5" />
              </div>
              <div>
                <p className="m-0 text-sm font-semibold tracking-tight">
                  {t('app.name')}
                </p>
                <p className="m-0 text-[11px] font-medium text-muted-foreground">
                  {t('navigation.personalCenter')}
                </p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full p-0"
                    aria-label={t('accountMenu.label')}
                  >
                    <UserAvatar
                      avatarUrl={user.avatar_url}
                      name={user.nickname || user.email}
                      fallback={initials}
                      className="size-8"
                    />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <UserAvatar
                    avatarUrl={user.avatar_url}
                    name={user.nickname || user.email}
                    fallback={initials}
                    className="size-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="m-0 truncate text-sm font-medium"
                      title={user.nickname || t('accountMenu.nicknameFallback')}
                    >
                      {user.nickname || t('accountMenu.nicknameFallback')}
                    </p>
                    <p
                      className="m-0 truncate text-xs text-muted-foreground"
                      title={user.email}
                    >
                      {user.email}
                    </p>
                  </div>
                </div>
                {isAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void navigate({ to: '/admin' })}
                    >
                      <LayoutDashboard className="mr-2 size-4" />
                      {t('navigation.adminConsole')}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  <LogOut className="mr-2 size-4" />
                  {t('accountMenu.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="hidden border-t border-border/60 px-4 sm:block sm:px-6">
          <div className="mx-auto flex h-13 max-w-5xl items-center gap-3">
            <AccountNav />
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-7.5rem)] max-w-5xl p-4 sm:p-6">
        {children}
      </main>
    </div>
  )
}
