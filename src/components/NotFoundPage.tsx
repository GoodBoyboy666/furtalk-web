import { Link } from '@tanstack/react-router'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { buttonVariants } from '@/components/ui/button'
import { FadeIn } from '@/components/motion'
import { cn } from '@/lib/utils'

// NotFoundPage 是应用级统一 404：大号低对比的“404”做背景，前景是一只
// “断线迷路”评论气泡（MessageSquare 加上脱落的尾巴），配以简短说明与
// “返回首页”主按钮。沿用黑白设计令牌，浅深色与窄屏均可用。
export function NotFoundPage() {
  const { t } = useTranslation('common')
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-16">
      <FadeIn className="w-full max-w-md text-center">
        <div className="relative flex items-center justify-center">
          <p
            aria-hidden="true"
            className="m-0 select-none text-[9rem] font-extrabold leading-none text-foreground/5"
          >
            {t('notFound.title')}
          </p>
          <div className="absolute flex flex-col items-center">
            <MessageSquare
              className="size-16 text-muted-foreground/60"
              strokeWidth={1.5}
            />
            <span
              aria-hidden="true"
              className="-mt-1 ml-10 size-3.5 rotate-45 rounded-[2px] border border-muted-foreground/40 bg-muted"
            />
          </div>
        </div>
        <h1 className="mt-6 text-xl font-semibold">{t('notFound.heading')}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {t('notFound.description')}
        </p>
        <Link
          to="/"
          className={cn(buttonVariants({ variant: 'default' }), 'mt-8')}
        >
          <ArrowLeft />
          {t('notFound.backHome')}
        </Link>
      </FadeIn>
    </main>
  )
}
