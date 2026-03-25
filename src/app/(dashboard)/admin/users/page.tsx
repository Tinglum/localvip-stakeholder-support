'use client'

import * as React from 'react'
import { Users, Plus, Shield, Mail, Calendar } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ROLES, BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useProfiles } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { Profile } from '@/lib/types/database'

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  super_admin: 'danger',
  internal_admin: 'warning',
  school_leader: 'info',
  cause_leader: 'info',
  business_onboarding: 'success',
  influencer: 'default',
  affiliate: 'default',
  volunteer: 'default',
  intern: 'default',
}

export default function AdminUsersPage() {
  const { isAdmin } = useAuth()
  const { data: users, loading } = useProfiles()
  const [inviteOpen, setInviteOpen] = React.useState(false)

  const columns: Column<Profile>[] = [
    {
      key: 'full_name',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.full_name} src={row.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-surface-800">{row.full_name}</p>
            <p className="text-xs text-surface-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row) => (
        <Badge variant={ROLE_BADGE_VARIANT[row.role] || 'default'}>
          <Shield className="h-3 w-3" /> {ROLES[row.role]?.label || row.role}
        </Badge>
      ),
    },
    {
      key: 'brand_context',
      header: 'Brand',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRANDS[row.brand_context]?.color }} />
          <span className="text-sm text-surface-600">{BRANDS[row.brand_context]?.label || row.brand_context}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'default'} dot>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-1 text-sm text-surface-500">
          <Calendar className="h-3.5 w-3.5" /> {formatDate(row.created_at)}
        </span>
      ),
    },
  ]

  // Role summary counts
  const roleCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of users) {
      counts[u.role] = (counts[u.role] || 0) + 1
    }
    return counts
  }, [users])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage team members, assign roles, and control access across both brands."
        actions={
          isAdmin ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" /> Invite User
            </Button>
          ) : undefined
        }
      />

      {/* Role summary */}
      {!loading && users.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-1.5">
              <span className="text-xs font-medium text-surface-600">{ROLES[role as keyof typeof ROLES]?.label || role}</span>
              <span className="rounded-full bg-surface-200 px-2 py-0.5 text-xs font-bold text-surface-700">{count}</span>
            </div>
          ))}
        </div>
      )}

      <DataTable<Profile>
        data={users}
        columns={columns}
        keyField="id"
        searchable
        loading={loading}
        emptyState={
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No users found"
            description="Invite team members to get started."
            action={isAdmin ? { label: 'Invite User', onClick: () => setInviteOpen(true) } : undefined}
          />
        }
      />

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join the platform. They will receive an email to set up their account.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              // TODO: Implement Supabase admin invite (requires server-side action)
              alert('User invitation requires a server-side API route. This will be implemented with Supabase Edge Functions.')
              setInviteOpen(false)
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Email *</label>
              <Input type="email" placeholder="user@example.com" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Full Name *</label>
              <Input placeholder="Full name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Role</label>
                <Select defaultValue="volunteer">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([key, r]) => (
                      <SelectItem key={key} value={key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Brand</label>
                <Select defaultValue="localvip">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BRANDS).map(([key, b]) => (
                      <SelectItem key={key} value={key}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit">
                <Mail className="h-4 w-4" /> Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
