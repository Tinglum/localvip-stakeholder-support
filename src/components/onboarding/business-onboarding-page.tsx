'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  FileText,
  Heart,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  QrCode,
  Search,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { computeBusinessExecutionSteps, computeBusinessOnboardingChecklist } from '@/lib/business-execution'
import { getEntityTheme } from '@/lib/entity-themes'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import {
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
  OnboardingFlow,
  OnboardingStage,
  OnboardingStep,
  OutreachActivity,
  Profile,
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
  if (percent >= 80) return { bar: 'from-emerald-500 to-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' }
  if (percent >= 40) return { bar: 'from-brand-600 to-brand-400', text: 'text-brand-700', bg: 'bg-brand-50' }
  if (percent >= 20) return { bar: 'from-amber-500 to-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' }
  return { bar: 'from-red-500 to-red-400', text: 'text-red-700', bg: 'bg-red-50' }
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
        onClick={() => setOpen(value => !value)}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Move
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-48 rounded-xl border border-surface-200 bg-surface-0 p-1 shadow-panel">
            {STAGE_ORDER.map(stage => (
              <button
                key={stage}
                onClick={() => handleStageChange(stage)}
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
  const { data: tasks } = useTasks()
  const { data: outreach } = useOutreach()

  // ── Filter state ──────────────────────────────────────────────
  const [cityFilter, setCityFilter] = React.useState('all')
  const [campaignFilter, setCampaignFilter] = React.useState('all')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [expandedChecklist, setExpandedChecklist] = React.useState<string | null>(null)

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className={`border ${businessTheme.border}`}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Pipeline</p>
            <p className="mt-1 text-2xl font-semibold text-surface-900">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className={`border ${businessTheme.border}`}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Active Build</p>
            <p className="mt-1 text-2xl font-semibold text-surface-900">{summary.onboarding}</p>
          </CardContent>
        </Card>
        <Card className={`border ${businessTheme.border}`}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Live</p>
            <p className="mt-1 text-2xl font-semibold text-surface-900">{summary.live}</p>
          </CardContent>
        </Card>
        <Card className={`border ${businessTheme.border}`}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Follow-ups</p>
            <p className="mt-1 text-2xl font-semibold text-surface-900">{summary.followUps}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-surface-0 py-2 pl-9 pr-3 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="all">All Cities</option>
            {cityOptions.map(city => (
              <option key={city.id} value={city.id}>{city.name}, {city.state}</option>
            ))}
          </select>
          <select
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
            className="rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-sm text-surface-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="all">All Campaigns</option>
            {campaignOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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

      {/* ── Stage groups ───────────────────────────────────────── */}
      <div className="space-y-8">
        {groupedBusinesses.map(group => (
          <section key={group.stage} className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={getStageBadgeVariant(group.stage)} dot>
                {ONBOARDING_STAGES[group.stage]?.label}
              </Badge>
              <span className="text-sm text-surface-500">{group.items.length} businesses</span>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {group.items.map(business => {
                const flow = flowByBusiness.get(business.id)
                const stakeholder = stakeholderByBusiness.get(business.id) || null
                const codes = stakeholder ? codesByStakeholder.get(stakeholder.id) || null : null
                const generated = stakeholder ? generatedByStakeholder.get(stakeholder.id) || [] : []
                const businessSteps = computeBusinessExecutionSteps({
                  business,
                  steps: stepsByFlow.get(flow?.id || '') || [],
                  codes,
                  generatedMaterials: generated,
                  qrCodes: qrByBusiness.get(business.id) || [],
                  offers: offersByBusiness.get(business.id) || [],
                  outreachCount: (outreachByBusiness.get(business.id) || []).length,
                })
                const metadata = business.metadata as Record<string, unknown> | null
                const checklist = computeBusinessOnboardingChecklist({
                  business,
                  steps: stepsByFlow.get(flow?.id || '') || [],
                  codes,
                  generatedMaterials: generated,
                  qrCodes: qrByBusiness.get(business.id) || [],
                  offers: offersByBusiness.get(business.id) || [],
                  outreachCount: (outreachByBusiness.get(business.id) || []).length,
                  completedTaskCount: tasks.filter(t => t.entity_type === 'business' && t.entity_id === business.id && t.status === 'completed').length,
                  hasOwner: !!business.owner_id,
                  hasCampaign: !!business.campaign_id,
                  hasLinkedCause: !!business.linked_cause_id,
                  hasLogo: !!(metadata?.logo_url),
                  hasCoverPhoto: !!(metadata?.cover_photo_url),
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

                const progressColors = getProgressColor(checklist.percent)

                return (
                  <Card key={business.id} className={`overflow-hidden border ${businessTheme.border}`}>
                    {/* ── Progress bar header ──────────────── */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-100 bg-surface-0">
                      <div className="flex-1 h-3 rounded-full bg-surface-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${progressColors.bar} transition-all duration-500 ease-out`}
                          style={{ width: `${checklist.percent}%` }}
                        />
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${progressColors.text}`}>
                        {checklist.percent}% ({checklist.completedCount}/{checklist.totalCount})
                      </span>
                      <button
                        onClick={() => setExpandedChecklist(expandedChecklist === business.id ? null : business.id)}
                        className="shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        View Checklist
                        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expandedChecklist === business.id ? 'rotate-90' : ''}`} />
                      </button>
                    </div>

                    {/* ── Business identity row ────────────── */}
                    <div className={`bg-gradient-to-r ${businessTheme.gradient} px-5 py-4`}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/crm/businesses/${business.id}`} className="text-lg font-semibold text-surface-900 transition-colors hover:text-brand-700">
                              {business.name}
                            </Link>
                            <Badge variant={getStageBadgeVariant(business.stage)} dot>
                              {ONBOARDING_STAGES[business.stage]?.label}
                            </Badge>
                            {business.category && (
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${businessTheme.badge}`}>
                                {business.category}
                              </span>
                            )}
                            {linkedCause && (
                              <Link href={`/crm/causes/${linkedCause.id}`} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${causeTheme.badge}`}>
                                {linkedCause.name}
                              </Link>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-surface-500">
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
                        <StageChanger business={business} onStageChanged={refetch} />
                      </div>
                    </div>

                    {/* ── Steps + Ownership columns ─────────── */}
                    <CardContent className="space-y-5 p-5">
                      <div className="grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
                        {/* Onboarding steps */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
                            <ClipboardList className="h-3.5 w-3.5" />
                            Onboarding Steps
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {businessSteps.map(step => (
                              <div
                                key={step.step.id}
                                className={`rounded-xl border px-3 py-2 text-sm ${
                                  step.state === 'completed'
                                    ? 'border-success-200 bg-success-50 text-success-700'
                                    : step.state === 'active'
                                    ? `border-amber-200 ${businessTheme.softSurface} ${businessTheme.mutedText}`
                                    : 'border-surface-200 bg-surface-50 text-surface-500'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      {step.state === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                                      <span className="font-medium">{step.label}</span>
                                    </div>
                                    {step.state === 'completed' && step.step.completed_at ? (
                                      <p className="text-xs">
                                        Completed {formatDateTime(step.step.completed_at)}
                                        {step.step.completed_by ? ` by ${profileMap.get(step.step.completed_by)?.full_name || 'a team member'}` : ''}
                                      </p>
                                    ) : step.blocker ? (
                                      <p className="text-xs">{step.blocker}</p>
                                    ) : (
                                      <p className="text-xs">
                                        {step.readyToComplete ? 'Ready to complete now.' : step.state === 'locked' ? 'Finish the earlier steps first.' : 'Open the next action area.'}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <Badge variant={step.state === 'completed' ? 'success' : step.state === 'active' ? 'warning' : 'default'}>
                                      {step.state}
                                    </Badge>
                                    {step.state === 'active' ? (
                                      step.readyToComplete ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => void handleCompleteStep(business.id, step.step.id)}
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
                        <div className="space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Ownership</p>
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

                      {/* ── Counters row ───────────────────────── */}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Tasks</p>
                          <p className="mt-1 text-xl font-semibold text-surface-900">{businessTasks.length}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Outreach</p>
                          <p className="mt-1 text-xl font-semibold text-surface-900">{businessOutreach.length}</p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Launch Assets</p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-surface-500">
                            <span className={`inline-flex items-center gap-1 ${business.linked_material_id ? 'text-surface-700' : 'text-surface-400'}`}>
                              <FileText className="h-3.5 w-3.5" /> Material
                            </span>
                            <span className={`inline-flex items-center gap-1 ${business.linked_qr_code_id || business.linked_qr_collection_id ? 'text-surface-700' : 'text-surface-400'}`}>
                              <QrCode className="h-3.5 w-3.5" /> QR
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ── Action buttons ─────────────────────── */}
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/crm/businesses/${business.id}`}>
                          <Button variant="outline" size="sm">
                            <Store className="h-3.5 w-3.5" /> Open CRM
                          </Button>
                        </Link>
                        <Link href={`/crm/scripts?business=${business.id}`}>
                          <Button size="sm">
                            <MessageSquare className="h-3.5 w-3.5" /> Script
                          </Button>
                        </Link>
                        <Link href={`/crm/outreach?business=${business.id}`}>
                          <Button variant="outline" size="sm">
                            <ArrowRight className="h-3.5 w-3.5" /> Log Outreach
                          </Button>
                        </Link>
                        <Link href={`/qr/generator?businessId=${business.id}&returnTo=${encodeURIComponent('/onboarding/business')}`}>
                          <Button variant="outline" size="sm">
                            <QrCode className="h-3.5 w-3.5" /> QR
                          </Button>
                        </Link>
                        {owner && (
                          <Link href={`/admin/users/${owner.id}`}>
                            <Button variant="outline" size="sm">
                              <Users className="h-3.5 w-3.5" /> Owner
                            </Button>
                          </Link>
                        )}
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
                    </CardContent>

                    {/* ── Expanded checklist ────────────────── */}
                    {expandedChecklist === business.id && (
                      <div className="border-t border-surface-200 bg-surface-50 p-5">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {checklist.items.map(item => (
                            <Link
                              key={item.id}
                              href={`${item.href}?tab=${item.tab}`}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                item.met
                                  ? 'text-success-700 hover:bg-success-50'
                                  : 'text-surface-600 hover:bg-surface-100'
                              }`}
                            >
                              {item.met ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" />
                              ) : (
                                <Circle className="h-4 w-4 shrink-0 text-surface-300" />
                              )}
                              <span className="flex-1">{item.label}</span>
                              {!item.met && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-surface-400" />}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
