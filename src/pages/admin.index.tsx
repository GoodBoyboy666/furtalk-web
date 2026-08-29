import { Link } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowUpRight,
  Command,
  FileCheck2,
  Globe2,
  MessageSquare,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from '@/components/ui/chart'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { CardHeaderLead } from '@/components/CardHeaderLead'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Stagger, StaggerItem } from '@/components/motion'
import { commentsApi, sitesApi, usersApi } from '@/lib/api/resources'
import {
  commentTrendDays,
  formatCommentTrendDate,
  isValidTimeZone,
  persistCommentTrendTimeZone,
  resolveCommentTrendTimeZone,
  supportedCommentTrendTimezones,
} from '@/lib/comment-trend'
import type { CommentTrendDays } from '@/lib/comment-trend'

const commentTrendStateClassName = 'h-[220px] w-full'

export function OverviewPage() {
  const { t, i18n } = useTranslation('admin')
  const [trendDays, setTrendDays] = useState<CommentTrendDays>(7)
  const [timezone, setTimezone] = useState(() => resolveCommentTrendTimeZone())
  const [timezoneInput, setTimezoneInput] = useState(timezone)
  const timezoneOptions = supportedCommentTrendTimezones(timezone)
  const [comments, sites, users] = useQueries({
    queries: [
      {
        queryKey: ['comments', { status: 'pending', limit: 5 }],
        queryFn: () => commentsApi.list({ status: 'pending', limit: 5 }),
      },
      { queryKey: ['sites'], queryFn: sitesApi.list },
      {
        queryKey: ['users', { limit: 1 }],
        queryFn: () => usersApi.list({ limit: 1 }),
      },
    ],
  })
  const commentTrend = useQuery({
    queryKey: ['admin-comment-trend', trendDays, timezone],
    queryFn: () => commentsApi.trend(trendDays, timezone),
  })
  const commentItems = comments.data?.comments || []
  const cards = [
    {
      label: t('pendingComments'),
      value: comments.isPending ? null : (comments.data?.total ?? 0),
      icon: MessageSquare,
      to: '/admin/comments',
      hint: t('pendingCommentsHint'),
    },
    {
      label: t('configuredSites'),
      value: sites.isPending ? null : sites.data?.sites.length,
      icon: Globe2,
      to: '/admin/sites',
      hint: t('configuredSitesHint'),
    },
    {
      label: t('platformUsers'),
      value: users.isPending ? null : (users.data?.total ?? 0),
      icon: Users,
      to: '/admin/users',
      hint: t('platformUsersHint'),
    },
  ] as const
  const chartConfig = {
    comments: {
      label: t('commentTrendSeries'),
      color: 'var(--chart-1)',
      icon: MessageSquare,
    },
  } satisfies ChartConfig
  const chartData = commentTrend.data?.points ?? []
  const locale = i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US'

  function updateTimezoneInput(value: string) {
    setTimezoneInput(value)
  }

  function commitTimezoneInput(value = timezoneInput) {
    if (!isValidTimeZone(value)) {
      setTimezoneInput(timezone)
      return
    }
    setTimezone(value)
    setTimezoneInput(value)
    persistCommentTrendTimeZone(value)
  }

  function handleTimezoneValueChange(value: string | null) {
    if (typeof value === 'string') {
      commitTimezoneInput(value)
    } else {
      setTimezoneInput(timezone)
    }
  }

  return (
    <>
      <PageHeader title={t('overviewTitle')} />
      <Stagger className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <StaggerItem key={card.label} className="h-full">
              <Link to={card.to} className="group block h-full no-underline">
                <Card className="h-full subtle-card-hover border-border/80 bg-card">
                  <CardHeader className="pb-3">
                    <CardHeaderLead
                      icon={Icon}
                      iconClassName="transition-colors group-hover:bg-primary/15"
                    >
                      <CardTitle className="text-base font-semibold">
                        {card.label}
                      </CardTitle>
                    </CardHeaderLead>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight">
                      {card.value === null ? (
                        <Skeleton className="h-9 w-16 rounded-md" />
                      ) : (
                        card.value
                      )}
                    </div>
                    <p className="mt-2.5 mb-0 flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{card.hint}</span>
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          )
        })}
      </Stagger>
      <Card className="mt-6 border-border/80">
        <CardHeader className="gap-4 border-b border-border/60 pb-4">
          <CardHeaderLead icon={MessageSquare}>
            <CardTitle className="text-base font-semibold">
              {t('commentTrendTitle')}
            </CardTitle>
          </CardHeaderLead>
          <CardAction
            className="flex flex-wrap items-center justify-end gap-2 max-sm:col-start-1 max-sm:col-span-2 max-sm:row-start-2 max-sm:row-span-1 max-sm:justify-start"
            role="group"
            aria-label={t('commentTrendRange')}
          >
            <div className="flex items-center gap-2">
              <Label
                htmlFor="comment-trend-timezone"
                className="text-xs text-muted-foreground"
              >
                {t('commentTrendTimezone')}
              </Label>
              <Combobox
                items={timezoneOptions}
                value={timezone}
                inputValue={timezoneInput}
                onInputValueChange={updateTimezoneInput}
                onValueChange={handleTimezoneValueChange}
              >
                <ComboboxInputGroup className="w-36 sm:w-44">
                  <ComboboxInput
                    id="comment-trend-timezone"
                    onBlur={(event) =>
                      commitTimezoneInput(event.currentTarget.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitTimezoneInput(event.currentTarget.value)
                      }
                    }}
                    className="font-mono text-xs"
                  />
                  <ComboboxTrigger />
                </ComboboxInputGroup>
                <ComboboxContent>
                  <ComboboxList>
                    {(option: string, index: number) => (
                      <ComboboxItem key={option} value={option} index={index}>
                        {option}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            {commentTrendDays.map((days) => (
              <Button
                key={days}
                type="button"
                size="sm"
                variant={trendDays === days ? 'default' : 'outline'}
                onClick={() => setTrendDays(days)}
              >
                {t(days === 7 ? 'last7Days' : 'last30Days')}
              </Button>
            ))}
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          {commentTrend.isPending ? (
            <Skeleton className={commentTrendStateClassName} />
          ) : commentTrend.isError ? (
            <div
              className={`flex ${commentTrendStateClassName} flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive`}
            >
              <p className="m-0">{t('commentTrendLoadFailed')}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void commentTrend.refetch()}
              >
                {t('retry')}
              </Button>
            </div>
          ) : chartData.every((point) => point.count === 0) ? (
            <div
              className={`flex ${commentTrendStateClassName} flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground`}
            >
              <MessageSquare className="size-5" />
              <p className="m-0">{t('commentTrendEmpty')}</p>
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className={`${commentTrendStateClassName} aspect-auto`}
            >
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value: string) =>
                    formatCommentTrendDate(value, locale)
                  }
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) =>
                        formatCommentTrendDate(String(value), locale)
                      }
                    />
                  }
                />
                <Area
                  dataKey="count"
                  name="comments"
                  type="monotone"
                  fill="var(--color-comments)"
                  fillOpacity={0.2}
                  stroke="var(--color-comments)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="border-border/80">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead icon={FileCheck2}>
              <CardTitle className="text-base font-semibold">
                {t('pendingQueueTitle')}
              </CardTitle>
            </CardHeaderLead>
            <CardAction>
              <Link
                to="/admin/comments"
                className="text-xs font-medium text-primary no-underline hover:underline"
              >
                {t('viewAll')}
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {comments.isError ? (
              <p className="text-sm text-destructive">
                {t('commentsLoadFailed')}
              </p>
            ) : commentItems.length === 0 ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-sm text-muted-foreground">
                <FileCheck2 className="size-5 text-emerald-500" />
                <span>{t('noPendingComments')}</span>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {commentItems.map((comment) => (
                  <Link
                    key={comment.id}
                    to="/admin/comments/$commentId"
                    params={{ commentId: comment.id }}
                    className="block rounded-lg p-3 no-underline transition-colors hover:bg-muted/50 first:pt-3 last:pb-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {comment.author_nickname ||
                            comment.author_email ||
                            t('anonymousUser')}
                        </p>
                        <p
                          className="mt-1 truncate text-xs leading-relaxed text-muted-foreground"
                          title={comment.body}
                        >
                          {comment.body}
                        </p>
                      </div>
                      <StatusBadge value={comment.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/80">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardHeaderLead icon={Command}>
              <CardTitle className="text-base font-semibold">
                {t('quickLinks')}
              </CardTitle>
            </CardHeaderLead>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { to: '/admin/comments', label: t('reviewComments') },
              { to: '/admin/sites', label: t('configureSites') },
              { to: '/admin/users', label: t('manageUsers') },
              { to: '/admin/settings', label: t('adjustPolicies') },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group flex items-center justify-between rounded-xl border border-border/70 bg-card p-3 text-sm font-medium no-underline transition-all hover:border-border hover:bg-muted/50 hover:shadow-xs"
              >
                <span>{item.label}</span>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
