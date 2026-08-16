import { motion } from 'motion/react'
import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { pageVariants } from './variants'

// PageTransition 是路由级内容进入过渡。它按当前路由 pathname 作为 key，
// 使每次路由切换都以新的子树播放统一的进入动画。
// 注意：key 使用 pathname 而非 location.key，避免仅 search 参数变化（如
// cursor 翻页、site/status 筛选）时无意义地重播页面级动画。
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <motion.div
      key={pathname}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      className={className}
    >
      {children}
    </motion.div>
  )
}
