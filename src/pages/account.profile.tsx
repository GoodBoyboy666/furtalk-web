import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Save, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CardHeaderLead } from '@/components/CardHeaderLead'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/PageHeader'
import { StateFade } from '@/components/motion'
import { authApi } from '@/lib/api/resources'
import { ApiError } from '@/lib/api/client'
import { toast } from 'sonner'

export function ProfilePage() {
  const { t } = useTranslation('account')
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me })
  const [nickname, setNickname] = useState('')
  const [website, setWebsite] = useState('')
  const [notice, setNotice] = useState({
    moderation_enabled: false,
    reply_enabled: false,
  })
  useEffect(() => {
    if (!me.data) return
    setNickname(me.data.nickname)
    setWebsite(me.data.website_url ?? '')
    setNotice(me.data.notification_preferences)
  }, [me.data])
  const profile = useMutation({
    mutationFn: () => authApi.updateMe({ nickname, website_url: website }),
    onSuccess: (data) => {
      toast.success(t('profileSaved'))
      void queryClient.setQueryData(['me'], data)
    },
    onError: (error) => toast.error(profileErrorMessage(error, t)),
  })
  const preferences = useMutation({
    mutationFn: () => authApi.updateNotifications(notice),
    onSuccess: (data) => {
      toast.success(t('preferencesSaved'))
      void queryClient.setQueryData(['me'], (current: typeof me.data) =>
        current ? { ...current, notification_preferences: data } : current,
      )
    },
    onError: (error) => toast.error(profileErrorMessage(error, t)),
  })
  if (me.isPending || !me.data)
    return (
      <StateFade kind="loading" className="text-sm text-muted-foreground">
        {t('profileLoading')}
      </StateFade>
    )
  return (
    <>
      <PageHeader
        title={t('profileTitle')}
        description={t('profileDescription')}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead icon={UserRound}>
              <CardTitle className="text-base font-semibold">
                {t('basicInfo')}
              </CardTitle>
            </CardHeaderLead>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t('emailReadonly')}</Label>
              <Input id="email" value={me.data.email} readOnly disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nickname">{t('nickname')}</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">{t('website')}</Label>
              <Input
                id="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://"
              />
            </div>
            <Button
              className="w-fit"
              onClick={() => profile.mutate()}
              disabled={profile.isPending}
            >
              <Save />
              {t('saveProfile')}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card shadow-xs">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead icon={Bell}>
              <CardTitle className="text-base font-semibold">
                {t('notificationPreferences')}
              </CardTitle>
            </CardHeaderLead>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Preference
              label={t('moderationAlert')}
              checked={notice.moderation_enabled}
              onChange={(value) =>
                setNotice({ ...notice, moderation_enabled: value })
              }
            />
            <Preference
              label={t('replyAlert')}
              checked={notice.reply_enabled}
              onChange={(value) =>
                setNotice({ ...notice, reply_enabled: value })
              }
            />
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => preferences.mutate()}
              disabled={preferences.isPending}
            >
              {t('saveNotificationPreferences')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Preference({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40">
      <Label className="cursor-pointer font-medium">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function profileErrorMessage(error: unknown, t: (key: string) => string) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : t('profileSaveFailed')
}
