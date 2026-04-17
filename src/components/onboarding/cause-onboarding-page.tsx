'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  FileText,
  Heart,
  LayoutGrid,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  QrCode,
  School,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  CauseInitialConnectionModal,
  LeaderConversationModal,
  CauseMaterialsQrModal,
  ActivationDecisionModal,
} from '@/components/crm/cause-lifecycle-modals'
import { useAuth } from '@/lib/auth/context'
import { asUuid } from '@/lib/uuid'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { BRANDS, ONBOARDING_STAGES } from '@/lib/constants'
import { getEntityTheme } from '@/lib/entity-themes'
import { cn, formatDate } from '@/lib/utils'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import {
  computeCauseOnboardingChecklist,
  type CauseOnboardingChecklist,
} from '@/lib/cause-execution'
import {
  useAdminTaskInsert,
  useAdminTasks,
  useBusinesses,
  useCauseUpdate,
  useCauses,
  useCampaigns,
  useCities,
  useGeneratedMaterials,
  useOnboardingFlows,
  useOnboardingSteps,
  useOutreach,
  useProfiles,
  useQrCodes,
  useStakeholderAssignments,
  useOutreachInsert,
  useStakeholderCodeInsert,
  useStakeholderCodes,
  useStakeholders,
  useTasks,
} from '@/lib/supabase/hooks'
import type {
  AdminTask,
  Brand,
  Business,
  Cause,
  GeneratedMaterial,
  OnboardingFlow,
  OnboardingStage,
  OnboardingStep,
  OutreachActivity,
  Profile,
  QrCode as QrCodeRow,
  Stakeholder,
  StakeholderAssignment,
  StakeholderCode,
  StakeholderType,
  Task,
} from '@/lib/types/database'

const STAGE_ORDER: OnboardingStage[] = ['lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live']
const causeTheme = getEntityTheme('cause')
const businessTheme = getEntityTheme('business')

interface CauseForm {
  name: string
  type: Cause['type']
  email: string
  phone: string
  website: string
  city_id: string
  brand: Brand
  source: string
  stage: OnboardingStage
}

const INITIAL_FORM: CauseForm = {
  name: '',
  type: 'school',
  email: '',
  phone: '',
  website: '',
  city_id: '',
  brand: 'localvip',
  source: '',
  stage: 'lead',
}

interface CauseStepState {
  id: string
  label: string
  completed: boolean
  current: boolean
}

interface CauseDetailData {
  owner: Profile | null
  city: { id: string; name: string; state: string } | null
  campaign: { id: string; name: string } | null
  helperAssignments: Array<{ assignment: StakeholderAssignment; profile: Profile }>
  steps: CauseStepState[]
  tasks: Task[]
  dueTask: Task | undefined
  outreach: OutreachActivity[]
  latestOutreach: OutreachActivity | undefined
  nextFollowUp: OutreachActivity | undefined
  linkedBusinesses: Business[]
  stakeholder: Stakeholder | null
  codes: StakeholderCode | null
  codesReady: boolean
  joinUrl: string | null
  generated: GeneratedMaterial[]
  generatedCount: number
  taskStatus: string | null
  qrCount: number
  qrGeneratorHref: string
  coverPhotoUrl: string | null
  setupLoading: boolean
  setupMessage: string | null
  checklist: CauseOnboardingChecklist
}

function getStageBadgeVariant(stage: string) {
  switch (stage) {
    case 'contacted':
    case 'interested':
      return 'info' as const
    case 'in_progress':
      return 'warning' as const
    case 'onboarded':
    case 'live':
      return 'success' as const
    case 'paused':
      return 'warning' as const
    case 'declined':
      return 'danger' as const
    default:
      return 'default' as const
  }
}

function getTaskStatusVariant(status: string | null | undefined) {
  if (status === 'generated') return 'success' as const
  if (status === 'ready_to_generate') return 'info' as const
  if (status === 'failed') return 'danger' as const
  return 'warning' as const
}

function fallbackSteps(stage: OnboardingStage) {
  const completedCount = (() => {
    switch (stage) {
      case 'lead':
        return 0
      case 'contacted':
        return 1
      case 'interested':
        return 2
      case 'in_progress':
        return 3
      case 'onboarded':
      case 'live':
        return 4
      default:
        return 0
    }
  })()

  return ['Initial connection', 'Leader conversation', 'Materials + QR', 'Activation decision'].map((label, index) => ({
    id: `${label}-${index}`,
    label,
    completed: index < completedCount,
    current: index === completedCount && completedCount < 4,
  }))
}

function normalizeSteps(stage: OnboardingStage, flow: OnboardingFlow | undefined, steps: OnboardingStep[]) {
  if (!flow || steps.length === 0) return fallbackSteps(stage)
  const firstPendingIndex = steps.findIndex((step) => !step.is_completed)
  return steps.map((step, index) => ({
    id: step.id,
    label: step.title,
    completed: step.is_completed,
    current: !step.is_completed && (firstPendingIndex === -1 ? index === steps.length - 1 : index === firstPendingIndex),
  }))
}

function mapCauseToStakeholderType(cause: Cause): StakeholderType {
  if (cause.type === 'school') return 'school'
  if (cause.type === 'community') return 'community'
  return 'cause'
}

function StageChanger({ cause, onStageChanged }: { cause: Cause; onStageChanged: () => void }) {
  const { update, loading } = useCauseUpdate()
  const [open, setOpen] = React.useState(false)

  async function handleStageChange(newStage: OnboardingStage) {
    await update(cause.id, { stage: newStage })
    setOpen(false)
    onStageChanged()
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Move Stage
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-surface-200 bg-surface-0 p-1 shadow-panel">
            {STAGE_ORDER.map((stage) => (
              <button
                key={stage}
                onClick={() => void handleStageChange(stage)}
                disabled={stage === cause.stage}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  stage === cause.stage ? 'bg-surface-100 text-surface-400' : 'text-surface-700 hover:bg-surface-50'
                }`}
              >
                <Badge variant={getStageBadgeVariant(stage)} dot>
                  {ONBOARDING_STAGES[stage]?.label}
                </Badge>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Progress bar color helper ─────────────────────────────

function getProgressColor(percent: number) {
  if (percent >= 80) return 'bg-success-500'
  if (percent >= 40) return 'bg-brand-500'
  if (percent >= 20) return 'bg-amber-500'
  return 'bg-danger-500'
}

function getProgressTextColor(percent: number) {
  if (percent >= 80) return 'text-success-700'
  if (percent >= 40) return 'text-brand-700'
  if (percent >= 20) return 'text-amber-700'
  return 'text-danger-700'
}

type CauseModalSection =
  | 'steps'
  | 'mission'
  | 'relationships'
  | 'brand'
  | 'tasks'
  | 'codes'
  | 'activity'
  | 'businesses'

function getCauseChecklistSection(itemId: string): CauseModalSection {
  switch (itemId) {
    case 'name':
    case 'type':
    case 'city':
    case 'contact':
    case 'website':
      return 'mission'
    case 'owner':
    case 'campaign':
      return 'relationships'
    case 'logo':
    case 'cover':
      return 'brand'
    case 'first_business':
    case 'second_business':
      return 'businesses'
    case 'first_outreach':
    case 'leader_convo':
      return 'activity'
    case 'referral_code':
    case 'connection_code':
    case 'qr':
    case 'materials':
    case 'join_url':
      return 'codes'
    case 'task_done':
      return 'tasks'
    case 'all_steps':
    default:
      return 'steps'
  }
}

function getCauseSectionHighlight(activeSection: string | null, section: string) {
  return activeSection === section ? 'ring-2 ring-pink-300 ring-offset-2 ring-offset-surface-0' : ''
}

function ChecklistJumpButton({
  met,
  label,
  onClick,
}: {
  met: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        met ? 'bg-success-50 text-success-700 hover:bg-success-100' : 'bg-white text-surface-700 hover:bg-surface-100'
      )}
    >
      {met ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" /> : <Circle className="h-4 w-4 shrink-0 text-surface-300" />}
      <span className={cn('flex-1', met && 'line-through opacity-60')}>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-surface-400" />
    </button>
  )
}

// ─── Main page component ───────────────────────────────────

export default function CauseOnboardingPage() {
  const { profile } = useAuth()
  const isFieldUser = getStakeholderShell(profile) === 'field'

  const { data: causes, loading, error, refetch } = useCauses()
  const { data: businesses } = useBusinesses()
  const { data: cities } = useCities()
  const { data: campaigns } = useCampaigns()
  const { data: profiles } = useProfiles()
  const { data: assignments } = useStakeholderAssignments()
  const { data: flows } = useOnboardingFlows()
  const { data: steps } = useOnboardingSteps()
  const { data: tasks } = useTasks()
  const { data: outreach } = useOutreach()
  const { data: stakeholders, refetch: refetchStakeholders } = useStakeholders()
  const { data: stakeholderCodes, refetch: refetchCodes } = useStakeholderCodes()
  const { data: generatedMaterials, refetch: refetchGenerated } = useGeneratedMaterials()
  const { data: adminTasks, refetch: refetchAdminTasks } = useAdminTasks()
  const { data: qrCodes, refetch: refetchQrCodes } = useQrCodes()
  const [insertingCause, setInsertingCause] = React.useState(false)
  const { insert: insertAdminTask, loading: creatingAdminTask } = useAdminTaskInsert()
  const { insert: insertStakeholderCode } = useStakeholderCodeInsert()

  const [addOpen, setAddOpen] = React.useState(false)
  const [form, setForm] = React.useState<CauseForm>(INITIAL_FORM)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [setupError, setSetupError] = React.useState<string | null>(null)
  const [setupLoadingCauseId, setSetupLoadingCauseId] = React.useState<string | null>(null)
  const [setupStatusByCause, setSetupStatusByCause] = React.useState<Record<string, string>>({})

  // Filter state
  const [cityFilter, setCityFilter] = React.useState('all')
  const [campaignFilter, setCampaignFilter] = React.useState('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCauseId, setSelectedCauseId] = React.useState<string | null>(null)

  const cityMap = React.useMemo(() => new Map(cities.map((city) => [city.id, city])), [cities])
  const campaignMap = React.useMemo(() => new Map(campaigns.map((campaign) => [campaign.id, campaign])), [campaigns])
  const profileMap = React.useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles])

  const linkedBusinessesByCause = React.useMemo(() => {
    const map = new Map<string, Business[]>()
    businesses.filter((business) => !!business.linked_cause_id).forEach((business) => {
      const causeId = business.linked_cause_id as string
      const current = map.get(causeId) || []
      current.push(business)
      map.set(causeId, current)
    })
    return map
  }, [businesses])

  const assignmentsByCause = React.useMemo(() => {
    const map = new Map<string, StakeholderAssignment[]>()
    assignments.filter((assignment) => assignment.entity_type === 'cause' && assignment.status === 'active').forEach((assignment) => {
      const current = map.get(assignment.entity_id) || []
      current.push(assignment)
      map.set(assignment.entity_id, current)
    })
    return map
  }, [assignments])

  const flowByCause = React.useMemo(() => {
    const map = new Map<string, OnboardingFlow>()
    flows.filter((flow) => flow.entity_type === 'cause').forEach((flow) => map.set(flow.entity_id, flow))
    return map
  }, [flows])

  const stepsByFlow = React.useMemo(() => {
    const map = new Map<string, OnboardingStep[]>()
    steps.forEach((step) => {
      const current = map.get(step.flow_id) || []
      current.push(step)
      map.set(step.flow_id, current)
    })
    return map
  }, [steps])

  const openTasksByCause = React.useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.filter((task) => task.entity_type === 'cause' && task.entity_id && task.status !== 'completed').forEach((task) => {
      const current = map.get(task.entity_id as string) || []
      current.push(task)
      map.set(task.entity_id as string, current)
    })
    return map
  }, [tasks])

  const outreachByCause = React.useMemo(() => {
    const map = new Map<string, OutreachActivity[]>()
    outreach.filter((activity) => activity.entity_type === 'cause' || !!activity.cause_id).forEach((activity) => {
      const causeId = activity.cause_id || (activity.entity_type === 'cause' ? activity.entity_id : null)
      if (!causeId) return
      const current = map.get(causeId) || []
      current.push(activity)
      map.set(causeId, current)
    })
    return map
  }, [outreach])

  const stakeholderByCause = React.useMemo(() => {
    const map = new Map<string, Stakeholder>()
    stakeholders.filter((stakeholder) => !!stakeholder.cause_id).forEach((stakeholder) => {
      if (!stakeholder.cause_id || map.has(stakeholder.cause_id)) return
      map.set(stakeholder.cause_id, stakeholder)
    })
    return map
  }, [stakeholders])

  const codesByStakeholder = React.useMemo(() => {
    const map = new Map<string, (typeof stakeholderCodes)[number]>()
    stakeholderCodes.forEach((code) => map.set(code.stakeholder_id, code))
    return map
  }, [stakeholderCodes])

  const generatedByStakeholder = React.useMemo(() => {
    const map = new Map<string, GeneratedMaterial[]>()
    generatedMaterials.forEach((generated) => {
      const current = map.get(generated.stakeholder_id) || []
      current.push(generated)
      map.set(generated.stakeholder_id, current)
    })
    return map
  }, [generatedMaterials])

  const adminTaskByStakeholder = React.useMemo(() => {
    const map = new Map<string, AdminTask>()
    adminTasks.filter((task) => task.task_type === 'stakeholder_setup').forEach((task) => {
      if (map.has(task.stakeholder_id)) return
      map.set(task.stakeholder_id, task)
    })
    return map
  }, [adminTasks])

  const qrByCause = React.useMemo(() => {
    const map = new Map<string, QrCodeRow[]>()
    qrCodes.filter((code) => !!code.cause_id).forEach((code) => {
      const causeId = code.cause_id as string
      const current = map.get(causeId) || []
      current.push(code)
      map.set(causeId, current)
    })
    return map
  }, [qrCodes])

  // ─── Filter causes based on role, city, campaign, search ───

  const filteredCauses = React.useMemo(() => {
    let items = causes
    if (isFieldUser) {
      const myIds = new Set<string>()
      assignments.filter(a => a.stakeholder_id === profile.id && a.entity_type === 'cause').forEach(a => myIds.add(a.entity_id))
      causes.filter(c => c.owner_id === profile.id).forEach(c => myIds.add(c.id))
      items = items.filter(c => myIds.has(c.id))
    }
    if (cityFilter !== 'all') items = items.filter(c => c.city_id === cityFilter)
    if (campaignFilter !== 'all') items = items.filter(c => c.campaign_id === campaignFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter(c => c.name.toLowerCase().includes(q))
    }
    return items
  }, [causes, isFieldUser, assignments, profile.id, cityFilter, campaignFilter, searchQuery])

  const groupedCauses = React.useMemo(() => {
    return STAGE_ORDER.map((stage) => ({
      stage,
      items: filteredCauses.filter((cause) => cause.stage === stage),
    })).filter((group) => group.items.length > 0)
  }, [filteredCauses])

  const selectedCause =
    selectedCauseId
      ? filteredCauses.find((cause) => cause.id === selectedCauseId)
        || causes.find((cause) => cause.id === selectedCauseId)
        || null
      : null

  const summary = React.useMemo(() => {
    const live = causes.filter((cause) => cause.stage === 'live').length
    const onboarding = causes.filter((cause) => cause.stage === 'in_progress' || cause.stage === 'onboarded').length
    const followUps = outreach.filter((activity) => {
      const causeId = activity.cause_id || (activity.entity_type === 'cause' ? activity.entity_id : null)
      return !!causeId
        && !!activity.next_step_date
        && new Date(activity.next_step_date).getTime() <= Date.now() + (1000 * 60 * 60 * 24 * 7)
    }).length
    const assigned = causes.filter((cause) => !!cause.owner_id || assignmentsByCause.has(cause.id)).length
    const linkedBusinesses = businesses.filter((business) => !!business.linked_cause_id).length
    const materialReady = causes.filter((cause) => {
      const stakeholder = stakeholderByCause.get(cause.id)
      if (!stakeholder) return false
      const generated = generatedByStakeholder.get(stakeholder.id) || []
      return generated.some((item) => item.generation_status === 'generated')
    }).length

    return { live, onboarding, followUps, assigned, linkedBusinesses, materialReady }
  }, [assignmentsByCause, businesses, causes, generatedByStakeholder, outreach, stakeholderByCause])

  const cityOptions = React.useMemo(() => {
    const ids = new Set(causes.map((cause) => cause.city_id).filter(Boolean) as string[])
    return Array.from(ids)
      .map((id) => cityMap.get(id))
      .filter(Boolean)
      .sort((left, right) => (left!.name > right!.name ? 1 : -1)) as typeof cities
  }, [causes, cityMap])

  const campaignOptions = React.useMemo(() => {
    const ids = new Set(causes.map((cause) => cause.campaign_id).filter(Boolean) as string[])
    return Array.from(ids)
      .map((id) => campaignMap.get(id))
      .filter(Boolean)
      .sort((left, right) => (left!.name > right!.name ? 1 : -1)) as typeof campaigns
  }, [causes, campaignMap])

  const nextBestActionCause = React.useMemo(() => {
    const ranked = causes
      .map((cause) => {
        const stakeholder = stakeholderByCause.get(cause.id) || null
        const code = stakeholder ? codesByStakeholder.get(stakeholder.id) || null : null
        const generated = stakeholder ? generatedByStakeholder.get(stakeholder.id) || [] : []
        const causeOutreach = (outreachByCause.get(cause.id) || [])
          .slice()
          .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
        const dueFollowUp = causeOutreach.find((item) => !!item.next_step_date)
        const priority =
          !stakeholder ? 0
          : !code ? 1
          : generated.filter((item) => item.generation_status === 'generated').length === 0 ? 2
          : dueFollowUp ? 3
          : 4

        return { cause, priority }
      })
      .sort((left, right) => left.priority - right.priority)

    return ranked[0] || null
  }, [causes, codesByStakeholder, generatedByStakeholder, outreachByCause, stakeholderByCause])

  async function refreshAll() {
    refetch({ silent: true })
    refetchStakeholders({ silent: true })
    refetchAdminTasks({ silent: true })
    refetchCodes({ silent: true })
    refetchGenerated({ silent: true })
    refetchQrCodes({ silent: true })
  }

  function getCauseDetail(cause: Cause): CauseDetailData {
    const flow = flowByCause.get(cause.id)
    const causeSteps = normalizeSteps(cause.stage, flow, stepsByFlow.get(flow?.id || '') || [])
    const owner = cause.owner_id ? profileMap.get(cause.owner_id) || null : null
    const helperAssignments = (assignmentsByCause.get(cause.id) || [])
      .map((assignment) => ({ assignment, profile: profileMap.get(assignment.stakeholder_id) || null }))
      .filter((item): item is { assignment: StakeholderAssignment; profile: Profile } => !!item.profile)
    const campaign = cause.campaign_id ? campaignMap.get(cause.campaign_id) || null : null
    const city = cause.city_id ? cityMap.get(cause.city_id) || null : null
    const causeTasks = openTasksByCause.get(cause.id) || []
    const causeOutreach = (outreachByCause.get(cause.id) || [])
      .slice()
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    const linkedBusinesses = linkedBusinessesByCause.get(cause.id) || []
    const stakeholder = stakeholderByCause.get(cause.id) || null
    const codes = stakeholder ? codesByStakeholder.get(stakeholder.id) || null : null
    const generated = stakeholder ? generatedByStakeholder.get(stakeholder.id) || [] : []
    const generatedCount = generated.filter((item) => item.generation_status === 'generated').length
    const adminTask = stakeholder ? adminTaskByStakeholder.get(stakeholder.id) || null : null
    const causeQrCodes = qrByCause.get(cause.id) || []
    const latestOutreach = causeOutreach[0]
    const nextFollowUp = causeOutreach
      .filter((activity) => activity.next_step || activity.next_step_date)
      .slice()
      .sort((left, right) => {
        const leftTime = left.next_step_date ? new Date(left.next_step_date).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.next_step_date ? new Date(right.next_step_date).getTime() : Number.MAX_SAFE_INTEGER
        return leftTime - rightTime
      })[0]
    const dueTask = causeTasks
      .slice()
      .sort((left, right) => {
        const leftTime = left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER
        return leftTime - rightTime
      })[0]
    const qrGeneratorHref = `/qr/generator?causeId=${cause.id}&returnTo=${encodeURIComponent('/onboarding/cause')}`
    const coverPhotoUrl = cause.cover_photo_url || null

    const checklist = computeCauseOnboardingChecklist({
      cause,
      steps: stepsByFlow.get(flow?.id || '') || [],
      codes,
      generatedMaterials: generated,
      qrCodes: causeQrCodes,
      outreachCount: causeOutreach.length,
      linkedBusinessCount: linkedBusinesses.length,
      completedTaskCount: tasks.filter((task) => task.entity_type === 'cause' && task.entity_id === cause.id && task.status === 'completed').length,
      hasOwner: !!cause.owner_id,
      hasCampaign: !!cause.campaign_id,
      hasJoinUrl: !!codes?.join_url,
      hasLogo: !!cause.logo_url,
      hasCoverPhoto: !!cause.cover_photo_url,
    })

    return {
      owner,
      city,
      campaign,
      helperAssignments,
      steps: causeSteps,
      tasks: causeTasks,
      dueTask,
      outreach: causeOutreach,
      latestOutreach,
      nextFollowUp,
      linkedBusinesses,
      stakeholder,
      codes,
      codesReady: !!codes?.join_url,
      joinUrl: codes?.join_url || null,
      generated,
      generatedCount,
      taskStatus: adminTask?.status || null,
      qrCount: causeQrCodes.length,
      qrGeneratorHref,
      coverPhotoUrl,
      setupLoading: setupLoadingCauseId === cause.id || creatingAdminTask,
      setupMessage: setupStatusByCause[cause.id] || null,
      checklist,
    }
  }

  async function ensureStakeholderSetup(cause: Cause) {
    setSetupError(null)
    setSetupLoadingCauseId(cause.id)

    try {
      let stakeholder = stakeholderByCause.get(cause.id) || null

      if (!stakeholder) {
        throw new Error('The stakeholder setup record is missing. Recreate this cause from the CRM or refresh after server setup completes.')
      }

      if (!codesByStakeholder.get(stakeholder.id)) {
        const createdCode = await insertStakeholderCode({
          stakeholder_id: stakeholder.id,
          referral_code: null,
          connection_code: null,
          join_url: null,
        })

        if (!createdCode) {
          throw new Error('The setup record exists, but the empty code record could not be added.')
        }
      }

      const task = adminTaskByStakeholder.get(stakeholder.id) || null

      if (!task) {
        const insertedTask = await insertAdminTask({
          stakeholder_id: stakeholder.id,
          task_type: 'stakeholder_setup',
          title: `Complete setup for ${cause.name}`,
          status: 'needs_setup',
          payload_json: {
            checklist: ['Add referral code', 'Add connection code', 'Generate materials'],
            source: 'cause_onboarding',
            cause_id: cause.id,
          },
          due_at: null,
        })

        if (!insertedTask) {
          throw new Error('The setup record was created, but the setup task could not be added.')
        }
      }

      setSetupStatusByCause((current) => ({
        ...current,
        [cause.id]: task ? 'Material setup already exists.' : 'Material setup is ready for codes and generation.',
      }))
      await refreshAll()
    } catch (caughtError) {
      setSetupError(caughtError instanceof Error ? caughtError.message : 'Could not create the setup record.')
    } finally {
      setSetupLoadingCauseId(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    setFeedback(null)

    setInsertingCause(true)

    try {
      const response = await fetch('/api/crm/causes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          brand: form.brand,
          stage: form.stage,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          city_id: form.city_id || null,
          source: form.source.trim() || null,
          source_detail: 'Added from cause onboarding',
        }),
      })

      const payload = await response.json().catch(() => ({ error: 'Failed to create cause. Please try again.' }))
      if (!response.ok) {
        setSubmitError(payload.error || 'Failed to create cause. Please try again.')
        return
      }

      setAddOpen(false)
      setForm(INITIAL_FORM)
      setFeedback(`${payload.name || form.name.trim()} added and ready for QR/material setup.`)
      await refreshAll()
    } finally {
      setInsertingCause(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading cause onboarding...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
        {error}
      </div>
    )
  }

  if (causes.length === 0) {
    return (
      <div>
        <PageHeader
          title="Cause Onboarding"
          description="Clear ownership, clear activation steps, and a clickable path from first contact to live community rollout."
          actions={(
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Cause
            </Button>
          )}
        />
        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title="No causes yet"
          description="Add your first school, church, nonprofit, or community organization to start managing ownership, QR readiness, and activation work."
          action={{ label: 'Add Cause', onClick: () => setAddOpen(true) }}
        />
        <AddCauseDialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open)
            if (!open) {
              setForm(INITIAL_FORM)
              setSubmitError(null)
            }
          }}
          form={form}
          setForm={setForm}
          cities={cities}
          onSubmit={handleSubmit}
          submitting={insertingCause}
          submitError={submitError}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cause Onboarding"
        description="Clear ownership, clear activation steps, and a clickable path from first contact to live community rollout."
        actions={(
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Cause
          </Button>
        )}
      />

      {feedback ? (
        <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {feedback}
        </div>
      ) : null}

      {setupError ? (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {setupError}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr),repeat(4,minmax(0,0.55fr))]">
        <Card className={`overflow-hidden border shadow-sm ${causeTheme.border}`}>
          <CardContent className={`flex h-full min-h-[120px] flex-col justify-between gap-4 bg-gradient-to-r ${causeTheme.gradient} p-5`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 shadow-sm ring-1 ${causeTheme.ring} ${causeTheme.icon}`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className={`text-sm font-semibold ${causeTheme.text}`}>Cause activation should feel obvious at a glance</p>
                <p className="max-w-2xl text-sm leading-6 text-surface-600">
                  Open any school or cause to run the full workspace, clear blockers, finish activation steps, and move it from first contact to live.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-surface-500">
              <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 font-medium text-surface-700">
                {filteredCauses.length} visible
              </span>
              <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1">
                Click a card to open the workspace
              </span>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3 xl:col-span-4 xl:grid-cols-4">
          <CompactCauseMetricCard label="Pipeline" value={filteredCauses.length} />
          <CompactCauseMetricCard label="Active Build" value={summary.onboarding} />
          <CompactCauseMetricCard label="Live" value={summary.live} />
          <CompactCauseMetricCard label="Follow-ups" value={summary.followUps} />
        </div>
      </div>

      <Card className="overflow-hidden border border-surface-200 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-surface-100 p-2 text-surface-600">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Filter the pipeline</p>
                <p className="text-sm text-surface-600">Narrow the list by city, campaign, or cause name.</p>
              </div>
            </div>
            {filteredCauses.length !== causes.length ? (
              <span className="rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs font-medium text-surface-600">
                {filteredCauses.length} of {causes.length} showing
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),170px,200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <Input
                placeholder="Search causes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10"
              />
            </div>
            <select
              className="h-11 rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              <option value="all">All Cities</option>
              {cityOptions.map((city) => (
                <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
              ))}
            </select>
            <select
              className="h-11 rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="all">All Campaigns</option>
              {campaignOptions.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="hidden grid gap-4 lg:grid-cols-4">
        <SimpleSummaryCard
          icon={<Users className="h-4 w-4" />}
          iconClassName={causeTheme.icon}
          label="Assigned Outreach"
          value={`${summary.assigned} causes covered`}
          className={`${causeTheme.border} ${causeTheme.surface}`}
        />
        <SimpleSummaryCard
          icon={<Building2 className="h-4 w-4" />}
          iconClassName={businessTheme.icon}
          label="Business Links"
          value={`${summary.linkedBusinesses} businesses linked to a local cause`}
          className={`${businessTheme.border} ${businessTheme.surface}`}
        />
        <SimpleSummaryCard
          icon={<QrCode className="h-4 w-4" />}
          iconClassName={causeTheme.icon}
          label="Material Engine"
          value={`${summary.materialReady} causes have launch assets ready`}
          className={causeTheme.border}
        />
        <Card>
          <CardContent className="flex h-full items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Next Best Action</p>
              <p className="mt-1 text-lg font-semibold text-surface-900">
                {nextBestActionCause ? `Keep ${nextBestActionCause.cause.name} moving` : 'Complete supporter-launch setup'}
              </p>
              <p className="mt-1 text-sm text-surface-500">
                {nextBestActionCause?.priority === 0
                  ? 'Create the stakeholder setup record before QR and materials.'
                  : nextBestActionCause?.priority === 1
                  ? 'Add codes so supporter materials and QR can go live.'
                  : nextBestActionCause?.priority === 2
                  ? 'Generate materials before the community rollout starts.'
                  : 'Use the cause record to keep the next activation action moving.'}
              </p>
            </div>
            {nextBestActionCause ? (
              <Link href={`/crm/causes/${nextBestActionCause.cause.id}`}>
                <Button>
                  Open Cause <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ─── Filter bar ───────────────────────────────────────── */}
      <div className="hidden flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            placeholder="Search causes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
        >
          <option value="all">All Cities</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700"
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
        >
          <option value="all">All Campaigns</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
          ))}
        </select>
        {filteredCauses.length !== causes.length ? (
          <span className="text-xs text-surface-500">
            Showing {filteredCauses.length} of {causes.length} causes
          </span>
        ) : null}
      </div>

      {/* ─── Grouped cards ────────────────────────────────────── */}
      <div className="space-y-8">
        {groupedCauses.map((group) => (
          <section key={group.stage} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Badge variant={getStageBadgeVariant(group.stage)} dot>
                  {ONBOARDING_STAGES[group.stage]?.label}
                </Badge>
                <span className="text-sm text-surface-500">{group.items.length} causes</span>
              </div>
              <span className="hidden text-[11px] uppercase tracking-[0.16em] text-surface-400 md:inline">
                Click a card to open the workspace
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((cause) => (
                <CauseOnboardingSummaryCard
                  key={cause.id}
                  cause={cause}
                  detail={getCauseDetail(cause)}
                  onOpen={() => setSelectedCauseId(cause.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Dialog open={!!selectedCause} onOpenChange={(open) => { if (!open) setSelectedCauseId(null) }}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-0">
          {selectedCause ? (
            <CauseDetailModal
              cause={selectedCause}
              detail={getCauseDetail(selectedCause)}
              onCreateSetup={() => void ensureStakeholderSetup(selectedCause)}
              onStageChanged={refetch}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AddCauseDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) {
            setForm(INITIAL_FORM)
            setSubmitError(null)
          }
        }}
        form={form}
        setForm={setForm}
        cities={cities}
        onSubmit={handleSubmit}
        submitting={insertingCause}
        submitError={submitError}
      />
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────

function CompactCauseMetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={`rounded-2xl border bg-white px-4 py-4 shadow-sm ${causeTheme.border}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-surface-900">{value}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-pink-100/80">
        <div className="h-full w-12 rounded-full bg-pink-500" />
      </div>
    </div>
  )
}

function SimpleSummaryCard({
  icon,
  iconClassName,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  iconClassName: string
  label: string
  value: string
  className?: string
}) {
  return (
    <Card className={`border ${className || ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2 ${iconClassName}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
            <p className="text-lg font-semibold text-surface-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Redesigned CauseOnboardingCard ────────────────────────

function CauseOnboardingCard({
  cause,
  owner,
  city,
  campaign,
  helperAssignments,
  steps,
  tasks,
  dueTask,
  outreach,
  latestOutreach,
  nextFollowUp,
  linkedBusinesses,
  stakeholder,
  codesReady,
  joinUrl,
  generatedCount,
  taskStatus,
  qrCount,
  qrGeneratorHref,
  setupLoading,
  setupMessage,
  onCreateSetup,
  onStageChanged,
  checklist,
  expanded,
  onToggleExpand,
}: {
  cause: Cause
  owner: Profile | null
  city: { id: string; name: string; state: string } | null
  campaign: { id: string; name: string } | null
  helperAssignments: Array<{ assignment: StakeholderAssignment; profile: Profile }>
  steps: Array<{ id: string; label: string; completed: boolean; current: boolean }>
  tasks: Task[]
  dueTask: Task | undefined
  outreach: OutreachActivity[]
  latestOutreach: OutreachActivity | undefined
  nextFollowUp: OutreachActivity | undefined
  linkedBusinesses: Business[]
  stakeholder: Stakeholder | null
  codesReady: boolean
  joinUrl: string | null
  generatedCount: number
  taskStatus: string | null
  qrCount: number
  qrGeneratorHref: string
  setupLoading: boolean
  setupMessage: string | null
  onCreateSetup: () => void
  onStageChanged: () => void
  checklist: CauseOnboardingChecklist
  expanded: boolean
  onToggleExpand: () => void
}) {
  return (
    <Card className={`overflow-hidden border ${causeTheme.border}`}>
      {/* ── Progress bar row ──────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-surface-200 bg-surface-50 px-5 py-3">
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-surface-200">
          <div
            className={cn('h-full rounded-full transition-all duration-500 ease-out', getProgressColor(checklist.percent))}
            style={{ width: `${checklist.percent}%` }}
          />
        </div>
        <span className={cn('whitespace-nowrap text-xs font-semibold', getProgressTextColor(checklist.percent))}>
          {checklist.percent}% ({checklist.completedCount}/{checklist.totalCount})
        </span>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-surface-600 transition-colors hover:bg-surface-100 hover:text-surface-900"
        >
          View Checklist
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>

      {/* ── Header row ────────────────────────────────────── */}
      <div className={`bg-gradient-to-r ${causeTheme.gradient} px-5 py-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/crm/causes/${cause.id}`} className="text-lg font-semibold text-surface-900 transition-colors hover:text-brand-700">
                {cause.name}
              </Link>
              <Badge variant={getStageBadgeVariant(cause.stage)} dot>
                {ONBOARDING_STAGES[cause.stage]?.label}
              </Badge>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${causeTheme.badge}`}>{cause.type}</span>
              <Badge variant={cause.brand === 'hato' ? 'hato' : 'info'}>
                {BRANDS[cause.brand]?.label || cause.brand}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-surface-500">
              {city ? (
                <Link href={`/crm/cities/${city.id}`} className="flex items-center gap-1 hover:text-surface-700">
                  <MapPin className="h-3.5 w-3.5" />
                  {city.name}, {city.state}
                </Link>
              ) : null}
              {campaign ? <Link href={`/campaigns/${campaign.id}`} className="hover:text-surface-700">Campaign: {campaign.name}</Link> : null}
              <span>Added {formatDate(cause.created_at)}</span>
            </div>
          </div>
          <StageChanger cause={cause} onStageChanged={onStageChanged} />
        </div>
      </div>

      {/* ── Body: Steps + Leadership ──────────────────────── */}
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
          {/* Onboarding steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
              <ClipboardList className="h-3.5 w-3.5" />
              Onboarding Steps
            </div>
            <div className="space-y-1.5">
              {steps.map((step) => {
                const isLocked = !step.completed && !step.current
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm',
                      step.completed
                        ? 'border-success-200 bg-success-50 text-success-700'
                        : step.current
                        ? `border-pink-200 ${causeTheme.softSurface} ${causeTheme.mutedText}`
                        : 'border-surface-200 bg-surface-50 text-surface-400'
                    )}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : step.current ? (
                      <Clock3 className="h-4 w-4 shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="font-medium">{step.label}</span>
                    {step.current && (
                      <Link
                        href={`/crm/causes/${cause.id}`}
                        className="ml-auto flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
                      >
                        Fix <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Leadership */}
          <div className="space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Leadership</p>
              {owner ? (
                <Link href={`/admin/users/${owner.id}`} className="mt-2 inline-flex text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                  {owner.full_name} - Primary owner
                </Link>
              ) : (
                <p className="mt-2 text-sm font-semibold text-surface-900">Unassigned owner</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Helpers</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {helperAssignments.length > 0 ? helperAssignments.map(({ assignment, profile: helper }) => (
                  <Link
                    key={helper.id}
                    href={`/admin/users/${helper.id}`}
                    className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-surface-700 transition-colors hover:border-surface-300 hover:text-surface-900"
                  >
                    {helper.full_name}
                    {assignment.role ? ` - ${assignment.role}` : ''}
                  </Link>
                )) : (
                  <span className="text-xs text-surface-400">None</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Metrics row ─────────────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Tasks</p>
            <p className="mt-1 text-xl font-semibold text-surface-900">{tasks.length}</p>
            <p className="mt-1 text-xs text-surface-500">Outreach: {outreach.length}</p>
            <p className="mt-0.5 text-xs text-surface-500">Businesses: {linkedBusinesses.length}</p>
          </div>
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Launch Assets</p>
            <div className="mt-2 space-y-1 text-xs text-surface-500">
              <p>Setup: <span className="font-medium text-surface-800">{stakeholder ? 'Ready' : 'Missing'}</span></p>
              <p>Codes: <span className="font-medium text-surface-800">{codesReady ? 'Ready' : 'Missing'}</span></p>
              <p>QR: <span className="font-medium text-surface-800">{qrCount > 0 ? `${qrCount} ready` : 'Missing'}</span></p>
              <p>Materials: <span className="font-medium text-surface-800">{generatedCount > 0 ? `${generatedCount} ready` : 'Waiting'}</span></p>
            </div>
          </div>
          <MetricBlock
            label="Outreach Activity"
            value={outreach.length}
            detail={latestOutreach ? `${latestOutreach.type.replace('_', ' ')} / ${formatDate(latestOutreach.created_at)}` : 'No outreach logged yet'}
            secondary={nextFollowUp?.next_step ? `${nextFollowUp.next_step}${nextFollowUp.next_step_date ? ` by ${formatDate(nextFollowUp.next_step_date)}` : ''}` : undefined}
          />
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Business Links</p>
            <p className="mt-1 text-xl font-semibold text-surface-900">{linkedBusinesses.length}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {linkedBusinesses.length > 0 ? linkedBusinesses.slice(0, 3).map((business) => (
                <Link key={business.id} href={`/crm/businesses/${business.id}`} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${businessTheme.badge}`}>
                  {business.name}
                </Link>
              )) : (
                <span className="text-xs text-surface-400">No connected businesses yet</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Action buttons ──────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <Link href={`/crm/causes/${cause.id}`}>
            <Button variant="outline" size="sm">
              <School className="h-3.5 w-3.5" /> Open CRM
            </Button>
          </Link>
          <Link href={qrGeneratorHref}>
            <Button size="sm">
              <QrCode className="h-3.5 w-3.5" /> QR Code
            </Button>
          </Link>
          {!stakeholder || !taskStatus ? (
            <Button variant="outline" size="sm" onClick={onCreateSetup} disabled={setupLoading}>
              {setupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {!stakeholder ? 'Create Material Setup' : 'Create Setup Task'}
            </Button>
          ) : null}
          <Link href={`/crm/outreach?cause=${cause.id}`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-3.5 w-3.5" /> Log Outreach
            </Button>
          </Link>
          {joinUrl ? (
            <a href={joinUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ArrowRight className="h-3.5 w-3.5" /> Support Page
              </Button>
            </a>
          ) : null}
        </div>

        {setupMessage ? (
          <div className="rounded-xl border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-700">
            {setupMessage}
          </div>
        ) : null}
      </CardContent>

      {/* ── Expanded checklist ────────────────────────────── */}
      {expanded && (
        <div className="border-t border-surface-200 bg-surface-50 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-surface-400">
            Onboarding Checklist — {checklist.completedCount}/{checklist.totalCount} completed
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {checklist.items.map(item => (
              <Link
                key={item.id}
                href={`${item.href}?tab=${item.tab}`}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  item.met ? 'text-success-700 bg-success-50' : 'text-surface-700 bg-surface-0 hover:bg-surface-100'
                )}
              >
                {item.met ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" /> : <Circle className="h-4 w-4 shrink-0 text-surface-400" />}
                <span className={item.met ? 'line-through opacity-60' : ''}>{item.label}</span>
                {!item.met && <ArrowRight className="ml-auto h-3.5 w-3.5 text-surface-400" />}
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function CauseOnboardingSummaryCard({
  cause,
  detail,
  onOpen,
}: {
  cause: Cause
  detail: CauseDetailData
  onOpen: () => void
}) {
  const progressColor = getProgressColor(detail.checklist.percent)
  const progressText = getProgressTextColor(detail.checklist.percent)
  const { coverPhotoUrl } = detail

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative w-full cursor-pointer overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        causeTheme.border
      )}
    >
      <div className={`relative overflow-hidden border-b border-surface-100 bg-gradient-to-r ${causeTheme.gradient} px-4 py-4`}>
        {coverPhotoUrl ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-cover bg-center opacity-[0.12]"
            style={{ backgroundImage: `url('${coverPhotoUrl}')` }}
          />
        ) : null}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-lg font-semibold text-surface-950 transition-colors group-hover:text-brand-700">
              {cause.name}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-surface-600">
              {detail.city ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {detail.city.name}
                </span>
              ) : null}
              <span className={cn('rounded-full px-2 py-0.5 font-medium', causeTheme.badge)}>
                {cause.type}
              </span>
              <Badge variant={cause.brand === 'hato' ? 'hato' : 'info'} className="text-[10px]">
                {BRANDS[cause.brand]?.label || cause.brand}
              </Badge>
              <span>Added {formatDate(cause.created_at)}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <Badge variant={getStageBadgeVariant(cause.stage)} dot className="justify-end">
              {ONBOARDING_STAGES[cause.stage]?.label}
            </Badge>
            <p className={cn('mt-2 text-3xl font-bold leading-none', progressText)}>
              {detail.checklist.percent}%
            </p>
            <p className="mt-1 text-[11px] text-surface-500">
              {detail.checklist.completedCount}/{detail.checklist.totalCount}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-100">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressColor)}
              style={{ width: `${detail.checklist.percent}%` }}
            />
          </div>
          <span className={cn('text-xs font-bold tabular-nums', progressText)}>
            {detail.checklist.percent}%
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-surface-500">
          <span className="flex items-center gap-1">
            <ClipboardList className="h-3 w-3" />
            {detail.tasks.length} tasks
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {detail.outreach.length} outreach
          </span>
          {detail.owner ? (
            <span className="flex items-center gap-1 truncate">
              <Users className="h-3 w-3" />
              {detail.owner.full_name?.split(' ')[0]}
            </span>
          ) : (
            <span className="text-surface-400">No owner yet</span>
          )}
          {detail.linkedBusinesses.length > 0 ? (
            <span className={cn('flex items-center gap-1 truncate rounded-full px-2 py-0.5', businessTheme.badge)}>
              <Building2 className="h-2.5 w-2.5" />
              {detail.linkedBusinesses.length} linked
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function CauseDetailModal({
  cause,
  detail,
  onCreateSetup,
  onStageChanged,
}: {
  cause: Cause
  detail: CauseDetailData
  onCreateSetup: () => void
  onStageChanged: () => void
}) {
  const { profile } = useAuth()
  const localProfileId = asUuid(profile.id)
  const { data: allCities } = useCities()
  const { update: updateCause, loading: updateLoading } = useCauseUpdate()
  const { insert: insertOutreach, loading: savingOutreach } = useOutreachInsert()
  const { data: freshOutreach, refetch: refetchOutreach } = useOutreach({ entity_type: 'cause', entity_id: cause.id })
  const outreachList = freshOutreach.length > 0 ? freshOutreach : detail.outreach

  const [lifecycleModal, setLifecycleModal] = React.useState<'initial_connection' | 'leader_conversation' | 'materials_qr' | 'activation_decision' | null>(null)
  const [showChecklist, setShowChecklist] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<CauseModalSection | null>(null)
  const sectionRefs = React.useRef<Partial<Record<CauseModalSection, HTMLDivElement | null>>>({})
  const clearHighlightRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressColor = getProgressColor(detail.checklist.percent)
  const progressText = getProgressTextColor(detail.checklist.percent)
  const { coverPhotoUrl } = detail

  const setSectionRef = React.useCallback((section: CauseModalSection) => {
    return (node: HTMLDivElement | null) => {
      sectionRefs.current[section] = node
    }
  }, [])

  const jumpToSection = React.useCallback((section: CauseModalSection) => {
    setActiveSection(section)
    if (clearHighlightRef.current) {
      clearTimeout(clearHighlightRef.current)
    }
    clearHighlightRef.current = setTimeout(() => setActiveSection(null), 2200)
    requestAnimationFrame(() => {
      sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  React.useEffect(() => {
    return () => {
      if (clearHighlightRef.current) {
        clearTimeout(clearHighlightRef.current)
      }
    }
  }, [])

  return (
    <div>
      <div className={`relative overflow-hidden border-b border-surface-100 bg-gradient-to-r ${causeTheme.gradient} px-6 py-5`}>
        {coverPhotoUrl ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-cover bg-center opacity-[0.14]"
            style={{ backgroundImage: `url('${coverPhotoUrl}')` }}
          />
        ) : null}
        <div className="relative">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-surface-900">{cause.name}</h2>
              <Badge variant={getStageBadgeVariant(cause.stage)} dot>
                {ONBOARDING_STAGES[cause.stage]?.label}
              </Badge>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', causeTheme.badge)}>
                {cause.type}
              </span>
              <Badge variant={cause.brand === 'hato' ? 'hato' : 'info'}>
                {BRANDS[cause.brand]?.label || cause.brand}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
              {detail.city ? (
                <Link href={`/crm/cities/${detail.city.id}`} className="flex items-center gap-1 hover:text-surface-700">
                  <MapPin className="h-3.5 w-3.5" />
                  {detail.city.name}, {detail.city.state}
                </Link>
              ) : null}
              {detail.campaign ? (
                <Link href={`/campaigns/${detail.campaign.id}`} className="hover:text-surface-700">
                  Campaign: {detail.campaign.name}
                </Link>
              ) : null}
              <span>Added {formatDate(cause.created_at)}</span>
              {cause.website ? (
                <a
                  href={cause.website.startsWith('http') ? cause.website : `https://${cause.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-surface-700"
                >
                  Visit site
                </a>
              ) : null}
            </div>
          </div>
          <StageChanger cause={cause} onStageChanged={onStageChanged} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/60">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressColor)}
              style={{ width: `${detail.checklist.percent}%` }}
            />
          </div>
          <span className={cn('text-sm font-bold tabular-nums', progressText)}>
            {detail.checklist.percent}%
          </span>
          <span className="text-xs text-surface-500">
            ({detail.checklist.completedCount}/{detail.checklist.totalCount})
          </span>
          <button
            onClick={() => setShowChecklist((current) => !current)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            {showChecklist ? 'Hide' : 'View'} Checklist
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showChecklist && 'rotate-90')} />
          </button>
        </div>
        </div>
      </div>

      {showChecklist ? (
        <div className="border-b border-surface-200 bg-surface-50 px-6 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-surface-400">
            Onboarding Checklist — {detail.checklist.completedCount}/{detail.checklist.totalCount} completed
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {detail.checklist.items.map((item) => (
              <ChecklistJumpButton
                key={item.id}
                met={item.met}
                label={item.label}
                onClick={() => jumpToSection(getCauseChecklistSection(item.id))}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            ref={setSectionRef('mission')}
            className={cn('space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getCauseSectionHighlight(activeSection, 'mission'))}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Mission Profile</p>
              <Button variant="outline" size="sm" onClick={() => setLifecycleModal('initial_connection')}>
                Edit info <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InlineDetail label="Organization name" value={cause.name || 'Missing'} />
              <InlineDetail label="Type" value={cause.type || 'Missing'} />
              <InlineDetail label="City" value={detail.city ? `${detail.city.name}, ${detail.city.state}` : 'Missing'} />
              <InlineDetail label="Contact" value={cause.email || cause.phone || 'Missing'} />
              <InlineDetail label="Website" value={cause.website || 'Missing'} />
              <InlineDetail label="Brand" value={BRANDS[cause.brand]?.label || cause.brand} />
            </div>
          </div>

          <div
            ref={setSectionRef('brand')}
            className={cn('space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getCauseSectionHighlight(activeSection, 'brand'))}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Brand Assets</p>
              <Button variant="outline" size="sm" onClick={() => setLifecycleModal('materials_qr')}>
                Review assets <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InlineDetail label="Logo" value={cause.logo_url ? 'Uploaded' : 'Missing'} />
              <InlineDetail label="Cover photo" value={coverPhotoUrl ? 'Uploaded' : 'Missing'} />
            </div>
            <div className="flex flex-wrap gap-2">
              {cause.logo_url ? (
                <a href={cause.logo_url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-medium text-surface-700 transition-colors hover:border-surface-300 hover:text-surface-900">
                  View logo
                </a>
              ) : null}
              {coverPhotoUrl ? (
                <a href={coverPhotoUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-medium text-surface-700 transition-colors hover:border-surface-300 hover:text-surface-900">
                  View cover
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.3fr,0.9fr]">
          <div ref={setSectionRef('steps')} className={cn('space-y-3 transition-shadow', getCauseSectionHighlight(activeSection, 'steps'))}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
              <ClipboardList className="h-3.5 w-3.5" />
              Onboarding Steps
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {detail.steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm',
                    step.completed
                      ? 'border-success-200 bg-success-50 text-success-700'
                      : step.current
                      ? `border-pink-200 ${causeTheme.softSurface} ${causeTheme.mutedText}`
                      : 'border-surface-200 bg-surface-50 text-surface-500'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {step.completed ? <CheckCircle2 className="h-4 w-4" /> : step.current ? <Clock3 className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                        <span className="font-medium">{step.label}</span>
                      </div>
                      <p className="text-xs">
                        {step.completed ? 'Completed and ready.' : step.current ? 'This is the next action to move.' : 'This unlocks after the current step.'}
                      </p>
                    </div>
                    {step.current ? (
                      <Button size="sm" variant="outline" onClick={() => {
                        const key = (step as any).key as typeof lifecycleModal
                        if (key) setLifecycleModal(key)
                        else setLifecycleModal('initial_connection')
                      }}>
                        Fix <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            ref={setSectionRef('relationships')}
            className={cn('space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getCauseSectionHighlight(activeSection, 'relationships'))}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Leadership + Relationships</p>
              {detail.owner ? (
                <Link href={`/admin/users/${detail.owner.id}`} className="mt-2 inline-flex text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                  {detail.owner.full_name} - Primary owner
                </Link>
              ) : (
                <p className="mt-2 text-sm font-semibold text-surface-900">Unassigned owner</p>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Helpers</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.helperAssignments.length > 0 ? detail.helperAssignments.map(({ assignment, profile: helper }) => (
                  <Link
                    key={helper.id}
                    href={`/admin/users/${helper.id}`}
                    className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-surface-700 transition-colors hover:border-surface-300 hover:text-surface-900"
                  >
                    {helper.full_name}
                    {assignment.role ? ` - ${assignment.role}` : ''}
                  </Link>
                )) : (
                  <span className="text-xs text-surface-400">None</span>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InlineDetail label="Campaign" value={detail.campaign?.name || 'Not linked'} />
              <InlineDetail label="Community stage" value={ONBOARDING_STAGES[cause.stage]?.label || cause.stage} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div ref={setSectionRef('tasks')} className={cn('rounded-xl border border-surface-200 bg-surface-50 p-3 transition-shadow', getCauseSectionHighlight(activeSection, 'tasks'))}>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Tasks</p>
            <p className="mt-1 text-xl font-semibold text-surface-900">{detail.tasks.length}</p>
            <div className="mt-2 space-y-1">
              <ActionableDetailButton label={detail.dueTask?.due_date ? `Due ${formatDate(detail.dueTask.due_date)}` : 'No due task yet'} onClick={() => jumpToSection('tasks')} />
              <ActionableDetailButton label={`Outreach: ${detail.outreach.length}`} onClick={() => jumpToSection('activity')} />
              <ActionableDetailButton label={`Businesses: ${detail.linkedBusinesses.length}`} onClick={() => jumpToSection('businesses')} />
            </div>
          </div>
          <div ref={setSectionRef('codes')} className={cn('rounded-xl border border-surface-200 bg-surface-50 p-3 transition-shadow', getCauseSectionHighlight(activeSection, 'codes'))}>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Codes + Materials</p>
            <div className="mt-2 space-y-1">
              <ActionableDetailButton label={`Referral: ${detail.codes?.referral_code || 'Missing'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Connection: ${detail.codes?.connection_code || 'Missing'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Join page: ${detail.joinUrl ? 'Ready' : 'Waiting on codes'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Setup: ${detail.stakeholder ? 'Ready' : 'Missing'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`QR: ${detail.qrCount > 0 ? `${detail.qrCount} ready` : 'Missing'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Materials: ${detail.generatedCount > 0 ? `${detail.generatedCount} ready` : 'Waiting'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Task: ${detail.taskStatus || 'Not started'}`} onClick={() => jumpToSection('codes')} />
            </div>
          </div>
          <div ref={setSectionRef('activity')} className={cn('transition-shadow', getCauseSectionHighlight(activeSection, 'activity'))}>
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Outreach Activity</p>
              <p className="mt-1 text-xl font-semibold text-surface-900">{detail.outreach.length}</p>
              <div className="mt-2 space-y-1">
                <ActionableDetailButton
                  label={detail.latestOutreach ? `${detail.latestOutreach.type.replace('_', ' ')} / ${formatDate(detail.latestOutreach.created_at)}` : 'No outreach logged yet'}
                  onClick={() => jumpToSection('activity')}
                />
                <ActionableDetailButton
                  label={detail.nextFollowUp?.next_step ? `${detail.nextFollowUp.next_step}${detail.nextFollowUp.next_step_date ? ` by ${formatDate(detail.nextFollowUp.next_step_date)}` : ''}` : 'No follow-up scheduled yet'}
                  onClick={() => jumpToSection('activity')}
                />
              </div>
            </div>
          </div>
          <div ref={setSectionRef('businesses')} className={cn('rounded-xl border border-surface-200 bg-surface-50 p-3 transition-shadow', getCauseSectionHighlight(activeSection, 'businesses'))}>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Business Links</p>
            <p className="mt-1 text-xl font-semibold text-surface-900">{detail.linkedBusinesses.length}</p>
            <div className="mt-2 space-y-1">
              <ActionableDetailButton label={detail.linkedBusinesses.length > 0 ? 'Open connected businesses' : 'No connected businesses yet'} onClick={() => jumpToSection('businesses')} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.linkedBusinesses.length > 0 ? detail.linkedBusinesses.slice(0, 3).map((business) => (
                <Link key={business.id} href={`/crm/businesses/${business.id}`} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', businessTheme.badge)}>
                  {business.name}
                </Link>
              )) : (
                <span className="text-xs text-surface-400">No connected businesses yet</span>
              )}
            </div>
          </div>
        </div>

        <div className={cn('space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getCauseSectionHighlight(activeSection, 'codes'))}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Generated Materials</p>
            <span className="text-xs text-surface-500">{detail.generatedCount} ready</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.generated.length > 0 ? detail.generated.slice(0, 6).map((item) => (
              <a
                key={item.id}
                href={item.generated_file_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-medium text-surface-700 transition-colors hover:border-surface-300 hover:text-surface-900"
              >
                {item.generated_file_name || item.library_folder.replaceAll('_', ' ')}
              </a>
            )) : (
              <span className="text-xs text-surface-400">Materials will appear here after generation runs.</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-surface-100 pt-2">
          <Button variant="outline" size="sm" onClick={() => setLifecycleModal('initial_connection')}>
            <School className="h-3.5 w-3.5" /> Org Info
          </Button>
          <Button size="sm" onClick={() => setLifecycleModal('materials_qr')}>
            <QrCode className="h-3.5 w-3.5" /> Materials & QR
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLifecycleModal('leader_conversation')}>
            <MessageSquare className="h-3.5 w-3.5" /> Log Outreach
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLifecycleModal('activation_decision')}>
            <Heart className="h-3.5 w-3.5" /> Activation
          </Button>
          {!detail.stakeholder || !detail.taskStatus ? (
            <Button variant="outline" size="sm" onClick={onCreateSetup} disabled={detail.setupLoading}>
              {detail.setupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {!detail.stakeholder ? 'Create Material Setup' : 'Create Setup Task'}
            </Button>
          ) : null}
          {detail.joinUrl ? (
            <a href={detail.joinUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ArrowRight className="h-3.5 w-3.5" /> Support Page
              </Button>
            </a>
          ) : null}
          <Link href={`/crm/causes/${cause.id}`}>
            <Button variant="outline" size="sm">
              <ArrowRight className="h-3.5 w-3.5" /> Full CRM
            </Button>
          </Link>
        </div>

        {detail.setupMessage ? (
          <div className="rounded-xl border border-success-200 bg-success-50 px-3 py-2 text-xs text-success-700">
            {detail.setupMessage}
          </div>
        ) : null}
      </div>

      {/* ── Lifecycle Modals (stay in onboarding, don't navigate away) ── */}
      <CauseInitialConnectionModal
        open={lifecycleModal === 'initial_connection'}
        onOpenChange={(v) => !v && setLifecycleModal(null)}
        cause={cause}
        city={detail.city}
        linkedBusinessCount={detail.linkedBusinesses.length}
        helperCount={detail.helperAssignments.length}
        cities={allCities}
        saving={updateLoading}
        blocker={null}
        readyToComplete={false}
        onSave={async (changes) => {
          await updateCause(cause.id, changes)
        }}
      />

      <LeaderConversationModal
        open={lifecycleModal === 'leader_conversation'}
        onOpenChange={(v) => !v && setLifecycleModal(null)}
        outreach={outreachList}
        profileMap={new Map()}
        saving={savingOutreach}
        blocker={null}
        readyToComplete={outreachList.length > 0}
        onLogOutreach={async ({ type, subject, body, outcome, nextStep, nextStepDate }) => {
          await insertOutreach({
            entity_type: 'cause',
            entity_id: cause.id,
            type: type as OutreachActivity['type'],
            performed_by: localProfileId || undefined,
            subject: subject || null,
            body,
            outcome: outcome || null,
            next_step: nextStep || null,
            next_step_date: nextStepDate || null,
          })
          refetchOutreach({ silent: true })
        }}
      />

      <CauseMaterialsQrModal
        open={lifecycleModal === 'materials_qr'}
        onOpenChange={(v) => !v && setLifecycleModal(null)}
        codes={detail.codes}
        generatedMaterials={detail.generated}
        qrCodes={[]}
        joinUrl={detail.joinUrl}
        engineBusy={null}
        regenBusy={false}
        saving={false}
        blocker={null}
        readyToComplete={false}
        onSaveCodes={async () => {}}
        onGenerateMaterials={async () => {}}
        onRegenerateAll={async () => {}}
      />

      <ActivationDecisionModal
        open={lifecycleModal === 'activation_decision'}
        onOpenChange={(v) => !v && setLifecycleModal(null)}
        cause={cause}
        linkedBusinessCount={detail.linkedBusinesses.length}
        generatedCount={detail.generatedCount}
        qrCount={detail.qrCount}
        codesReady={detail.codesReady}
        stakeholderReady={!!detail.stakeholder}
        saving={false}
        blocker={null}
        readyToComplete={detail.codesReady && detail.generatedCount > 0}
      />
    </div>
  )
}

function InlineDetail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-surface-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-surface-900">{value}</p>
    </div>
  )
}

function ActionableDetailButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs text-surface-500 transition-colors hover:bg-white hover:text-surface-800"
    >
      <span>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-surface-400" />
    </button>
  )
}

function MetricBlock({
  label,
  value,
  detail,
  secondary,
}: {
  label: string
  value: number
  detail: string
  secondary?: string
}) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-surface-900">{value}</p>
      <p className="mt-1 text-xs text-surface-500">{detail}</p>
      {secondary ? <p className="mt-1 text-xs text-surface-500">{secondary}</p> : null}
    </div>
  )
}

function AddCauseDialog({
  open,
  onOpenChange,
  form,
  setForm,
  cities,
  onSubmit,
  submitting,
  submitError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: CauseForm
  setForm: React.Dispatch<React.SetStateAction<CauseForm>>
  cities: Array<{ id: string; name: string; state: string }>
  onSubmit: (event: React.FormEvent) => Promise<void>
  submitting: boolean
  submitError: string | null
}) {
  function handleFormChange(field: keyof CauseForm, value: string) {
    setForm((current) => ({ ...current, [field]: value as never }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a New Cause</DialogTitle>
          <DialogDescription>
            Register the school, nonprofit, church, or community organization and seed its supporter-launch setup in one flow.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-surface-700">Organization Name *</label>
            <Input placeholder="e.g. Riverside Elementary" required value={form.name} onChange={(event) => handleFormChange('name', event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormSelect label="Type" value={form.type} onChange={(value) => handleFormChange('type', value)}>
              <option value="school">School</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="church">Church</option>
              <option value="community">Community</option>
              <option value="other">Other</option>
            </FormSelect>
            <FormSelect label="City" value={form.city_id} onChange={(value) => handleFormChange('city_id', value)}>
              <option value="">Select a city...</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
              ))}
            </FormSelect>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Email" value={form.email} onChange={(value) => handleFormChange('email', value)} type="email" placeholder="contact@school.edu" />
            <FormInput label="Phone" value={form.phone} onChange={(value) => handleFormChange('phone', value)} type="tel" placeholder="(404) 555-0000" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Website" value={form.website} onChange={(value) => handleFormChange('website', value)} type="url" placeholder="https://example.org" />
            <FormInput label="Source" value={form.source} onChange={(value) => handleFormChange('source', value)} placeholder="e.g. Referral, Event, Community Intro" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormSelect label="Brand" value={form.brand} onChange={(value) => handleFormChange('brand', value)}>
              {Object.entries(BRANDS).map(([value, definition]) => (
                <option key={value} value={value}>{definition.label}</option>
              ))}
            </FormSelect>
            <FormSelect label="Stage" value={form.stage} onChange={(value) => handleFormChange('stage', value)}>
              {Object.entries(ONBOARDING_STAGES).map(([value, definition]) => (
                <option key={value} value={value}>{definition.label}</option>
              ))}
            </FormSelect>
          </div>
          {submitError ? <p className="text-sm text-danger-600">{submitError}</p> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {submitting ? 'Creating...' : 'Create Cause'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FormInput({
  label,
  value,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-surface-700">{label}</label>
      <Input {...props} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function FormSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-surface-700">{label}</label>
      <select className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  )
}
