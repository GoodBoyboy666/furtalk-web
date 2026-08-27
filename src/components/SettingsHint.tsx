import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

export function SettingsHint({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Info aria-hidden="true" className="size-3.5" />
          </button>
        }
      />
      <HoverCardContent className="w-[min(20rem,calc(100vw-2rem))] leading-relaxed">
        {children}
      </HoverCardContent>
    </HoverCard>
  )
}
