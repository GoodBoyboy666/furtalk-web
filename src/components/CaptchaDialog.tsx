import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CaptchaChallenge } from '@/components/CaptchaChallenge'
import type { CaptchaChallengeHandle } from '@/components/CaptchaChallenge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CaptchaChallengeConfig } from '@/lib/captcha/loaders'

// CaptchaDialogProps 是受控验证码对话框的输入契约。
// 路由保留各自 action 的 config 查询、业务校验、mutation 与错误处理；
// 对话框只负责在打开时挂载挑战、单次解决回调与取消清理。
type CaptchaDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: CaptchaChallengeConfig | null
  action: string
  title: string
  description: string
  onSolved: (token: string) => void
  onError: (message: string) => void
}

// CaptchaDialog 是 provider-neutral 验证码的对话框宿主。
// 挑战只在对话框打开时挂载，关闭即卸载，保证每次尝试都是全新实例；
// 非空 token 只回调 onSolved 一次，重置/过期产生的空 token 不会触发解决。
export function CaptchaDialog({
  open,
  onOpenChange,
  config,
  action,
  title,
  description,
  onSolved,
  onError,
}: CaptchaDialogProps) {
  const { t } = useTranslation('auth')
  const challengeRef = useRef<CaptchaChallengeHandle>(null)
  const solvedRef = useRef(false)

  // 打开时允许新一轮解决；关闭时重置挑战句柄（卸载前清理）。
  useEffect(() => {
    if (open) {
      solvedRef.current = false
    } else {
      challengeRef.current?.reset()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && config ? (
          // 宿主容器左对齐并可横向滚动，避免窄屏下托管 iframe 溢出。
          <div className="flex min-h-16 items-start justify-start overflow-x-auto">
            <div className="shrink-0">
              <CaptchaChallenge
                ref={challengeRef}
                config={config}
                action={action}
                onToken={(token) => {
                  if (token && !solvedRef.current) {
                    solvedRef.current = true
                    onSolved(token)
                  }
                }}
                onError={onError}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('captchaDialogCancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
