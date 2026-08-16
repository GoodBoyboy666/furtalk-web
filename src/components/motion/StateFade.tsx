import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { stateVariants } from './variants'

// StateFade 是同一区域内 loading / empty / error / content 状态切换时的淡入。
// kind 作为 key：状态变化时旧子树立即卸载、新子树淡入，避免叠加旧内容。
export function StateFade({
  kind,
  children,
  className,
}: {
  kind: string
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      key={kind}
      variants={stateVariants}
      initial="initial"
      animate="enter"
      className={className}
    >
      {children}
    </motion.div>
  )
}
