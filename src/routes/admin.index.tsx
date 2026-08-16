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
              <Link to={card.to} className="group no-underline">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {card.label}
                    </CardTitle>
                    <Icon className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold">
                      {card.value === null ? (
                        <Skeleton className="h-9 w-16" />
                      ) : (
                        card.value
                      )}
                    </div>
                    <p className="mt-2 mb-0 flex items-center gap-1 text-xs text-muted-foreground">
                      {card.hint}
                      <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          )
        })}
      </Stagger>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {t('pendingQueueTitle')}
              </CardTitle>
              <p className="mt-1 mb-0 text-sm text-muted-foreground">
                {t('pendingQueueHint')}
              </p>
            </div>
            <Link
              to="/admin/comments"
              className="text-sm text-primary no-underline hover:underline"
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
              <div className="flex items-center gap-3 rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                <FileCheck2 className="size-5" />
                {t('noPendingComments')}
              </div>
            ) : (
              <div className="divide-y">
                {commentItems.map((comment) => (
                  <Link
                    key={comment.id}
                    to="/admin/comments/$commentId"
                    params={{ commentId: comment.id }}
                    className="block py-4 no-underline first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {comment.author_nickname ||
                            comment.author_email ||
                            t('anonymousUser')}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('quickLinks')}</CardTitle>
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
                className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm no-underline transition hover:bg-muted"
              >
                <span>{item.label}</span>
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
