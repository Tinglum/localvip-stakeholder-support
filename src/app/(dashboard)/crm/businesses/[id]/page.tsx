'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Globe, MapPin, Calendar, Clock,
  AlertTriangle, MessageSquare, CheckSquare, StickyNote, QrCode,
  FileText, Send, Plus, ExternalLink, MoreHorizontal, User,
  Edit2, Check, X, ChevronDown, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import {
  useCampaigns,
  useRecord,
  useCauses,
  useCities,
  useMaterials,
  useOutreach, useOutreachInsert,
  useTasks, useTaskInsert, useTaskUpdate,
  useNotes, useNoteInsert,
  useBusinessUpdate,
  useProfiles,
  useQrCodes,
  useStakeholderAssignments,
} from '@/lib/supabase/hooks'
import type {
  Business,
  Campaign,
  Cause,
  City,
  Note,
  OnboardingStage,
  OutreachActivity,
  OutreachType,
  Profile,
  StakeholderAssignment,
  Task,
  TaskPriority,
  TaskStatus,
} from '@/lib/types/database'

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

// ─── Type icon helper ───────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  in_person: <MapPin className="h-4 w-4" />,
  text: <MessageSquare className="h-4 w-4" />,
  social_media: <Globe className="h-4 w-4" />,
  referral: <User className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
}

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  urgent: 'danger', high: 'warning', medium: 'info', low: 'default',
}

const OUTREACH_TYPES: { value: OutreachType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'in_person', label: 'In Person' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'referral', label: 'Referral' },
  { value: 'other', label: 'Other' },
]

const STAGE_OPTIONS: OnboardingStage[] = [
  'lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live', 'paused', 'declined',
]

// ─── Component ──────────────────────────────────────────────

export default function BusinessDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = React.useState<'overview' | 'activity' | 'tasks' | 'notes' | 'qr' | 'materials'>('overview')

  // ── Data hooks ──
  const { data: biz, loading: bizLoading } = useRecord<Business>('businesses', id)
  const { data: profiles } = useProfiles()
  const { data: cities } = useCities()
  const { data: causes } = useCauses()
  const { data: campaigns } = useCampaigns()
  const { data: qrCodes } = useQrCodes()
  const { data: materials } = useMaterials()
  const { data: assignments } = useStakeholderAssignments({ entity_id: id })
  const { data: outreach, loading: outreachLoading, refetch: refetchOutreach } = useOutreach({ entity_id: id })
  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useTasks({ entity_id: id })
  const { data: notes, loading: notesLoading, refetch: refetchNotes } = useNotes({ entity_id: id })

  // ── Mutation hooks ──
  const { update: updateBusiness, loading: updateLoading } = useBusinessUpdate()
  const { insert: insertOutreach, loading: insertingOutreach } = useOutreachInsert()
  const { insert: insertTask, loading: insertingTask } = useTaskInsert()
  const { insert: insertNote, loading: insertingNote } = useNoteInsert()
  const { update: updateTask } = useTaskUpdate()

  const profileMap = React.useMemo(() => new Map(profiles.map(item => [item.id, item])), [profiles])
  const owner = biz?.owner_id ? profileMap.get(biz.owner_id) || null : null
  const city = biz?.city_id ? cities.find(item => item.id === biz.city_id) || null : null
  const linkedCause = biz?.linked_cause_id ? causes.find(item => item.id === biz.linked_cause_id) || null : null
  const campaign = biz?.campaign_id ? campaigns.find(item => item.id === biz.campaign_id) || null : null
  const linkedQr = biz?.linked_qr_code_id ? qrCodes.find(item => item.id === biz.linked_qr_code_id) || null : null
  const linkedMaterial = biz?.linked_material_id ? materials.find(item => item.id === biz.linked_material_id) || null : null
  const helperAssignments = React.useMemo(() => assignments
    .filter(assignment => assignment.entity_type === 'business' && assignment.entity_id === id && assignment.status === 'active')
    .map(assignment => ({ assignment, profile: profileMap.get(assignment.stakeholder_id) }))
    .filter((item): item is { assignment: StakeholderAssignment; profile: Profile } => !!item.profile), [assignments, id, profileMap])

  // ── Stage change handler ──
  const [stageDropdownOpen, setStageDropdownOpen] = React.useState(false)

  const handleStageChange = React.useCallback(async (newStage: OnboardingStage) => {
    if (!biz) return
    await updateBusiness(biz.id, { stage: newStage })
    setStageDropdownOpen(false)
    // Force a page reload to reflect change since useRecord doesn't have refetch
    window.location.reload()
  }, [biz, updateBusiness])

  // ── Loading state ──
  if (bizLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading business...</span>
      </div>
    )
  }

  if (!biz) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-warning-500" />
        <p className="text-sm font-medium text-surface-700">Business not found</p>
        <p className="mt-1 text-xs text-surface-400">The business record could not be loaded.</p>
        <Link href="/crm/businesses" className="mt-4">
          <Button variant="outline" size="sm"><ArrowLeft className="h-3.5 w-3.5" /> Back to Businesses</Button>
        </Link>
      </div>
    )
  }

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
              This record may be a duplicate. Review and merge if needed.
            </p>
          </div>
          <Button variant="outline" size="sm">Review</Button>
        </div>
      )}

      {/* Onboarding Progress */}
      <Card>
        <CardContent className="py-4">
          <ProgressSteps steps={onboardingSteps} />
        </CardContent>
      </Card>

      {/* Page Header */}
      <PageHeader
        title={biz.name}
        description="Owner, city, campaign, linked cause, materials, QR, tasks, and outreach all in one place."
        breadcrumb={[
          { label: 'CRM', href: '/crm/businesses' },
          { label: 'Businesses', href: '/crm/businesses' },
          { label: biz.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {/* Stage Dropdown */}
            <div className="relative">
              <button
                onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
                className="flex items-center gap-1.5"
                disabled={updateLoading}
              >
                <Badge variant={STAGE_VARIANT[biz.stage]} dot className="text-sm">
                  {updateLoading ? 'Updating...' : ONBOARDING_STAGES[biz.stage].label}
                </Badge>
                <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
              </button>
              {stageDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setStageDropdownOpen(false)} />
                  <div className="absolute right-0 z-40 mt-1 w-44 rounded-lg border border-surface-200 bg-surface-0 py-1 shadow-lg">
                    {STAGE_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStageChange(s)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-50 ${
                          biz.stage === s ? 'font-medium text-brand-700 bg-brand-50' : 'text-surface-700'
                        }`}
                      >
                        {ONBOARDING_STAGES[s].label}
                        {biz.stage === s && <Check className="ml-auto h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <span className="text-xs text-surface-400">owned by</span>
            {owner ? (
              <Link href={`/admin/users/${owner.id}`} className="text-sm font-medium text-surface-700 transition-colors hover:text-brand-700">
                {owner.full_name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-surface-700">Unassigned</span>
            )}
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

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Primary Owner</p>
            {owner ? (
              <Link href={`/admin/users/${owner.id}`} className="text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                {owner.full_name}
              </Link>
            ) : (
              <p className="text-sm text-surface-500">No owner assigned yet.</p>
            )}
            <p className="text-xs text-surface-400">{helperAssignments.length} active helpers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">City</p>
            {city ? (
              <Link href={`/crm/cities/${city.id}`} className="text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                {city.name}, {city.state}
              </Link>
            ) : (
              <p className="text-sm text-surface-500">No city linked yet.</p>
            )}
            <p className="text-xs text-surface-400">{biz.address || 'No address on file'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Linked Cause</p>
            {linkedCause ? (
              <Link href={`/crm/causes/${linkedCause.id}`} className="text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                {linkedCause.name}
              </Link>
            ) : (
              <p className="text-sm text-surface-500">No school or cause linked yet.</p>
            )}
            <p className="text-xs text-surface-400">{linkedCause?.type || 'Link a cause to clarify the story.'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaign</p>
            {campaign ? (
              <Link href={`/campaigns/${campaign.id}`} className="text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                {campaign.name}
              </Link>
            ) : (
              <p className="text-sm text-surface-500">No campaign linked yet.</p>
            )}
            <p className="text-xs text-surface-400">{campaign?.status || 'Useful for city launch tracking.'}</p>
          </CardContent>
        </Card>
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
        <OverviewTab
          biz={biz}
          city={city}
          owner={owner}
          linkedCause={linkedCause}
          campaign={campaign}
          helperAssignments={helperAssignments}
          updateBusiness={updateBusiness}
          updateLoading={updateLoading}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityTab
          biz={biz}
          outreach={outreach}
          loading={outreachLoading}
          onInsert={insertOutreach}
          inserting={insertingOutreach}
          refetch={refetchOutreach}
          profileMap={profileMap}
          userId={profile.id}
        />
      )}

      {activeTab === 'tasks' && (
        <TasksTab
          biz={biz}
          tasks={tasks}
          loading={tasksLoading}
          onInsert={insertTask}
          inserting={insertingTask}
          onUpdate={updateTask}
          profileMap={profileMap}
          refetch={refetchTasks}
          userId={profile.id}
        />
      )}

      {activeTab === 'notes' && (
        <NotesTab
          biz={biz}
          notes={notes}
          loading={notesLoading}
          onInsert={insertNote}
          inserting={insertingNote}
          profileMap={profileMap}
          refetch={refetchNotes}
          userId={profile.id}
        />
      )}

      {activeTab === 'qr' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-800">QR Codes</h3>
            <Link href="/qr/generator">
              <Button size="sm"><Plus className="h-3.5 w-3.5" /> Generate QR Code</Button>
            </Link>
          </div>
          {linkedQr ? (
            <Card>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{linkedQr.name}</p>
                    <p className="mt-1 text-xs text-surface-500">{linkedQr.short_code} - {linkedQr.scan_count} scans</p>
                  </div>
                  <Badge variant={linkedQr.status === 'active' ? 'success' : 'default'} dot>
                    {linkedQr.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={linkedQr.redirect_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open Redirect</Button>
                  </a>
                  <Link href="/qr/generator">
                    <Button size="sm"><QrCode className="h-3.5 w-3.5" /> Manage QR</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
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
          )}
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
          {linkedMaterial ? (
            <Card>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{linkedMaterial.title}</p>
                    <p className="mt-1 text-xs text-surface-500">{linkedMaterial.file_name || linkedMaterial.type}</p>
                  </div>
                  <Badge variant={linkedMaterial.status === 'active' ? 'success' : 'default'} dot>
                    {linkedMaterial.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {linkedMaterial.file_url && (
                    <a href={linkedMaterial.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open Material</Button>
                    </a>
                  )}
                  <Link href="/materials/library">
                    <Button size="sm"><FileText className="h-3.5 w-3.5" /> Manage Materials</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-8 text-center">
                <FileText className="mb-3 h-10 w-10 text-surface-300" />
                <p className="text-sm font-medium text-surface-700">No materials assigned</p>
                <p className="mt-1 text-xs text-surface-400">Attach flyers, scripts, or documents to this business record.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────

function OverviewTab({
  biz,
  city,
  owner,
  linkedCause,
  campaign,
  helperAssignments,
  updateBusiness,
  updateLoading,
}: {
  biz: Business
  city: City | null
  owner: Profile | null
  linkedCause: Cause | null
  campaign: Campaign | null
  helperAssignments: Array<{ assignment: StakeholderAssignment; profile: Profile }>
  updateBusiness: (id: string, changes: Partial<Business>) => Promise<Business | null>
  updateLoading: boolean
}) {
  const [editingField, setEditingField] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState('')

  const startEdit = (field: string, value: string | null) => {
    setEditingField(field)
    setEditValue(value ?? '')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveEdit = async (field: string) => {
    await updateBusiness(biz.id, { [field]: editValue || null } as Partial<Business>)
    setEditingField(null)
    setEditValue('')
    window.location.reload()
  }

  const editableFields: { field: keyof Business; icon: React.ReactNode; label: string; link?: (v: string) => string }[] = [
    { field: 'email', icon: <Mail className="h-4 w-4" />, label: 'Email', link: (v) => `mailto:${v}` },
    { field: 'phone', icon: <Phone className="h-4 w-4" />, label: 'Phone', link: (v) => `tel:${v}` },
    { field: 'website', icon: <Globe className="h-4 w-4" />, label: 'Website', link: (v) => v.startsWith('http') ? v : `https://${v}` },
    { field: 'address', icon: <MapPin className="h-4 w-4" />, label: 'Address' },
    { field: 'category', icon: <User className="h-4 w-4" />, label: 'Category' },
    { field: 'source', icon: <Send className="h-4 w-4" />, label: 'Source' },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Contact Info */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {editableFields.map(({ field, icon, label, link }) => {
              const value = biz[field] as string | null
              const isEditing = editingField === field

              return (
                <div key={field} className="flex items-start gap-3 group">
                  <span className="mt-0.5 text-surface-400">{icon}</span>
                  <div className="flex-1">
                    <p className="text-xs text-surface-400">{label}</p>
                    {isEditing ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 rounded border border-surface-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(field)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                        <button
                          onClick={() => saveEdit(field)}
                          disabled={updateLoading}
                          className="rounded p-1 text-success-600 hover:bg-success-50"
                        >
                          {updateLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={cancelEdit} className="rounded p-1 text-surface-400 hover:bg-surface-100">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {value ? (
                          link ? (
                            <a href={link(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
                              {value}
                            </a>
                          ) : (
                            <p className="text-sm text-surface-700">{value}</p>
                          )
                        ) : (
                          <p className="text-sm italic text-surface-400">Not provided</p>
                        )}
                        <button
                          onClick={() => startEdit(field, value)}
                          className="ml-1 rounded p-0.5 text-surface-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-surface-500"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Relationships</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RelationshipRow label="Owner">
              {owner ? (
                <Link href={`/admin/users/${owner.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {owner.full_name}
                </Link>
              ) : (
                <span className="text-sm text-surface-500">Unassigned</span>
              )}
            </RelationshipRow>
            <RelationshipRow label="City">
              {city ? (
                <Link href={`/crm/cities/${city.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {city.name}, {city.state}
                </Link>
              ) : (
                <span className="text-sm text-surface-500">No city linked</span>
              )}
            </RelationshipRow>
            <RelationshipRow label="Cause">
              {linkedCause ? (
                <Link href={`/crm/causes/${linkedCause.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {linkedCause.name}
                </Link>
              ) : (
                <span className="text-sm text-surface-500">No cause linked</span>
              )}
            </RelationshipRow>
            <RelationshipRow label="Campaign">
              {campaign ? (
                <Link href={`/campaigns/${campaign.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                  {campaign.name}
                </Link>
              ) : (
                <span className="text-sm text-surface-500">No campaign linked</span>
              )}
            </RelationshipRow>
            <div>
              <p className="text-xs text-surface-400">Helpers</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {helperAssignments.length > 0 ? helperAssignments.map(({ assignment, profile }) => (
                  <Link
                    key={assignment.id}
                    href={`/admin/users/${profile.id}`}
                    className="rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs font-medium text-surface-700 hover:border-surface-300"
                  >
                    {profile.full_name}
                    {assignment.role ? ` - ${assignment.role}` : ''}
                  </Link>
                )) : (
                  <span className="text-sm text-surface-500">No helper assignments yet.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DateRow label="Created" value={biz.created_at} />
            <DateRow label="Last Updated" value={biz.updated_at} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Activity Tab ───────────────────────────────────────────

function ActivityTab({
  biz,
  outreach,
  loading,
  onInsert,
  inserting,
  refetch,
  profileMap,
  userId,
}: {
  biz: Business
  outreach: OutreachActivity[]
  loading: boolean
  onInsert: (record: Partial<OutreachActivity>) => Promise<OutreachActivity | null>
  inserting: boolean
  refetch: () => void
  profileMap: Map<string, Profile>
  userId: string
}) {
  const [showForm, setShowForm] = React.useState(false)
  const [formType, setFormType] = React.useState<OutreachType>('call')
  const [formSubject, setFormSubject] = React.useState('')
  const [formBody, setFormBody] = React.useState('')
  const [formOutcome, setFormOutcome] = React.useState('')

  const handleSubmit = async () => {
    if (!formBody.trim()) return
    await onInsert({
      type: formType,
      subject: formSubject || null,
      body: formBody,
      entity_type: 'business',
      entity_id: biz.id,
      performed_by: userId,
      outcome: formOutcome || null,
    })
    setFormType('call')
    setFormSubject('')
    setFormBody('')
    setFormOutcome('')
    setShowForm(false)
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-800">Outreach Timeline</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" /> Log Activity
        </Button>
      </div>

      {/* New Activity Form */}
      {showForm && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-500">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as OutreachType)}
                  className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {OUTREACH_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-500">Outcome</label>
                <input
                  type="text"
                  value={formOutcome}
                  onChange={(e) => setFormOutcome(e.target.value)}
                  placeholder="e.g. Interested, Left voicemail"
                  className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Subject</label>
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="Brief subject line"
                className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Notes / Details</label>
              <textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={3}
                placeholder="Describe what happened..."
                className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={inserting || !formBody.trim()}>
                {inserting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Save Activity
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
        </div>
      ) : outreach.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <Send className="mb-3 h-10 w-10 text-surface-300" />
            <p className="text-sm font-medium text-surface-700">No outreach activity yet</p>
            <p className="mt-1 text-xs text-surface-400">Log your first activity to start tracking this relationship.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-0">
          {outreach.map((act, idx) => (
            <div key={act.id} className="relative flex gap-4 pb-6">
              {idx < outreach.length - 1 && (
                <div className="absolute left-[15px] top-8 h-full w-px bg-surface-200" />
              )}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-100 text-surface-500">
                {TYPE_ICONS[act.type] || <Clock className="h-4 w-4" />}
              </div>
              <div className="flex-1 rounded-lg border border-surface-200 bg-surface-0 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-surface-500">{act.type.replace('_', ' ')}</span>
                  <span className="text-xs text-surface-400">{formatDateTime(act.created_at)}</span>
                </div>
                {act.subject && (
                  <p className="mt-0.5 text-sm font-medium text-surface-800">{act.subject}</p>
                )}
                {act.body && (
                  <p className="mt-1 text-sm text-surface-700">{act.body}</p>
                )}
                {act.outcome && (
                  <div className="mt-2">
                    <Badge variant="default">{act.outcome}</Badge>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-surface-400">
                  <span>By {profileMap.get(act.performed_by)?.full_name || act.performed_by}</span>
                  {act.next_step && <span>Next: {act.next_step}</span>}
                  {act.next_step_date && <span>Due {formatDate(act.next_step_date)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tasks Tab ──────────────────────────────────────────────

function TasksTab({
  biz,
  tasks,
  loading,
  onInsert,
  inserting,
  onUpdate,
  profileMap,
  refetch,
  userId,
}: {
  biz: Business
  tasks: Task[]
  loading: boolean
  onInsert: (record: Partial<Task>) => Promise<Task | null>
  inserting: boolean
  onUpdate: (id: string, changes: Partial<Task>) => Promise<Task | null>
  profileMap: Map<string, Profile>
  refetch: () => void
  userId: string
}) {
  const [showForm, setShowForm] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [priority, setPriority] = React.useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = React.useState('')

  const handleSubmit = async () => {
    if (!title.trim()) return
    await onInsert({
      title,
      priority,
      status: 'pending',
      entity_type: 'business',
      entity_id: biz.id,
      created_by: userId,
      assigned_to: userId,
      due_date: dueDate || null,
    })
    setTitle('')
    setPriority('medium')
    setDueDate('')
    setShowForm(false)
    refetch()
  }

  const toggleComplete = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed'
    await onUpdate(task.id, {
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    })
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-800">Tasks for {biz.name}</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>

      {/* New Task Form */}
      {showForm && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-500">Task Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-500">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-surface-500">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded border border-surface-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={inserting || !title.trim()}>
                {inserting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Task
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <CheckSquare className="mb-3 h-10 w-10 text-surface-300" />
            <p className="text-sm font-medium text-surface-700">No tasks yet</p>
            <p className="mt-1 text-xs text-surface-400">Create a task to track what needs to be done for this business.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleComplete(task)}>
                    <CheckSquare className={`h-4 w-4 ${task.status === 'completed' ? 'text-success-500' : 'text-surface-400'}`} />
                  </button>
                  <div>
                    <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-surface-400 line-through' : 'text-surface-800'}`}>
                      {task.title}
                    </p>
                    <p className="text-xs text-surface-400">
                      {task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}
                    </p>
                    <p className="text-xs text-surface-400">
                      Assigned to {task.assigned_to ? (profileMap.get(task.assigned_to)?.full_name || task.assigned_to) : 'Unassigned'}
                    </p>
                  </div>
                </div>
                <Badge variant={PRIORITY_VARIANT[task.priority]}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Notes Tab ──────────────────────────────────────────────

function NotesTab({
  biz,
  notes,
  loading,
  onInsert,
  inserting,
  profileMap,
  refetch,
  userId,
}: {
  biz: Business
  notes: Note[]
  loading: boolean
  onInsert: (record: Partial<Note>) => Promise<Note | null>
  inserting: boolean
  profileMap: Map<string, Profile>
  refetch: () => void
  userId: string
}) {
  const [newNote, setNewNote] = React.useState('')

  const handleSubmit = async () => {
    if (!newNote.trim()) return
    await onInsert({
      content: newNote,
      entity_type: 'business',
      entity_id: biz.id,
      created_by: userId,
      is_internal: false,
    })
    setNewNote('')
    refetch()
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-800">Notes</h3>

      {/* Add Note Form */}
      <Card>
        <CardContent className="py-4">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
            placeholder="Write a note..."
            className="w-full rounded border border-surface-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={inserting || !newNote.trim()}>
              {inserting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <StickyNote className="mb-3 h-10 w-10 text-surface-300" />
            <p className="text-sm font-medium text-surface-700">No notes yet</p>
            <p className="mt-1 text-xs text-surface-400">Add a note to capture important information about this business.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-surface-600">{profileMap.get(note.created_by)?.full_name || note.created_by}</span>
                  <span className="text-xs text-surface-400">{formatDateTime(note.created_at)}</span>
                </div>
                <p className="text-sm text-surface-700">{note.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

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

function RelationshipRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-surface-400">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  )
}
