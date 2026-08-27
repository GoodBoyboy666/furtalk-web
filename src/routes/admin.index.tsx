import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowUpRight,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export const Route = createFileRoute('/admin/')({ component: OverviewPage })

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
    if (isValidTimeZone(value)) {
      setTimezone(value)
      persistCommentTrendTimeZone(value)
    }
  }

  function commitTimezoneInput() {
    if (!isValidTimeZone(timezoneInput)) {
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
                  <CardHeader className="flex-row items-center justify-between pb-3">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {card.label}
                    </CardTitle>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <Icon className="size-4" />
                    </div>
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
        <CardHeader className="gap-4 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="size-4.5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {t('commentTrendTitle')}
              </CardTitle>
              <p className="mt-0.5 mb-0 text-xs text-muted-foreground">
                {t('commentTrendHint')}
              </p>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={t('commentTrendRange')}
          >
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
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label
              htmlFor="comment-trend-timezone"
              className="text-xs text-muted-foreground"
            >
              {t('commentTrendTimezone')}
            </Label>
            <Input
              id="comment-trend-timezone"
              list="comment-trend-timezones"
              value={timezoneInput}
              onChange={(event) => updateTimezoneInput(event.target.value)}
              onBlur={commitTimezoneInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitTimezoneInput()
              }}
              aria-describedby="comment-trend-timezone-hint"
              className="w-full max-w-xs font-mono text-xs"
            />
            <datalist id="comment-trend-timezones">
              {timezoneOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <span
              id="comment-trend-timezone-hint"
              className="text-xs text-muted-foreground"
            >
              {t('commentTrendTimezoneHint')}
            </span>
          </div>
          {commentTrend.isPending ? (
            <Skeleton className="min-h-[260px] w-full" />
          ) : commentTrend.isError ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
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
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="size-5" />
              <p className="m-0">{t('commentTrendEmpty')}</p>
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="min-h-[260px] w-full"
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
          <CardHeader className="flex-row items-center justify-between border-b border-border/60 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                {t('pendingQueueTitle')}
              </CardTitle>
              <p className="mt-0.5 mb-0 text-xs text-muted-foreground">
                {t('pendingQueueHint')}
              </p>
            </div>
            <Link
              to="/admin/comments"
              className="text-xs font-medium text-primary no-underline hover:underline"
            >
              {t('viewAll')}
            </Link>
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
            <CardTitle className="text-base font-semibold">
              {t('quickLinks')}
            </CardTitle>
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
