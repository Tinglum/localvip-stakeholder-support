'use client'

import * as React from 'react'
import { UserCheck, Plus, QrCode, FileText, BarChart3 } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ROLES, BRANDS } from '@/lib/constants'
import type { UserRole, Brand } from '@/lib/types/database'

interface StakeholderRow {
  id: string
  name: string
  role: UserRole
  brand: Brand
  city: string
  referral_code: string
  qr_count: number
  businesses_contacted: number
  status: string
}

const DEMO_STAKEHOLDERS: StakeholderRow[] = [
  { id: 's-001', name: 'Alex Rivera', role: 'business_onboarding', brand: 'localvip', city: 'Atlanta', referral_code: 'alex-biz', qr_count: 8, businesses_contacted: 24, status: 'active' },
  { id: 's-002', name: 'Jordan Taylor', role: 'influencer', brand: 'localvip', city: 'Atlanta', referral_code: 'jordan-inf', qr_count: 12, businesses_contacted: 15, status: 'active' },
  { id: 's-003', name: 'Dr. Sarah Johnson', role: 'school_leader', brand: 'hato', city: 'Atlanta', referral_code: 'sarah-mlk', qr_count: 4, businesses_contacted: 8, status: 'active' },
  { id: 's-004', name: 'Marcus Williams', role: 'cause_leader', brand: 'localvip', city: 'Atlanta', referral_code: 'marcus-cs', qr_count: 3, businesses_contacted: 6, status: 'active' },
  { id: 's-005', name: 'Casey Adams', role: 'volunteer', brand: 'localvip', city: 'Atlanta', referral_code: 'casey-vol', qr_count: 2, businesses_contacted: 10, status: 'active' },
  { id: 's-006', name: 'Pat Kim', role: 'intern', brand: 'localvip', city: 'Charlotte', referral_code: 'pat-int', qr_count: 1, businesses_contacted: 5, status: 'active' },
  { id: 's-007', name: 'Sam Foster', role: 'affiliate', brand: 'localvip', city: 'Nashville', referral_code: 'sam-aff', qr_count: 6, businesses_contacted: 12, status: 'active' },
  { id: 's-008', name: 'Taylor Reed', role: 'volunteer', brand: 'hato', city: 'Birmingham', referral_code: 'taylor-vol', qr_count: 2, businesses_contacted: 7, status: 'active' },
]

export default function StakeholdersPage() {
  const [filters, setFilters] = React.useState<Record<string, string>>({})

  const filtered = React.useMemo(() => {
    let result = DEMO_STAKEHOLDERS
    if (filters.role) result = result.filter(s => s.role === filters.role)
    if (filters.brand) result = result.filter(s => s.brand === filters.brand)
    if (filters.city) result = result.filter(s => s.city === filters.city)
    return result
  }, [filters])

  const columns: Column<StakeholderRow>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (s) => <span className="font-medium text-surface-900">{s.name}</span> },
    { key: 'role', header: 'Role', sortable: true, render: (s) => <Badge variant="info">{ROLES[s.role].label}</Badge> },
    { key: 'brand', header: 'Brand', render: (s) => <Badge variant={s.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[s.brand].label}</Badge> },
    { key: 'city', header: 'City', sortable: true },
    { key: 'referral_code', header: 'Referral Code', render: (s) => <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs">{s.referral_code}</code> },
    { key: 'qr_count', header: 'QR Codes', render: (s) => <span className="flex items-center gap-1 text-surface-600"><QrCode className="h-3.5 w-3.5 text-surface-400" />{s.qr_count}</span> },
    { key: 'businesses_contacted', header: 'Contacted', sortable: true, render: (s) => <span className="text-surface-600">{s.businesses_contacted}</span> },
    { key: 'status', header: 'Status', render: (s) => <Badge variant="success" dot>{s.status}</Badge> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stakeholders"
        description="Everyone who supports LocalVIP — volunteers, influencers, affiliates, and partners."
        actions={<Button><Plus className="h-4 w-4" /> Add Stakeholder</Button>}
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyField="id"
        searchPlaceholder="Search by name, role, or city..."
        filters={[
          { key: 'role', label: 'All Roles', options: Object.entries(ROLES).map(([v, d]) => ({ value: v, label: d.label })) },
          { key: 'brand', label: 'All Brands', options: [{ value: 'localvip', label: 'LocalVIP' }, { value: 'hato', label: 'HATO' }] },
          { key: 'city', label: 'All Cities', options: [...new Set(DEMO_STAKEHOLDERS.map(s => s.city))].map(c => ({ value: c, label: c })) },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))}
        emptyState={<EmptyState icon={<UserCheck className="h-8 w-8" />} title="No stakeholders yet" description="Invite stakeholders to start building your team." />}
      />
    </div>
  )
}
