'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Heart,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  QrCode,
  Rocket,
  Send,
  Sparkles,
  StickyNote,
  Store,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressSteps } from '@/components/ui/progress-steps'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BRANDS, ONBOARDING_STAGES } from '@/lib/constants'
import { buildStakeholderJoinUrl, MATERIAL_LIBRARY_FOLDERS } from '@/lib/material-engine'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import {
  computeCauseExecutionSteps,
  computeCauseReadiness,
  getCauseNextActions,
  type CauseExecutionStepSummary,
} from '@/lib/cause-execution'
import {
  useBusinesses,
  useCampaigns,
  useCauseUpdate,
  useCities,
  useGeneratedMaterials,
  useNoteInsert,
  useNotes,
  useOnboardingFlows,
  useOnboardingSteps,
  useOutreach,
  useOutreachInsert,
  useProfiles,
  useQrCodes,
  useRecord,
  useStakeholderAssignments,
  useStakeholderCodes,
  useStakeholders,
  useTaskInsert,
  useTaskUpdate,
  useTasks,
} from '@/lib/supabase/hooks'
import type {
  Business,
  Cause,
  GeneratedMaterial,
  OnboardingStage,
  OutreachType,
  TaskPriority,
} from '@/lib/types/database'

// ─── Helpers ────────────────────────────────────────────────

const STAGE_VARIANT: Record<OnboardingStage, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  lead: 'default', contacted: 'info', interested: 'info', in_progress: 'warning',
  onboarded: 'success', live: 'success', paused: 'warning', declined: 'danger',
}

const STAGE_OPTIONS: OnboardingStage[] = [
  'lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live', 'paused', 'declined',
]

const OUTREACH_TYPES: { value: OutreachType; label: string }[] = [
  { value: 'call', label: 'Call' }, { value: 'email', label: 'Email' }, { value: 'text', label: 'Text' },
  { value: 'in_person', label: 'In Person' }, { value: 'social_media', label: 'Social Media' },
  { value: 'referral', label: 'Referral' }, { value: 'other', label: 'Other' },
]

function stepVariant(step: CauseExecutionStepSummary) {
  if (step.state === 'completed') return 'success' as const
  if (step.state === 'active' && step.readyToComplete) return 'info' as const
  if (step.state === 'active') return 'warning' as const
  return 'default' as const
}

type DashboardTab = 'mission' | 'launch' | 'businesses' | 'community' | 'leadership' | 'materials' | 'codes' | 'activity' | 'tasks'

// ─── Component ──────────────────────────────────────────────

export default function CauseDetailPage() {
  const params = useParams()
  const causeId = params.id as string
  const { profile, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = React.useState<DashboardTab>('mission')

  // ── Data hooks ──
  const { data: cause, loading: causeLoading } = useRecord<Cause>('causes', causeId)
  const { data: profiles } = useProfiles()
  const { data: cities } = useCities()
  const { data: campaigns } = useCampaigns()
  const { data: allBusinesses } = useBusinesses()
  const { data: allStakeholders } = useStakeholders()
  const { data: allStakeholderCodes } = useStakeholderCodes()
  const { data: allGeneratedMaterials } = useGeneratedMaterials()
  const { data: assignments } = useStakeholderAssignments({ entity_id: causeId })
  const { data: causeQrCodes } = useQrCodes({ cause_id: causeId })
  const { data: flows } = useOnboardingFlows({ entity_type: 'cause', entity_id: causeId })
  const flow = flows[0] || null
  const { data: steps, refetch: refetchSteps } = useOnboardingSteps({ flow_id: flow?.id || '__none__' })
  const { data: outreach, refetch: refetchOutreach } = useOutreach({ entity_id: causeId })
  const { data: tasks, refetch: refetchTasks } = useTasks({ entity_id: causeId })
  const { data: notes, refetch: refetchNotes } = useNotes({ entity_id: causeId })

  // ── Mutation hooks ──
  const { update: updateCause, loading: updateLoading } = useCauseUpdate()
  const { insert: insertOutreach, loading: insertingOutreach } = useOutreachInsert()
  const { insert: insertTask, loading: insertingTask } = useTaskInsert()
  const { update: updateTask } = useTaskUpdate()
  const { insert: insertNote, loading: insertingNote } = useNoteInsert()

  // ── Derived data ──
  const profileMap = React.useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])
  const city = cause?.city_id ? cities.find(c => c.id === cause.city_id) || null : null
  const owner = cause?.owner_id ? profileMap.get(cause.owner_id) || null : null
  const campaign = cause?.campaign_id ? campaigns.find(c => c.id === cause.campaign_id) || null : null
  const linkedBusinesses = React.useMemo(() =>
    allBusinesses.filter(b => b.linked_cause_id === causeId),
    [allBusinesses, causeId],
  )
  const isSchool = cause?.type === 'school'
  const entityLabel = isSchool ? 'School' : 'Cause'

  // ── Stakeholder + codes ──
  const causeStakeholder = React.useMemo(() =>
    allStakeholders.find(s => s.cause_id === causeId) || null,
    [allStakeholders, causeId],
  )
  const codes = React.useMemo(() =>
    causeStakeholder ? allStakeholderCodes.find(c => c.stakeholder_id === causeStakeholder.id) || null : null,
    [allStakeholderCodes, causeStakeholder],
  )
  const generatedMaterials = React.useMemo(() =>
    causeStakeholder
      ? allGeneratedMaterials.filter(gm => gm.stakeholder_id === causeStakeholder.id)
      : [],
    [allGeneratedMaterials, causeStakeholder],
  )
  const generatedCount = generatedMaterials.filter(m => m.generation_status === 'generated' && !!m.generated_file_url).length

  // ── Execution engine ──
  const executionSteps = React.useMemo(() => {
    if (!cause) return []
    return computeCauseExecutionSteps({
      cause,
      steps,
      codes,
      generatedMaterials,
      qrCodes: causeQrCodes,
      outreachCount: outreach.length,
      linkedBusinessCount: linkedBusinesses.length,
    })
  }, [cause, steps, codes, generatedMaterials, causeQrCodes, outreach.length, linkedBusinesses.length])

  const readiness = React.useMemo(() => {
    if (!cause) return { score: 0, total: 8, percent: 0, checks: [] }
    return computeCauseReadiness({
      cause,
      steps,
      codes,
      generatedMaterials,
      qrCodes: causeQrCodes,
      outreachCount: outreach.length,
      linkedBusinessCount: linkedBusinesses.length,
    })
  }, [cause, steps, codes, generatedMaterials, causeQrCodes, outreach.length, linkedBusinesses.length])

  const nextActions = React.useMemo(() => {
    if (!cause) return []
    return getCauseNextActions({
      cause,
      steps: executionSteps,
      codes,
      generatedMaterials,
      qrCodes: causeQrCodes,
      outreachCount: outreach.length,
      linkedBusinessCount: linkedBusinesses.length,
      openTaskCount: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
    })
  }, [cause, executionSteps, codes, generatedMaterials, causeQrCodes, outreach.length, linkedBusinesses.length, tasks])

  // ── Stage / dialogs ──
  const [stageDropdownOpen, setStageDropdownOpen] = React.useState(false)
  const [linkCampaignOpen, setLinkCampaignOpen] = React.useState(false)
  const [pendingCampaignId, setPendingCampaignId] = React.useState(cause?.campaign_id || '__none')
  const [reviewDupOpen, setReviewDupOpen] = React.useState(false)
  const [reviewDupLoading, setReviewDupLoading] = React.useState(false)

  React.useEffect(() => {
    setPendingCampaignId(cause?.campaign_id || '__none')
  }, [cause?.campaign_id])

  const handleStageChange = React.useCallback(async (newStage: OnboardingStage) => {
    if (!cause) return
    await updateCause(cause.id, { stage: newStage })
    setStageDropdownOpen(false)
    window.location.reload()
  }, [cause, updateCause])

  const handleCampaignLinkSave = React.useCallback(async () => {
    if (!cause) return
    await updateCause(cause.id, { campaign_id: pendingCampaignId === '__none' ? null : pendingCampaignId })
    setLinkCampaignOpen(false)
    window.location.reload()
  }, [cause, pendingCampaignId, updateCause])

  // ── Codes + Material Engine ──
  const [referralCode, setReferralCode] = React.useState('')
  const [connectionCode, setConnectionCode] = React.useState('')
  const [engineMessage, setEngineMessage] = React.useState<string | null>(null)
  const [engineError, setEngineError] = React.useState<string | null>(null)
  const [engineBusy, setEngineBusy] = React.useState<'codes' | 'generate' | null>(null)
  const [stepBusyId, setStepBusyId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setReferralCode(codes?.referral_code || '')
    setConnectionCode(codes?.connection_code || '')
  }, [codes?.connection_code, codes?.referral_code])

  const joinUrl = React.useMemo(() => {
    if (codes?.join_url) return codes.join_url
    if (!connectionCode.trim()) return ''
    return buildStakeholderJoinUrl(isSchool ? 'school' : 'cause', connectionCode)
  }, [codes?.join_url, connectionCode, isSchool])

  async function callExecutionAction(payload: Record<string, unknown>) {
    const response = await fetch(`/api/crm/causes/${causeId}/execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'The cause action could not be completed.')
    return body
  }

  async function handleSaveCodes() {
    setEngineBusy('codes')
    setEngineMessage(null)
    setEngineError(null)
    try {
      const body = await callExecutionAction({ action: 'save_codes', referralCode, connectionCode })
      const generatedCount = Array.isArray(body?.result?.generatedMaterials) ? body.result.generatedMaterials.length : 0
      if (generatedCount === 0) {
        setEngineError(body?.result?.generationError || 'Codes saved, but materials could not be generated.')
      } else {
        setEngineMessage('Codes saved and materials generated.')
      }
      window.location.reload()
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Codes could not be saved.')
    } finally {
      setEngineBusy(null)
    }
  }

  async function handleGenerateMaterials() {
    setEngineBusy('generate')
    setEngineMessage(null)
    setEngineError(null)
    try {
      const body = await callExecutionAction({ action: 'generate_materials' })
      const count = Array.isArray(body?.result?.generatedMaterials) ? body.result.generatedMaterials.length : 0
      if (count === 0) {
        setEngineError(body?.result?.generationError || 'Materials could not be generated.')
      } else {
        setEngineMessage(`${count} material${count > 1 ? 's' : ''} generated.`)
      }
      window.location.reload()
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Materials could not be generated.')
    } finally {
      setEngineBusy(null)
    }
  }

  async function handleCompleteStep(stepId: string) {
    setStepBusyId(stepId)
    setEngineMessage(null)
    setEngineError(null)
    try {
      await callExecutionAction({ action: 'complete_step', stepId })
      setEngineMessage('Step completed.')
      window.location.reload()
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Step could not be completed.')
    } finally {
      setStepBusyId(null)
    }
  }

  // ── Activity / outreach form ──
  const [outreachType, setOutreachType] = React.useState<OutreachType>('other')
  const [outreachSubject, setOutreachSubject] = React.useState('')
  const [outreachBody, setOutreachBody] = React.useState('')
  const [outreachOutcome, setOutreachOutcome] = React.useState('')

  async function handleLogOutreach(e: React.FormEvent) {
    e.preventDefault()
    if (!outreachBody.trim()) return
    await insertOutreach({
      entity_type: 'cause',
      entity_id: causeId,
      type: outreachType,
      performed_by: profile.id,
      subject: outreachSubject || null,
      body: outreachBody,
      outcome: outreachOutcome || null,
    })
    setOutreachSubject('')
    setOutreachBody('')
    setOutreachOutcome('')
    refetchOutreach({ silent: true })
  }

  // ── Tasks form ──
  const [taskTitle, setTaskTitle] = React.useState('')
  const [taskPriority, setTaskPriority] = React.useState<TaskPriority>('medium')

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    await insertTask({
      title: taskTitle,
      priority: taskPriority,
      status: 'pending',
      entity_type: 'cause',
      entity_id: causeId,
      created_by: profile.id,
    })
    setTaskTitle('')
    refetchTasks({ silent: true })
  }

  async function handleToggleTask(id: string, completed: boolean) {
    await updateTask(id, {
      status: completed ? 'completed' : 'pending',
      completed_at: completed ? new Date().toISOString() : null,
    })
    refetchTasks({ silent: true })
  }

  // ── Notes form ──
  const [noteContent, setNoteContent] = React.useState('')

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteContent.trim()) return
    await insertNote({
      content: noteContent,
      entity_type: 'cause',
      entity_id: causeId,
      created_by: profile.id,
      is_internal: false,
    })
    setNoteContent('')
    refetchNotes({ silent: true })
  }

  // ── Duplicate review ──
  async function handleNotDuplicate() {
    setReviewDupLoading(true)
    await updateCause(causeId, { duplicate_of: null })
    setReviewDupOpen(false)
    window.location.reload()
  }

  async function handleArchiveAsDuplicate() {
    setReviewDupLoading(true)
    await updateCause(causeId, { status: 'archived' })
    setReviewDupOpen(false)
    window.location.reload()
  }

  // ── Loading / error states ──
  if (causeLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading {isSchool ? 'school' : 'cause'}...</span>
      </div>
    )
  }

  if (!cause) {
    return (
      <EmptyState
        icon={isSchool ? <GraduationCap className="h-8 w-8" /> : <Heart className="h-8 w-8" />}
        title={`${entityLabel} not found`}
        description="This record could not be loaded."
      />
    )
  }

  const completedStepCount = executionSteps.filter(s => s.state === 'completed').length
  const qrGeneratorHref = `/qr/generator?causeId=${cause.id}&returnTo=${encodeURIComponent(`/crm/causes/${cause.id}`)}`

  // ── TAB CONFIG ──
  const tabs: Array<{ key: DashboardTab; label: string; icon: React.ReactNode; count?: number }> = [
    { key: 'mission', label: 'Mission Control', icon: <Rocket className="h-4 w-4" /> },
    { key: 'launch', label: 'Build My Launch', icon: <Zap className="h-4 w-4" /> },
    { key: 'businesses', label: 'Businesses', icon: <Store className="h-4 w-4" />, count: linkedBusinesses.length },
    { key: 'community', label: isSchool ? 'Parents & Community' : 'Supporters', icon: <Users className="h-4 w-4" /> },
    { key: 'leadership', label: isSchool ? 'PTA / Leadership' : 'Board / Leadership', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'materials', label: 'Materials', icon: <FileText className="h-4 w-4" />, count: generatedCount },
    { key: 'codes', label: 'QR & Codes', icon: <QrCode className="h-4 w-4" /> },
    { key: 'activity', label: 'Activity', icon: <MessageSquare className="h-4 w-4" />, count: outreach.length },
    { key: 'tasks', label: 'Tasks & Notes', icon: <ClipboardList className="h-4 w-4" />, count: tasks.filter(t => t.status !== 'completed').length },
  ]

  return (
    <div className="space-y-6">
      {/* ── Duplicate warning ── */}
      {cause.duplicate_of && (
        <div className="flex items-center gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-800">Potential duplicate detected</p>
            <p className="text-xs text-warning-600">This record may be a duplicate. Review and merge if needed.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setReviewDupOpen(true)}>Review</Button>
        </div>
      )}

      {/* ── Progress stepper ── */}
      <ProgressSteps
        steps={STAGE_OPTIONS.slice(0, 6).map((stage, idx) => ({
          label: ONBOARDING_STAGES[stage].label,
          completed: STAGE_OPTIONS.indexOf(cause.stage) > idx || cause.stage === 'live',
          current: cause.stage === stage,
        }))}
      />

      {/* ── Header ── */}
      <PageHeader
        title={cause.name}
        description={`${entityLabel} mobilization dashboard \u2022 ${city ? `${city.name}, ${city.state}` : 'No city linked'}`}
        breadcrumb={[
          { label: 'CRM', href: '/crm/causes' },
          { label: isSchool ? 'Schools' : 'Causes', href: '/crm/causes' },
          { label: cause.name },
        ]}
        actions={(
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setStageDropdownOpen(!stageDropdownOpen)}>
                <Badge variant={STAGE_VARIANT[cause.stage]} dot className="mr-1">{ONBOARDING_STAGES[cause.stage].label}</Badge>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              {stageDropdownOpen && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-surface-200 bg-white py-1 shadow-lg">
                  {STAGE_OPTIONS.map(stage => (
                    <button
                      key={stage}
                      onClick={() => handleStageChange(stage)}
                      disabled={updateLoading}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-50"
                    >
                      <Badge variant={STAGE_VARIANT[stage]} dot>{ONBOARDING_STAGES[stage].label}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" onClick={() => setActiveTab('activity')}>
              <Send className="h-3.5 w-3.5" /> Log Activity
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('tasks')}>
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
          </div>
        )}
      />

      {/* ── Quick info cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setLinkCampaignOpen(true)}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaign</p>
            <p className="mt-1 text-sm font-semibold text-surface-900 truncate">{campaign?.name || 'Not linked'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Owner</p>
            <p className="mt-1 text-sm font-semibold text-surface-900 truncate">{owner?.full_name || 'Unassigned'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">City</p>
            <p className="mt-1 text-sm font-semibold text-surface-900 truncate">{city ? `${city.name}, ${city.state}` : 'No city'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Readiness</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-surface-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${readiness.percent >= 75 ? 'bg-success-500' : readiness.percent >= 40 ? 'bg-warning-500' : 'bg-surface-300'}`}
                  style={{ width: `${readiness.percent}%` }}
                />
              </div>
              <span className="text-sm font-bold text-surface-900">{readiness.percent}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-100 p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {typeof tab.count === 'number' && tab.count > 0 && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                activeTab === tab.key ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB: MISSION CONTROL
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'mission' && (
        <div className="space-y-6">
          {/* Status cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard label="Activation" value={`${completedStepCount}/${executionSteps.length}`} ready={executionSteps.every(s => s.state === 'completed')} />
            <StatusCard label="QR Assets" value={causeQrCodes.length > 0 ? 'Ready' : 'Missing'} ready={causeQrCodes.length > 0} />
            <StatusCard label="Businesses" value={`${linkedBusinesses.length}`} ready={linkedBusinesses.length > 0} />
            <StatusCard label="Materials" value={`${generatedCount} ready`} ready={generatedCount > 0} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
            {/* Lifecycle */}
            <Card>
              <CardHeader>
                <CardTitle>{entityLabel} Activation Lifecycle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {executionSteps.length === 0 ? (
                  <p className="text-sm text-surface-500">No activation steps found. Trigger a save to create them.</p>
                ) : executionSteps.map(item => (
                  <div key={item.step.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant={stepVariant(item)}>{item.state}</Badge>
                          <p className="font-semibold text-surface-900">{item.label}</p>
                        </div>
                        {item.description && <p className="text-sm text-surface-600">{item.description}</p>}
                        {item.step.completed_at ? (
                          <p className="text-xs text-surface-500">
                            Completed {formatDateTime(item.step.completed_at)}
                            {item.step.completed_by ? ` by ${profileMap.get(item.step.completed_by)?.full_name || 'a team member'}` : ''}
                          </p>
                        ) : item.blocker ? (
                          <p className="text-xs text-warning-700">{item.blocker}</p>
                        ) : (
                          <p className="text-xs text-success-600">Ready to complete.</p>
                        )}
                      </div>
                      {item.state === 'active' && item.readyToComplete && (
                        <Button size="sm" onClick={() => void handleCompleteStep(item.step.id)} disabled={stepBusyId === item.step.id}>
                          {stepBusyId === item.step.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {engineError && <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{engineError}</div>}
                {engineMessage && <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{engineMessage}</div>}
              </CardContent>
            </Card>

            {/* Next actions + readiness */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Next Best Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {nextActions.length > 0 ? nextActions.map(action => (
                    <div key={action} className="flex items-start gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <p className="text-sm text-surface-700">{action}</p>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
                      No immediate blockers. Keep the momentum going!
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Readiness Checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {readiness.checks.map(check => (
                    <div key={check.label} className="flex items-center gap-3 rounded-lg px-3 py-2">
                      {check.met
                        ? <CheckCircle2 className="h-4 w-4 text-success-500" />
                        : <div className="h-4 w-4 rounded-full border-2 border-surface-300" />}
                      <span className={`text-sm ${check.met ? 'text-surface-700' : 'text-surface-500'}`}>{check.label}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setActiveTab('businesses')}>
                    <Store className="h-3.5 w-3.5" /> Add Business
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setActiveTab('activity')}>
                    <Send className="h-3.5 w-3.5" /> Log Outreach
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setActiveTab('codes')}>
                    <QrCode className="h-3.5 w-3.5" /> Setup Codes
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setActiveTab('materials')}>
                    <FileText className="h-3.5 w-3.5" /> View Materials
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setActiveTab('community')}>
                    <Users className="h-3.5 w-3.5" /> {isSchool ? 'Parents' : 'Supporters'}
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setActiveTab('tasks')}>
                    <ClipboardList className="h-3.5 w-3.5" /> Add Task
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: BUILD MY LAUNCH
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'launch' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isSchool ? 'School' : 'Cause'} Launch Playbook</CardTitle>
              <p className="text-sm text-surface-500">Follow these steps to build a successful launch. Each section guides you through what needs to happen and tracks your progress.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  group: 'Setup',
                  icon: <Target className="h-5 w-5 text-brand-600" />,
                  items: [
                    { label: 'Profile complete (city + contact)', done: !!(cause.city_id && (cause.email || cause.phone)) },
                    { label: 'Referral & connection codes saved', done: !!(codes?.referral_code && codes?.connection_code) },
                    { label: 'Materials generated', done: generatedCount > 0 },
                    { label: 'QR code created', done: causeQrCodes.length > 0 },
                  ],
                },
                {
                  group: isSchool ? 'Internal Alignment' : 'Internal Alignment',
                  icon: <Users className="h-5 w-5 text-violet-600" />,
                  items: [
                    { label: isSchool ? 'Principal / decision-maker identified' : 'Board / decision-maker identified', done: outreach.length >= 1 },
                    { label: isSchool ? 'PTA leadership engaged' : 'Leadership engaged', done: outreach.length >= 2 },
                    { label: 'Internal champion confirmed', done: executionSteps.some(s => s.key === 'leader_conversation' && s.state === 'completed') },
                  ],
                },
                {
                  group: 'First Business',
                  icon: <Store className="h-5 w-5 text-amber-600" />,
                  items: [
                    { label: 'First business prospect identified', done: linkedBusinesses.length >= 1 },
                    { label: 'First business contacted', done: linkedBusinesses.some(b => b.stage !== 'lead') },
                    { label: 'First business onboarded', done: linkedBusinesses.some(b => b.stage === 'onboarded' || b.stage === 'live') },
                  ],
                },
                {
                  group: isSchool ? 'Parent / Community Activation' : 'Supporter Activation',
                  icon: <Heart className="h-5 w-5 text-pink-600" />,
                  items: [
                    { label: isSchool ? 'Parent materials ready' : 'Supporter materials ready', done: generatedMaterials.some(m => m.library_folder === 'share_with_parents' && m.generation_status === 'generated') },
                    { label: isSchool ? 'Flyer sent home / shared in group' : 'Supporter flyer shared', done: false },
                    { label: isSchool ? 'Parent engagement started' : 'Community engagement started', done: outreach.length >= 3 },
                  ],
                },
                {
                  group: isSchool ? 'PTA / Leadership Activation' : 'Board / Leadership Activation',
                  icon: <BookOpen className="h-5 w-5 text-indigo-600" />,
                  items: [
                    { label: isSchool ? 'PTA one-pager shared' : 'Leadership one-pager shared', done: generatedMaterials.some(m => m.library_folder === 'share_with_pta' && m.generation_status === 'generated') },
                    { label: 'Meeting scheduled or completed', done: false },
                    { label: 'Support secured', done: executionSteps.some(s => s.key === 'activation_decision' && s.state === 'completed') },
                  ],
                },
                {
                  group: 'Launch Readiness',
                  icon: <Rocket className="h-5 w-5 text-success-600" />,
                  items: [
                    { label: '3+ businesses linked', done: linkedBusinesses.length >= 3 },
                    { label: 'All activation steps complete', done: executionSteps.every(s => s.state === 'completed') },
                    { label: `${entityLabel} is live`, done: cause.stage === 'live' },
                  ],
                },
              ].map(section => {
                const doneCount = section.items.filter(i => i.done).length
                return (
                  <div key={section.group} className="rounded-2xl border border-surface-200 bg-surface-50 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {section.icon}
                        <h3 className="font-semibold text-surface-900">{section.group}</h3>
                      </div>
                      <Badge variant={doneCount === section.items.length ? 'success' : doneCount > 0 ? 'warning' : 'default'}>
                        {doneCount}/{section.items.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {section.items.map(item => (
                        <div key={item.label} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                          {item.done
                            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" />
                            : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-surface-300" />}
                          <span className={`text-sm ${item.done ? 'text-surface-700 line-through' : 'text-surface-900'}`}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: BUSINESSES
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'businesses' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Business Pipeline</CardTitle>
                  <p className="mt-1 text-sm text-surface-500">
                    {isSchool ? 'Local businesses supporting your school through LocalVIP.' : 'Businesses partnering with your cause.'}
                  </p>
                </div>
                <Link href={`/crm/businesses?linked_cause_id=${causeId}`}>
                  <Button variant="outline" size="sm"><Store className="h-3.5 w-3.5" /> View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {linkedBusinesses.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <Store className="mx-auto mb-3 h-10 w-10 text-surface-300" />
                  <p className="text-sm font-semibold text-surface-700">No businesses yet</p>
                  <p className="mt-1 text-xs text-surface-500 max-w-sm mx-auto">
                    {isSchool
                      ? 'Start by identifying local businesses near your school. When they join, families save and your school earns.'
                      : 'Recruit local businesses to support your cause. Each business that joins drives real support to your mission.'}
                  </p>
                  <Link href="/crm/businesses">
                    <Button size="sm" className="mt-4"><Plus className="h-3.5 w-3.5" /> Find a Business</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedBusinesses.map(biz => (
                    <Link key={biz.id} href={`/crm/businesses/${biz.id}`} className="block">
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-surface-200 bg-white px-4 py-3 transition-colors hover:bg-surface-50 hover:border-surface-300">
                        <div className="min-w-0">
                          <p className="font-semibold text-surface-900 truncate">{biz.name}</p>
                          <p className="text-xs text-surface-500">{biz.category || 'Business'} {biz.address ? `\u2022 ${biz.address}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={STAGE_VARIANT[biz.stage]} dot>{ONBOARDING_STAGES[biz.stage].label}</Badge>
                          <ArrowRight className="h-4 w-4 text-surface-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                  <Link href="/crm/businesses">
                    <Button variant="outline" size="sm" className="w-full mt-2"><Plus className="h-3.5 w-3.5" /> Add Another Business</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: PARENTS & COMMUNITY / SUPPORTERS
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'community' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{isSchool ? 'Parent & Community Engagement' : 'Supporter Engagement'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-surface-600">
                  {isSchool
                    ? 'Parents are the engine. When they shop at partner businesses, the school earns. Here\u2019s how to activate them:'
                    : 'Supporters are the engine. When they shop at partner businesses, your cause earns. Here\u2019s how to activate them:'}
                </p>
                <div className="space-y-3">
                  {[
                    { label: isSchool ? 'Share the parent flyer in school groups' : 'Share the supporter flyer in community groups', icon: <Send className="h-4 w-4 text-brand-500" /> },
                    { label: isSchool ? 'Send the flyer home with students' : 'Distribute flyers at community events', icon: <FileText className="h-4 w-4 text-brand-500" /> },
                    { label: 'Post in Facebook / WhatsApp groups', icon: <Globe className="h-4 w-4 text-brand-500" /> },
                    { label: isSchool ? 'Announce at PTA meetings' : 'Announce at community gatherings', icon: <Users className="h-4 w-4 text-brand-500" /> },
                    { label: 'Use QR code at events for instant sign-up', icon: <QrCode className="h-4 w-4 text-brand-500" /> },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3">
                      {item.icon}
                      <span className="text-sm text-surface-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isSchool ? 'Parent Materials' : 'Supporter Materials'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const parentMats = generatedMaterials.filter(m => m.library_folder === 'share_with_parents' && m.generation_status === 'generated')
                  if (parentMats.length === 0) {
                    return (
                      <div className="rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center">
                        <FileText className="mx-auto mb-2 h-8 w-8 text-surface-300" />
                        <p className="text-sm font-medium text-surface-700">No {isSchool ? 'parent' : 'supporter'} materials yet</p>
                        <p className="mt-1 text-xs text-surface-500">Set up your codes first, then generate materials.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab('codes')}>
                          <QrCode className="h-3.5 w-3.5" /> Setup Codes
                        </Button>
                      </div>
                    )
                  }
                  return parentMats.map(mat => (
                    <div key={mat.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-surface-900">{mat.generated_file_name || 'Material'}</p>
                          <p className="text-xs text-surface-500">{mat.library_folder.replace(/_/g, ' ')}</p>
                        </div>
                        <Badge variant="success">Ready</Badge>
                      </div>
                      {mat.generated_file_url && (
                        <a href={mat.generated_file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> Open file
                        </a>
                      )}
                    </div>
                  ))
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: PTA / LEADERSHIP
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'leadership' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{isSchool ? 'PTA & School Leadership' : 'Board & Leadership'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-surface-600">
                  {isSchool
                    ? 'Getting PTA support is a multiplier. Here\u2019s your playbook for securing their buy-in:'
                    : 'Getting leadership support accelerates everything. Here\u2019s your playbook:'}
                </p>
                <div className="space-y-3">
                  {[
                    { label: isSchool ? 'Identify the PTA president or key decision-maker' : 'Identify the board chair or key decision-maker', done: outreach.length >= 1 },
                    { label: isSchool ? 'Share the PTA one-pager' : 'Share the leadership one-pager', done: generatedMaterials.some(m => m.library_folder === 'share_with_pta' && m.generation_status === 'generated') },
                    { label: 'Schedule a 15-minute intro meeting', done: false },
                    { label: 'Present the value proposition', done: false },
                    { label: 'Get verbal or formal support', done: executionSteps.some(s => s.key === 'activation_decision' && s.state === 'completed') },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3">
                      {item.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" /> : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-surface-300" />}
                      <span className={`text-sm ${item.done ? 'text-surface-700' : 'text-surface-900'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isSchool ? 'PTA Materials' : 'Leadership Materials'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const ptaMats = generatedMaterials.filter(m => m.library_folder === 'share_with_pta' && m.generation_status === 'generated')
                  if (ptaMats.length === 0) {
                    return (
                      <div className="rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center">
                        <BookOpen className="mx-auto mb-2 h-8 w-8 text-surface-300" />
                        <p className="text-sm font-medium text-surface-700">No {isSchool ? 'PTA' : 'leadership'} materials yet</p>
                        <p className="mt-1 text-xs text-surface-500">Generate materials after setting up your codes.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab('codes')}>
                          <QrCode className="h-3.5 w-3.5" /> Setup Codes
                        </Button>
                      </div>
                    )
                  }
                  return ptaMats.map(mat => (
                    <div key={mat.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-surface-900">{mat.generated_file_name || 'Material'}</p>
                          <p className="text-xs text-surface-500">{mat.library_folder.replace(/_/g, ' ')}</p>
                        </div>
                        <Badge variant="success">Ready</Badge>
                      </div>
                      {mat.generated_file_url && (
                        <a href={mat.generated_file_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> Open file
                        </a>
                      )}
                    </div>
                  ))
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: MATERIALS
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {generatedMaterials.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-surface-300" />
                <p className="text-sm font-semibold text-surface-700">No materials generated yet</p>
                <p className="mt-1 text-xs text-surface-500 max-w-md mx-auto">
                  Materials are generated automatically when you save your referral and connection codes. Each material gets your unique QR code stamped on it.
                </p>
                <Button size="sm" className="mt-4" onClick={() => setActiveTab('codes')}>
                  <QrCode className="h-3.5 w-3.5" /> Setup Codes First
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {MATERIAL_LIBRARY_FOLDERS.map(folder => {
                const folderMats = generatedMaterials.filter(m => m.library_folder === folder.value && m.generation_status === 'generated')
                if (folderMats.length === 0) return null
                return (
                  <Card key={folder.value}>
                    <CardHeader>
                      <CardTitle>{folder.label}</CardTitle>
                      <p className="text-sm text-surface-500">{folder.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {folderMats.map(mat => (
                        <div key={mat.id} className="flex items-center justify-between gap-4 rounded-xl border border-surface-200 bg-white px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-surface-900 truncate">{mat.generated_file_name || 'Generated asset'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {mat.tags?.map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="success">Ready</Badge>
                            {mat.generated_file_url && (
                              <a href={mat.generated_file_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /> Open</Button>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )
              })}
              {/* Also show failed materials for admin */}
              {isAdmin && generatedMaterials.some(m => m.generation_status === 'failed') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-danger-700">Failed Materials</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {generatedMaterials.filter(m => m.generation_status === 'failed').map(mat => (
                      <div key={mat.id} className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
                        <p className="text-sm font-medium text-danger-800">{mat.generated_file_name || 'Failed asset'}</p>
                        {mat.generation_error && <p className="mt-1 text-xs text-danger-600">{mat.generation_error}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: QR & CODES
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'codes' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Codes & Material Engine</CardTitle>
                <p className="text-sm text-surface-500">
                  These codes power your QR assets and personalized materials. Save them to trigger generation.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Referral code</label>
                    <Input value={referralCode} onChange={e => setReferralCode(e.target.value)} placeholder={`${cause.name.toLowerCase().replace(/\s+/g, '-')}`} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700">Connection code</label>
                    <Input value={connectionCode} onChange={e => setConnectionCode(e.target.value)} placeholder={`${cause.name.toLowerCase().replace(/\s+/g, '-')}`} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Join URL</label>
                  <div className="flex gap-2">
                    <Input value={joinUrl} readOnly className="bg-surface-50" />
                    {joinUrl && (
                      <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(joinUrl)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStatus label="Generation" value={generatedCount > 0 ? 'generated' : codes?.referral_code ? 'ready' : 'needs codes'} />
                  <MiniStatus label="Generated files" value={`${generatedCount}`} />
                  <MiniStatus label="QR linked" value={causeQrCodes.length > 0 ? 'Yes' : 'No'} />
                </div>
                {engineError && <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{engineError}</div>}
                {engineMessage && <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{engineMessage}</div>}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleSaveCodes()} disabled={engineBusy !== null || !referralCode.trim() || !connectionCode.trim()}>
                    {engineBusy === 'codes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Save codes + generate
                  </Button>
                  <Button variant="outline" onClick={() => void handleGenerateMaterials()} disabled={engineBusy !== null || !codes?.connection_code}>
                    {engineBusy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Generate materials
                  </Button>
                  <Link href={qrGeneratorHref}>
                    <Button variant="outline"><QrCode className="h-4 w-4" /> Create QR Code</Button>
                  </Link>
                  {joinUrl && (
                    <Button variant="outline" asChild>
                      <Link href={joinUrl} target="_blank"><ExternalLink className="h-4 w-4" /> Open join page</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR Codes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {causeQrCodes.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center">
                    <QrCode className="mx-auto mb-2 h-8 w-8 text-surface-300" />
                    <p className="text-sm font-medium text-surface-700">No QR codes yet</p>
                    <p className="mt-1 text-xs text-surface-500">Create a QR code to give supporters a direct sign-up path.</p>
                    <Link href={qrGeneratorHref}>
                      <Button size="sm" className="mt-3"><QrCode className="h-3.5 w-3.5" /> Create QR Code</Button>
                    </Link>
                  </div>
                ) : causeQrCodes.map(qr => (
                  <div key={qr.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{qr.name}</p>
                        <p className="text-xs text-surface-500">{qr.scan_count} scans</p>
                      </div>
                      <Badge variant={qr.status === 'active' ? 'success' : 'default'}>{qr.status}</Badge>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(qr.redirect_url)}>
                        <Copy className="h-3.5 w-3.5" /> Copy Link
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: ACTIVITY
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Log Outreach</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogOutreach} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    value={outreachType}
                    onChange={e => setOutreachType(e.target.value as OutreachType)}
                    className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  >
                    {OUTREACH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <Input value={outreachSubject} onChange={e => setOutreachSubject(e.target.value)} placeholder="Subject" />
                  <Input value={outreachOutcome} onChange={e => setOutreachOutcome(e.target.value)} placeholder="Outcome" />
                </div>
                <Textarea
                  value={outreachBody}
                  onChange={e => setOutreachBody(e.target.value)}
                  rows={3}
                  placeholder="What happened? Describe the conversation, meeting, or interaction..."
                />
                <Button type="submit" disabled={insertingOutreach || !outreachBody.trim()}>
                  {insertingOutreach ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Log Outreach
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {outreach.length === 0 ? (
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
                  No outreach logged yet. Start tracking your conversations above.
                </div>
              ) : outreach.map(item => (
                <div key={item.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-surface-900">{item.subject || item.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-surface-500">{formatDateTime(item.created_at)}</p>
                  </div>
                  {item.body && <p className="mt-2 text-sm text-surface-600">{item.body}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="default">{item.type.replace(/_/g, ' ')}</Badge>
                    {item.outcome && <Badge variant="info">{item.outcome}</Badge>}
                    <Badge variant="outline">{profileMap.get(item.performed_by)?.full_name || 'Team member'}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB: TASKS & NOTES
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddTask} className="flex gap-2">
                  <Input
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="Add a task..."
                    className="flex-1"
                  />
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as TaskPriority)}
                    className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <Button type="submit" disabled={insertingTask || !taskTitle.trim()}>
                    {insertingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </form>
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="py-6 text-center text-sm text-surface-500">No tasks yet.</p>
                  ) : tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg border border-surface-200 bg-white px-3 py-2.5">
                      <button onClick={() => handleToggleTask(task.id, task.status !== 'completed')}>
                        {task.status === 'completed'
                          ? <CheckCircle2 className="h-4 w-4 text-success-500" />
                          : <div className="h-4 w-4 rounded-full border-2 border-surface-300" />}
                      </button>
                      <span className={`flex-1 text-sm ${task.status === 'completed' ? 'text-surface-400 line-through' : 'text-surface-800'}`}>
                        {task.title}
                      </span>
                      <Badge variant={
                        task.priority === 'urgent' ? 'danger' :
                        task.priority === 'high' ? 'warning' :
                        task.priority === 'medium' ? 'info' : 'default'
                      }>
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddNote} className="space-y-2">
                  <Textarea
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    rows={3}
                    placeholder="Add a note..."
                  />
                  <Button type="submit" disabled={insertingNote || !noteContent.trim()}>
                    {insertingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
                    Save Note
                  </Button>
                </form>
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-surface-500">No notes yet.</p>
                  ) : notes.map(note => (
                    <div key={note.id} className="rounded-lg border border-surface-200 bg-white px-4 py-3">
                      <p className="text-sm text-surface-700">{note.content}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-surface-400">
                        <span>{profileMap.get(note.created_by)?.full_name || 'Team member'}</span>
                        <span>&middot;</span>
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          DIALOGS
         ══════════════════════════════════════════════════════════ */}

      {/* Campaign linking */}
      <Dialog open={linkCampaignOpen} onOpenChange={setLinkCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{campaign ? 'Change linked campaign' : 'Link a campaign'}</DialogTitle>
            <DialogDescription>Associate this {entityLabel.toLowerCase()} with a campaign to track progress together.</DialogDescription>
          </DialogHeader>
          <select
            value={pendingCampaignId}
            onChange={e => setPendingCampaignId(e.target.value)}
            className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
          >
            <option value="__none">No campaign</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkCampaignOpen(false)}>Cancel</Button>
            <Button onClick={handleCampaignLinkSave} disabled={updateLoading}>
              {updateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate review */}
      <Dialog open={reviewDupOpen} onOpenChange={setReviewDupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Duplicate Flag</DialogTitle>
            <DialogDescription>This record was flagged as a potential duplicate. Choose how to resolve it.</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
            <p className="font-medium text-surface-900">{cause.name}</p>
            <p className="mt-1 text-xs text-surface-500">
              If this is a legitimate record, clear the flag. If it&apos;s truly a duplicate, archive it.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setReviewDupOpen(false)} disabled={reviewDupLoading}>Cancel</Button>
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

// ─── Shared small components ────────────────────────────────

function StatusCard({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-2xl font-semibold text-surface-900">{value}</p>
          <Badge variant={ready ? 'success' : 'warning'}>{ready ? 'Ready' : 'Needs work'}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-surface-900">{value}</p>
    </div>
  )
}
