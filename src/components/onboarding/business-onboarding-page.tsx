'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Lock,
  ArrowRight,
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
  MapPin,
  MessageSquare,
  Plus,
  QrCode,
  Search,
  Store,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { computeBusinessExecutionSteps, computeBusinessOnboardingChecklist } from '@/lib/business-execution'
import { getEntityTheme } from '@/lib/entity-themes'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import {
  useAdminTasks,
  useBusinesses,
  useBusinessUpdate,
  useCampaigns,
  useCauses,
  useCities,
  useGeneratedMaterials,
  useOnboardingFlows,
  useOnboardingSteps,
  useOffers,
  useOutreach,
  useProfiles,
  useQrCodes,
  useStakeholders,
  useStakeholderCodes,
  useStakeholderAssignments,
  useTasks,
} from '@/lib/supabase/hooks'
import type {
  Business,
  GeneratedMaterial,
  OnboardingFlow,
  OnboardingStage,
  OnboardingStep,
  OutreachActivity,
  Profile,
  Stakeholder,
  Task,
} from '@/lib/types/database'

const STAGE_ORDER: OnboardingStage[] = ['lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live']

const businessTheme = getEntityTheme('business')
const causeTheme = getEntityTheme('cause')

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

function getProgressColor(percent: number) {
  if (percent >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-500/30' }
  if (percent >= 40) return { bar: 'bg-brand-500', text: 'text-brand-700', ring: 'ring-brand-500/30' }
  if (percent >= 20) return { bar: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-500/30' }
  return { bar: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-500/30' }
}

function StageChanger({
  business,
  onStageChanged,
}: {
  business: Business
  onStageChanged: () => void
}) {
  const { update, loading } = useBusinessUpdate()
  const [open, setOpen] = React.useState(false)

  async function handleStageChange(newStage: OnboardingStage) {
    await update(business.id, { stage: newStage })
    setOpen(false)
    onStageChanged()
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setOpen(value => !value) }}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Move
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-surface-200 bg-surface-0 p-1 shadow-panel">
            {STAGE_ORDER.map(stage => (
              <button
                key={stage}
                onClick={(e) => { e.stopPropagation(); void handleStageChange(stage) }}
                disabled={stage === business.stage}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  stage === business.stage
                    ? 'bg-surface-100 text-surface-400'
                    : 'text-surface-700 hover:bg-surface-50'
                }`}
              >
                <Badge variant={getStageBadgeVariant(stage)} dot>
                  {ONBOARDING_STAGES[stage]?.label}
                </Badge>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function BusinessOnboardingPage() {
  const { profile } = useAuth()
  const isFieldUser = getStakeholderShell(profile) === 'field'

  const { data: businesses, loading, error, refetch } = useBusinesses()
  const { data: cities } = useCities()
  const { data: causes } = useCauses()
  const { data: campaigns } = useCampaigns()
  const { data: profiles } = useProfiles()
  const { data: assignments } = useStakeholderAssignments()
  const { data: stakeholders, refetch: refetchStakeholders } = useStakeholders()
  const { data: stakeholderCodes, refetch: refetchStakeholderCodes } = useStakeholderCodes()
  const { data: generatedMaterials, refetch: refetchGeneratedMaterials } = useGeneratedMaterials()
  const { data: flows, refetch: refetchFlows } = useOnboardingFlows()
  const { data: steps, refetch: refetchSteps } = useOnboardingSteps()
  const { data: offers, refetch: refetchOffers } = useOffers()
  const { data: qrCodes, refetch: refetchQrCodes } = useQrCodes()
  const { data: adminTasks } = useAdminTasks()
  const { data: tasks } = useTasks()
  const { data: outreach } = useOutreach()

  // ── Filter state ──────────────────────────────────────────────
  const [cityFilter, setCityFilter] = React.useState('all')
  const [campaignFilter, setCampaignFilter] = React.useState('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedBusinessId, setSelectedBusinessId] = React.useState<string | null>(null)

  // ── Lookup maps ───────────────────────────────────────────────
  const cityMap = React.useMemo(() => new Map(cities.map(city => [city.id, city])), [cities])
  const causeMap = React.useMemo(() => new Map(causes.map(cause => [cause.id, cause])), [causes])
  const campaignMap = React.useMemo(() => new Map(campaigns.map(campaign => [campaign.id, campaign])), [campaigns])
  const profileMap = React.useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles])

  const assignmentsByBusiness = React.useMemo(() => {
    const map = new Map<string, typeof assignments>()
    assignments
      .filter(assignment => assignment.entity_type === 'business' && assignment.status === 'active')
      .forEach(assignment => {
        const current = map.get(assignment.entity_id) || []
        current.push(assignment)
        map.set(assignment.entity_id, current)
      })
    return map
  }, [assignments])

  const flowByBusiness = React.useMemo(() => {
    const map = new Map<string, OnboardingFlow>()
    flows
      .filter(flow => flow.entity_type === 'business')
      .forEach(flow => map.set(flow.entity_id, flow))
    return map
  }, [flows])

  const stepsByFlow = React.useMemo(() => {
    const map = new Map<string, OnboardingStep[]>()
    steps.forEach(step => {
      const current = map.get(step.flow_id) || []
      current.push(step)
      map.set(step.flow_id, current)
    })
    return map
  }, [steps])

  const stakeholderByBusiness = React.useMemo(() => {
    const map = new Map<string, typeof stakeholders[number]>()
    stakeholders
      .filter((stakeholder) => !!stakeholder.business_id)
      .forEach((stakeholder) => {
        if (stakeholder.business_id) map.set(stakeholder.business_id, stakeholder)
      })
    return map
  }, [stakeholders])

  const codesByStakeholder = React.useMemo(() => {
    const map = new Map<string, typeof stakeholderCodes[number]>()
    stakeholderCodes.forEach((code) => map.set(code.stakeholder_id, code))
    return map
  }, [stakeholderCodes])

  const generatedByStakeholder = React.useMemo(() => {
    const map = new Map<string, typeof generatedMaterials>()
    generatedMaterials.forEach((item) => {
      const current = map.get(item.stakeholder_id) || []
      current.push(item)
      map.set(item.stakeholder_id, current)
    })
    return map
  }, [generatedMaterials])

  const adminTaskByStakeholder = React.useMemo(() => {
    const map = new Map<string, typeof adminTasks[number]>()
    adminTasks
      .filter((task) => task.task_type === 'stakeholder_setup')
      .forEach((task) => {
        if (map.has(task.stakeholder_id)) return
        map.set(task.stakeholder_id, task)
      })
    return map
  }, [adminTasks])

  const offersByBusiness = React.useMemo(() => {
    const map = new Map<string, typeof offers>()
    offers.forEach((offer) => {
      const current = map.get(offer.business_id) || []
      current.push(offer)
      map.set(offer.business_id, current)
    })
    return map
  }, [offers])

  const qrByBusiness = React.useMemo(() => {
    const map = new Map<string, typeof qrCodes>()
    qrCodes.forEach((item) => {
      if (!item.business_id) return
      const current = map.get(item.business_id) || []
      current.push(item)
      map.set(item.business_id, current)
    })
    return map
  }, [qrCodes])

  const openTasksByBusiness = React.useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks
      .filter(task => task.entity_type === 'business' && task.entity_id && task.status !== 'completed')
      .forEach(task => {
        const current = map.get(task.entity_id as string) || []
        current.push(task)
        map.set(task.entity_id as string, current)
      })
    return map
  }, [tasks])

  const outreachByBusiness = React.useMemo(() => {
    const map = new Map<string, OutreachActivity[]>()
    outreach
      .filter(activity => activity.entity_type === 'business')
      .forEach(activity => {
        const current = map.get(activity.entity_id) || []
        current.push(activity)
        map.set(activity.entity_id, current)
      })
    return map
  }, [outreach])

  // ── Filtered businesses (role + filter bar) ───────────────────
  const filteredBusinesses = React.useMemo(() => {
    let items = businesses
    if (isFieldUser) {
      const myIds = new Set<string>()
      assignments
        .filter(a => a.stakeholder_id === profile.id && a.entity_type === 'business')
        .forEach(a => myIds.add(a.entity_id))
      businesses
        .filter(b => b.owner_id === profile.id)
        .forEach(b => myIds.add(b.id))
      items = items.filter(b => myIds.has(b.id))
    }
    if (cityFilter !== 'all') items = items.filter(b => b.city_id === cityFilter)
    if (campaignFilter !== 'all') items = items.filter(b => b.campaign_id === campaignFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter(b => b.name.toLowerCase().includes(q))
    }
    return items
  }, [businesses, isFieldUser, assignments, profile.id, cityFilter, campaignFilter, searchQuery])

  // ── Group filtered businesses by stage ────────────────────────
  const groupedBusinesses = React.useMemo(() => {
    return STAGE_ORDER.map(stage => ({
      stage,
      items: filteredBusinesses.filter(business => business.stage === stage),
    })).filter(group => group.items.length > 0)
  }, [filteredBusinesses])

  // ── Summary stats ─────────────────────────────────────────────
  const summary = React.useMemo(() => {
    const live = filteredBusinesses.filter(business => business.stage === 'live').length
    const onboarding = filteredBusinesses.filter(business => business.stage === 'in_progress' || business.stage === 'onboarded').length
    const followUps = outreach.filter(activity =>
      activity.entity_type === 'business'
      && !!activity.next_step_date
      && new Date(activity.next_step_date).getTime() <= Date.now() + (1000 * 60 * 60 * 24 * 7)
    ).length
    const assigned = filteredBusinesses.filter(business => assignmentsByBusiness.has(business.id)).length

    return { total: filteredBusinesses.length, live, onboarding, followUps, assigned }
  }, [assignmentsByBusiness, filteredBusinesses, outreach])

  // ── Unique city/campaign options for filter dropdowns ─────────
  const cityOptions = React.useMemo(() => {
    const ids = new Set(businesses.map(b => b.city_id).filter(Boolean) as string[])
    return Array.from(ids)
      .map(id => cityMap.get(id))
      .filter(Boolean)
      .sort((a, b) => (a!.name > b!.name ? 1 : -1)) as typeof cities
  }, [businesses, cityMap])

  const campaignOptions = React.useMemo(() => {
    const ids = new Set(businesses.map(b => b.campaign_id).filter(Boolean) as string[])
    return Array.from(ids)
      .map(id => campaignMap.get(id))
      .filter(Boolean)
      .sort((a, b) => (a!.name > b!.name ? 1 : -1)) as typeof campaigns
  }, [businesses, campaignMap])

  // ── Step execution helpers ────────────────────────────────────
  const [busyStepId, setBusyStepId] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)

  const refreshExecutionBoards = React.useCallback(() => {
    refetch({ silent: true })
    refetchStakeholders({ silent: true })
    refetchStakeholderCodes({ silent: true })
    refetchGeneratedMaterials({ silent: true })
    refetchFlows({ silent: true })
    refetchSteps({ silent: true })
    refetchOffers({ silent: true })
    refetchQrCodes({ silent: true })
  }, [refetch, refetchFlows, refetchGeneratedMaterials, refetchOffers, refetchQrCodes, refetchStakeholderCodes, refetchStakeholders, refetchSteps])

  async function handleCompleteStep(businessId: string, stepId: string) {
    setBusyStepId(stepId)
    setActionError(null)
    setActionMessage(null)

    try {
      const response = await fetch(`/api/crm/businesses/${businessId}/execution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_step',
          stepId,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setActionError(payload.error || 'The onboarding step could not be completed.')
        return
      }

      setActionMessage('Onboarding step completed.')
      refreshExecutionBoards()
    } catch {
      setActionError('The onboarding step could not be completed.')
    } finally {
      setBusyStepId(null)
    }
  }

  // ── Helper: build enriched business data ──────────────────────
  function getBusinessDetail(business: Business) {
    const flow = flowByBusiness.get(business.id)
    const stakeholder = stakeholderByBusiness.get(business.id) || null
    const codes = stakeholder ? codesByStakeholder.get(stakeholder.id) || null : null
    const generated = stakeholder ? generatedByStakeholder.get(stakeholder.id) || [] : []
    const generatedReady = generated.filter((item) => item.generation_status === 'generated')
    const businessOffers = offersByBusiness.get(business.id) || []
    const businessQrCodes = qrByBusiness.get(business.id) || []
    const businessSteps = computeBusinessExecutionSteps({
      business,
      steps: stepsByFlow.get(flow?.id || '') || [],
      codes,
      generatedMaterials: generated,
      qrCodes: businessQrCodes,
      offers: businessOffers,
      outreachCount: (outreachByBusiness.get(business.id) || []).length,
    })
    const checklist = computeBusinessOnboardingChecklist({
      business,
      steps: stepsByFlow.get(flow?.id || '') || [],
      codes,
      generatedMaterials: generated,
      qrCodes: businessQrCodes,
      offers: businessOffers,
      outreachCount: (outreachByBusiness.get(business.id) || []).length,
      completedTaskCount: tasks.filter(t => t.entity_type === 'business' && t.entity_id === business.id && t.status === 'completed').length,
      hasOwner: !!business.owner_id,
      hasCampaign: !!business.campaign_id,
      hasLinkedCause: !!business.linked_cause_id,
      hasLogo: !!business.logo_url,
      hasCoverPhoto: !!business.cover_photo_url,
    })
    const owner = business.owner_id ? profileMap.get(business.owner_id) : null
    const helperAssignments = (assignmentsByBusiness.get(business.id) || [])
      .map(assignment => ({ assignment, profile: profileMap.get(assignment.stakeholder_id) }))
      .filter((item): item is { assignment: typeof assignments[number]; profile: Profile } => !!item.profile)
    const linkedCause = business.linked_cause_id ? causeMap.get(business.linked_cause_id) : null
    const campaign = business.campaign_id ? campaignMap.get(business.campaign_id) : null
    const city = business.city_id ? cityMap.get(business.city_id) : null
    const businessTasks = openTasksByBusiness.get(business.id) || []
    const businessOutreach = (outreachByBusiness.get(business.id) || [])
      .slice()
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    const adminTask = stakeholder ? adminTaskByStakeholder.get(stakeholder.id) || null : null
    const latestOutreach = businessOutreach[0]
    const nextFollowUp = businessOutreach
      .filter((activity) => activity.next_step || activity.next_step_date)
      .slice()
      .sort((left, right) => {
        const leftTime = left.next_step_date ? new Date(left.next_step_date).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.next_step_date ? new Date(right.next_step_date).getTime() : Number.MAX_SAFE_INTEGER
        return leftTime - rightTime
      })[0]
    const dueTask = businessTasks
      .slice()
      .sort((left, right) => {
        const leftTime = left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER
        return leftTime - rightTime
      })[0]
    const logoUrl = business.logo_url || null
    const coverPhotoUrl = business.cover_photo_url || null
    const captureOffer = businessOffers.find((offer) => offer.offer_type === 'capture') || null
    const cashbackOffer = businessOffers.find((offer) => offer.offer_type === 'cashback') || null
    const qrGeneratorHref = `/qr/generator?businessId=${business.id}&returnTo=${encodeURIComponent('/onboarding/business')}`

    return {
      flow,
      stakeholder,
      codes,
      generated: generatedReady,
      businessSteps,
      checklist,
      owner,
      helperAssignments,
      linkedCause,
      campaign,
      city,
      businessTasks,
      businessOutreach,
      latestOutreach,
      nextFollowUp,
      dueTask,
      codesReady: !!codes?.join_url,
      joinUrl: codes?.join_url || null,
      generatedCount: generatedReady.length,
      qrCount: businessQrCodes.length,
      taskStatus: adminTask?.status || null,
      captureOffer,
      cashbackOffer,
      qrGeneratorHref,
      logoUrl,
      coverPhotoUrl,
    }
  }

  // ── Selected business for modal ───────────────────────────────
  const selectedBusiness = selectedBusinessId
    ? filteredBusinesses.find(b => b.id === selectedBusinessId) || businesses.find(b => b.id === selectedBusinessId) || null
    : null

  // ── Loading / error / empty states ────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading business onboarding...</span>
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

  if (businesses.length === 0) {
    return (
      <div>
        <PageHeader
          title="Business Onboarding"
          description="Track every business from first contact through launch."
          actions={
            <Link href="/crm/businesses?action=new">
              <Button>
                <Plus className="h-4 w-4" /> Add Business
              </Button>
            </Link>
          }
        />
        <EmptyState
          icon={<Store className="h-8 w-8" />}
          title="No businesses yet"
          description="Add your first business to start managing outreach owners, next steps, and launch readiness."
          action={{ label: 'Add Business', onClick: () => { window.location.href = '/crm/businesses?action=new' } }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Onboarding"
        description="Clear ownership, clear next steps, and a clickable path from lead to live."
        actions={
          <Link href="/crm/businesses?action=new">
            <Button>
              <Plus className="h-4 w-4" /> Add Business
            </Button>
          </Link>
        }
      />

      {/* ── Summary stat cards ─────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr),repeat(4,minmax(0,0.55fr))]">
        <Card className={`overflow-hidden border shadow-sm ${businessTheme.border}`}>
          <CardContent className={`flex h-full min-h-[120px] flex-col justify-between gap-4 bg-gradient-to-r ${businessTheme.gradient} p-5`}>
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 shadow-sm ring-1 ${businessTheme.ring} ${businessTheme.icon}`}>
                <Store className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className={`text-sm font-semibold ${businessTheme.text}`}>Business onboarding should feel obvious at a glance</p>
                <p className="max-w-2xl text-sm leading-6 text-surface-600">
                  Open any business to run the full workspace, clear blockers, finish setup steps, and move it from lead to live.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-surface-500">
              <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 font-medium text-surface-700">
                {filteredBusinesses.length} visible
              </span>
              <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1">
                Click a card to open the workspace
              </span>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3 xl:col-span-4 xl:grid-cols-4">
          <CompactBusinessMetricCard label="Pipeline" value={summary.total} />
          <CompactBusinessMetricCard label="Active Build" value={summary.onboarding} />
          <CompactBusinessMetricCard label="Live" value={summary.live} />
          <CompactBusinessMetricCard label="Follow-ups" value={summary.followUps} />
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <Card className="overflow-hidden border border-surface-200 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-surface-100 p-2 text-surface-600">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Filter the pipeline</p>
                <p className="text-sm text-surface-600">Narrow the list by city, campaign, or business name.</p>
              </div>
            </div>
            {filteredBusinesses.length !== businesses.length ? (
              <span className="rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs font-medium text-surface-600">
                {filteredBusinesses.length} of {businesses.length} showing
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),170px,200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                placeholder="Search businesses..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-xl border border-surface-200 bg-surface-0 py-2 pl-10 pr-3 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              className="h-11 rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">All Cities</option>
              {cityOptions.map(city => (
                <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
              ))}
            </select>
            <select
              value={campaignFilter}
              onChange={e => setCampaignFilter(e.target.value)}
              className="h-11 rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">All Campaigns</option>
              {campaignOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ── Action feedback ────────────────────────────────────── */}
      {actionError ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {actionError}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {actionMessage}
        </div>
      ) : null}

      {/* ── Empty filtered state ───────────────────────────────── */}
      {filteredBusinesses.length === 0 && businesses.length > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Store className="h-8 w-8 text-surface-300" />
            <p className="text-sm font-medium text-surface-600">No businesses match your filters</p>
            <button
              onClick={() => { setCityFilter('all'); setCampaignFilter('all'); setSearchQuery('') }}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Clear all filters
            </button>
          </CardContent>
        </Card>
      )}

      {/* ── Stage groups with compact cards ────────────────────── */}
      <div className="space-y-8">
        {groupedBusinesses.map(group => (
          <section key={group.stage} className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Badge variant={getStageBadgeVariant(group.stage)} dot>
                  {ONBOARDING_STAGES[group.stage]?.label}
                </Badge>
                <span className="text-sm text-surface-500">{group.items.length} businesses</span>
              </div>
              <span className="hidden text-xs uppercase tracking-[0.16em] text-surface-400 md:block">
                Click a card to open the workspace
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map(business => {
                const detail = getBusinessDetail(business)

                return (
                  <BusinessOnboardingSummaryCard
                    key={business.id}
                    business={business}
                    detail={detail}
                    onOpen={() => setSelectedBusinessId(business.id)}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Fullscreen detail modal ────────────────────────────── */}
      <Dialog open={!!selectedBusiness} onOpenChange={(open) => { if (!open) setSelectedBusinessId(null) }}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-0">
          {selectedBusiness && (
            <BusinessDetailModal
              business={selectedBusiness}
              detail={getBusinessDetail(selectedBusiness)}
              profileMap={profileMap}
              busyStepId={busyStepId}
              onCompleteStep={handleCompleteStep}
              onStageChanged={refetch}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Business Detail Modal (fullscreen-ish)
// ═══════════════════════════════════════════════════════════════

function CompactBusinessMetricCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className={`rounded-2xl border bg-white px-4 py-4 shadow-sm ${businessTheme.border}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-surface-900">{value}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#eef5a5]/60">
        <div className="h-full w-12 rounded-full bg-[#d7e200]" />
      </div>
    </div>
  )
}

function BusinessOnboardingSummaryCard({
  business,
  detail,
  onOpen,
}: {
  business: Business
  detail: any
  onOpen: () => void
}) {
  const { checklist, owner, city, linkedCause, businessTasks, businessOutreach, coverPhotoUrl } = detail
  const progressColors = getProgressColor(checklist.percent)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative w-full cursor-pointer overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        businessTheme.border,
      )}
    >
      <div className={`relative overflow-hidden border-b border-surface-100 bg-gradient-to-r ${businessTheme.gradient} px-4 py-4`}>
        {coverPhotoUrl ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-cover bg-center opacity-[0.08]"
            style={{ backgroundImage: `url('${coverPhotoUrl}')` }}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-white/35" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-semibold text-surface-950 transition-colors group-hover:text-brand-700">
                {business.name}
              </p>
              <Badge variant={getStageBadgeVariant(business.stage)} dot className="shrink-0">
                {ONBOARDING_STAGES[business.stage]?.label}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-surface-700">
              {city ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {city.name}
                </span>
              ) : null}
              {business.category ? (
                <span className={`rounded-full px-2 py-0.5 font-medium ${businessTheme.badge}`}>
                  {business.category}
                </span>
              ) : null}
              <span>Added {formatDate(business.created_at)}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-surface-700">Progress</p>
            <p className={cn('mt-1 text-3xl font-bold leading-none', progressColors.text)}>
              {checklist.percent}%
            </p>
            <p className="mt-1 text-[11px] text-surface-700">
              {checklist.completedCount}/{checklist.totalCount}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-100">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressColors.bar)}
              style={{ width: `${checklist.percent}%` }}
            />
          </div>
          <span className={cn('text-xs font-bold tabular-nums', progressColors.text)}>
            {checklist.percent}%
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-surface-500">
          <span className="flex items-center gap-1">
            <ClipboardList className="h-3 w-3" />
            {businessTasks.length} tasks
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {businessOutreach.length} outreach
          </span>
          {owner ? (
            <span className="flex items-center gap-1 truncate">
              <Users className="h-3 w-3" />
              {owner.full_name?.split(' ')[0]}
            </span>
          ) : (
            <span className="text-surface-400">No owner yet</span>
          )}
        </div>

        {linkedCause ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium', causeTheme.badge)}>
              <Heart className="h-2.5 w-2.5" />
              {linkedCause.name}
            </span>
          </div>
        ) : null}
      </div>
    </button>
  )
}

type BusinessModalSection =
  | 'steps'
  | 'profile'
  | 'relationships'
  | 'brand'
  | 'tasks'
  | 'codes'
  | 'outreach'
  | 'offers'

function getBusinessChecklistSection(itemId: string): BusinessModalSection {
  switch (itemId) {
    case 'name':
    case 'category':
    case 'city':
    case 'contact':
    case 'website':
      return 'profile'
    case 'owner':
    case 'campaign':
    case 'cause':
      return 'relationships'
    case 'logo':
    case 'cover':
      return 'brand'
    case 'first_outreach':
    case 'owner_convo':
      return 'outreach'
    case 'referral_code':
    case 'connection_code':
    case 'qr':
    case 'materials':
      return 'codes'
    case 'capture_offer':
    case 'cashback':
      return 'offers'
    case 'task_done':
      return 'tasks'
    case 'all_steps':
    default:
      return 'steps'
  }
}

function getSectionHighlight(activeSection: string | null, section: string) {
  return activeSection === section ? 'ring-2 ring-brand-300 ring-offset-2 ring-offset-surface-0' : ''
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

function BusinessDetailModal({
  business,
  detail,
  profileMap,
  busyStepId,
  onCompleteStep,
  onStageChanged,
}: {
  business: Business
  detail: ReturnType<any>
  profileMap: Map<string, Profile>
  busyStepId: string | null
  onCompleteStep: (businessId: string, stepId: string) => void
  onStageChanged: () => void
}) {
  const {
    checklist,
    businessSteps,
    owner,
    helperAssignments,
    linkedCause,
    campaign,
    city,
    businessTasks,
    businessOutreach,
    logoUrl,
    coverPhotoUrl,
    generated,
    generatedCount,
    qrCount,
    taskStatus,
    codesReady,
    joinUrl,
    latestOutreach,
    nextFollowUp,
    dueTask,
    captureOffer,
    cashbackOffer,
    qrGeneratorHref,
    codes,
  } = detail
  const progressColors = getProgressColor(checklist.percent)
  const [showChecklist, setShowChecklist] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<BusinessModalSection | null>(null)
  const sectionRefs = React.useRef<Partial<Record<BusinessModalSection, HTMLDivElement | null>>>({})
  const clearHighlightRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSectionRef = React.useCallback((section: BusinessModalSection) => {
    return (node: HTMLDivElement | null) => {
      sectionRefs.current[section] = node
    }
  }, [])

  const jumpToSection = React.useCallback((section: BusinessModalSection) => {
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
      {/* ── Gradient header ────────────────────────────────────── */}
      <div className={`relative overflow-hidden border-b border-surface-100 bg-gradient-to-r ${businessTheme.gradient} px-6 py-5`}>
        {coverPhotoUrl ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-cover bg-center opacity-[0.08]"
            style={{ backgroundImage: `url('${coverPhotoUrl}')` }}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-white/45" />
        <div className="relative">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-700">
              Business Onboarding
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-surface-900">{business.name}</h2>
              <Badge variant={getStageBadgeVariant(business.stage)} dot>
                {ONBOARDING_STAGES[business.stage]?.label}
              </Badge>
              {business.category && (
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', businessTheme.badge)}>
                  {business.category}
                </span>
              )}
              {linkedCause && (
                <Link href={`/crm/causes/${linkedCause.id}`} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${causeTheme.badge}`}>
                  {linkedCause.name}
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-surface-700">
              {city && (
                <Link href={`/crm/cities/${city.id}`} className="flex items-center gap-1 hover:text-surface-700">
                  <MapPin className="h-3.5 w-3.5" />
                  {city.name}, {city.state}
                </Link>
              )}
              {campaign && (
                <Link href={`/campaigns/${campaign.id}`} className="hover:text-surface-700">
                  Campaign: {campaign.name}
                </Link>
              )}
              <span>Added {formatDate(business.created_at)}</span>
              {business.website && (
                <a
                  href={business.website.startsWith('http') ? business.website : `https://${business.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-surface-700"
                >
                  Visit site
                </a>
              )}
            </div>
          </div>
          <StageChanger business={business} onStageChanged={onStageChanged} />
        </div>

        {/* ── Progress bar ───────────────────────────────────── */}
        <div className="mt-4 rounded-2xl border border-[#d7e200]/40 bg-white/70 px-4 py-4 shadow-sm backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-600">
            Progress in motion
          </p>
          <div className="mt-3 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#e8ecbf]">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressColors.bar)}
              style={{ width: `${checklist.percent}%` }}
            />
          </div>
          <span className={cn('text-sm font-bold tabular-nums', progressColors.text)}>
            {checklist.percent}%
          </span>
          <span className="text-xs font-medium text-surface-700">
            ({checklist.completedCount}/{checklist.totalCount})
          </span>
          <button
            onClick={() => setShowChecklist((current) => !current)}
            className="ml-auto flex items-center gap-1 rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 transition-colors hover:bg-surface-50"
          >
            {showChecklist ? 'Hide' : 'View'} Checklist
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showChecklist && 'rotate-90')} />
          </button>
        </div>
        </div>
        </div>
      </div>

      {/* ── Expanded checklist ──────────────────────────────────── */}
      {showChecklist && (
        <div className="border-b border-surface-200 bg-surface-50 px-6 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-surface-400">
            Onboarding Checklist — {checklist.completedCount}/{checklist.totalCount} completed
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.items.map((item: any) => (
              <ChecklistJumpButton
                key={item.id}
                met={item.met}
                label={item.label}
                onClick={() => jumpToSection(getBusinessChecklistSection(item.id))}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Body content ───────────────────────────────────────── */}
      <div className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            ref={setSectionRef('profile')}
            className={cn('space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getSectionHighlight(activeSection, 'profile'))}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Business Profile</p>
              <Link href={`/crm/businesses/${business.id}`}>
                <Button variant="outline" size="sm">
                  Open CRM <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InlineDetail label="Business name" value={business.name || 'Missing'} />
              <InlineDetail label="Category" value={business.category || 'Missing'} />
              <InlineDetail label="City" value={city ? `${city.name}, ${city.state}` : 'Missing'} />
              <InlineDetail label="Contact" value={business.email || business.phone || 'Missing'} />
              <InlineDetail label="Website" value={business.website || 'Missing'} />
              <InlineDetail label="Source" value={business.source || 'Not set'} />
            </div>
          </div>

          <div
            ref={setSectionRef('brand')}
            className={cn('space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getSectionHighlight(activeSection, 'brand'))}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Brand Assets</p>
              <Link href={`/crm/businesses/${business.id}`}>
                <Button variant="outline" size="sm">
                  Review assets <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InlineDetail label="Logo" value={logoUrl ? 'Uploaded' : 'Missing'} />
              <InlineDetail label="Cover photo" value={coverPhotoUrl ? 'Uploaded' : 'Missing'} />
            </div>
            <div className="flex flex-wrap gap-2">
              {logoUrl ? (
                <a href={logoUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-surface-200 bg-white px-3 py-1 text-xs font-medium text-surface-700 transition-colors hover:border-surface-300 hover:text-surface-900">
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

        {/* Steps + Ownership columns */}
        <div className="grid gap-5 lg:grid-cols-[1.3fr,0.9fr]">
          {/* Onboarding steps */}
          <div ref={setSectionRef('steps')} className={cn('space-y-3 transition-shadow', getSectionHighlight(activeSection, 'steps'))}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
              <ClipboardList className="h-3.5 w-3.5" />
              Onboarding Steps
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {businessSteps.map((step: any) => (
                <div
                  key={step.step.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm',
                    step.state === 'completed'
                      ? 'border-success-200 bg-success-50 text-success-700'
                      : step.state === 'active'
                      ? `border-amber-200 ${businessTheme.softSurface} ${businessTheme.mutedText}`
                      : 'border-surface-200 bg-surface-50 text-surface-500'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {step.state === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : step.state === 'active' ? <Clock3 className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                        <span className="font-medium">{step.label}</span>
                      </div>
                      {step.state === 'completed' ? (
                        <p className="text-xs">
                          {step.step.completed_at
                            ? `Completed ${formatDateTime(step.step.completed_at)}${step.step.completed_by ? ` by ${profileMap.get(step.step.completed_by)?.full_name || 'a team member'}` : ''}`
                            : 'Completed and ready.'}
                        </p>
                      ) : step.state === 'active' ? (
                        <p className="text-xs">{step.readyToComplete ? 'Ready to complete now.' : step.blocker || 'This is the next action to move.'}</p>
                      ) : (
                        <p className="text-xs">This unlocks after the current step.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {step.state === 'active' ? (
                        step.readyToComplete ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void onCompleteStep(business.id, step.step.id)}
                            disabled={busyStepId === step.step.id}
                          >
                            {busyStepId === step.step.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            Complete
                          </Button>
                        ) : (
                          <Link href={`/crm/businesses/${business.id}`}>
                            <Button size="sm" variant="outline">
                              Fix <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ownership panel */}
          <div
            ref={setSectionRef('relationships')}
            className={cn('space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getSectionHighlight(activeSection, 'relationships'))}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Ownership + Relationships</p>
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
                {helperAssignments.length > 0 ? helperAssignments.map(({ assignment, profile: helper }: any) => (
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
              <InlineDetail label="Campaign" value={campaign?.name || 'Not linked'} />
              <InlineDetail label="Cause / school" value={linkedCause?.name || 'Not linked'} />
            </div>
          </div>
        </div>

        {/* ── Counters row ───────────────────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div ref={setSectionRef('tasks')} className={cn('transition-shadow', getSectionHighlight(activeSection, 'tasks'))}>
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Tasks</p>
              <p className="mt-1 text-xl font-semibold text-surface-900">{businessTasks.length}</p>
              <div className="mt-2 space-y-1">
                <ActionableDetailButton label={dueTask?.due_date ? `Due ${formatDate(dueTask.due_date)}` : 'No due task yet'} onClick={() => jumpToSection('tasks')} />
                <ActionableDetailButton label={`Outreach: ${businessOutreach.length}`} onClick={() => jumpToSection('outreach')} />
              </div>
            </div>
          </div>
          <div ref={setSectionRef('codes')} className={cn('rounded-xl border border-surface-200 bg-surface-50 p-3 transition-shadow', getSectionHighlight(activeSection, 'codes'))}>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Codes + Materials</p>
            <div className="mt-2 space-y-1">
              <ActionableDetailButton label={`Referral: ${codes?.referral_code || 'Missing'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Connection: ${codes?.connection_code || 'Missing'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Join page: ${joinUrl ? 'Ready' : 'Waiting on codes'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`QR: ${qrCount > 0 ? `${qrCount} ready` : 'Missing'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Materials: ${generatedCount > 0 ? `${generatedCount} ready` : 'Waiting'}`} onClick={() => jumpToSection('codes')} />
              <ActionableDetailButton label={`Task: ${taskStatus || 'Not started'}`} onClick={() => jumpToSection('codes')} />
            </div>
          </div>
          <div ref={setSectionRef('outreach')} className={cn('transition-shadow', getSectionHighlight(activeSection, 'outreach'))}>
            <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Outreach Activity</p>
              <p className="mt-1 text-xl font-semibold text-surface-900">{businessOutreach.length}</p>
              <div className="mt-2 space-y-1">
                <ActionableDetailButton
                  label={latestOutreach ? `${latestOutreach.type.replace('_', ' ')} / ${formatDate(latestOutreach.created_at)}` : 'No outreach logged yet'}
                  onClick={() => jumpToSection('outreach')}
                />
                <ActionableDetailButton
                  label={nextFollowUp?.next_step ? `${nextFollowUp.next_step}${nextFollowUp.next_step_date ? ` by ${formatDate(nextFollowUp.next_step_date)}` : ''}` : 'No follow-up scheduled yet'}
                  onClick={() => jumpToSection('outreach')}
                />
              </div>
            </div>
          </div>
          <div ref={setSectionRef('offers')} className={cn('rounded-xl border border-surface-200 bg-surface-50 p-3 transition-shadow', getSectionHighlight(activeSection, 'offers'))}>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Offers + Launch Readiness</p>
            <div className="mt-2 space-y-1">
              <ActionableDetailButton label={`100-list offer: ${captureOffer?.headline || 'Missing'}`} onClick={() => jumpToSection('offers')} />
              <ActionableDetailButton label={`Cashback: ${cashbackOffer?.cashback_percent ? `${cashbackOffer.cashback_percent}% ready` : 'Missing'}`} onClick={() => jumpToSection('offers')} />
              <ActionableDetailButton label={`Cause: ${linkedCause?.name || 'Not linked'}`} onClick={() => jumpToSection('relationships')} />
              <ActionableDetailButton label={`Status: ${codesReady ? 'Capture ready' : 'Needs codes'}`} onClick={() => jumpToSection('codes')} />
            </div>
          </div>
        </div>

        <div className={cn('space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 transition-shadow', getSectionHighlight(activeSection, 'codes'))}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Generated Materials</p>
            <span className="text-xs text-surface-500">{generatedCount} ready</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {generated.length > 0 ? generated.slice(0, 6).map((item: GeneratedMaterial) => (
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

        {/* ── Action buttons ─────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-100">
          <Link href={`/crm/businesses/${business.id}`}>
            <Button variant="outline" size="sm">
              <Store className="h-3.5 w-3.5" /> Open CRM
            </Button>
          </Link>
          <Link href={qrGeneratorHref}>
            <Button size="sm">
              <QrCode className="h-3.5 w-3.5" /> QR Code
            </Button>
          </Link>
          <Link href={`/crm/scripts?business=${business.id}`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-3.5 w-3.5" /> Script
            </Button>
          </Link>
          <Link href={`/crm/outreach?business=${business.id}`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-3.5 w-3.5" /> Log Outreach
            </Button>
          </Link>
          {joinUrl ? (
            <a href={joinUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ArrowRight className="h-3.5 w-3.5" /> Join Page
              </Button>
            </a>
          ) : null}
          {owner && (
            <Link href={`/admin/users/${owner.id}`}>
              <Button variant="outline" size="sm">
                <Users className="h-3.5 w-3.5" /> Owner
              </Button>
            </Link>
          )}
          {linkedCause ? (
            <Link href={`/crm/causes/${linkedCause.id}`}>
              <Button variant="outline" size="sm">
                <Heart className="h-3.5 w-3.5" /> Cause
              </Button>
            </Link>
          ) : null}
          {campaign && (
            <Link href={`/campaigns/${campaign.id}`}>
              <Button variant="outline" size="sm">
                Campaign
              </Button>
            </Link>
          )}
          {city && (
            <Link href={`/crm/cities/${city.id}`}>
              <Button variant="outline" size="sm">
                <MapPin className="h-3.5 w-3.5" /> City
              </Button>
            </Link>
          )}
        </div>
      </div>
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
