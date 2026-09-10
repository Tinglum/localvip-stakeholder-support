'use client'

import * as React from 'react'
import {
  Send, Plus, Phone, Mail, MessageSquare, MapPin, Users,
  ExternalLink, Clock, Loader2,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/utils'
import { useOutreach, useProfiles, useBusinesses, useCauses, useContacts } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { OutreachActivity } from '@/lib/types/database'
import { OutreachActivityDialog } from '@/components/crm/outreach-activity-dialog'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  in_person: <MapPin className="h-3.5 w-3.5" />,
  text: <MessageSquare className="h-3.5 w-3.5" />,
  social_media: <ExternalLink className="h-3.5 w-3.5" />,
  referral: <Users className="h-3.5 w-3.5" />,
  other: <Send className="h-3.5 w-3.5" />,
}

export default function OutreachPage() {
  const { profile } = useAuth()
  const [addOpen, setAddOpen] = React.useState(false)
  const [editingActivity, setEditingActivity] = React.useState<OutreachActivity | null>(null)

  const { data: activities, loading, error, refetch } = useOutreach()

  // Lookup data
  const { data: profiles } = useProfiles()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: contacts } = useContacts()

  // Build lookup maps
  const profileMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of profiles) map[p.id] = p.full_name
    return map
  }, [profiles])

  const entityMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const b of businesses) map[b.id] = b.name
    for (const c of causes) map[c.id] = c.name
    for (const ct of contacts) map[ct.id] = `${ct.first_name} ${ct.last_name}`
    return map
  }, [businesses, causes, contacts])

  const businessOptions = React.useMemo(() => businesses.map(b => ({ value: b.id, label: b.name })), [businesses])
  const causeOptions = React.useMemo(() => causes.map(c => ({ value: c.id, label: c.name })), [causes])
  const contactOptions = React.useMemo(() => contacts.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })), [contacts])

  const columns: Column<OutreachActivity>[] = [
    {
      key: 'created_at', header: 'Date', sortable: true, width: '140px',
      render: (o) => <span className="text-xs text-surface-500">{formatDateTime(o.created_at)}</span>,
    },
    {
      key: 'type', header: 'Type', width: '120px',
      render: (o) => (
        <span className="flex items-center gap-1.5">
          <span className="text-surface-400">{TYPE_ICONS[o.type]}</span>
          <span className="text-sm capitalize text-surface-600">{o.type.replace('_', ' ')}</span>
        </span>
      ),
    },
    {
      key: 'subject', header: 'Subject',
      render: (o) => o.subject
        ? <span className="font-medium text-surface-800">{o.subject}</span>
        : <span className="text-surface-300">&mdash;</span>,
    },
    {
      key: 'entity_type', header: 'Entity', width: '200px',
      render: (o) => (
        <span className="flex items-center gap-1.5">
          <Badge variant={o.entity_type === 'business' ? 'info' : o.entity_type === 'cause' ? 'hato' : 'default'} className="text-[10px]">
            {o.entity_type}
          </Badge>
          <span className="text-sm text-surface-600 truncate">{entityMap[o.entity_id] || 'Unknown'}</span>
        </span>
      ),
    },
    {
      key: 'performed_by', header: 'Performed By', width: '140px',
      render: (o) => (
        <span className="text-sm text-surface-600">{profileMap[o.performed_by] || 'Unknown'}</span>
      ),
    },
    {
      key: 'outcome', header: 'Outcome',
      render: (o) => o.outcome
        ? <span className="text-sm text-surface-600 line-clamp-1">{o.outcome}</span>
        : <span className="text-surface-300">&mdash;</span>,
    },
    {
      key: 'next_step', header: 'Next Step',
      render: (o) => o.next_step ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-700">{o.next_step}</span>
          {o.next_step_date && (
            <span className="flex items-center gap-0.5 text-xs text-surface-400">
              <Clock className="h-3 w-3" />{new Date(o.next_step_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      ) : <span className="text-surface-300">&mdash;</span>,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-surface-500">Loading outreach activities...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outreach Activity"
        description="Every call, email, visit, and message — all in one timeline. Log it or lose it."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Log Activity</Button>}
      />

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          Failed to load outreach activities: {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={activities}
        keyField="id"
        searchPlaceholder="Search by subject, outcome, or next step..."
        onRowClick={(item) => setEditingActivity(item)}
        emptyState={<EmptyState icon={<Send className="h-8 w-8" />} title="No outreach logged yet" description="Log your first outreach activity to start building history." action={{ label: 'Log Activity', onClick: () => setAddOpen(true) }} />}
      />

      <OutreachActivityDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        performedByName={profile?.full_name}
        performedById={profile?.id}
        businesses={businessOptions}
        causes={causeOptions}
        contacts={contactOptions}
        onSaved={refetch}
      />

      <OutreachActivityDialog
        open={!!editingActivity}
        onOpenChange={(open) => { if (!open) setEditingActivity(null) }}
        activity={editingActivity}
        performedByName={editingActivity ? (profileMap[editingActivity.performed_by] || profile?.full_name) : profile?.full_name}
        performedById={profile?.id}
        businesses={businessOptions}
        causes={causeOptions}
        contacts={contactOptions}
        onSaved={refetch}
      />
    </div>
  )
}
