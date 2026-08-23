import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  KeyRound,
  Loader2,
  MailCheck,
  MailX,
  Pencil,
  Search,
  ShieldOff,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { StateFade } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { usersApi } from '@/lib/api/resources'
import type {
  AdminUser,
  AdminUserBatchAction,
  UserRole,
  UserStatus,
} from '@/lib/api/types'
import { adminSortLabel, adminSortOptions } from '@/lib/admin-sort'
import type { AdminSort } from '@/lib/admin-sort'
import { UserAvatar, initialsFrom } from '@/components/UserAvatar'
import { ListPagination } from '@/components/ListPagination'
import { ApiError } from '@/lib/api/client'
import {
  userDeleteModeLabel,
  userDeleteModeOptions,
} from '@/lib/user-delete-mode'
import { selectItems } from '@/lib/i18n'
import { usePageSize } from '@/lib/pagination'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { AdminBatchToolbar } from '@/components/AdminBatchToolbar'
import { getFailedBatchId } from '@/lib/admin-batch'
import { useCurrentPageSelection } from '@/lib/use-current-page-selection'

export const Route = createFileRoute('/admin/users')({ component: UsersPage })

const userRoleOptions = [
  { value: 'user', key: 'enums:status.user' },
  { value: 'admin', key: 'enums:status.admin' },
] as const

const userStatusOptions = [
  { value: 'active', key: 'enums:status.active' },
  { value: 'disabled', key: 'enums:status.disabled' },
] as const

export function UsersPage() {
  const { t } = useTranslation('admin')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<AdminSort>('desc')
  const [page, setPage] = useState(1)
  const { pageSize, changePageSize } = usePageSize('admin-users')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [batchConfirm, setBatchConfirm] = useState<
    'soft_delete' | 'hard_delete' | null
  >(null)
  const queryClient = useQueryClient()
  const users = useQuery({
    queryKey: ['users', { q, sort, page, pageSize }],
    queryFn: () => usersApi.list({ q, sort, page, limit: pageSize }),
  })
  const total = users.isSuccess ? users.data.total : 0
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const visibleIds = users.data?.users.map((user) => user.id) ?? []
  const selection = useCurrentPageSelection(
    visibleIds,
    [q, sort, page, pageSize].join('|'),
  )
  const batchMutation = useMutation({
    mutationFn: ({
      ids,
      action,
      confirm,
    }: {
      ids: string[]
      action: AdminUserBatchAction
      confirm?: boolean
    }) => usersApi.batch({ ids, action, confirm }),
    onSuccess: (result, variables) => {
      toast.success(
        t('batchOperationCompleted', {
          changed: result.changed_count,
          unchanged: result.unchanged_count,
        }),
      )
      selection.clear()
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      if (variables.action === 'hard_delete') {
        for (const id of variables.ids) {
          void queryClient.removeQueries({ queryKey: ['users', id] })
        }
      }
      setBatchConfirm(null)
    },
    onError: (error) => {
      const failedID = getFailedBatchId(error)
      toast.error(
        failedID
          ? t('batchOperationFailedWithID', { id: failedID })
          : error instanceof Error
            ? error.message
            : t('operationFailed'),
      )
    },
  })
  const batchActions = [
    { value: 'enable' as const, label: t('batchEnableUsers'), icon: <Check /> },
    {
      value: 'disable' as const,
      label: t('batchDisableUsers'),
      icon: <ShieldOff />,
    },
    {
      value: 'verify_email' as const,
      label: t('batchVerifyUsers'),
      icon: <MailCheck />,
    },
    {
      value: 'unverify_email' as const,
      label: t('batchUnverifyUsers'),
      icon: <MailX />,
    },
    {
      value: 'soft_delete' as const,
      label: t('batchSoftDeleteUsers'),
      icon: <Trash2 />,
    },
    {
      value: 'hard_delete' as const,
      label: t('batchHardDeleteUsers'),
      icon: <Trash2 />,
      variant: 'destructive' as const,
    },
    {
      value: 'restore' as const,
      label: t('batchRestoreUsers'),
      icon: <Undo2 />,
    },
  ]
  useEffect(() => {
    if (users.isSuccess && page > totalPages) {
      setPage(totalPages)
    }
  }, [users.isSuccess, page, totalPages])

  return (
    <>
      <PageHeader
        title={t('usersTitle')}
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button>
                  <UserPlus />
                  {t('createUser')}
                </Button>
              }
            />
            <CreateUserDialog onClose={() => setCreateOpen(false)} />
          </Dialog>
        }
      />{' '}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
            placeholder={t('searchUserHint')}
            className="pl-9 bg-card"
          />
        </div>
        <Select
          value={sort}
          onValueChange={(value) => {
            setSort(value ?? 'desc')
            setPage(1)
          }}
          items={selectItems(adminSortOptions, t)}
        >
          <SelectTrigger className="w-36 bg-card">
            <SelectValue placeholder={t('sort.desc', { ns: 'enums' })}>
              {adminSortLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {adminSortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.key)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {users.isSuccess ? (
          <span className="text-sm font-medium text-muted-foreground">
            {t('userCount', { count: users.data.total })}
          </span>
        ) : null}
      </div>
      <AdminBatchToolbar
        selectedCount={selection.selectedCount}
        pending={batchMutation.isPending}
        label={t('batchSelectedCount', { count: selection.selectedCount })}
        actions={batchActions}
        onAction={(batch) => {
          const action = batch.value as AdminUserBatchAction
          if (action === 'soft_delete' || action === 'hard_delete') {
            setBatchConfirm(action)
            return
          }
          batchMutation.mutate({
            ids: [...selection.selectedIds],
            action,
          })
        }}
      />
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
        {users.isPending ? (
          <StateFade kind="loading">
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t('loadingUsers')}
            </div>
          </StateFade>
        ) : users.isError ? (
          <StateFade kind="error">
            <div className="p-8 text-center text-sm text-destructive">
              {t('usersLoadFailed')}
            </div>
          </StateFade>
        ) : users.data.users.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={t('selectAllUsers')}
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected}
                    onCheckedChange={(checked) => selection.toggleAll(checked)}
                  />
                </TableHead>
                <TableHead>{t('user')}</TableHead>
                <TableHead>{t('role')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('emailVerified')}</TableHead>
                <TableHead>{t('created')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="align-top">
                    <Checkbox
                      aria-label={t('selectUser', { id: user.id })}
                      checked={selection.isSelected(user.id)}
                      onCheckedChange={(checked) =>
                        selection.toggle(user.id, checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        avatarUrl={user.avatar_url}
                        name={user.nickname || user.email}
                        fallback={initialsFrom(user.nickname, user.email)}
                        className="size-8 shrink-0"
                      />
                      <div className="min-w-0">
                        <p
                          className="m-0 truncate text-sm font-medium"
                          title={user.nickname || t('nicknameFallback')}
                        >
                          {user.nickname || t('nicknameFallback')}
                        </p>
                        <p className="m-0 truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={user.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={user.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      value={user.email_verified ? 'verified' : 'unverified'}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.status === 'deleted' ? (
                        <RestoreUserButton user={user} />
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditTarget(user.id)}
                          >
                            <Pencil className="size-3.5" />
                            {t('action.edit', { ns: 'common' })}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetTarget(user.id)}
                          >
                            <KeyRound className="size-3.5" />
                            {t('resetPassword')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="size-3.5" />
                            {t('action.delete', { ns: 'common' })}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <EmptyState title={t('noMatchingUsers')} />
          </div>
        )}
        {users.isSuccess ? (
          <ListPagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              changePageSize(size)
              setPage(1)
            }}
          />
        ) : null}
      </div>
      {editTarget ? (
        <EditUserDialog
          userId={editTarget}
          open
          onOpenChange={(open) => {
            if (!open) setEditTarget(null)
          }}
          onSuccess={() => setEditTarget(null)}
        />
      ) : null}
      {resetTarget ? (
        <ResetPasswordDialog
          userId={resetTarget}
          open
          onOpenChange={(open) => {
            if (!open) setResetTarget(null)
          }}
          onSuccess={() => setResetTarget(null)}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteUserDialog
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
      <AlertDialog
        open={batchConfirm !== null}
        onOpenChange={(open) => !open && setBatchConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {batchConfirm === 'hard_delete'
                ? t('batchHardDeleteUsersTitle')
                : t('batchSoftDeleteUsersTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {batchConfirm === 'hard_delete'
                ? t('batchHardDeleteUsersHint', {
                    count: selection.selectedCount,
                  })
                : t('batchSoftDeleteUsersHint', {
                    count: selection.selectedCount,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('action.cancel', { ns: 'common' })}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={batchMutation.isPending}
              onClick={() => {
                if (!batchConfirm) return
                batchMutation.mutate({
                  ids: [...selection.selectedIds],
                  action: batchConfirm,
                  confirm: true,
                })
              }}
            >
              {batchMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {batchConfirm === 'hard_delete'
                ? t('confirmHardDelete')
                : t('confirmSoftDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RestoreUserButton({ user }: { user: AdminUser }) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const restore = useMutation({
    mutationFn: () => usersApi.restore(user.id),
    onSuccess: (updated) => {
      toast.success(t('userRestored'))
      void queryClient.setQueryData(['users', user.id], updated)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (submitError) => {
      toast.error(
        submitError instanceof ApiError
          ? submitError.message
          : t('restoreFailed'),
      )
    },
  })
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={restore.isPending}
      onClick={() => restore.mutate()}
    >
      {restore.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
      {t('action.restore', { ns: 'common' })}
    </Button>
  )
}

function DeleteUserDialog({
  user,
  onClose,
}: {
  user: AdminUser
  onClose: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'soft' | 'hard'>('soft')
  const [error, setError] = useState('')
  const remove = useMutation({
    mutationFn: () => usersApi.remove(user.id, mode),
    onSuccess: () => {
      toast.success(
        mode === 'hard' ? t('userHardDeleted') : t('userSoftDeleted'),
      )
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.removeQueries({ queryKey: ['users', user.id] })
      onClose()
    },
    onError: (submitError) => {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : t('deleteUserFailed'),
      )
    },
  })
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'hard'
              ? t('hardDeleteUserTitle')
              : t('softDeleteUserTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('deleteUserHint')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label>{t('deleteMode')}</Label>
          <Select
            value={mode}
            onValueChange={(value) => setMode(value || 'soft')}
            items={selectItems(userDeleteModeOptions, t)}
          >
            <SelectTrigger aria-label={t('deleteMode')}>
              <SelectValue placeholder={t('chooseDeleteMode')}>
                {userDeleteModeLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {userDeleteModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.key)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('action.cancel', { ns: 'common' })}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : null}
            {mode === 'hard' ? t('confirmHardDelete') : t('confirmSoftDelete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [website, setWebsite] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [password, setPassword] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [error, setError] = useState('')
  const create = useMutation({
    mutationFn: () =>
      usersApi.create({
        email,
        nickname,
        website_url: website || undefined,
        role,
        password: password || undefined,
        email_verified: emailVerified,
      }),
    onSuccess: () => {
      toast.success(t('userCreated'))
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (submitError) => {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : t('createUserFailed'),
      )
    },
  })
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('createUserTitle')}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="create-email">{t('email')}</Label>
          <Input
            id="create-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="create-nickname">{t('nickname')}</Label>
          <Input
            id="create-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="create-website">{t('personalWebsite')}</Label>
          <Input
            id="create-website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="grid gap-2">
          <Label>{t('role')}</Label>
          <RoleSelect value={role} onChange={setRole} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="create-password">{t('initialPassword')}</Label>
          <Input
            id="create-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('initialPasswordPlaceholder')}
            autoComplete="new-password"
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <div>
            <p className="m-0 text-sm font-medium">{t('emailVerifiedLabel')}</p>
            <p className="m-0 text-xs text-muted-foreground">
              {t('emailVerifiedHint')}
            </p>
          </div>
          <Switch
            checked={emailVerified}
            onCheckedChange={setEmailVerified}
            aria-label={t('emailVerifiedLabel')}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={create.isPending} onClick={onClose}>
          {t('action.cancel', { ns: 'common' })}
        </Button>
        <Button
          disabled={!email || !nickname || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <Loader2 className="animate-spin" /> : null}
          {t('createUser')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function EditUserDialog({
  userId,
  open,
  onOpenChange,
  onSuccess,
}: {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ['users', userId],
    queryFn: () => usersApi.get(userId),
    enabled: open,
  })
  const [form, setForm] = useState<{
    email: string
    nickname: string
    website: string
    role: UserRole
    status: UserStatus
    email_verified: boolean
  } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!detail.data || form) return
    setForm({
      email: detail.data.email,
      nickname: detail.data.nickname,
      website: detail.data.website_url ?? '',
      role: detail.data.role as UserRole,
      status: detail.data.status as UserStatus,
      email_verified: detail.data.email_verified,
    })
    setError('')
  }, [detail.data, form])

  const update = useMutation({
    mutationFn: () => {
      if (!form || !detail.data) throw new Error(t('userProfileNotLoaded'))
      const payload = {
        email: form.email !== detail.data.email ? form.email : undefined,
        nickname:
          form.nickname !== detail.data.nickname ? form.nickname : undefined,
        website_url: websitePayload(detail.data, form.website),
        role: form.role !== detail.data.role ? form.role : undefined,
        status: form.status !== detail.data.status ? form.status : undefined,
        email_verified: form.email_verified,
      }
      return usersApi.update(userId, payload)
    },
    onSuccess: (updated) => {
      toast.success(t('userUpdated'))
      void queryClient.setQueryData(['users', userId], updated)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onSuccess()
    },
    onError: (submitError) => {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : t('updateUserFailed'),
      )
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editUserTitle')}</DialogTitle>
          <DialogDescription>{t('editUserHint')}</DialogDescription>
        </DialogHeader>
        {detail.isPending || !form ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {t('loadingUserProfile')}
          </div>
        ) : detail.isError ? (
          <div className="p-6 text-center text-sm text-destructive">
            {t('userProfileLoadFailed')}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-email">{t('email')}</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-nickname">{t('nickname')}</Label>
              <Input
                id="edit-nickname"
                value={form.nickname}
                onChange={(event) =>
                  setForm({ ...form, nickname: event.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-website">{t('personalWebsite')}</Label>
              <Input
                id="edit-website"
                value={form.website}
                onChange={(event) =>
                  setForm({ ...form, website: event.target.value })
                }
                placeholder={t('websiteClearHint')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t('role')}</Label>
                <RoleSelect
                  value={form.role}
                  onChange={(role) => setForm({ ...form, role })}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('status')}</Label>
                <StatusSelect
                  value={form.status}
                  onChange={(status) => setForm({ ...form, status })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <div>
                <p className="m-0 text-sm font-medium">
                  {t('emailVerifiedLabel')}
                </p>
              </div>
              <Switch
                checked={form.email_verified}
                onCheckedChange={(email_verified) =>
                  setForm({ ...form, email_verified })
                }
                aria-label={t('emailVerifiedLabel')}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={update.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t('action.cancel', { ns: 'common' })}
          </Button>
          <Button
            disabled={!form || update.isPending}
            onClick={() => update.mutate()}
          >
            {update.isPending ? <Loader2 className="animate-spin" /> : null}
            {t('action.saveChanges', { ns: 'common' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  userId,
  open,
  onOpenChange,
  onSuccess,
}: {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const reset = useMutation({
    mutationFn: () => usersApi.resetPassword(userId, { password }),
    onSuccess: () => {
      toast.success(t('passwordReset'))
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      setPassword('')
      setConfirm('')
      onSuccess()
    },
    onError: (submitError) => {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : t('passwordResetFailed'),
      )
    },
  })
  const submit = () => {
    if (password !== confirm) {
      setError(t('passwordMismatch'))
      return
    }
    if (password.length < 8) {
      setError(t('passwordMinLength'))
      return
    }
    setError('')
    reset.mutate()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('resetPasswordTitle')}</DialogTitle>
          <DialogDescription>{t('resetPasswordHint')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reset-password">{t('newPassword')}</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reset-confirm">{t('confirmPassword')}</Label>
            <Input
              id="reset-confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={reset.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t('action.cancel', { ns: 'common' })}
          </Button>
          <Button disabled={!password || reset.isPending} onClick={submit}>
            {reset.isPending ? <Loader2 className="animate-spin" /> : null}
            {t('confirmReset')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoleSelect({
  value,
  onChange,
}: {
  value: UserRole
  onChange: (value: UserRole) => void
}) {
  const { t } = useTranslation('admin')
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next || 'user')}
      items={selectItems(userRoleOptions, t)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {userRoleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.key)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function StatusSelect({
  value,
  onChange,
}: {
  value: UserStatus
  onChange: (value: UserStatus) => void
}) {
  const { t } = useTranslation('admin')
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next || 'active')}
      items={selectItems(userStatusOptions, t)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {userStatusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.key)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

// websitePayload 计算编辑表单的 website_url 提交值：
// 与当前值一致时省略，空串显式清除，否则提交新值。
function websitePayload(
  user: AdminUser,
  website: string,
): string | null | undefined {
  if (website === (user.website_url ?? '')) return undefined
  if (website === '') return null
  return website
}
