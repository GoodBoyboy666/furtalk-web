import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  ChevronsUpDown,
  FileText,
  LogOut,
  Menu,
  MessageSquareQuote,
  Settings,
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
import { BrandMark } from '@/components/BrandMark'
import LanguageToggle from './LanguageToggle'
import ThemeToggle from './ThemeToggle'
import { StateFade } from '@/components/motion'
import { authApi } from '@/lib/api/resources'
import { isUnauthorized } from '@/lib/api/client'
import type { Me } from '@/lib/api/types'

const primaryNavigation = [
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
] as const

type NavItem = (typeof primaryNavigation)[number]

function NavItems({
  items,
  onNavigate,
}: {
  items: readonly NavItem[]
  onNavigate?: () => void
}) {
  const { t } = useTranslation('common')
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <div className="grid gap-0.5">
      {items.map((item) => {
        const Icon = item.icon
        const active =
          pathname === item.to ||
          (item.to !== '/admin' && pathname.startsWith(`${item.to}/`))
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group flex min-h-9 items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">{t(item.labelKey)}</span>
          </Link>
        )
      })}
    </div>
  )
}

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
      <nav aria-label={t('navigation.workspace')}>
        <p className="mb-2 px-2.5 text-[11px] font-medium text-muted-foreground">
          {t('navigation.workspace')}
        </p>
        <NavItems items={primaryNavigation} onNavigate={onNavigate} />
      </nav>
    </div>
  )
}

function SidebarUser({
  user,
  initials,
  onProfile,
  onLogout,
  logoutPending,
}: {
  user: Me
  initials: string
  onProfile: () => void
  onLogout: () => void
  logoutPending: boolean
}) {
  const { t } = useTranslation('common')
  return (
    <div className="border-t border-sidebar-border p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              aria-label={t('accountMenu.label')}
              className="h-auto w-full justify-start gap-3 px-2 py-2 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
            >
              <UserAvatar
                avatarUrl={user.avatar_url}
                name={user.nickname || user.email}
                fallback={initials}
                className="size-8 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {user.nickname || t('accountMenu.nicknameFallback')}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </span>
              <ChevronsUpDown
                className="ml-auto size-4 shrink-0"
                aria-hidden="true"
              />
            </Button>
          }
        />
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem onClick={onProfile}>
            <UserRound className="mr-2 size-4" />
            {t('navigation.personalCenter')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={logoutPending} onClick={onLogout}>
            <LogOut className="mr-2 size-4" />
            {t('accountMenu.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
  const openProfile = () => {
    setMobileOpen(false)
    void navigate({ to: '/account/profile' })
  }
  const signOut = () => logout.mutate()
  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BrandMark className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold tracking-tight">
                {t('app.name')}
              </p>
              <p className="m-0 truncate text-xs text-muted-foreground">
                {t('app.console')}
              </p>
            </div>
          </div>
          <SidebarNavigation />
          <SidebarUser
            user={user}
            initials={initials}
            onProfile={openProfile}
            onLogout={signOut}
            logoutPending={logout.isPending}
          />
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
              <SheetContent
                side="left"
                className="w-72 max-w-[calc(100vw-1.5rem)] gap-0 bg-sidebar p-0 text-sidebar-foreground"
              >
                <SheetHeader className="border-b border-sidebar-border px-4 py-4">
                  <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <BrandMark className="size-4" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-semibold">
                        {t('app.name')}
                      </span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {t('app.console')}
                      </span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <SidebarNavigation onNavigate={() => setMobileOpen(false)} />
                <SidebarUser
                  user={user}
                  initials={initials}
                  onProfile={openProfile}
                  onLogout={signOut}
                  logoutPending={logout.isPending}
                />
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
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
