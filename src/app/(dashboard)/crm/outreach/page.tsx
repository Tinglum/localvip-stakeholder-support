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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/utils'
import { useOutreach, useOutreachInsert } from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { OutreachActivity, OutreachType } from '@/lib/types/database'

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
  const [submitting, setSubmitting] = React.useState(false)

  // Form state
  const [type, setType] = React.useState<OutreachType | ''>('')
  const [subject, setSubject] = React.useState('')
  const [entityType, setEntityType] = React.useState<'business' | 'cause' | 'contact'>('business')
  const [entityId, setEntityId] = React.useState('')
  const [outcome, setOutcome] = React.useState('')
  const [nextStep, setNextStep] = React.useState('')
  const [nextStepDate, setNextStepDate] = React.useState('')

  const { data: activities, loading, error, refetch } = useOutreach()
  const { insert } = useOutreachInsert()

  const resetForm = () => {
    setType('')
    setSubject('')
    setEntityType('business')
    setEntityId('')
    setOutcome('')
    setNextStep('')
    setNextStepDate('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type) return
    setSubmitting(true)

    const result = await insert({
      type,
      subject: subject || null,
      entity_type: entityType,
      entity_id: entityId,
      performed_by: profile.id,
      outcome: outcome || null,
      next_step: nextStep || null,
      next_step_date: nextStepDate || null,
    })

    setSubmitting(false)

    if (result) {
      setAddOpen(false)
      resetForm()
      refetch()
    }
  }

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
      key: 'entity_type', header: 'Entity Type', width: '110px',
      render: (o) => (
        <Badge variant={o.entity_type === 'business' ? 'info' : o.entity_type === 'cause' ? 'hato' : 'default'} className="text-[10px]">
          {o.entity_type}
        </Badge>
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
        emptyState={<EmptyState icon={<Send className="h-8 w-8" />} title="No outreach logged yet" description="Log your first outreach activity to start building history." action={{ label: 'Log Activity', onClick: () => setAddOpen(true) }} />}
      />

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Outreach Activity</DialogTitle>
            <DialogDescription>Record a call, visit, email, or message. This builds the relationship history.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Type *</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  required
                  value={type}
                  onChange={e => setType(e.target.value as OutreachType)}
                >
                  <option value="">Select type</option>
                  <option value="call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="in_person">In Person</option>
                  <option value="text">Text Message</option>
                  <option value="social_media">Social Media</option>
                  <option value="referral">Referral</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Entity Type *</label>
                <select
                  className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  required
                  value={entityType}
                  onChange={e => setEntityType(e.target.value as 'business' | 'cause' | 'contact')}
                >
                  <option value="business">Business</option>
                  <option value="cause">Cause</option>
                  <option value="contact">Contact</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Subject</label>
                <Input placeholder="Brief subject line" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Entity ID *</label>
                <Input required placeholder="Entity UUID" value={entityId} onChange={e => setEntityId(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Outcome</label>
              <Textarea placeholder="What happened? Be specific — this is the relationship record." value={outcome} onChange={e => setOutcome(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Next Step</label>
                <Input placeholder="What should happen next?" value={nextStep} onChange={e => setNextStep(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Next Step Date</label>
                <Input type="date" value={nextStepDate} onChange={e => setNextStepDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setAddOpen(false); resetForm() }}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {submitting ? 'Logging...' : 'Log Activity'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
