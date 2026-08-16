import { useRouterState } from '@tanstack/react-router'
import LanguageToggle from './LanguageToggle'

// isShellPath 识别由 AdminShell / AccountShell 托管的路径树，
// 避免根级固定语言控件与壳层头部的语言控件重复出现。
function isShellPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/account' ||
    pathname.startsWith('/account/')
  )
}

export default function RootLanguageToggle() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (isShellPath(pathname)) {
    return null
  }

  return (
    <div
      className="fixed z-40"
      style={{
        right: 'max(1rem, env(safe-area-inset-right))',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <LanguageToggle />
    </div>
  )
}
