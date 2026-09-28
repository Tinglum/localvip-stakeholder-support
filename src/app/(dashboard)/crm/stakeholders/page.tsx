'use client'

import * as React from 'react'
import { UserCheck, Plus, QrCode, Loader2, Info } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProfiles, useProfileUpdate } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import { ROLES, BRANDS } from '@/lib/constants'
import type { Profile, UserRole, Brand } from '@/lib/types/database'

// ─── Invite Dialog (placeholder) ─────────────────────────────

function InviteStakeholderDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Stakeholder</DialogTitle>
          <DialogDescription>
            Invite a new stakeholder to join the platform.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div className="text-sm text-surface-700">
            <p className="font-medium text-surface-900">Use Admin &gt; Users to invite</p>
            <p className="mt-1 text-surface-500">
              Stakeholder invitations are managed through the Admin panel. Go to{' '}
              <a href="/admin/users" className="font-medium text-brand-600 hover:text-brand-700 underline">
                Admin &rarr; Users
              </a>{' '}
              to send an invite and assign a role.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <a href="/admin/users">Go to Admin &rarr; Users</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Team Member Detail Dialog ───────────────────────────────

// Roles the backend's TryResolveApplicationRole (UserController) accepts. Anything
// else in ROLES would 400. Several map to the same Identity role (e.g. field /
// launch_partner / volunteer / intern → Employee), so the role shown after save
// is whatever the backend's role reads back as.
const ASSIGNABLE_ROLES: UserRole[] = (
  ['super_admin', 'admin', 'business', 'community', 'field', 'launch_partner', 'volunteer', 'intern', 'influencer'] as UserRole[]
).filter((r) => r in ROLES)

const LABEL = 'text-xs uppercase tracking-wide text-surface-400'

function profilePhone(p: Profile) {
  return p.phone ?? (p as { phone_number?: string | null }).phone_number ?? ''
}

// The update hook surfaces the raw response body, usually `{"error":"..."}`.
function readableError(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
  } catch { /* not JSON */ }
  return raw
}

function StakeholderDetailDialog({
  profile,
  canEdit,
  onOpenChange,
  onSaved,
}: {
  profile: Profile | null
  canEdit: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { update, loading: saving, error } = useProfileUpdate()
  const [role, setRole] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('')
  const [phone, setPhone] = React.useState('')
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    if (!profile) return
    setRole(profile.role)
    setStatus(profile.status === 'active' ? 'active' : 'inactive')
    setPhone(profilePhone(profile))
    setSaved(false)
  }, [profile])

  const changes = React.useMemo(() => {
    if (!profile) return {}
    const c: Record<string, string> = {}
    if (role && role !== profile.role) c.role = role
    if (status && status !== (profile.status === 'active' ? 'active' : 'inactive')) c.status = status
    if (phone.trim() !== profilePhone(profile)) c.phone = phone.trim()
    return c
  }, [profile, role, status, phone])
  const dirty = Object.keys(changes).length > 0

  async function handleSave() {
    if (!profile || !dirty) return
    setSaved(false)
    const result = await update(profile.id, changes as Partial<Profile>)
    if (result) {
      setSaved(true)
      onSaved()
    }
  }

  const roleOptions = profile && !ASSIGNABLE_ROLES.includes(profile.role)
    ? [profile.role, ...ASSIGNABLE_ROLES]
    : ASSIGNABLE_ROLES

  return (
    <Dialog open={!!profile} onOpenChange={onOpenChange}>
      <DialogContent>
        {profile && (
          <>
            <DialogHeader>
              <DialogTitle>{profile.full_name || 'Team member'}</DialogTitle>
              <DialogDescription>{profile.email}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className={LABEL}>Role</dt>
                <dd className="mt-1 text-surface-900">
                  {canEdit ? (
                    <Select value={role} onValueChange={(v) => { setRole(v); setSaved(false) }}>
                      <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => (
                          <SelectItem key={r} value={r}>{ROLES[r]?.label ?? r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (ROLES[profile.role]?.label ?? profile.role)}
                </dd>
              </div>
              <div>
                <dt className={LABEL}>Status</dt>
                <dd className="mt-1 text-surface-900 capitalize">
                  {canEdit ? (
                    <Select value={status} onValueChange={(v) => { setStatus(v); setSaved(false) }}>
                      <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : profile.status}
                </dd>
              </div>
              <div>
                <dt className={LABEL}>Phone</dt>
                <dd className="mt-1 text-surface-900">
                  {canEdit ? (
                    <Input
                      aria-label="Phone"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setSaved(false) }}
                      placeholder="—"
                    />
                  ) : (profilePhone(profile) || '—')}
                </dd>
              </div>
              <div>
                <dt className={LABEL}>Brand</dt>
                <dd className="mt-1 text-surface-900">
                  {BRANDS[profile.brand_context]?.label ?? (profile.brand_context || '—')}
                  {canEdit && (
                    <p className="mt-0.5 text-xs text-surface-400">Not editable yet — no brand field on user accounts.</p>
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-surface-400">Referral Code</dt>
                <dd className="mt-0.5">
                  {profile.referral_code ? (
                    <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs">{profile.referral_code}</code>
                  ) : '—'}
                </dd>
              </div>
            </dl>
            {error && (
              <div role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                {readableError(error)}
              </div>
            )}
            {saved && !error && (
              <div role="status" className="rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">
                Changes saved.
              </div>
            )}
            <DialogFooter>
              {canEdit && (
                <a
                  href={`/admin/users?userId=${encodeURIComponent(profile.id)}`}
                  className="mr-auto self-center text-sm text-surface-500 hover:text-brand-600 underline-offset-2 hover:underline"
                >
                  Open in Admin
                </a>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              {canEdit && (
                <Button onClick={handleSave} disabled={!dirty || saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function StakeholdersPage() {
  const { data: profiles, loading, error, refetch } = useProfiles()
  const { isAdmin } = useAuth()
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Profile | null>(null)

  // Client-side filtering since useProfiles doesn't accept filters for role/brand
  // STAKEHOLDER DEFINITION:
  //   A user who actively drives LocalVIP — business/cause owners, field reps,
  //   admins, AND consumers whose ConsumerType is anything except "Normal"
  //   (Influencer, Volunteer, Intern, LaunchTeamPartner). Plain consumers belong
  //   in /crm/consumers, not here.
  const filtered = React.useMemo(() => {
    let result = profiles.filter((p) => {
      const meta = (p as { metadata?: Record<string, unknown> }).metadata || {}
      const qaAccountType = (meta as { qa_account_type?: unknown }).qa_account_type
      const consumerType = (p as { consumer_type?: string }).consumer_type
        ?? (meta as { consumer_type?: string }).consumer_type
        ?? (p as { ConsumerType?: string }).ConsumerType

      // If this is a Consumer account, only include them if ConsumerType !== Normal
      const isConsumerByRole = p.role === 'community'
      const isConsumerByAccountType = qaAccountType === 4 || qaAccountType === 'Consumer'
      if (isConsumerByRole || isConsumerByAccountType) {
        if (!consumerType || consumerType === 'Normal' || consumerType === '0') return false
      }
      return true
    })

    if (filters.role) result = result.filter((p) => p.role === filters.role)
    if (filters.brand) result = result.filter((p) => p.brand_context === filters.brand)
    return result
  }, [profiles, filters])

  // Gather unique brands for filter options. Team members often have an empty
  // brand_context, which used to produce a single blank option — drop those so
  // the list falls back to the real brand choices instead of a blank row.
  const brandOptions = React.useMemo(() => {
    const brands = new Set(
      profiles.map((p) => p.brand_context).filter((b): b is Brand => !!b),
    )
    return Array.from(brands).map((b) => ({
      value: b,
      label: BRANDS[b]?.label ?? b,
    }))
  }, [profiles])

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      render: (p) => (
        <div>
          <span className="font-medium text-surface-900">{p.full_name}</span>
          <p className="text-xs text-surface-400">{p.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (p) => (
        <Badge variant="info">{ROLES[p.role]?.label ?? p.role}</Badge>
      ),
    },
    {
      key: 'brand_context',
      header: 'Brand',
      render: (p) => (
        <Badge variant={p.brand_context === 'hato' ? 'hato' : 'info'}>
          {BRANDS[p.brand_context]?.label ?? p.brand_context}
        </Badge>
      ),
    },
    {
      key: 'referral_code',
      header: 'Referral Code',
      render: (p) =>
        p.referral_code ? (
          <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs">{p.referral_code}</code>
        ) : (
          <span className="text-xs text-surface-300">&mdash;</span>
        ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (p) =>
        p.phone ? (
          <span className="text-sm text-surface-600">{p.phone}</span>
        ) : (
          <span className="text-xs text-surface-300">&mdash;</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge
          variant={
            p.status === 'active' ? 'success' :
            p.status === 'pending' ? 'warning' :
            'default'
          }
          dot
        >
          {p.status}
        </Badge>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
        Failed to load stakeholders: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stakeholders"
        description="Everyone who supports LocalVIP — volunteers, influencers, affiliates, and partners."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> Add Stakeholder
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        onRowClick={setSelected}
        searchPlaceholder="Search by name, role, or email..."
        filters={[
          {
            key: 'role',
            label: 'All Roles',
            options: Object.entries(ROLES).map(([v, d]) => ({ value: v, label: d.label })),
          },
          {
            key: 'brand',
            label: 'All Brands',
            options: brandOptions.length > 0
              ? brandOptions
              : [
                  { value: 'localvip', label: 'LocalVIP' },
                  { value: 'hato', label: 'HATO' },
                ],
          },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
        emptyState={
          <EmptyState
            icon={<UserCheck className="h-8 w-8" />}
            title="No stakeholders yet"
            description="Invite stakeholders to start building your team."
          />
        }
      />

      <InviteStakeholderDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <StakeholderDetailDialog
        profile={selected}
        canEdit={isAdmin}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
        onSaved={() => refetch({ silent: true })}
      />
    </div>
  )
}
