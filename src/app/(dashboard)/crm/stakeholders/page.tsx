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
import { useProfiles } from '@/lib/supabase/hooks'
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

// ─── Page ────────────────────────────────────────────────────

export default function StakeholdersPage() {
  const { data: profiles, loading, error } = useProfiles()
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [inviteOpen, setInviteOpen] = React.useState(false)

  // Client-side filtering since useProfiles doesn't accept filters for role/brand
  const filtered = React.useMemo(() => {
    let result = profiles
    if (filters.role) result = result.filter((p) => p.role === filters.role)
    if (filters.brand) result = result.filter((p) => p.brand_context === filters.brand)
    return result
  }, [profiles, filters])

  // Gather unique brands for filter options
  const brandOptions = React.useMemo(() => {
    const brands = new Set(profiles.map((p) => p.brand_context))
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
    </div>
  )
}
