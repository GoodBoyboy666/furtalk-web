import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// UserAvatar 渲染头像图片，加载失败或未提供时回退到首字母。
export function UserAvatar({
  avatarUrl,
  name,
  fallback,
  className,
}: {
  avatarUrl?: string
  name?: string
  fallback: string
  className?: string
}) {
  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name ?? ''} /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  )
}

// initialsFrom 从昵称或邮箱生成稳定首字母回退。
export function initialsFrom(name: string, email: string): string {
  return (name || email).slice(0, 2).toUpperCase()
}
