'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, Globe, MapPin, Clock,
  AlertTriangle, MessageSquare, CheckSquare, StickyNote, QrCode as QrCodeIcon,
  FileText, Send, Plus, ExternalLink, MoreHorizontal, User,
  Check, ChevronDown, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProgressSteps } from '@/components/ui/progress-steps'
import { BusinessExecutionOverview } from '@/components/crm/business-execution-overview'
import { LogInAsButton } from '@/components/crm/log-in-as-button'
import { QaImportedFieldsPanel, QaWritebackWishlistTable, type QaImportedFact, type QaWritebackRow } from '@/components/crm/qa-linking-panels'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { EMPTY_UUID, asUuid } from '@/lib/uuid'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import { useCrmBusiness, useCrmBusinessLocalState } from '@/lib/hooks/crm-businesses'
import {
  useOutreach, useOutreachInsert,
  useTasks, useTaskInsert, useTaskUpdate,
  useNotes, useNoteInsert,
  useBusinessUpdate,
} from '@/lib/supabase/hooks'
import type { CrmBusiness, QaBusinessDetail } from '@/lib/crm-api'
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
  QrCode,
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const qaBusinessId = React.useMemo(() => {
    const value = searchParams.get('qaId')
    return value && /^\d+$/.test(value) ? Number(value) : null
  }, [searchParams])
  const { profile } = useAuth()
  const localProfileId = asUuid(profile.id)
  const [activeTab, setActiveTab] = React.useState<'overview' | 'activity' | 'tasks' | 'notes' | 'qr' | 'materials'>('overview')

  // ── Data hooks ──
  const { data: businessResponse, loading: bizLoading, error: bizError, refetch: refetchBusiness } = useCrmBusiness(id, qaBusinessId)
  const biz = businessResponse?.business || null
  const localBusinessId = businessResponse?.localBusinessId || null
  const qaBusiness = businessResponse?.qaBusiness || null
  const readOnly = businessResponse?.readOnly || false
  const detailQaError = businessResponse?.qaError || null
  const localEntityId = localBusinessId || EMPTY_UUID
  const { data: localState, loading: localStateLoading, error: localStateError, refetch: refetchLocalState } = useCrmBusinessLocalState(localBusinessId)
  const profiles = localState?.profiles || []
  const cities = localState?.cities || []
  const causes = localState?.causes || []
  const campaigns = localState?.campaigns || []
  const qrCodes = localState?.qrCodes || []
  const materials = localState?.materials || []
  const allStakeholders = localState?.stakeholders || []
  const allGeneratedMaterials = localState?.generatedMaterials || []
  const assignments = localState?.assignments || []
  const { data: outreach, loading: outreachLoading } = useOutreach({ entity_id: localEntityId })
  const { data: tasks, loading: tasksLoading } = useTasks({ entity_id: localEntityId })
  const { data: notes, loading: notesLoading } = useNotes({ entity_id: localEntityId })

  // ── Mutation hooks ──
  const { update: updateBusiness, loading: updateLoading } = useBusinessUpdate()
  const { insert: insertOutreach, loading: insertingOutreach } = useOutreachInsert()
  const { insert: insertTask, loading: insertingTask } = useTaskInsert()
  const { insert: insertNote, loading: insertingNote } = useNoteInsert()
  const { update: updateTask } = useTaskUpdate()

  const outreachItems = localState?.outreach || outreach
  const outreachBusy = localState ? false : outreachLoading
  const taskItems = localState?.tasks || tasks
  const tasksBusy = localState ? false : tasksLoading
  const noteItems = localState?.notes || notes
  const notesBusy = localState ? false : notesLoading

  const profileMap = React.useMemo(() => new Map(profiles.map(item => [item.id, item])), [profiles])
  const city = biz?.city_id ? cities.find(item => item.id === biz.city_id) || null : null
  const linkedCause = biz?.linked_cause_id ? causes.find(item => item.id === biz.linked_cause_id) || null : null
  const campaign = biz?.campaign_id ? campaigns.find(item => item.id === biz.campaign_id) || null : null
  const linkedQr = biz?.linked_qr_code_id ? qrCodes.find(item => item.id === biz.linked_qr_code_id) || null : null
  const linkedMaterial = biz?.linked_material_id ? materials.find(item => item.id === biz.linked_material_id) || null : null
  const businessStakeholder = allStakeholders.find(s => localBusinessId && s.business_id === localBusinessId) || null
  const owner = React.useMemo(() => {
    if (!biz) return null
    if (biz.owner_id) return profileMap.get(biz.owner_id) || null
    if (businessStakeholder?.profile_id) return profileMap.get(businessStakeholder.profile_id) || null
    if (businessStakeholder?.owner_user_id) return profileMap.get(businessStakeholder.owner_user_id) || null
    return null
  }, [biz, businessStakeholder, profileMap])
  const businessGeneratedMaterials = React.useMemo(() => {
    if (!businessStakeholder) return []
    return allGeneratedMaterials
      .filter(gm => gm.stakeholder_id === businessStakeholder.id && gm.generation_status === 'generated')
      .map(gm => ({
        generated: gm,
        material: materials.find(m => m.id === gm.material_id) || null,
      }))
      .filter(item => item.material)
  }, [allGeneratedMaterials, businessStakeholder, materials])
  const helperAssignments = React.useMemo(() => assignments
    .filter(assignment => assignment.entity_type === 'business' && assignment.entity_id === localEntityId && assignment.status === 'active')
    .map(assignment => ({ assignment, profile: profileMap.get(assignment.stakeholder_id) }))
    .filter((item): item is { assignment: StakeholderAssignment; profile: Profile } => !!item.profile), [assignments, localEntityId, profileMap])
  const qaLinkedBusinessId = businessResponse?.qaBusinessId || biz?.qa_account_id || qaBusinessId || null
  const qaImportedFacts = React.useMemo<QaImportedFact[]>(() => {
    if (!biz || !qaLinkedBusinessId) return []

    return [
      { label: 'QA business ID', value: String(qaLinkedBusinessId) },
      { label: 'Business name', value: biz.name },
      { label: 'Headline', value: biz.headline },
      { label: 'Owner name', value: biz.owner_name },
      { label: 'Owner email', value: biz.owner_email || biz.email },
      { label: 'Owner phone', value: biz.owner_phone || biz.phone },
      { label: 'Address 1', value: biz.address1 },
      { label: 'Address 2', value: biz.address2 },
      { label: 'Full address', value: biz.full_address || biz.address },
      { label: 'City', value: biz.city_name },
      { label: 'State', value: biz.state },
      { label: 'Zip code', value: biz.zip_code },
      { label: 'Country', value: biz.country },
      { label: 'Description', value: biz.description || biz.public_description },
      { label: 'Marketing', value: biz.marketing !== null && biz.marketing !== undefined ? String(biz.marketing) : null },
      { label: 'Transaction fee', value: biz.tx_fee !== null && biz.tx_fee !== undefined ? String(biz.tx_fee) : null },
      { label: 'Sales tax', value: biz.sales_tax !== null && biz.sales_tax !== undefined ? String(biz.sales_tax) : null },
      { label: 'Tax ID', value: biz.tax_id },
      { label: 'Time zone', value: biz.time_zone },
      { label: 'Stripe onboarding', value: biz.stripe_onboarding_complete === null || biz.stripe_onboarding_complete === undefined ? null : biz.stripe_onboarding_complete ? 'Complete' : 'Not complete' },
      { label: 'QA status', value: biz.active === null || biz.active === undefined ? null : biz.active ? 'Active' : 'Inactive' },
    ]
  }, [biz, qaLinkedBusinessId])
  const writebackRows = React.useMemo<QaWritebackRow[]>(() => {
    if (!biz) return []

    const rows: QaWritebackRow[] = []
    const pushRow = (field: string, currentValue: string | null | undefined, qaNeed: string, status = 'Needs QA field') => {
      if (!currentValue || !String(currentValue).trim()) return
      rows.push({ field, currentValue: String(currentValue), qaNeed, status })
    }

    pushRow('Dashboard stage', ONBOARDING_STAGES[biz.stage]?.label || biz.stage, 'onboarding_stage + write API')
    pushRow('Campaign link', campaign?.name, 'campaign_id or account_campaign relation')
    pushRow('Linked cause', linkedCause?.name, 'linked_nonprofit_account_id relation')
    pushRow('Cover photo', biz.cover_photo_url, 'cover_photo_url')
    pushRow('Average ticket', biz.avg_ticket, 'average_ticket')
    pushRow('Products / services', biz.products_services?.join(', '), 'products_services')
    pushRow('Activation status', biz.activation_status, 'activation_status')
    pushRow('Launch phase', biz.launch_phase, 'launch_phase')
    pushRow('Linked QR code', linkedQr?.name, 'qr_code relation / qr domain APIs')
    pushRow('Linked material', linkedMaterial?.title, 'material relation / material APIs')
    pushRow('Tasks', taskItems.length > 0 ? `${taskItems.length} tracked task${taskItems.length === 1 ? '' : 's'}` : null, 'tasks table + read/write APIs', 'Needs QA workflow domain')
    pushRow('Notes', noteItems.length > 0 ? `${noteItems.length} saved note${noteItems.length === 1 ? '' : 's'}` : null, 'notes table + read/write APIs', 'Needs QA workflow domain')
    pushRow('Outreach activity', outreachItems.length > 0 ? `${outreachItems.length} logged ${outreachItems.length === 1 ? 'activity' : 'activities'}` : null, 'outreach activity table + read/write APIs', 'Needs QA workflow domain')

    return rows
  }, [biz, campaign?.name, linkedCause?.name, linkedMaterial?.title, linkedQr?.name, noteItems.length, outreachItems.length, taskItems.length])

  const refetchBusinessDetail = React.useCallback(() => {
    refetchBusiness()
    refetchLocalState()
  }, [refetchBusiness, refetchLocalState])

  // ── Stage change handler ──
  const [stageDropdownOpen, setStageDropdownOpen] = React.useState(false)
  const [linkCauseOpen, setLinkCauseOpen] = React.useState(false)
  const [linkCampaignOpen, setLinkCampaignOpen] = React.useState(false)
  const [reviewDupOpen, setReviewDupOpen] = React.useState(false)
  const [reviewDupLoading, setReviewDupLoading] = React.useState(false)
  const [pendingCauseId, setPendingCauseId] = React.useState(biz?.linked_cause_id || '__none')
  const [pendingCampaignId, setPendingCampaignId] = React.useState(biz?.campaign_id || '__none')

  const handleStageChange = React.useCallback(async (newStage: OnboardingStage) => {
    if (!biz || !localBusinessId || readOnly) return
    await updateBusiness(localBusinessId, { stage: newStage })
    setStageDropdownOpen(false)
    window.location.reload()
  }, [biz, localBusinessId, readOnly, updateBusiness])

  React.useEffect(() => {
    setPendingCauseId(biz?.linked_cause_id || '__none')
    setPendingCampaignId(biz?.campaign_id || '__none')
  }, [biz?.campaign_id, biz?.linked_cause_id])

  React.useEffect(() => {
    if (readOnly && activeTab !== 'overview') {
      setActiveTab('overview')
    }
  }, [activeTab, readOnly])

  React.useEffect(() => {
    if (!localBusinessId || localBusinessId === id) return
    const nextQaId = businessResponse?.qaBusinessId || qaBusinessId
    const nextHref = `/crm/businesses/${localBusinessId}${nextQaId !== null ? `?qaId=${nextQaId}` : ''}`
    router.replace(nextHref)
  }, [businessResponse?.qaBusinessId, id, localBusinessId, qaBusinessId, router])

  const handleNotDuplicate = async () => {
    if (!biz || !localBusinessId || readOnly) return
    setReviewDupLoading(true)
    await updateBusiness(localBusinessId, { duplicate_of: null })
    setReviewDupOpen(false)
    window.location.reload()
  }

  const handleArchiveAsDuplicate = async () => {
    if (!biz || !localBusinessId || readOnly) return
    setReviewDupLoading(true)
    await updateBusiness(localBusinessId, { status: 'archived' })
    setReviewDupOpen(false)
    window.location.reload()
  }

  const handleCauseLinkSave = React.useCallback(async () => {
    if (!biz || !localBusinessId || readOnly) return
    await updateBusiness(localBusinessId, {
      linked_cause_id: pendingCauseId === '__none' ? null : pendingCauseId,
    })
    setLinkCauseOpen(false)
    window.location.reload()
  }, [biz, localBusinessId, pendingCauseId, readOnly, updateBusiness])

  const handleCampaignLinkSave = React.useCallback(async () => {
    if (!biz || !localBusinessId || readOnly) return
    await updateBusiness(localBusinessId, {
      campaign_id: pendingCampaignId === '__none' ? null : pendingCampaignId,
    })
    setLinkCampaignOpen(false)
    window.location.reload()
  }, [biz, localBusinessId, pendingCampaignId, readOnly, updateBusiness])

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
        <p className="mt-1 text-xs text-surface-400">{bizError || detailQaError || 'The business record could not be loaded.'}</p>
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

  const tabs = readOnly
    ? [{ key: 'overview' as const, label: 'Overview' }]
    : [
        { key: 'overview' as const, label: 'Overview' },
        { key: 'activity' as const, label: 'Activity' },
        { key: 'tasks' as const, label: 'Tasks' },
        { key: 'notes' as const, label: 'Notes' },
        { key: 'qr' as const, label: 'QR Codes' },
        { key: 'materials' as const, label: 'Materials' },
      ]
  const qrGeneratorHref = localBusinessId
    ? `/qr/generator?businessId=${localBusinessId}&returnTo=${encodeURIComponent(`/crm/businesses/${id}${qaBusinessId ? `?qaId=${qaBusinessId}` : ''}`)}`
    : '/qr/generator'

  return (
    <div className="space-y-6">
      {bizError && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">Business detail warning</p>
            <p className="mt-1 text-xs text-warning-700">{bizError}</p>
          </div>
        </div>
      )}

      {detailQaError && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">QA business sync warning</p>
            <p className="mt-1 text-xs text-warning-700">{detailQaError}</p>
          </div>
        </div>
      )}

      {localStateError && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">Business workspace warning</p>
            <p className="mt-1 text-xs text-warning-700">{localStateError}</p>
          </div>
        </div>
      )}

      {qaLinkedBusinessId && (
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <p className="font-medium">QA-linked business record</p>
            <p className="mt-1 text-xs text-sky-800">
              Blue cards on this page are imported live from the QA server every time this business is opened. Dashboard tabs like onboarding, tasks, notes, outreach, QR, and materials remain dashboard-managed for now.
            </p>
          </div>
        </div>
      )}

      {readOnly && (
        <div className="flex items-start gap-3 rounded-lg border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-info-600" />
          <div>
            <p className="font-medium">QA record loaded in read-only mode</p>
            <p className="mt-1 text-xs text-info-700">
              This business exists in QA, but it does not have a linked local dashboard record yet. Tasks, notes, and launch actions stay disabled until we import or link it.
            </p>
          </div>
        </div>
      )}

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
          <Button variant="outline" size="sm" onClick={() => setReviewDupOpen(true)}>Review</Button>
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
        description={readOnly
          ? 'Viewing the live QA business payload without a local dashboard link yet.'
          : 'Owner, city, campaign, linked cause, materials, QR, tasks, and outreach all in one place.'}
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
                disabled={updateLoading || readOnly}
              >
                <Badge variant={STAGE_VARIANT[biz.stage]} dot className="text-sm">
                  {readOnly ? 'Read only' : updateLoading ? 'Updating...' : ONBOARDING_STAGES[biz.stage].label}
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
            <span className="text-xs text-surface-400">{readOnly ? 'QA owner' : 'owned by'}</span>
            {owner ? (
              <Link href={`/admin/users/${owner.id}`} className="text-sm font-medium text-surface-700 transition-colors hover:text-brand-700">
                {owner.full_name}
              </Link>
            ) : biz.owner_name ? (
              <span className="text-sm font-medium text-surface-700">{biz.owner_name}</span>
            ) : (
              <span className="text-sm font-medium text-surface-700">Unassigned</span>
            )}
          </div>
        }
      />

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {!readOnly ? (
          <>
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
              <QrCodeIcon className="h-3.5 w-3.5" /> Generate QR Code
            </Button>
            <div className="ml-auto">
              <LogInAsButton
                userId={owner?.id || businessStakeholder?.profile_id || businessStakeholder?.owner_user_id || null}
                userName={owner?.full_name || biz.name}
                stakeholderType="Business"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-surface-500">
            Dashboard actions will unlock after this QA record is linked to a local business.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Primary Owner</p>
            {owner ? (
              <Link href={`/admin/users/${owner.id}`} className="text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                {owner.full_name}
              </Link>
            ) : biz.owner_name ? (
              <div>
                <p className="text-sm font-semibold text-surface-900">{biz.owner_name}</p>
                <p className="text-xs text-surface-400">{biz.owner_email || 'QA owner email not provided'}</p>
              </div>
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
            ) : biz.city_name || biz.state ? (
              <p className="text-sm font-semibold text-surface-900">
                {[biz.city_name, biz.state].filter(Boolean).join(', ')}
              </p>
            ) : (
              <p className="text-sm text-surface-500">No city linked yet.</p>
            )}
            <p className="text-xs text-surface-400">{biz.full_address || biz.address || 'No address on file'}</p>
          </CardContent>
        </Card>
        <Card className="transition-colors hover:border-brand-200">
          <button
            type="button"
            onClick={() => !readOnly && setLinkCauseOpen(true)}
            className="block w-full text-left"
            disabled={readOnly}
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Linked Cause</p>
                <span className="text-xs font-medium text-brand-700">{readOnly ? 'Read only' : linkedCause ? 'Change' : 'Link now'}</span>
              </div>
              {linkedCause ? (
                <span className="inline-block text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                  {linkedCause.name}
                </span>
              ) : (
                <p className="text-sm text-surface-500">No school or cause linked yet.</p>
              )}
              <p className="text-xs text-surface-400">{linkedCause?.type || 'Click to link a cause and clarify the story.'}</p>
            </CardContent>
          </button>
        </Card>
        <Card className="transition-colors hover:border-brand-200">
          <button
            type="button"
            onClick={() => !readOnly && setLinkCampaignOpen(true)}
            className="block w-full text-left"
            disabled={readOnly}
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaign</p>
                <span className="text-xs font-medium text-brand-700">{readOnly ? 'Read only' : campaign ? 'Change' : 'Link now'}</span>
              </div>
              {campaign ? (
                <span className="inline-block text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                  {campaign.name}
                </span>
              ) : (
                <p className="text-sm text-surface-500">No campaign linked yet.</p>
              )}
              <p className="text-xs text-surface-400">{campaign?.status || 'Click to link this business into a launch campaign.'}</p>
            </CardContent>
          </button>
        </Card>
      </div>

      {qaImportedFacts.length > 0 && (
        <QaImportedFieldsPanel
          title="Imported From QA"
          description="These values are refreshed from QA whenever this business record is opened."
          facts={qaImportedFacts}
          accentLabel="QA business fields"
        />
      )}

      {biz && (
        <QaWritebackWishlistTable
          title="Dashboard Info To Add To QA Later"
          description="This is the dashboard-owned information attached to this business that still needs QA fields and write APIs before it can move fully server-side."
          rows={writebackRows}
        />
      )}

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
        readOnly ? (
          <ReadOnlyBusinessOverview biz={biz} qaBusiness={qaBusiness} />
        ) : localStateLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
            <span className="ml-2 text-sm text-surface-500">Loading business workspace...</span>
          </div>
        ) : (
        <BusinessExecutionOverview
          biz={biz}
          localBusinessId={localBusinessId}
          localState={localState}
          city={city}
          owner={owner}
          linkedCause={linkedCause}
            campaign={campaign}
            helperAssignments={helperAssignments}
            updateBusiness={updateBusiness}
            updateLoading={updateLoading}
            refetchBusiness={refetchBusinessDetail}
            refetchWorkspace={refetchLocalState}
          />
        )
      )}

      {activeTab === 'activity' && (
        <ActivityTab
          biz={biz}
          outreach={outreachItems}
          loading={outreachBusy}
          onInsert={insertOutreach}
          inserting={insertingOutreach}
          refetch={refetchBusinessDetail}
          profileMap={profileMap}
          userId={localProfileId}
        />
      )}

      {activeTab === 'tasks' && (
        <TasksTab
          biz={biz}
          tasks={taskItems}
          loading={tasksBusy}
          onInsert={insertTask}
          inserting={insertingTask}
          onUpdate={updateTask}
          profileMap={profileMap}
          refetch={refetchBusinessDetail}
          userId={localProfileId}
        />
      )}

      {activeTab === 'notes' && (
        <NotesTab
          biz={biz}
          notes={noteItems}
          loading={notesBusy}
          onInsert={insertNote}
          inserting={insertingNote}
          profileMap={profileMap}
          refetch={refetchBusinessDetail}
          userId={localProfileId}
        />
      )}

      {activeTab === 'qr' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-800">QR Codes</h3>
            <Link href={qrGeneratorHref}>
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
                  <Link href={qrGeneratorHref}>
                    <Button size="sm"><QrCodeIcon className="h-3.5 w-3.5" /> Manage QR</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-8 text-center">
                <QrCodeIcon className="mb-3 h-10 w-10 text-surface-300" />
                <p className="text-sm font-medium text-surface-700">No QR codes generated yet</p>
                <p className="mt-1 text-xs text-surface-400">Create a trackable QR code to link customers to this business.</p>
                <Link href={qrGeneratorHref} className="mt-4">
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
          {/* Generated materials from the material engine */}
          {businessGeneratedMaterials.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-surface-500 uppercase tracking-wide">Generated Materials</h4>
              {businessGeneratedMaterials.map(({ generated, material }) => (
                <Card key={generated.id}>
                  <CardContent className="space-y-3 py-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{material!.title}</p>
                        <p className="mt-1 text-xs text-surface-500">{generated.generated_file_name || material!.type}</p>
                      </div>
                      <Badge variant="success" dot>generated</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {generated.generated_file_url && (
                        <a href={generated.generated_file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open</Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Linked material (legacy single-material field) */}
          {linkedMaterial && (
            <div className="space-y-3">
              {businessGeneratedMaterials.length > 0 && (
                <h4 className="text-xs font-medium text-surface-500 uppercase tracking-wide">Linked Material</h4>
              )}
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
            </div>
          )}

          {/* Empty state — only if nothing at all */}
          {businessGeneratedMaterials.length === 0 && !linkedMaterial && (
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

      <Dialog open={linkCauseOpen} onOpenChange={setLinkCauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{linkedCause ? 'Change linked cause' : 'Link a cause'}</DialogTitle>
            <DialogDescription>
              Connect this business to the school or cause that best fits the story you are building around it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Cause or school</label>
              <Select value={pendingCauseId} onValueChange={setPendingCauseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a cause or school..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No linked cause</SelectItem>
                  {causes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkCauseOpen(false)}>Cancel</Button>
            <Button onClick={handleCauseLinkSave} disabled={updateLoading}>
              {updateLoading ? 'Saving...' : linkedCause ? 'Save cause link' : 'Link cause'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkCampaignOpen} onOpenChange={setLinkCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{campaign ? 'Change linked campaign' : 'Link a campaign'}</DialogTitle>
            <DialogDescription>
              Tie this business into the right campaign so progress, assets, and launch reporting stay connected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Campaign</label>
              <Select value={pendingCampaignId} onValueChange={setPendingCampaignId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No linked campaign</SelectItem>
                  {campaigns.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkCampaignOpen(false)}>Cancel</Button>
            <Button onClick={handleCampaignLinkSave} disabled={updateLoading}>
              {updateLoading ? 'Saving...' : campaign ? 'Save campaign link' : 'Link campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Review Dialog */}
      <Dialog open={reviewDupOpen} onOpenChange={setReviewDupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Duplicate Flag</DialogTitle>
            <DialogDescription>
              This record was flagged as a potential duplicate. Choose how to resolve it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
              <p className="font-medium text-surface-900">{biz.name}</p>
              <p className="mt-1 text-xs text-surface-500">
                If this is a legitimate record, clear the flag. If it&apos;s truly a duplicate, archive it so it&apos;s excluded from your active pipeline.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setReviewDupOpen(false)} disabled={reviewDupLoading}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleNotDuplicate} disabled={reviewDupLoading}>
              {reviewDupLoading ? 'Saving...' : 'Not a Duplicate'}
            </Button>
            <Button variant="danger" onClick={handleArchiveAsDuplicate} disabled={reviewDupLoading}>
              {reviewDupLoading ? 'Archiving...' : 'Archive as Duplicate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────

function QaBusinessSnapshot({ qaBusiness }: { qaBusiness: QaBusinessDetail }) {
  const facts = [
    { label: 'QA business ID', value: String(qaBusiness.id) },
    { label: 'Active', value: qaBusiness.active ? 'Yes' : 'No' },
    { label: 'Headline', value: qaBusiness.headline },
    { label: 'Owner name', value: qaBusiness.ownerName },
    { label: 'Owner email', value: qaBusiness.ownerEmail },
    { label: 'Owner phone', value: qaBusiness.ownerPhone },
    { label: 'Address 1', value: qaBusiness.address1 },
    { label: 'Address 2', value: qaBusiness.address2 },
    { label: 'Full address', value: qaBusiness.fullAddress },
    { label: 'City', value: qaBusiness.city },
    { label: 'State', value: qaBusiness.state },
    { label: 'Zip code', value: qaBusiness.zipCode },
    { label: 'Country', value: qaBusiness.country },
    { label: 'Marketing', value: qaBusiness.marketing !== null ? String(qaBusiness.marketing) : null },
    { label: 'Transaction fee', value: qaBusiness.txFee !== null ? String(qaBusiness.txFee) : null },
    { label: 'Sales tax', value: qaBusiness.salesTax !== null ? String(qaBusiness.salesTax) : null },
    { label: 'Tax ID', value: qaBusiness.taxId },
    { label: 'Time zone', value: qaBusiness.timeZone },
    { label: 'Stripe onboarding', value: qaBusiness.hasStripeOnboarding ? 'Complete' : 'Not complete' },
    { label: 'Image URL', value: qaBusiness.imageUrl },
    { label: 'Created', value: formatDateTime(qaBusiness.createdDate) },
  ].filter(item => item.value)

  return (
    <Card className="border-sky-200 bg-sky-50/70">
      <CardHeader>
        <CardTitle className="text-base text-sky-950">QA Business Payload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {qaBusiness.description && (
          <div className="rounded-lg border border-sky-200 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-sky-700">Description</p>
            <p className="mt-2 text-sm text-sky-950">{qaBusiness.description}</p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {facts.map(item => (
            <div key={item.label} className="rounded-lg border border-sky-200 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-sky-700">{item.label}</p>
              <p className="mt-2 break-words text-sm text-sky-950">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ReadOnlyBusinessOverview({
  biz,
  qaBusiness,
}: {
  biz: CrmBusiness
  qaBusiness: QaBusinessDetail | null
}) {
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Read-only summary</p>
          <p className="mt-2 text-sm text-surface-700">
            This page is rendering the live QA business payload. Dashboard actions remain disabled until the record is linked to a local business row.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Business name</p>
            <p className="mt-2 text-sm font-semibold text-surface-900">{biz.name}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Primary contact</p>
            <p className="mt-2 text-sm text-surface-900">{biz.owner_name || 'No owner name'}</p>
            <p className="mt-1 text-xs text-surface-500">{biz.owner_email || biz.email || 'No email available'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Phone</p>
            <p className="mt-2 text-sm text-surface-900">{biz.owner_phone || biz.phone || 'No phone available'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Address</p>
            <p className="mt-2 text-sm text-surface-900">{biz.full_address || biz.address || 'No address available'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OverviewTab({
  biz,
  city,
  owner,
  linkedCause,
  campaign,
  helperAssignments,
  updateBusiness,
  updateLoading,
  refetchBusiness,
  refetchWorkspace,
}: {
  biz: Business
  city: City | null
  owner: Profile | null
  linkedCause: Cause | null
  campaign: Campaign | null
  helperAssignments: Array<{ assignment: StakeholderAssignment; profile: Profile }>
  updateBusiness: (id: string, changes: Partial<Business>) => Promise<Business | null>
  updateLoading: boolean
  refetchBusiness?: () => void
  refetchWorkspace?: () => void
}) {
  return (
    <BusinessExecutionOverview
      biz={biz}
      localBusinessId={biz.id}
      city={city}
      owner={owner}
      linkedCause={linkedCause}
      campaign={campaign}
      helperAssignments={helperAssignments}
      updateBusiness={updateBusiness}
      updateLoading={updateLoading}
      refetchBusiness={refetchBusiness}
      refetchWorkspace={refetchWorkspace}
    />
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
  userId: string | null
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
      performed_by: userId || undefined,
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
  userId: string | null
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
      created_by: userId || undefined,
      assigned_to: userId || undefined,
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
  userId: string | null
}) {
  const [newNote, setNewNote] = React.useState('')

  const handleSubmit = async () => {
    if (!newNote.trim()) return
    await onInsert({
      content: newNote,
      entity_type: 'business',
      entity_id: biz.id,
      created_by: userId || undefined,
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
