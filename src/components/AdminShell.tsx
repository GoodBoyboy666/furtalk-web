import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  ChevronRight,
  FileText,
  LogOut,
  Menu,
  MessageSquareQuote,
  Settings,
  Shield,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar, initialsFrom } from '@/components/UserAvatar'
import LanguageToggle from './LanguageToggle'
import ThemeToggle from './ThemeToggle'
import { StateFade } from '@/components/motion'
import { authApi } from '@/lib/api/resources'
import { isUnauthorized } from '@/lib/api/client'

const navigation = [
  { to: '/admin', labelKey: 'navigation.overview', icon: BarChart3 },
  { to: '/admin/comments', labelKey: 'navigation.comments', icon: FileText },
  {
    to: '/admin/threads',
    labelKey: 'navigation.threads',
    icon: MessageSquareQuote,
  },
  { to: '/admin/sites', labelKey: 'navigation.sites', icon: SlidersHorizontal },
  { to: '/admin/users', labelKey: 'navigation.users', icon: Users },
  { to: '/admin/settings', labelKey: 'navigation.settings', icon: Settings },
  {
    to: '/account/profile',
    labelKey: 'navigation.personalCenter',
    icon: UserRound,
  },
] as const

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('common')
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <nav className="grid gap-1.5">
      {navigation.map((item) => {
        const Icon = item.icon
        const active =
          pathname === item.to ||
          (item.to !== '/admin' && pathname.startsWith(item.to))
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              active
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0 transition-transform group-hover:scale-105" />
            <span className="truncate">{t(item.labelKey)}</span>
            {active ? (
              <ChevronRight className="ml-auto size-3.5 opacity-80" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
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
    // 普通用户不能进入 /admin/*：直接送回个人中心，避免渲染无权导航。
    if (session.isSuccess && session.data.role !== 'admin') {
      void navigate({ to: '/account/profile' })
    }
  }, [
    navigate,
    session.data,
    session.error,
    session.isError,
    session.isSuccess,
  ])

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
  if (session.data.role !== 'admin')
    return (
      <StateFade
        kind="session-non-admin"
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      >
        {t('session.goingToAccount')}
      </StateFade>
    )
  const user = session.data
  const initials = initialsFrom(user.nickname, user.email)
  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/70 bg-sidebar/95 backdrop-blur-md lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-border/60 px-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Shield className="size-4.5" />
            </div>
            <div>
              <p className="m-0 text-sm font-semibold tracking-tight">
                {t('app.name')}
              </p>
              <p className="m-0 text-[11px] font-medium text-muted-foreground">
                {t('app.console')}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3.5 py-4">
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/80">
              {t('navigation.workspace')}
            </p>
            <NavItems />
          </div>
          <div className="border-t border-border/60 p-3">
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/40 p-2.5 transition-colors">
              <UserAvatar
                avatarUrl={user.avatar_url}
                name={user.nickname || user.email}
                fallback={initials}
                className="size-8"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {user.nickname || t('accountMenu.nicknameFallback')}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="glass-header flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label={t('accountMenu.openNavigation')}
                  >
                    <Menu />
                  </Button>
                }
              />
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b px-6 py-5">
                  <SheetTitle className="flex items-center gap-2">
                    <Shield className="size-4" />
                    {t('app.name')} {t('app.console')}
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3">
                  <NavItems onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <p className="m-0 text-sm font-semibold">{t('app.name')}</p>
              <p className="m-0 text-xs text-muted-foreground">
                {t('app.console')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="gap-2 px-2"
                    aria-label={t('accountMenu.label')}
                  >
                    <UserAvatar
                      avatarUrl={user.avatar_url}
                      name={user.nickname || user.email}
                      fallback={initials}
                      className="size-7"
                    />
                    <span className="hidden max-w-28 truncate text-sm sm:inline">
                      {user.nickname || user.email}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => void navigate({ to: '/account/profile' })}
                >
                  <UserRound className="mr-2 size-4" />
                  {t('navigation.personalCenter')}
                </DropdownMenuItem>
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
        </header>
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
