import type { Variants } from 'motion/react'

// motionEase 是全站统一的缓动曲线，避免各路由各自定义不同时长/缓动。
export const motionEase: [number, number, number, number] = [0.22, 1, 0.36, 1]

// motionDuration 是统一时长刻度：fast 用于状态/反馈，base 用于页面级进入。
export const motionDuration = {
  fast: 0.15,
  base: 0.22,
} as const

// pageVariants 是路由级进入过渡：只使用 opacity + 小位移的合成器友好属性，
// 由 MotionConfig reducedMotion="user" 在用户偏好减弱动效时自动移除 transform。
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: motionDuration.base, ease: motionEase },
  },
}

// fadeVariants 是内容/状态纯淡入（无 transform），用于共享页头、空状态等。
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  enter: {
    opacity: 1,
    transition: { duration: motionDuration.base, ease: motionEase },
  },
}

// stateVariants 是同一区域内 loading/empty/error/content 状态切换时的淡入。
export const stateVariants: Variants = {
  initial: { opacity: 0 },
  enter: {
    opacity: 1,
    transition: { duration: motionDuration.fast, ease: motionEase },
  },
}

// listContainerVariants 与 listItemVariants 是有界集合的受限 stagger：
// 延迟很短，长列表也不会拖慢访问。
export const listContainerVariants: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
}

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: motionDuration.fast, ease: motionEase },
  },
}
