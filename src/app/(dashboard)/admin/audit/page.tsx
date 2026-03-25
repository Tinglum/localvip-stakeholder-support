'use client'

import * as React from 'react'
import { ScrollText, User, Calendar } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

interface AuditRow {
  id: string
  action: string
  entity_type: string
  entity_name: string
  user_name: string
  created_at: string
}

const DEMO_AUDIT_LOG: AuditRow[] = [
  { id: 'a-001', action: 'create', entity_type: 'business', entity_name: 'Southern Paws Pet Grooming', user_name: 'System (Website Form)', created_at: '2026-03-23T08:00:00Z' },
  { id: 'a-002', action: 'update', entity_type: 'business', entity_name: 'Main Street Bakery', user_name: 'Alex Rivera', created_at: '2026-03-22T10:30:00Z' },
  { id: 'a-003', action: 'create', entity_type: 'outreach', entity_name: 'Call to Main Street Bakery', user_name: 'Alex Rivera', created_at: '2026-03-22T10:30:00Z' },
  { id: 'a-004', action: 'create', entity_type: 'qr_code', entity_name: 'Volunteer Table Tent', user_name: 'Casey Adams', created_at: '2026-03-21T15:00:00Z' },
  { id: 'a-005', action: 'update', entity_type: 'onboarding_flow', entity_name: 'Sunrise Yoga Studio', user_name: 'Casey Adams', created_at: '2026-03-21T14:00:00Z' },
  { id: 'a-006', action: 'create', entity_type: 'user', entity_name: 'Taylor Reed', user_name: 'Rick (Admin)', created_at: '2026-03-20T09:00:00Z' },
  { id: 'a-007', action: 'update', entity_type: 'material', entity_name: 'HATO School Flyer', user_name: 'Rick (Admin)', created_at: '2026-03-19T16:30:00Z' },
  { id: 'a-008', action: 'delete', entity_type: 'task', entity_name: 'Duplicate cleanup', user_name: 'Kenneth (Super Admin)', created_at: '2026-03-18T11:00:00Z' },
  { id: 'a-009', action: 'create', entity_type: 'campaign', entity_name: 'Charlotte Pilot', user_name: 'Rick (Admin)', created_at: '2026-03-15T10:00:00Z' },
  { id: 'a-010', action: 'update', entity_type: 'profile', entity_name: 'Jordan Taylor', user_name: 'Jordan Taylor', created_at: '2026-03-14T13:00:00Z' },
]

const ACTION_VARIANT: Record<string, 'success' | 'info' | 'danger' | 'default'> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
}

export default function AuditLogPage() {
  const columns: Column<AuditRow>[] = [
    { key: 'created_at', header: 'Date', sortable: true, width: '180px', render: (a) => <span className="text-xs text-surface-500">{formatDateTime(a.created_at)}</span> },
    { key: 'action', header: 'Action', width: '100px', render: (a) => <Badge variant={ACTION_VARIANT[a.action] || 'default'}>{a.action}</Badge> },
    { key: 'entity_type', header: 'Type', width: '120px', render: (a) => <span className="text-xs text-surface-500 capitalize">{a.entity_type.replace('_', ' ')}</span> },
    { key: 'entity_name', header: 'Entity', render: (a) => <span className="font-medium text-surface-800">{a.entity_name}</span> },
    { key: 'user_name', header: 'By', render: (a) => <span className="text-surface-600">{a.user_name}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Complete history of every create, update, and delete in the system." />
      <DataTable
        columns={columns}
        data={DEMO_AUDIT_LOG}
        keyField="id"
        searchPlaceholder="Search audit log..."
        emptyState={<div className="py-12 text-center text-surface-400"><ScrollText className="mx-auto h-8 w-8 mb-2" /><p>No audit entries yet</p></div>}
      />
    </div>
  )
}
