'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
  Pencil,
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
import { LogInAsButton } from '@/components/crm/log-in-as-button'
import { QaImportedFieldsPanel, QaWritebackWishlistTable, type QaImportedFact, type QaWritebackRow } from '@/components/crm/qa-linking-panels'
import {
  CauseInitialConnectionModal,
  LeaderConversationModal,
  CauseMaterialsQrModal,
  ActivationDecisionModal,
} from '@/components/crm/cause-lifecycle-modals'
import { BRANDS, ONBOARDING_STAGES } from '@/lib/constants'
import { buildStakeholderJoinUrl, normalizeStakeholderCode, MATERIAL_LIBRARY_FOLDERS } from '@/lib/material-engine'
import { EMPTY_UUID, asUuid } from '@/lib/uuid'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import { useCrmCause } from '@/lib/hooks/crm-businesses'
import type { CrmCause } from '@/lib/crm-api'
import {
  computeCauseExecutionSteps,
  computeCauseReadiness,
  getCauseNextActions,
  getTabForStepKey,
  getTabForReadinessCheck,
  type CauseExecutionStepSummary,
} from '@/lib/cause-execution'
import {
  useBusinesses,
  useCampaigns,
  useCauseUpdate,
  useCities,
  useAdminTasks,
  useGeneratedMaterials,
  useMaterials,
  useNoteInsert,
  useNotes,
  useOnboardingFlows,
  useOnboardingSteps,
  useOutreach,
  useOutreachInsert,
  useProfiles,
  useQrCodes,
  useStakeholderAssignments,
  useStakeholderCodes,
  useStakeholders,
  useTaskInsert,
  useTaskUpdate,
  useTasks,
} from '@/lib/supabase/hooks'
import type {
  Business,
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

interface GenerationTemplateSummary {
  id: string
  name: string
  templateType: string
  outputFormat: string
  libraryFolder: string
}

// ─── Component ──────────────────────────────────────────────

export default function CauseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const routeId = params.id as string
  const qaCauseId = React.useMemo(() => {
    const value = searchParams.get('qaId')
    return value && /^\d+$/.test(value) ? Number(value) : null
  }, [searchParams])
  const { profile, isAdmin } = useAuth()
  const localProfileId = asUuid(profile.id)
  const [activeTab, setActiveTab] = React.useState<DashboardTab>('mission')

  // ── Data hooks ──
  const { data: causeResponse, loading: causeLoading, error: causeError } = useCrmCause(routeId, qaCauseId)
  const cause = causeResponse?.cause || null
  const localCauseId = causeResponse?.localCauseId || null
  const readOnly = causeResponse?.readOnly || false
  const detailQaError = causeResponse?.qaError || null
  const causeId = localCauseId || EMPTY_UUID
  const { data: profiles } = useProfiles()
  const { data: cities } = useCities()
  const { data: campaigns } = useCampaigns()
  const { data: allBusinesses } = useBusinesses()
  const { data: allStakeholders, refetch: refetchStakeholders } = useStakeholders()
  const { data: allStakeholderCodes, refetch: refetchCodes } = useStakeholderCodes()
  const { data: allGeneratedMaterials, refetch: refetchGeneratedMaterials } = useGeneratedMaterials()
  const { data: allMaterialRecords, refetch: refetchMaterialRecords } = useMaterials()
  const { data: assignments } = useStakeholderAssignments({ entity_id: causeId })
  const { data: causeQrCodes, refetch: refetchQrCodes } = useQrCodes({ cause_id: causeId })
  const { data: flows, refetch: refetchFlows } = useOnboardingFlows({ entity_type: 'cause', entity_id: causeId })
  const flow = flows[0] || null
  const { data: steps, refetch: refetchSteps } = useOnboardingSteps({ flow_id: flow?.id || EMPTY_UUID })
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
  const { data: adminTasks, refetch: refetchAdminTasks } = useAdminTasks({ stakeholder_id: causeStakeholder?.id || EMPTY_UUID })

  // ── Owner resolution (fallback chain: cause.owner_id → stakeholder.profile_id → stakeholder.owner_user_id → assignment) ──
  const owner = React.useMemo(() => {
    if (!cause) return null
    if (cause.owner_id) return profileMap.get(cause.owner_id) || null
    if (causeStakeholder?.profile_id) return profileMap.get(causeStakeholder.profile_id) || null
    if (causeStakeholder?.owner_user_id) return profileMap.get(causeStakeholder.owner_user_id) || null
    if (assignments.length > 0) return profileMap.get(assignments[0].stakeholder_id) || null
    return null
  }, [cause, causeStakeholder, assignments, profileMap])
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
  const causeMaterialMap = React.useMemo(() => new Map(allMaterialRecords.map(m => [m.id, m])), [allMaterialRecords])
  const generatedMaterialPairs = React.useMemo(() =>
    generatedMaterials
      .filter(gm => gm.generation_status === 'generated')
      .map(gm => ({ generated: gm, material: gm.material_id ? causeMaterialMap.get(gm.material_id) || null : null })),
    [generatedMaterials, causeMaterialMap],
  )
  const generatedCount = generatedMaterialPairs.filter(({ generated }) => !!generated.generated_file_url).length
  const setupTask = adminTasks[0] || null
  const generationState = generatedCount > 0
    ? 'generated'
    : setupTask?.status || (codes?.referral_code ? 'ready' : 'needs codes')
  const qaLinkedCauseId = causeResponse?.qaCauseId || cause?.qa_account_id || qaCauseId || null
  const qaImportedFacts = React.useMemo<QaImportedFact[]>(() => {
    if (!cause || !qaLinkedCauseId) return []

    return [
      { label: 'QA nonprofit ID', value: String(qaLinkedCauseId) },
      { label: 'Name', value: cause.name },
      { label: 'Headline', value: cause.headline },
      { label: 'Primary contact', value: cause.owner_name },
      { label: 'Contact email', value: cause.owner_email || cause.email },
      { label: 'Contact phone', value: cause.owner_phone || cause.phone },
      { label: 'Address 1', value: cause.address1 },
      { label: 'Address 2', value: cause.address2 },
      { label: 'Full address', value: cause.full_address || cause.address },
      { label: 'City', value: cause.city_name },
      { label: 'State', value: cause.state },
      { label: 'Zip code', value: cause.zip_code },
      { label: 'Country', value: cause.country },
      { label: 'Description', value: cause.description },
      { label: 'Marketing', value: cause.marketing !== null && cause.marketing !== undefined ? String(cause.marketing) : null },
      { label: 'Transaction fee', value: cause.tx_fee !== null && cause.tx_fee !== undefined ? String(cause.tx_fee) : null },
      { label: 'Sales tax', value: cause.sales_tax !== null && cause.sales_tax !== undefined ? String(cause.sales_tax) : null },
      { label: 'Tax ID', value: cause.tax_id },
      { label: 'Time zone', value: cause.time_zone },
      { label: 'QA status', value: cause.active === null || cause.active === undefined ? null : cause.active ? 'Active' : 'Inactive' },
    ]
  }, [cause, qaLinkedCauseId])

  // â”€â”€ Codes + Material Engine â”€â”€

  const [referralCode, setReferralCode] = React.useState('')
  const [connectionCode, setConnectionCode] = React.useState('')
  const [engineMessage, setEngineMessage] = React.useState<string | null>(null)
  const [engineError, setEngineError] = React.useState<string | null>(null)
  const [engineBusy, setEngineBusy] = React.useState<'codes' | 'generate' | null>(null)
  const [stepBusyId, setStepBusyId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (codes?.referral_code || codes?.connection_code) {
      setReferralCode(codes.referral_code || '')
      setConnectionCode(codes.connection_code || '')
    } else {
      // Fall back to operator profile codes when stakeholder_codes row has no values yet
      const profileMeta = (profile?.metadata || {}) as Record<string, unknown>
      const sharedUrl = typeof profileMeta.qa_shared_url === 'string' ? profileMeta.qa_shared_url : null
      const profileConnectionCode = sharedUrl
        ? normalizeStakeholderCode(sharedUrl.split('/').pop() || '') || normalizeStakeholderCode(profile?.referral_code || '')
        : normalizeStakeholderCode(profile?.referral_code || '')
      setReferralCode(profile?.referral_code || '')
      setConnectionCode(profileConnectionCode || '')
    }
  }, [codes?.connection_code, codes?.referral_code, profile?.referral_code, profile?.metadata])

  const joinUrl = React.useMemo(() => {
    if (codes?.join_url) return codes.join_url
    if (!connectionCode.trim()) return ''
    return buildStakeholderJoinUrl(isSchool ? 'school' : 'cause', connectionCode)
  }, [codes?.join_url, connectionCode, isSchool])

  const writebackRows = React.useMemo<QaWritebackRow[]>(() => {
    if (!cause) return []

    const rows: QaWritebackRow[] = []
    const pushRow = (field: string, currentValue: string | null | undefined, qaNeed: string, status = 'Needs QA field') => {
      if (!currentValue || !String(currentValue).trim()) return
      rows.push({ field, currentValue: String(currentValue), qaNeed, status })
    }

    pushRow('Dashboard stage', ONBOARDING_STAGES[cause.stage]?.label || cause.stage, 'onboarding_stage + write API')
    pushRow('Cause type', cause.type, 'cause_type / nonprofit_type')
    pushRow('Campaign link', campaign?.name, 'campaign_id or account_campaign relation')
    pushRow('Linked businesses', linkedBusinesses.length > 0 ? `${linkedBusinesses.length} linked business${linkedBusinesses.length === 1 ? '' : 'es'}` : null, 'business-to-cause relation table + APIs')
    pushRow('Referral code', codes?.referral_code, 'referral_code field or stakeholder code domain')
    pushRow('Connection code', codes?.connection_code, 'connection_code field or stakeholder code domain')
    pushRow('Join URL', joinUrl, 'join_url field')
    pushRow('Generated materials', generatedCount > 0 ? `${generatedCount} generated asset${generatedCount === 1 ? '' : 's'}` : null, 'materials domain + assignment APIs', 'Needs QA workflow domain')
    pushRow('QR codes', causeQrCodes.length > 0 ? `${causeQrCodes.length} linked QR code${causeQrCodes.length === 1 ? '' : 's'}` : null, 'qr code domain + relation APIs', 'Needs QA workflow domain')
    pushRow('Outreach activity', outreach.length > 0 ? `${outreach.length} logged ${outreach.length === 1 ? 'activity' : 'activities'}` : null, 'outreach activity table + read/write APIs', 'Needs QA workflow domain')
    pushRow('Tasks', tasks.length > 0 ? `${tasks.length} tracked task${tasks.length === 1 ? '' : 's'}` : null, 'tasks table + read/write APIs', 'Needs QA workflow domain')
    pushRow('Notes', notes.length > 0 ? `${notes.length} saved note${notes.length === 1 ? '' : 's'}` : null, 'notes table + read/write APIs', 'Needs QA workflow domain')

    return rows
  }, [campaign?.name, cause, causeQrCodes.length, codes?.connection_code, codes?.referral_code, generatedCount, joinUrl, linkedBusinesses.length, notes.length, outreach.length, tasks.length])

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

  React.useEffect(() => {
    if (!localCauseId || localCauseId === routeId) return
    const nextQaId = causeResponse?.qaCauseId || qaCauseId
    const nextHref = `/crm/causes/${localCauseId}${nextQaId !== null ? `?qaId=${nextQaId}` : ''}`
    router.replace(nextHref)
  }, [causeResponse?.qaCauseId, localCauseId, qaCauseId, routeId, router])

  const handleStageChange = React.useCallback(async (newStage: OnboardingStage) => {
    if (!cause || !localCauseId || readOnly) return
    await updateCause(localCauseId, { stage: newStage })
    setStageDropdownOpen(false)
    window.location.reload()
  }, [cause, localCauseId, readOnly, updateCause])

  const handleCampaignLinkSave = React.useCallback(async () => {
    if (!cause || !localCauseId || readOnly) return
    await updateCause(localCauseId, { campaign_id: pendingCampaignId === '__none' ? null : pendingCampaignId })
    setLinkCampaignOpen(false)
    window.location.reload()
  }, [cause, localCauseId, pendingCampaignId, readOnly, updateCause])

  async function refetchExecution() {
    refetchStakeholders({ silent: true })
    refetchCodes({ silent: true })
    refetchGeneratedMaterials({ silent: true })
    refetchMaterialRecords({ silent: true })
    refetchAdminTasks({ silent: true })
    refetchFlows({ silent: true })
    refetchSteps({ silent: true })
    refetchQrCodes({ silent: true })
    refetchOutreach({ silent: true })
  }

  async function callExecutionAction(payload: Record<string, unknown>) {
    const response = await fetch(`/api/crm/causes/${causeId}/execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const contentType = response.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : { error: await response.text().catch(() => 'The cause action could not be completed.') }
    if (!response.ok) throw new Error(body.error || 'The cause action could not be completed.')
    return body
  }

  async function listGenerationTemplates() {
    const body = await callExecutionAction({ action: 'list_generation_templates' })
    return Array.isArray(body?.templates) ? (body.templates as GenerationTemplateSummary[]) : []
  }

  async function runMaterialGenerationBatch(
    templates: GenerationTemplateSummary[],
    options: {
      progressPrefix: string
      setProgress: (message: string | null) => void
      setError: (message: string | null) => void
      emptyMessage: string
      successMessage: string
    },
  ) {
    if (templates.length === 0) {
      options.setProgress(options.emptyMessage)
      options.setError(null)
      return
    }

    const failures: Array<{ template: GenerationTemplateSummary; message: string }> = []

    for (const [index, template] of templates.entries()) {
      options.setProgress(`${options.progressPrefix} (${index + 1}/${templates.length}): ${template.name}`)
      try {
        await callExecutionAction({ action: 'generate_template', templateId: template.id })
      } catch (error) {
        failures.push({
          template,
          message: error instanceof Error ? error.message : 'Generation failed.',
        })
      }
    }

    await refetchExecution()

    if (failures.length === templates.length) {
      options.setProgress(null)
      options.setError(failures[0]?.message || 'Materials could not be generated.')
      return
    }

    if (failures.length > 0) {
      options.setProgress(
        `${options.successMessage} ${templates.length - failures.length}/${templates.length} finished. `
        + `Some templates still need attention: ${failures.map((failure) => failure.template.name).join(', ')}.`
      )
      options.setError(failures[0]?.message || null)
      return
    }

    options.setError(null)
    options.setProgress(options.successMessage)
  }

  async function handleSaveCodes() {
    setEngineBusy('codes')
    setEngineMessage(null)
    setEngineError(null)
    try {
      await callExecutionAction({ action: 'save_codes', referralCode, connectionCode })
      await refetchExecution()
      setEngineMessage('Codes saved.')
      const templates = await listGenerationTemplates()
      await runMaterialGenerationBatch(templates, {
        progressPrefix: 'Generating materials',
        setProgress: setEngineMessage,
        setError: setEngineError,
        emptyMessage: 'Codes saved. No active auto-generation templates were found.',
        successMessage: 'Codes saved and materials generated.',
      })
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
      const templates = await listGenerationTemplates()
      await runMaterialGenerationBatch(templates, {
        progressPrefix: 'Generating materials',
        setProgress: setEngineMessage,
        setError: setEngineError,
        emptyMessage: 'No active auto-generation templates were found.',
        successMessage: 'Materials generated.',
      })
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
      performed_by: localProfileId || undefined,
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
      created_by: localProfileId || undefined,
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
      created_by: localProfileId || undefined,
      is_internal: false,
    })
    setNoteContent('')
    refetchNotes({ silent: true })
  }

  // ── Duplicate review ──
  async function handleNotDuplicate() {
    if (!localCauseId || readOnly) return
    setReviewDupLoading(true)
    await updateCause(localCauseId, { duplicate_of: null })
    setReviewDupOpen(false)
    window.location.reload()
  }

  async function handleArchiveAsDuplicate() {
    if (!localCauseId || readOnly) return
    setReviewDupLoading(true)
    await updateCause(localCauseId, { status: 'archived' })
    setReviewDupOpen(false)
    window.location.reload()
  }

  // ── Lifecycle modals ──
  const [lifecycleModal, setLifecycleModal] = React.useState<'initial_connection' | 'leader_conversation' | 'materials_qr' | 'activation_decision' | null>(null)

  function getExecutionStep(key: string) {
    return executionSteps.find(s => s.key === key) || null
  }

  async function handleSaveCodesWithValues(ref: string, conn: string) {
    setReferralCode(ref)
    setConnectionCode(conn)
    setEngineBusy('codes')
    setEngineMessage(null)
    setEngineError(null)
    try {
      await callExecutionAction({ action: 'save_codes', referralCode: ref, connectionCode: conn })
      await refetchExecution()
      setEngineMessage('Codes saved.')
      const templates = await listGenerationTemplates()
      await runMaterialGenerationBatch(templates, {
        progressPrefix: 'Generating materials',
        setProgress: setEngineMessage,
        setError: setEngineError,
        emptyMessage: 'Codes saved. No active auto-generation templates were found.',
        successMessage: 'Codes saved and materials generated.',
      })
    } catch (error) {
      setEngineError(error instanceof Error ? error.message : 'Codes could not be saved.')
    } finally {
      setEngineBusy(null)
    }
  }

  async function handleLogOutreachFromModal(data: { type: string; subject: string; body: string; outcome: string; nextStep: string; nextStepDate: string }) {
    await insertOutreach({
      entity_type: 'cause',
      entity_id: causeId,
      type: data.type as OutreachType,
      performed_by: localProfileId || undefined,
      subject: data.subject || null,
      body: data.body,
      outcome: data.outcome || null,
    } as any)
    refetchOutreach({ silent: true })
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
        description={causeError || detailQaError || 'This record could not be loaded.'}
      />
    )
  }

  if (readOnly) {
    return (
      <QaCauseReadonlyView
        cause={cause}
        qaError={detailQaError}
        apiError={causeError}
      />
    )
  }

  const completedStepCount = executionSteps.filter(s => s.state === 'completed').length
  const qrGeneratorHref = localCauseId
    ? `/qr/generator?causeId=${localCauseId}&returnTo=${encodeURIComponent(`/crm/causes/${localCauseId}${qaCauseId !== null ? `?qaId=${qaCauseId}` : ''}`)}`
    : '/qr/generator'

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
      {causeError && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">Cause detail warning</p>
            <p className="mt-1 text-xs text-warning-700">{causeError}</p>
          </div>
        </div>
      )}

      {detailQaError && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">QA nonprofit sync warning</p>
            <p className="mt-1 text-xs text-warning-700">{detailQaError}</p>
          </div>
        </div>
      )}
      {qaLinkedCauseId && (
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <p className="font-medium">QA-linked cause record</p>
            <p className="mt-1 text-xs text-sky-800">
              Blue cards on this page are imported live from the QA server every time this cause is opened. Dashboard launch work like codes, tasks, notes, outreach, materials, and QR stays local until QA supports those domains.
            </p>
          </div>
        </div>
      )}
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
            <Button size="sm" onClick={() => setLifecycleModal('leader_conversation')}>
              <Send className="h-3.5 w-3.5" /> Log Activity
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('tasks')}>
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
            <LogInAsButton
              userId={owner?.id || causeStakeholder?.profile_id || causeStakeholder?.owner_user_id || null}
              userName={owner?.full_name || cause.name}
              stakeholderType={isSchool ? 'School Leader' : 'Cause Leader'}
            />
          </div>
        )}
      />

      {/* ── Quick info cards ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <Card className="group cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setLinkCampaignOpen(true)}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaign</p>
            <p className="mt-1 text-sm font-semibold text-surface-900 truncate">{campaign?.name || 'Not linked'}</p>
          </CardContent>
        </Card>
        <Card className="group cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setLifecycleModal('initial_connection')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Owner</p>
              <Pencil className="h-3 w-3 text-surface-300 group-hover:text-brand-500 transition-colors" />
            </div>
            <p className="mt-1 text-sm font-semibold text-surface-900 truncate">{owner?.full_name || 'Unassigned'}</p>
          </CardContent>
        </Card>
        <Card className="group cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setLifecycleModal('initial_connection')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">City</p>
              <Pencil className="h-3 w-3 text-surface-300 group-hover:text-brand-500 transition-colors" />
            </div>
            <p className="mt-1 text-sm font-semibold text-surface-900 truncate">{city ? `${city.name}, ${city.state}` : 'No city'}</p>
          </CardContent>
        </Card>
        <Card className="group cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setLifecycleModal('activation_decision')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Readiness</p>
              <ArrowRight className="h-3 w-3 text-surface-300 group-hover:text-brand-500 transition-colors" />
            </div>
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
        {/* Codes card */}
        <Card className="group cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setLifecycleModal('materials_qr')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Referral Code</p>
              {codes?.referral_code
                ? <button type="button" onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(codes.referral_code!) }} className="text-surface-300 hover:text-brand-500 transition-colors" title="Copy referral code"><Copy className="h-3 w-3" /></button>
                : <Pencil className="h-3 w-3 text-surface-300 group-hover:text-brand-500 transition-colors" />}
            </div>
            {codes?.referral_code ? (
              <p className="mt-1 font-mono text-sm font-semibold text-surface-900 truncate">{codes.referral_code}</p>
            ) : (
              <p className="mt-1 text-sm text-surface-400">Not set</p>
            )}
            {joinUrl ? (
              <div className="mt-1 flex items-center gap-1">
                <p className="text-xs text-brand-600 truncate">{joinUrl.replace('https://', '')}</p>
                <button type="button" onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(joinUrl) }} className="shrink-0 text-surface-300 hover:text-brand-500 transition-colors" title="Copy join URL"><Copy className="h-2.5 w-2.5" /></button>
              </div>
            ) : null}
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
            <StatusCard label="Activation" value={`${completedStepCount}/${executionSteps.length}`} ready={executionSteps.every(s => s.state === 'completed')} onClick={() => setLifecycleModal('activation_decision')} />
            <StatusCard label="QR Assets" value={causeQrCodes.length > 0 ? 'Ready' : 'Missing'} ready={causeQrCodes.length > 0} onClick={() => setLifecycleModal('materials_qr')} />
            <StatusCard label="Businesses" value={`${linkedBusinesses.length}`} ready={linkedBusinesses.length > 0} onClick={() => setActiveTab('businesses')} />
            <StatusCard label="Materials" value={`${generatedCount} ready`} ready={generatedCount > 0} onClick={() => setActiveTab('materials')} />
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
                          <button
                            type="button"
                            onClick={() => setActiveTab(getTabForStepKey(item.key) as DashboardTab)}
                            className="text-xs text-warning-700 underline decoration-warning-300 underline-offset-2 hover:text-warning-900 hover:decoration-warning-500 transition-colors cursor-pointer text-left"
                          >
                            {item.blocker} →
                          </button>
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
                    <button
                      key={action.text}
                      type="button"
                      onClick={() => setActiveTab(action.tab as DashboardTab)}
                      className="flex w-full items-start gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer group"
                    >
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <span className="text-sm text-surface-700 group-hover:text-brand-700 flex-1">{action.text}</span>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-surface-300 group-hover:text-brand-500 transition-colors" />
                    </button>
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
                    <button
                      key={check.label}
                      type="button"
                      onClick={() => setActiveTab(getTabForReadinessCheck(check.label) as DashboardTab)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer ${
                        check.met
                          ? 'hover:bg-success-50'
                          : 'hover:bg-warning-50'
                      }`}
                    >
                      {check.met
                        ? <CheckCircle2 className="h-4 w-4 text-success-500" />
                        : <div className="h-4 w-4 rounded-full border-2 border-surface-300" />}
                      <span className={`text-sm flex-1 ${check.met ? 'text-surface-700' : 'text-surface-500'}`}>{check.label}</span>
                      {!check.met && <ArrowRight className="h-3.5 w-3.5 text-surface-300" />}
                    </button>
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
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setLifecycleModal('leader_conversation')}>
                    <Send className="h-3.5 w-3.5" /> Log Outreach
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setLifecycleModal('materials_qr')}>
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
                  tab: 'codes' as DashboardTab,
                  modal: 'initial_connection' as const,
                  icon: <Target className="h-5 w-5 text-brand-600" />,
                  items: [
                    { label: 'Profile complete (city + contact)', done: !!(cause.city_id && (cause.owner_email || cause.email || cause.owner_phone || cause.phone)), modal: 'initial_connection' as const },
                    { label: 'Referral & connection codes saved', done: !!(codes?.referral_code && codes?.connection_code), modal: 'materials_qr' as const },
                    { label: 'Materials generated', done: generatedCount > 0, tab: 'materials' as DashboardTab },
                    { label: 'QR code created', done: causeQrCodes.length > 0, modal: 'materials_qr' as const },
                  ],
                },
                {
                  group: 'Internal Alignment',
                  tab: 'activity' as DashboardTab,
                  modal: 'leader_conversation' as const,
                  icon: <Users className="h-5 w-5 text-violet-600" />,
                  items: [
                    { label: isSchool ? 'Principal / decision-maker identified' : 'Board / decision-maker identified', done: outreach.length >= 1, modal: 'leader_conversation' as const },
                    { label: isSchool ? 'PTA leadership engaged' : 'Leadership engaged', done: outreach.length >= 2, modal: 'leader_conversation' as const },
                    { label: 'Internal champion confirmed', done: executionSteps.some(s => s.key === 'leader_conversation' && s.state === 'completed'), modal: 'leader_conversation' as const },
                  ],
                },
                {
                  group: 'First Business',
                  tab: 'businesses' as DashboardTab,
                  icon: <Store className="h-5 w-5 text-amber-600" />,
                  items: [
                    { label: 'First business prospect identified', done: linkedBusinesses.length >= 1, tab: 'businesses' as DashboardTab },
                    { label: 'First business contacted', done: linkedBusinesses.some(b => b.stage !== 'lead'), tab: 'businesses' as DashboardTab },
                    { label: 'First business onboarded', done: linkedBusinesses.some(b => b.stage === 'onboarded' || b.stage === 'live'), tab: 'businesses' as DashboardTab },
                  ],
                },
                {
                  group: isSchool ? 'Parent / Community Activation' : 'Supporter Activation',
                  tab: 'community' as DashboardTab,
                  icon: <Heart className="h-5 w-5 text-pink-600" />,
                  items: [
                    { label: isSchool ? 'Parent materials ready' : 'Supporter materials ready', done: generatedMaterials.some(m => m.library_folder === 'share_with_parents' && m.generation_status === 'generated'), modal: 'materials_qr' as const },
                    { label: isSchool ? 'Flyer sent home / shared in group' : 'Supporter flyer shared', done: false, tab: 'community' as DashboardTab },
                    { label: isSchool ? 'Parent engagement started' : 'Community engagement started', done: outreach.length >= 3, modal: 'leader_conversation' as const },
                  ],
                },
                {
                  group: isSchool ? 'PTA / Leadership Activation' : 'Board / Leadership Activation',
                  tab: 'leadership' as DashboardTab,
                  icon: <BookOpen className="h-5 w-5 text-indigo-600" />,
                  items: [
                    { label: isSchool ? 'PTA one-pager shared' : 'Leadership one-pager shared', done: generatedMaterials.some(m => m.library_folder === 'share_with_pta' && m.generation_status === 'generated'), modal: 'materials_qr' as const },
                    { label: 'Meeting scheduled or completed', done: false, modal: 'leader_conversation' as const },
                    { label: 'Support secured', done: executionSteps.some(s => s.key === 'activation_decision' && s.state === 'completed'), modal: 'activation_decision' as const },
                  ],
                },
                {
                  group: 'Launch Readiness',
                  tab: 'mission' as DashboardTab,
                  modal: 'activation_decision' as const,
                  icon: <Rocket className="h-5 w-5 text-success-600" />,
                  items: [
                    { label: '3+ businesses linked', done: linkedBusinesses.length >= 3, tab: 'businesses' as DashboardTab },
                    { label: 'All activation steps complete', done: executionSteps.every(s => s.state === 'completed'), modal: 'activation_decision' as const },
                    { label: `${entityLabel} is live`, done: cause.stage === 'live', modal: 'activation_decision' as const },
                  ],
                },
              ].map(section => {
                const doneCount = section.items.filter(i => i.done).length
                return (
                  <div key={section.group} className="rounded-2xl border border-surface-200 bg-surface-50 p-5">
                    <button
                      type="button"
                      onClick={() => { const m = (section as any).modal; const t = section.tab; if (m) setLifecycleModal(m); else if (t) setActiveTab(t) }}
                      className="flex w-full items-center justify-between mb-3 text-left group"
                    >
                      <div className="flex items-center gap-3">
                        {section.icon}
                        <h3 className="font-semibold text-surface-900 group-hover:text-brand-700 transition-colors">{section.group}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={doneCount === section.items.length ? 'success' : doneCount > 0 ? 'warning' : 'default'}>
                          {doneCount}/{section.items.length}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-surface-300 group-hover:text-brand-500 transition-colors" />
                      </div>
                    </button>
                    <div className="space-y-2">
                      {section.items.map(item => {
                        const itemAction = () => {
                          const m = (item as any).modal
                          const t = (item as any).tab
                          if (m) setLifecycleModal(m as typeof lifecycleModal)
                          else if (t) setActiveTab(t as DashboardTab)
                        }
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={itemAction}
                            className={`flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2 text-left transition-colors hover:bg-surface-50 hover:border-surface-300 border border-transparent`}
                          >
                            {item.done
                              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" />
                              : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-surface-300" />}
                            <span className={`flex-1 text-sm ${item.done ? 'text-surface-500 line-through' : 'text-surface-900'}`}>{item.label}</span>
                            {!item.done && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-surface-300" />}
                          </button>
                        )
                      })}
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
                    { label: isSchool ? 'Share the parent flyer in school groups' : 'Share the supporter flyer in community groups', icon: <Send className="h-4 w-4 text-brand-500" />, modal: 'materials_qr' as const },
                    { label: isSchool ? 'Send the flyer home with students' : 'Distribute flyers at community events', icon: <FileText className="h-4 w-4 text-brand-500" />, tab: 'materials' as DashboardTab },
                    { label: 'Post in Facebook / WhatsApp groups', icon: <Globe className="h-4 w-4 text-brand-500" />, modal: 'materials_qr' as const },
                    { label: isSchool ? 'Announce at PTA meetings' : 'Announce at community gatherings', icon: <Users className="h-4 w-4 text-brand-500" />, modal: 'leader_conversation' as const },
                    { label: 'Use QR code at events for instant sign-up', icon: <QrCode className="h-4 w-4 text-brand-500" />, modal: 'materials_qr' as const },
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { const m = (item as any).modal; const t = (item as any).tab; if (m) setLifecycleModal(m); else if (t) setActiveTab(t as DashboardTab) }}
                      className="flex w-full items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50 transition-colors group"
                    >
                      {item.icon}
                      <span className="flex-1 text-sm text-surface-700 group-hover:text-brand-700">{item.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-surface-300 group-hover:text-brand-500 transition-colors" />
                    </button>
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
                    mat.generated_file_url ? (
                      <a key={mat.id} href={mat.generated_file_url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-surface-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-colors group">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-900 group-hover:text-brand-700">{mat.generated_file_name || 'Material'}</p>
                            <p className="text-xs text-surface-500">{mat.library_folder.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="success">Ready</Badge>
                            <ExternalLink className="h-3.5 w-3.5 text-surface-300 group-hover:text-brand-500" />
                          </div>
                        </div>
                      </a>
                    ) : (
                      <div key={mat.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-900">{mat.generated_file_name || 'Material'}</p>
                            <p className="text-xs text-surface-500">{mat.library_folder.replace(/_/g, ' ')}</p>
                          </div>
                          <Badge variant="success">Ready</Badge>
                        </div>
                      </div>
                    )
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
                    { label: isSchool ? 'Identify the PTA president or key decision-maker' : 'Identify the board chair or key decision-maker', done: outreach.length >= 1, modal: 'leader_conversation' as const },
                    { label: isSchool ? 'Share the PTA one-pager' : 'Share the leadership one-pager', done: generatedMaterials.some(m => m.library_folder === 'share_with_pta' && m.generation_status === 'generated'), tab: 'materials' as DashboardTab },
                    { label: 'Schedule a 15-minute intro meeting', done: false, modal: 'leader_conversation' as const },
                    { label: 'Present the value proposition', done: false, modal: 'leader_conversation' as const },
                    { label: 'Get verbal or formal support', done: executionSteps.some(s => s.key === 'activation_decision' && s.state === 'completed'), modal: 'activation_decision' as const },
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { const m = (item as any).modal; const t = (item as any).tab; if (m) setLifecycleModal(m); else if (t) setActiveTab(t as DashboardTab) }}
                      className="flex w-full items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50 transition-colors group"
                    >
                      {item.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" /> : <div className="h-4 w-4 shrink-0 rounded-full border-2 border-surface-300" />}
                      <span className={`flex-1 text-sm ${item.done ? 'text-surface-700' : 'text-surface-900 group-hover:text-brand-700'}`}>{item.label}</span>
                      {!item.done && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-surface-300 group-hover:text-brand-500 transition-colors" />}
                    </button>
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
                    mat.generated_file_url ? (
                      <a key={mat.id} href={mat.generated_file_url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-surface-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-colors group">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-900 group-hover:text-brand-700">{mat.generated_file_name || 'Material'}</p>
                            <p className="text-xs text-surface-500">{mat.library_folder.replace(/_/g, ' ')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="success">Ready</Badge>
                            <ExternalLink className="h-3.5 w-3.5 text-surface-300 group-hover:text-brand-500" />
                          </div>
                        </div>
                      </a>
                    ) : (
                      <div key={mat.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-900">{mat.generated_file_name || 'Material'}</p>
                            <p className="text-xs text-surface-500">{mat.library_folder.replace(/_/g, ' ')}</p>
                          </div>
                          <Badge variant="success">Ready</Badge>
                        </div>
                      </div>
                    )
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
          {generatedMaterialPairs.length === 0 ? (
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
                const folderPairs = generatedMaterialPairs.filter(({ generated }) => generated.library_folder === folder.value)
                if (folderPairs.length === 0) return null
                return (
                  <Card key={folder.value}>
                    <CardHeader>
                      <CardTitle>{folder.label}</CardTitle>
                      <p className="text-sm text-surface-500">{folder.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {folderPairs.map(({ generated, material }) => {
                        const fileUrl = generated.generated_file_url || material?.file_url || null
                        const Inner = (
                          <>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-surface-900 truncate group-hover:text-brand-700 transition-colors">
                                {material?.title || generated.generated_file_name || 'Generated asset'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {material?.description && (
                                  <span className="text-xs text-surface-500 truncate max-w-[200px]">{material.description}</span>
                                )}
                                {generated.tags?.map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {generated.is_outdated && <Badge variant="warning">Update available</Badge>}
                              <Badge variant="success">Ready</Badge>
                              <ExternalLink className="h-3.5 w-3.5 text-surface-300 group-hover:text-brand-500 transition-colors" />
                            </div>
                          </>
                        )
                        return fileUrl ? (
                          <a key={generated.id} href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex group items-center justify-between gap-4 rounded-xl border border-surface-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                            {Inner}
                          </a>
                        ) : (
                          <div key={generated.id} className="group flex items-center justify-between gap-4 rounded-xl border border-surface-200 bg-white px-4 py-3">
                            {Inner}
                          </div>
                        )
                      })}
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
                    {generatedMaterials.filter(m => m.generation_status === 'failed').map(mat => {
                      const failedSource = mat.material_id ? causeMaterialMap.get(mat.material_id) : null
                      return (
                        <div key={mat.id} className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
                          <p className="text-sm font-medium text-danger-800">{failedSource?.title || mat.generated_file_name || 'Failed asset'}</p>
                          {mat.generation_error && <p className="mt-1 text-xs text-danger-600">{mat.generation_error}</p>}
                        </div>
                      )
                    })}
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
                  <MiniStatus label="Generation" value={generationState} />
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

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generated materials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {generatedMaterialPairs.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center">
                      <FileText className="mx-auto mb-2 h-8 w-8 text-surface-300" />
                      <p className="text-sm font-medium text-surface-700">No materials generated yet</p>
                      <p className="mt-1 text-xs text-surface-500">Save your codes or run generation to create cause-ready materials here.</p>
                    </div>
                  ) : (
                    generatedMaterialPairs.slice(0, 4).map(({ generated, material }) => (
                      <div key={generated.id} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-surface-900">
                              {material?.title || generated.generated_file_name || 'Generated asset'}
                            </p>
                            <p className="mt-1 text-xs text-surface-500">{generated.library_folder.replace(/_/g, ' ')}</p>
                          </div>
                          <Badge variant="success">Ready</Badge>
                        </div>
                        {(generated.generated_file_url || material?.file_url) && (
                          <a
                            href={generated.generated_file_url || material?.file_url || ''}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open file
                          </a>
                        )}
                      </div>
                    ))
                  )}
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
                        <div className="flex items-center gap-2">
                          <Badge variant={qr.status === 'active' ? 'success' : 'default'}>{qr.status}</Badge>
                          <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(qr.redirect_url)}>
                            <Copy className="h-3.5 w-3.5" /> Copy Link
                          </Button>
                          <a href={qr.redirect_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
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
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLifecycleModal('leader_conversation')}
                  className="w-full text-left rounded-xl border border-surface-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-surface-900 group-hover:text-brand-700">{item.subject || item.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-surface-500">{formatDateTime(item.created_at)}</p>
                  </div>
                  {item.body && <p className="mt-2 text-sm text-surface-600">{item.body}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="default">{item.type.replace(/_/g, ' ')}</Badge>
                    {item.outcome && <Badge variant="info">{item.outcome}</Badge>}
                    <Badge variant="outline">{profileMap.get(item.performed_by)?.full_name || 'Team member'}</Badge>
                  </div>
                </button>
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
          QA PANELS (bottom — for reference only)
         ══════════════════════════════════════════════════════════ */}
      {qaImportedFacts.length > 0 && (
        <QaImportedFieldsPanel
          title="Imported From QA"
          description="These values are refreshed from QA whenever this cause or nonprofit record is opened."
          facts={qaImportedFacts}
          accentLabel="QA cause fields"
        />
      )}

      <QaWritebackWishlistTable
        title="Dashboard Info To Add To QA Later"
        description="This is the dashboard-only launch and follow-up data already attached to this record that still needs QA fields and write APIs."
        rows={writebackRows}
      />

      {/* ══════════════════════════════════════════════════════════
          LIFECYCLE MODALS
         ══════════════════════════════════════════════════════════ */}
      {cause && (
        <>
          <CauseInitialConnectionModal
            open={lifecycleModal === 'initial_connection'}
            onOpenChange={(open) => setLifecycleModal(open ? 'initial_connection' : null)}
            cause={cause as any}
            city={city}
            linkedBusinessCount={linkedBusinesses.length}
            helperCount={assignments.length}
            onSave={async (changes) => {
              if (localCauseId) {
                await updateCause(localCauseId, changes as any)
                window.location.reload()
              }
            }}
            onCompleteStep={(() => {
              const step = getExecutionStep('initial_connection')
              return step?.step.id && step.state === 'active' && step.readyToComplete
                ? () => void handleCompleteStep(step.step.id)
                : undefined
            })()}
            readyToComplete={getExecutionStep('initial_connection')?.readyToComplete ?? false}
            saving={updateLoading || stepBusyId !== null}
            blocker={getExecutionStep('initial_connection')?.blocker ?? null}
            cities={cities}
          />

          <LeaderConversationModal
            open={lifecycleModal === 'leader_conversation'}
            onOpenChange={(open) => setLifecycleModal(open ? 'leader_conversation' : null)}
            outreach={outreach}
            profileMap={profileMap}
            onLogOutreach={handleLogOutreachFromModal}
            onCompleteStep={(() => {
              const step = getExecutionStep('leader_conversation')
              return step?.step.id && step.state === 'active' && step.readyToComplete
                ? () => void handleCompleteStep(step.step.id)
                : undefined
            })()}
            readyToComplete={getExecutionStep('leader_conversation')?.readyToComplete ?? false}
            saving={stepBusyId !== null}
            blocker={getExecutionStep('leader_conversation')?.blocker ?? null}
          />

          <CauseMaterialsQrModal
            open={lifecycleModal === 'materials_qr'}
            onOpenChange={(open) => setLifecycleModal(open ? 'materials_qr' : null)}
            codes={codes}
            generatedMaterials={generatedMaterials}
            qrCodes={causeQrCodes}
            joinUrl={joinUrl || null}
            onSaveCodes={handleSaveCodesWithValues}
            onGenerateMaterials={handleGenerateMaterials}
            onRegenerateAll={handleGenerateMaterials}
            onCompleteStep={(() => {
              const step = getExecutionStep('materials_qr')
              return step?.step.id && step.state === 'active' && step.readyToComplete
                ? () => void handleCompleteStep(step.step.id)
                : undefined
            })()}
            readyToComplete={getExecutionStep('materials_qr')?.readyToComplete ?? false}
            saving={stepBusyId !== null}
            blocker={getExecutionStep('materials_qr')?.blocker ?? null}
            engineBusy={engineBusy}
            regenBusy={engineBusy === 'generate'}
          />

          <ActivationDecisionModal
            open={lifecycleModal === 'activation_decision'}
            onOpenChange={(open) => setLifecycleModal(open ? 'activation_decision' : null)}
            cause={cause as any}
            linkedBusinessCount={linkedBusinesses.length}
            generatedCount={generatedCount}
            qrCount={causeQrCodes.length}
            codesReady={!!(codes?.referral_code && codes?.connection_code)}
            stakeholderReady={!!causeStakeholder}
            onCompleteStep={(() => {
              const step = getExecutionStep('activation_decision')
              return step?.step.id && step.state === 'active' && step.readyToComplete
                ? () => void handleCompleteStep(step.step.id)
                : undefined
            })()}
            readyToComplete={getExecutionStep('activation_decision')?.readyToComplete ?? false}
            saving={stepBusyId !== null}
            blocker={getExecutionStep('activation_decision')?.blocker ?? null}
          />
        </>
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

function StatusCard({ label, value, ready, onClick }: { label: string; value: string; ready: boolean; onClick?: () => void }) {
  return (
    <Card
      className={onClick ? 'group cursor-pointer hover:shadow-card-hover transition-shadow' : ''}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
          {onClick && <ArrowRight className="h-3 w-3 text-surface-300 group-hover:text-brand-500 transition-colors" />}
        </div>
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

function QaCauseReadonlyView({
  cause,
  qaError,
  apiError,
}: {
  cause: CrmCause
  qaError: string | null
  apiError: string | null
}) {
  const entityLabel = cause.type === 'school' ? 'School' : 'Cause'

  return (
    <div className="space-y-6">
      {(apiError || qaError) && (
        <div className="flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          <div>
            <p className="font-medium">QA nonprofit sync warning</p>
            <p className="mt-1 text-xs text-warning-700">{apiError || qaError}</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-info-600" />
        <div>
          <p className="font-medium">QA record loaded in read-only mode</p>
          <p className="mt-1 text-xs text-info-700">
            This {entityLabel.toLowerCase()} exists in QA, but it does not have a linked local dashboard record yet. CRM-only tabs like tasks, notes, materials, and codes stay disabled until it is imported or linked locally.
          </p>
        </div>
      </div>

      <PageHeader
        title={cause.name}
        description={`${entityLabel} account from QA • dashboard workflow stays read-only until linked locally.`}
        breadcrumb={[
          { label: 'CRM', href: '/crm/causes' },
          { label: 'Causes', href: '/crm/causes' },
          { label: cause.name },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniStatus label="QA Status" value={cause.active ? 'Active' : 'Inactive'} />
        <MiniStatus label="Type" value={entityLabel} />
        <MiniStatus label="Owner Email" value={cause.owner_email || cause.email || 'Not available'} />
        <MiniStatus label="Location" value={[cause.city_name, cause.state].filter(Boolean).join(', ') || 'Not available'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QA Account Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Headline</p>
            <p className="mt-2 text-sm text-surface-900">{cause.headline || 'No headline available'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Primary Contact</p>
            <p className="mt-2 text-sm text-surface-900">{cause.owner_name || 'No owner name'}</p>
            <p className="mt-1 text-xs text-surface-500">{cause.owner_email || cause.email || 'No email available'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Phone</p>
            <p className="mt-2 text-sm text-surface-900">{cause.owner_phone || cause.phone || 'No phone available'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Address</p>
            <p className="mt-2 text-sm text-surface-900">{cause.full_address || cause.address || 'No address available'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Description</p>
            <p className="mt-2 text-sm text-surface-900">{cause.description || 'No description available'}</p>
          </div>
          <div className="rounded-lg border border-surface-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Created</p>
            <p className="mt-2 text-sm text-surface-900">{formatDateTime(cause.created_at)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
