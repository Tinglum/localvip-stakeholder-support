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
import { ROLES, BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { UserRole, Brand } from '@/lib/types/database'

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  brand: Brand
  city: string
  status: string
  created_at: string
  last_active: string
}

const DEMO_USERS: UserRow[] = [
  { id: 'u-001', name: 'Kenneth', email: 'kenneth@localvip.com', role: 'super_admin', brand: 'localvip', city: 'Atlanta', status: 'active', created_at: '2024-01-01', last_active: '2026-03-25' },
  { id: 'u-002', name: 'Rick', email: 'rick@localvip.com', role: 'internal_admin', brand: 'localvip', city: 'Atlanta', status: 'active', created_at: '2024-01-01', last_active: '2026-03-25' },
  { id: 'u-003', name: 'Dr. Sarah Johnson', email: 'principal@mlkschool.edu', role: 'school_leader', brand: 'hato', city: 'Atlanta', status: 'active', created_at: '2024-01-15', last_active: '2026-03-24' },
  { id: 'u-004', name: 'Marcus Williams', email: 'director@communitystrong.org', role: 'cause_leader', brand: 'localvip', city: 'Atlanta', status: 'active', created_at: '2024-02-01', last_active: '2026-03-23' },
  { id: 'u-005', name: 'Alex Rivera', email: 'alex@partner.com', role: 'business_onboarding', brand: 'localvip', city: 'Atlanta', status: 'active', created_at: '2024-02-15', last_active: '2026-03-25' },
  { id: 'u-006', name: 'Jordan Taylor', email: 'jordan@influencer.com', role: 'influencer', brand: 'localvip', city: 'Atlanta', status: 'active', created_at: '2024-03-01', last_active: '2026-03-24' },
  { id: 'u-007', name: 'Casey Adams', email: 'volunteer@example.com', role: 'volunteer', brand: 'localvip', city: 'Atlanta', status: 'active', created_at: '2024-03-15', last_active: '2026-03-22' },
  { id: 'u-008', name: 'Pat Kim', email: 'pat@intern.com', role: 'intern', brand: 'localvip', city: 'Charlotte', status: 'active', created_at: '2026-01-10', last_active: '2026-03-25' },
  { id: 'u-009', name: 'Sam Foster', email: 'sam@affiliate.com', role: 'affiliate', brand: 'localvip', city: 'Nashville', status: 'active', created_at: '2026-02-01', last_active: '2026-03-20' },
  { id: 'u-010', name: 'Taylor Reed', email: 'taylor@volunteer.com', role: 'volunteer', brand: 'hato', city: 'Birmingham', status: 'pending', created_at: '2026-03-20', last_active: '—' },
]

export default function AdminUsersPage() {
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [filters, setFilters] = React.useState<Record<string, string>>({})

  const filtered = React.useMemo(() => {
    let result = DEMO_USERS
    if (filters.role) result = result.filter(u => u.role === filters.role)
    if (filters.status) result = result.filter(u => u.status === filters.status)
    return result
  }, [filters])

  const columns: Column<UserRow>[] = [
    {
      key: 'name', header: 'User', sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div>
            <p className="font-medium text-surface-800">{u.name}</p>
            <p className="text-xs text-surface-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', sortable: true, render: (u) => <Badge variant="info"><Shield className="h-3 w-3 mr-0.5" />{ROLES[u.role].label}</Badge> },
    { key: 'brand', header: 'Brand', render: (u) => <Badge variant={u.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[u.brand].label}</Badge> },
    { key: 'city', header: 'City', sortable: true },
    { key: 'last_active', header: 'Last Active', render: (u) => <span className="text-xs text-surface-500">{u.last_active === '—' ? '—' : formatDate(u.last_active)}</span> },
    {
      key: 'status', header: 'Status',
      render: (u) => (
        <Badge variant={u.status === 'active' ? 'success' : u.status === 'pending' ? 'warning' : 'default'} dot>
          {u.status}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage system access. Invite stakeholders, assign roles, and control permissions."
        actions={<Button onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" /> Invite User</Button>}
      />

      {/* Role summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(ROLES).slice(0, 5).map(([role, def]) => {
          const count = DEMO_USERS.filter(u => u.role === role).length
          return (
            <div key={role} className="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-0 px-3 py-2">
              <span className="text-xs text-surface-500">{def.label}</span>
              <span className="ml-auto text-sm font-bold text-surface-700">{count}</span>
            </div>
          )
        })}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        searchPlaceholder="Search by name, email, or role..."
        filters={[
          { key: 'role', label: 'All Roles', options: Object.entries(ROLES).map(([v, d]) => ({ value: v, label: d.label })) },
          { key: 'status', label: 'All Statuses', options: [{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'inactive', label: 'Inactive' }] },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))}
        emptyState={<EmptyState icon={<Users className="h-8 w-8" />} title="No users yet" description="Invite your first team member." />}
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Send an invitation email. They will create an account and land on their role-based dashboard.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setInviteOpen(false) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Full Name *</label><Input required placeholder="Full name" /></div>
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Email *</label><Input required type="email" placeholder="email@example.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Role *</label>
                <select className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm" required>
                  <option value="">Select role</option>
                  {Object.entries(ROLES).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Brand</label>
                <select className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm">
                  <option value="localvip">LocalVIP</option>
                  <option value="hato">HATO</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit"><Mail className="h-4 w-4" /> Send Invite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
