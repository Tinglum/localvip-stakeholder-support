'use client'

import * as React from 'react'
import {
  Send, Plus, Phone, Mail, MessageSquare, MapPin, Users,
  ExternalLink, ArrowRight, Clock,
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

interface OutreachRow {
  id: string
  type: string
  entity_name: string
  entity_type: string
  performed_by: string
  outcome: string
  next_step: string | null
  next_step_date: string | null
  created_at: string
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  in_person: <MapPin className="h-3.5 w-3.5" />,
  text: <MessageSquare className="h-3.5 w-3.5" />,
  social_media: <ExternalLink className="h-3.5 w-3.5" />,
  referral: <Users className="h-3.5 w-3.5" />,
}

const DEMO_OUTREACH: OutreachRow[] = [
  { id: 'o-001', type: 'call', entity_name: 'Main Street Bakery', entity_type: 'business', performed_by: 'Alex Rivera', outcome: 'Interested — wants to see the one-pager', next_step: 'Email one-pager', next_step_date: '2026-03-25', created_at: '2026-03-24T10:30:00Z' },
  { id: 'o-002', type: 'email', entity_name: 'Grace Community Church', entity_type: 'cause', performed_by: 'Casey Adams', outcome: 'Sent intro email, awaiting response', next_step: 'Follow up if no reply by Friday', next_step_date: '2026-03-28', created_at: '2026-03-24T08:15:00Z' },
  { id: 'o-003', type: 'in_person', entity_name: 'Sunrise Yoga Studio', entity_type: 'business', performed_by: 'Casey Adams', outcome: 'Owner signed agreement on the spot', next_step: 'Schedule POS setup', next_step_date: '2026-03-27', created_at: '2026-03-23T14:00:00Z' },
  { id: 'o-004', type: 'call', entity_name: 'Peachtree Auto Repair', entity_type: 'business', performed_by: 'Alex Rivera', outcome: 'Left voicemail', next_step: 'Try again tomorrow', next_step_date: '2026-03-25', created_at: '2026-03-23T11:00:00Z' },
  { id: 'o-005', type: 'social_media', entity_name: 'EastSide Barbershop', entity_type: 'business', performed_by: 'Jordan Taylor', outcome: 'DM sent on Instagram, owner responded positively', next_step: 'Schedule in-person visit', next_step_date: '2026-03-26', created_at: '2026-03-22T16:30:00Z' },
  { id: 'o-006', type: 'in_person', entity_name: 'MLK Elementary School', entity_type: 'cause', performed_by: 'Dr. Sarah Johnson', outcome: 'Met with PTA, they want to participate in HATO', next_step: 'Send HATO onboarding packet', next_step_date: '2026-03-25', created_at: '2026-03-22T10:00:00Z' },
  { id: 'o-007', type: 'email', entity_name: 'Buckhead Dental Arts', entity_type: 'business', performed_by: 'Alex Rivera', outcome: 'Sent follow-up email with business one-pager', next_step: 'Call to discuss', next_step_date: '2026-03-27', created_at: '2026-03-21T09:30:00Z' },
  { id: 'o-008', type: 'referral', entity_name: 'Green Leaf Market', entity_type: 'business', performed_by: 'Jordan Taylor', outcome: 'Referred by River Cafe owner', next_step: 'Make first contact', next_step_date: '2026-03-25', created_at: '2026-03-20T14:00:00Z' },
  { id: 'o-009', type: 'call', entity_name: 'Roswell Family Pharmacy', entity_type: 'business', performed_by: 'Casey Adams', outcome: 'Spoke with manager, will present to owner next week', next_step: 'Follow up after owner meeting', next_step_date: '2026-03-31', created_at: '2026-03-20T11:15:00Z' },
  { id: 'o-010', type: 'text', entity_name: 'Southern Paws Pet Grooming', entity_type: 'business', performed_by: 'Jordan Taylor', outcome: 'Texted owner, no response yet', next_step: 'Call if no response by EOD', next_step_date: '2026-03-25', created_at: '2026-03-19T15:45:00Z' },
]

export default function OutreachPage() {
  const [addOpen, setAddOpen] = React.useState(false)

  const columns: Column<OutreachRow>[] = [
    {
      key: 'created_at', header: 'Date', sortable: true, width: '140px',
      render: (o) => <span className="text-xs text-surface-500">{formatDateTime(o.created_at)}</span>,
    },
    {
      key: 'type', header: 'Type', width: '100px',
      render: (o) => (
        <span className="flex items-center gap-1.5">
          <span className="text-surface-400">{TYPE_ICONS[o.type]}</span>
          <span className="text-sm capitalize text-surface-600">{o.type.replace('_', ' ')}</span>
        </span>
      ),
    },
    {
      key: 'entity_name', header: 'Entity', sortable: true,
      render: (o) => (
        <div>
          <span className="font-medium text-surface-800">{o.entity_name}</span>
          <Badge variant={o.entity_type === 'business' ? 'info' : 'hato'} className="ml-2 text-[10px]">
            {o.entity_type}
          </Badge>
        </div>
      ),
    },
    { key: 'performed_by', header: 'By', sortable: true, render: (o) => <span className="text-surface-600">{o.performed_by}</span> },
    { key: 'outcome', header: 'Outcome', render: (o) => <span className="text-sm text-surface-600 line-clamp-1">{o.outcome}</span> },
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
      ) : <span className="text-surface-300">—</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outreach Activity"
        description="Every call, email, visit, and message — all in one timeline. Log it or lose it."
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Log Activity</Button>}
      />
      <DataTable
        columns={columns}
        data={DEMO_OUTREACH}
        keyField="id"
        searchPlaceholder="Search by entity, person, or outcome..."
        emptyState={<EmptyState icon={<Send className="h-8 w-8" />} title="No outreach logged yet" description="Log your first outreach activity to start building history." action={{ label: 'Log Activity', onClick: () => setAddOpen(true) }} />}
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Outreach Activity</DialogTitle>
            <DialogDescription>Record a call, visit, email, or message. This builds the relationship history.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); setAddOpen(false) }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-700">Type *</label>
                <select className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm" required>
                  <option value="">Select type</option>
                  <option value="call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="in_person">In Person</option>
                  <option value="text">Text Message</option>
                  <option value="social_media">Social Media</option>
                  <option value="referral">Referral</option>
                </select>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Entity *</label><Input required placeholder="Business or cause name" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-surface-700">Outcome *</label><Textarea required placeholder="What happened? Be specific — this is the relationship record." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Next Step</label><Input placeholder="What should happen next?" /></div>
              <div><label className="mb-1 block text-sm font-medium text-surface-700">Next Step Date</label><Input type="date" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit"><Plus className="h-4 w-4" /> Log Activity</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
