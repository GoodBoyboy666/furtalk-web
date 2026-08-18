import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe2, Loader2, Pencil, Plus, RotateCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { StateFade, Stagger, StaggerItem } from '@/components/motion'
import { sitesApi } from '@/lib/api/resources'
import { invalidateSites, sitesView } from '@/lib/api/sites'
import { selectItems } from '@/lib/i18n'
import type { Site, SiteOrigin } from '@/lib/api/types'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/sites')({ component: SitesPage })

// SitesPage 是站点管理页，供测试直接使用。
export function SitesPage() {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const sites = useQuery({ queryKey: ['sites'], queryFn: sitesApi.list })
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [editing, setEditing] = useState<Site | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const create = useMutation({
    mutationFn: () => sitesApi.create({ name, canonical_url: url }),
    onSuccess: () => {
      toast.success(t('siteCreated'))
      setOpen(false)
      setName('')
      setUrl('')
      void invalidateSites(queryClient)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('createFailed')),
  })
  const remove = useMutation({
    mutationFn: (id: string) => sitesApi.remove(id),
    onSuccess: () => {
      toast.success(t('siteDeleted'))
      setDeleteId(null)
      void invalidateSites(queryClient)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('deleteFailed')),
  })
  const updateSite = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error(t('noEditingSite'))
      return sitesApi.update(editing.id, {
        name: editName,
        canonical_url: editUrl,
        status: editStatus,
      })
    },
    onSuccess: () => {
      toast.success(t('siteUpdated'))
      setEditing(null)
      void invalidateSites(queryClient)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('updateFailed')),
  })
  const startEdit = (site: Site) => {
    setEditing(site)
    setEditName(site.name)
    setEditUrl(site.canonical_url)
    setEditStatus(site.status)
  }
  const view = sitesView({
    isPending: sites.isPending,
    isError: sites.isError,
    error: sites.error,
    sites: sites.data?.sites,
  })
  return (
    <>
      <PageHeader
        title={t('sitesTitle')}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button>
                  <Plus />
                  {t('createSite')}
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('createSiteTitle')}</DialogTitle>
                <DialogDescription>{t('createSiteHint')}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="site-name">{t('siteName')}</Label>
                  <Input
                    id="site-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('siteNamePlaceholder')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="site-url">{t('canonicalUrl')}</Label>
                  <Input
                    id="site-url"
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t('action.cancel', { ns: 'common' })}
                </Button>
                <Button
                  disabled={!name || !url || create.isPending}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {t('createSiteAction')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {view.kind === 'loading' ? (
        <StateFade kind="loading" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {t('loadingSites')}
            </CardContent>
          </Card>
        </StateFade>
      ) : view.kind === 'error' ? (
        <StateFade
          kind="error"
          className="rounded-lg border bg-background p-8 text-center"
        >
          <p className="text-sm text-destructive">{view.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => void sites.refetch()}
          >
            <RotateCw />
            {t('retryLoading')}
          </Button>
        </StateFade>
      ) : view.kind === 'empty' ? (
        <EmptyState title={t('noSites')} description={t('noSitesHint')} />
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2">
          {view.sites.map((site) => (
            <StaggerItem key={site.id} className="h-full">
              <SiteCard
                site={site}
                onEdit={() => startEdit(site)}
                onDelete={() => setDeleteId(site.id)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(value) => !value && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editSiteTitle')}</DialogTitle>
            <DialogDescription>{t('editSiteHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-site-name">{t('siteName')}</Label>
              <Input
                id="edit-site-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-site-url">{t('canonicalUrl')}</Label>
              <Input
                id="edit-site-url"
                type="url"
                value={editUrl}
                onChange={(event) => setEditUrl(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('status')}</Label>
              <Select
                value={editStatus}
                onValueChange={(value) => value && setEditStatus(value)}
                items={selectItems(siteStatusOptions, t)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {siteStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.key)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('action.cancel', { ns: 'common' })}
            </Button>
            <Button
              disabled={!editName || !editUrl || updateSite.isPending}
              onClick={() => updateSite.mutate()}
            >
              {updateSite.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {t('action.saveChanges', { ns: 'common' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(value) => !value && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteSiteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteSiteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && remove.mutate(deleteId)}
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.confirmDelete', { ns: 'common' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const siteStatusOptions = [
  { value: 'active', key: 'enums:siteStatus.active' },
  { value: 'disabled', key: 'enums:siteStatus.disabled' },
] as const

function SiteCard({
  site,
  onEdit,
  onDelete,
}: {
  site: Site
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const [origin, setOrigin] = useState('')
  const [editingOrigin, setEditingOrigin] = useState<SiteOrigin | null>(null)
  const [originEditValue, setOriginEditValue] = useState('')
  const [removingOrigin, setRemovingOrigin] = useState<SiteOrigin | null>(null)
  const add = useMutation({
    mutationFn: () => sitesApi.addOrigin(site.id, origin),
    onSuccess: () => {
      setOrigin('')
      toast.success(t('originAdded'))
      void invalidateSites(queryClient)
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t('addOriginFailed'),
      ),
  })
  const update = useMutation({
    mutationFn: () => {
      if (!editingOrigin) throw new Error(t('noEditingOrigin'))
      return sitesApi.updateOrigin(site.id, editingOrigin.id, originEditValue)
    },
    onSuccess: () => {
      setEditingOrigin(null)
      toast.success(t('originUpdated'))
      void invalidateSites(queryClient)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('updateFailed')),
  })
  const remove = useMutation({
    mutationFn: (item: SiteOrigin) => sitesApi.removeOrigin(site.id, item.id),
    onSuccess: () => {
      setRemovingOrigin(null)
      toast.success(t('originDeleted'))
      void invalidateSites(queryClient)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t('deleteFailed')),
  })
  const startEditOrigin = (item: SiteOrigin) => {
    setEditingOrigin(item)
    setOriginEditValue(item.origin)
  }
  return (
    <Card className="h-full border-border/80 bg-card subtle-card-hover">
      <CardHeader className="flex-row items-start justify-between border-b border-border/60 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe2 className="size-4.5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-base font-semibold">
              {site.name}
            </CardTitle>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {site.canonical_url}
            </p>
            <p className="m-0 mt-0.5 break-all font-mono text-[11px] text-muted-foreground/80">
              ID: {site.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('editSite')}
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('deleteSite')}
            onClick={onDelete}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t('currentStatus')}
          </span>
          <StatusBadge value={site.status} />
        </div>
        <div className="grid gap-2">
          <p className="m-0 text-xs font-medium">{t('allowedOrigins')}</p>
          {site.origins.length ? (
            <div className="grid gap-1">
              {site.origins.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate">{item.origin}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={t('editOriginAction', {
                        origin: item.origin,
                      })}
                      onClick={() => startEditOrigin(item)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={t('deleteOriginAction', {
                        origin: item.origin,
                      })}
                      onClick={() => setRemovingOrigin(item)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-xs text-muted-foreground">
              {t('noOrigins')}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Input
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              placeholder="https://app.example.com"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!origin || add.isPending}
              onClick={() => add.mutate()}
            >
              {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              {t('action.add', { ns: 'common' })}
            </Button>
          </div>
        </div>
      </CardContent>
      <Dialog
        open={!!editingOrigin}
        onOpenChange={(value) => !value && setEditingOrigin(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editOrigin')}</DialogTitle>
            <DialogDescription>{t('editOriginHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="origin-edit">{t('exactOrigin')}</Label>
            <Input
              id="origin-edit"
              value={originEditValue}
              onChange={(event) => setOriginEditValue(event.target.value)}
              placeholder="https://app.example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrigin(null)}>
              {t('action.cancel', { ns: 'common' })}
            </Button>
            <Button
              disabled={!originEditValue || update.isPending}
              onClick={() => update.mutate()}
            >
              {update.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.saveChanges', { ns: 'common' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!removingOrigin}
        onOpenChange={(value) => !value && setRemovingOrigin(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteOriginTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {removingOrigin?.origin}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removingOrigin && remove.mutate(removingOrigin)}
            >
              {remove.isPending ? <Loader2 className="animate-spin" /> : null}
              {t('action.confirmDelete', { ns: 'common' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
