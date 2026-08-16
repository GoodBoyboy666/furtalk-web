import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { fadeVariants } from './variants'

// FadeIn 是共享内容/状态进入的纯淡入包装，不依赖路由 hooks，
// 适合页面内共享组件（页头、卡片、空状态）以及不参与布局切换的顶层路由。
export function FadeIn({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={fadeVariants}
      initial="initial"
      animate="enter"
      className={className}
    >
      {children}
    </motion.div>
  )
}
