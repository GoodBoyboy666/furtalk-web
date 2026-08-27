import { PawPrint } from 'lucide-react'
import type { LucideProps } from 'lucide-react'

// BrandMark 是 Furtalk 的共享品牌标记；默认作为相邻品牌名称的装饰图标。
export function BrandMark({
  'aria-hidden': ariaHidden = true,
  ...props
}: LucideProps) {
  return <PawPrint aria-hidden={ariaHidden} {...props} />
}
