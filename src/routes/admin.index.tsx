import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import {
  ArrowUpRight,
  FileCheck2,
  Globe2,
  MessageSquare,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { Stagger, StaggerItem } from '@/components/motion'
import { commentsApi, sitesApi, usersApi } from '@/lib/api/resources'

export const Route = createFileRoute('/admin/')({ component: OverviewPage })

function OverviewPage() {
  const { t } = useTranslation('admin')
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
  const commentItems = comments.data?.comments || []
  const cards = [
    {
      label: t('pendingComments'),
      value: comments.isPending ? null : commentItems.length,
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
