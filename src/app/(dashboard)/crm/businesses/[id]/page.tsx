'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Globe, MapPin, Calendar, Clock,
  AlertTriangle, MessageSquare, CheckSquare, StickyNote, QrCode,
  FileText, Send, Plus, ExternalLink, MoreHorizontal, User,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { OnboardingStage } from '@/lib/types/database'

// ─── Stage badge variant ────────────────────────────────────

const STAGE_VARIANT: Record<OnboardingStage, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  lead: 'default',
  contacted: 'info',
  interested: 'info',
  in_progress: 'warning',
  onboarded: 'success',
  live: 'success',
  paused: 'warning',
  declined: 'danger',
}

// ─── Demo detail data ───────────────────────────────────────

interface BusinessDetail {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string
  city: string
  category: string
  stage: OnboardingStage
  owner: string
  owner_email: string
  source: string
  status: string
  duplicate_of: string | null
  duplicate_name: string | null
  created_at: string
  updated_at: string
  first_contact: string | null
  onboarded_at: string | null
}

const DEMO_DETAIL: Record<string, BusinessDetail> = {
  'biz-001': {
    id: 'biz-001', name: 'Main Street Bakery', email: 'hello@mainstreetbakery.com',
    phone: '(404) 555-0101', website: 'mainstreetbakery.com',
    address: '142 Main St, Atlanta, GA 30301', city: 'Atlanta',
    category: 'Restaurant / Bakery', stage: 'interested', owner: 'Alex Rivera',
    owner_email: 'alex@partner.com', source: 'Walk-in', status: 'active',
    duplicate_of: 'biz-009', duplicate_name: 'Main St. Bakery & Cafe',
    created_at: '2026-02-10T00:00:00Z', updated_at: '2026-03-22T10:30:00Z',
    first_contact: '2026-02-14T00:00:00Z', onboarded_at: null,
  },
  'biz-002': {
    id: 'biz-002', name: 'Peachtree Auto Repair', email: 'service@peachtreeauto.com',
    phone: '(404) 555-0202', website: 'peachtreeauto.com',
    address: '890 Peachtree Rd, Atlanta, GA 30308', city: 'Atlanta',
    category: 'Automotive', stage: 'in_progress', owner: 'Alex Rivera',
    owner_email: 'alex@partner.com', source: 'Referral', status: 'active',
    duplicate_of: null, duplicate_name: null,
    created_at: '2026-01-22T00:00:00Z', updated_at: '2026-03-21T14:00:00Z',
    first_contact: '2026-01-25T00:00:00Z', onboarded_at: null,
  },
  'biz-003': {
    id: 'biz-003', name: 'River Cafe', email: 'info@rivercafe.co',
    phone: '(404) 555-0303', website: 'rivercafe.co',
    address: '55 River Walk Dr, Atlanta, GA 30339', city: 'Atlanta',
    category: 'Restaurant / Cafe', stage: 'onboarded', owner: 'Jordan Taylor',
    owner_email: 'jordan@influencer.com', source: 'Campaign - Spring 2026', status: 'active',
    duplicate_of: null, duplicate_name: null,
    created_at: '2026-01-05T00:00:00Z', updated_at: '2026-03-20T09:15:00Z',
    first_contact: '2026-01-08T00:00:00Z', onboarded_at: '2026-03-15T00:00:00Z',
  },
}

const DEMO_ACTIVITY = [
  { id: 'act-1', type: 'call' as const, summary: 'Follow-up call — owner confirmed interest in LocalVIP partnership. Wants to see sample QR materials.', performed_by: 'Alex Rivera', date: '2026-03-22T10:30:00Z', outcome: 'Interested' },
  { id: 'act-2', type: 'email' as const, summary: 'Sent introductory email with one-pager PDF and pricing overview.', performed_by: 'Alex Rivera', date: '2026-03-18T09:00:00Z', outcome: 'Delivered' },
  { id: 'act-3', type: 'in_person' as const, summary: 'Walked in to introduce LocalVIP. Spoke with manager on duty. Left flyer.', performed_by: 'Alex Rivera', date: '2026-02-14T14:00:00Z', outcome: 'Contacted' },
  { id: 'act-4', type: 'email' as const, summary: 'Added as lead from walk-in outreach in downtown Atlanta territory.', performed_by: 'System', date: '2026-02-10T00:00:00Z', outcome: 'Lead Created' },
]

const DEMO_TASKS = [
  { id: 'task-1', title: 'Send QR code sample pack', priority: 'high' as const, status: 'pending' as const, due: '2026-03-25', assignee: 'Alex Rivera' },
  { id: 'task-2', title: 'Schedule onboarding walkthrough', priority: 'medium' as const, status: 'pending' as const, due: '2026-03-28', assignee: 'Alex Rivera' },
  { id: 'task-3', title: 'Verify business license info', priority: 'low' as const, status: 'completed' as const, due: '2026-03-15', assignee: 'Casey Adams' },
]

const DEMO_NOTES = [
  { id: 'note-1', content: 'Owner (Maria) prefers morning calls before 10 AM. Husband co-owns but is not involved in marketing decisions.', author: 'Alex Rivera', date: '2026-03-22T10:45:00Z' },
  { id: 'note-2', content: 'Bakery does strong weekend foot traffic. Would be a great candidate for in-store QR standee display.', author: 'Casey Adams', date: '2026-02-14T14:30:00Z' },
]

// ─── Type icon helper ───────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  in_person: <MapPin className="h-4 w-4" />,
  text: <MessageSquare className="h-4 w-4" />,
  social_media: <Globe className="h-4 w-4" />,
  referral: <User className="h-4 w-4" />,
}

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  urgent: 'danger', high: 'warning', medium: 'info', low: 'default',
}

// ─── Component ──────────────────────────────────────────────

export default function BusinessDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [activeTab, setActiveTab] = React.useState<'overview' | 'activity' | 'tasks' | 'notes' | 'qr' | 'materials'>('overview')

  // Resolve demo data (fallback to first entry for unknown IDs)
  const biz = DEMO_DETAIL[id] || DEMO_DETAIL['biz-001']

  const stageOrder = ONBOARDING_STAGES[biz.stage].order
  const onboardingSteps = [
    { label: 'Lead', completed: stageOrder >= 0, current: biz.stage === 'lead' },
    { label: 'Contacted', completed: stageOrder >= 1, current: biz.stage === 'contacted' },
    { label: 'Interested', completed: stageOrder >= 2, current: biz.stage === 'interested' },
    { label: 'In Progress', completed: stageOrder >= 3, current: biz.stage === 'in_progress' },
    { label: 'Onboarded', completed: stageOrder >= 4, current: biz.stage === 'onboarded' },
    { label: 'Live', completed: stageOrder >= 5, current: biz.stage === 'live' },
  ]

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'activity' as const, label: 'Activity' },
    { key: 'tasks' as const, label: 'Tasks' },
    { key: 'notes' as const, label: 'Notes' },
    { key: 'qr' as const, label: 'QR Codes' },
    { key: 'materials' as const, label: 'Materials' },
  ]

  return (
    <div className="space-y-6">
      {/* Duplicate Warning Banner */}
      {biz.duplicate_of && (
        <div className="flex items-center gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-800">Potential duplicate detected</p>
            <p className="text-xs text-warning-600">
              This record may be a duplicate of <span className="font-medium">{biz.duplicate_name}</span>. Review and merge if needed.
            </p>
          </div>
          <Button variant="outline" size="sm">Review</Button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title={biz.name}
        breadcrumb={[
          { label: 'CRM', href: '/crm/businesses' },
          { label: 'Businesses', href: '/crm/businesses' },
          { label: biz.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STAGE_VARIANT[biz.stage]} dot className="text-sm">
              {ONBOARDING_STAGES[biz.stage].label}
            </Badge>
            <span className="text-xs text-surface-400">owned by</span>
            <span className="text-sm font-medium text-surface-700">{biz.owner}</span>
          </div>
        }
      />

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setActiveTab('activity')}>
          <Send className="h-3.5 w-3.5" /> Log Activity
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab('tasks')}>
          <CheckSquare className="h-3.5 w-3.5" /> Add Task
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab('notes')}>
          <StickyNote className="h-3.5 w-3.5" /> Add Note
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveTab('qr')}>
          <QrCode className="h-3.5 w-3.5" /> Generate QR Code
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Contact Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={biz.email} link={biz.email ? `mailto:${biz.email}` : undefined} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={biz.phone} link={biz.phone ? `tel:${biz.phone}` : undefined} />
                <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={biz.website} link={biz.website ? `https://${biz.website}` : undefined} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={biz.address} />
                <InfoRow icon={<User className="h-4 w-4" />} label="Category" value={biz.category} />
                <InfoRow icon={<Send className="h-4 w-4" />} label="Source" value={biz.source} />
              </div>
            </CardContent>
          </Card>

          {/* Key Dates */}
          <Card>
            <CardHeader>
              <CardTitle>Key Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DateRow label="Created" value={biz.created_at} />
              <DateRow label="First Contact" value={biz.first_contact} />
              <DateRow label="Onboarded" value={biz.onboarded_at} />
              <DateRow label="Last Updated" value={biz.updated_at} />
            </CardContent>
          </Card>

          {/* Onboarding Progress */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Onboarding Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressSteps steps={onboardingSteps} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-800">Outreach Timeline</h3>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Log Activity</Button>
          </div>
          <div className="relative space-y-0">
            {DEMO_ACTIVITY.map((act, idx) => (
              <div key={act.id} className="relative flex gap-4 pb-6">
                {/* Timeline line */}
                {idx < DEMO_ACTIVITY.length - 1 && (
                  <div className="absolute left-[15px] top-8 h-full w-px bg-surface-200" />
                )}
                {/* Icon */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-100 text-surface-500">
                  {TYPE_ICONS[act.type] || <Clock className="h-4 w-4" />}
                </div>
                {/* Content */}
                <div className="flex-1 rounded-lg border border-surface-200 bg-surface-0 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-surface-500">{act.performed_by}</span>
                    <span className="text-xs text-surface-400">{formatDateTime(act.date)}</span>
                  </div>
                  <p className="mt-1 text-sm text-surface-700">{act.summary}</p>
                  <div className="mt-2">
                    <Badge variant="default">{act.outcome}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-800">Tasks for {biz.name}</h3>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add Task</Button>
          </div>
          <div className="space-y-2">
            {DEMO_TASKS.map((task) => (
              <Card key={task.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <CheckSquare className={`h-4 w-4 ${task.status === 'completed' ? 'text-success-500' : 'text-surface-400'}`} />
                    <div>
                      <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-surface-400 line-through' : 'text-surface-800'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-surface-400">{task.assignee} &middot; Due {formatDate(task.due)}</p>
                    </div>
                  </div>
                  <Badge variant={PRIORITY_VARIANT[task.priority]}>
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-800">Notes</h3>
            <Button size="sm"><Plus className="h-3.5 w-3.5" /> Add Note</Button>
          </div>
          <div className="space-y-3">
            {DEMO_NOTES.map((note) => (
              <Card key={note.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-surface-600">{note.author}</span>
                    <span className="text-xs text-surface-400">{formatDateTime(note.date)}</span>
                  </div>
                  <p className="text-sm text-surface-700">{note.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'qr' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-800">QR Codes</h3>
            <Link href="/qr/generator">
              <Button size="sm"><Plus className="h-3.5 w-3.5" /> Generate QR Code</Button>
            </Link>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center py-8 text-center">
              <QrCode className="mb-3 h-10 w-10 text-surface-300" />
              <p className="text-sm font-medium text-surface-700">No QR codes generated yet</p>
              <p className="mt-1 text-xs text-surface-400">Create a trackable QR code to link customers to this business.</p>
              <Link href="/qr/generator" className="mt-4">
                <Button size="sm">Generate First QR Code</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-800">Materials</h3>
            <Link href="/materials/library">
              <Button variant="outline" size="sm"><FileText className="h-3.5 w-3.5" /> Browse Library</Button>
            </Link>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center py-8 text-center">
              <FileText className="mb-3 h-10 w-10 text-surface-300" />
              <p className="text-sm font-medium text-surface-700">No materials assigned</p>
              <p className="mt-1 text-xs text-surface-400">Attach flyers, scripts, or documents to this business record.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function InfoRow({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: string | null; link?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-surface-400">{icon}</span>
      <div>
        <p className="text-xs text-surface-400">{label}</p>
        {value ? (
          link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
              {value}
            </a>
          ) : (
            <p className="text-sm text-surface-700">{value}</p>
          )
        ) : (
          <p className="text-sm italic text-surface-400">Not provided</p>
        )}
      </div>
    </div>
  )
}

function DateRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-surface-500">{label}</span>
      <span className="text-sm text-surface-700">
        {value ? formatDate(value) : <span className="italic text-surface-400">--</span>}
      </span>
    </div>
  )
}
