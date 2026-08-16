import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { listContainerVariants, listItemVariants } from './variants'

// Stagger 用于有界集合（卡片网格、列表条目）的受限进入动画。
// Stagger 容器与 StaggerItem 配对使用，stagger 延迟很短且受 reduced-motion 控制。
export function Stagger({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={listContainerVariants}
      initial="initial"
      animate="enter"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div variants={listItemVariants} className={className}>
      {children}
    </motion.div>
  )
}
