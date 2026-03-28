'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileText,
  Heart,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  QrCode,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { computeBusinessExecutionSteps } from '@/lib/business-execution'
import { getEntityTheme } from '@/lib/entity-themes'
import { formatDate, formatDateTime } from '@/lib/utils'
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
        Move Stage
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

  const cityMap = React.useMemo(() => new Map(cities.map(city => [city.id, city])), [cities])
  const causeMap = React.useMemo(() => new Map(causes.map(cause => [cause.id, cause])), [causes])
  const campaignMap = React.useMemo(() => new Map(campaigns.map(campaign => [campaign.id, campaign])), [campaigns])
  const profileMap = React.useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles])

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

  const groupedBusinesses = React.useMemo(() => {
    return STAGE_ORDER.map(stage => ({
      stage,
      items: businesses.filter(business => business.stage === stage),
    })).filter(group => group.items.length > 0)
  }, [businesses])

  const summary = React.useMemo(() => {
    const live = businesses.filter(business => business.stage === 'live').length
    const onboarding = businesses.filter(business => business.stage === 'in_progress' || business.stage === 'onboarded').length
    const followUps = outreach.filter(activity =>
      activity.entity_type === 'business'
      && !!activity.next_step_date
      && new Date(activity.next_step_date).getTime() <= Date.now() + (1000 * 60 * 60 * 24 * 7)
    ).length
    const assigned = businesses.filter(business => assignmentsByBusiness.has(business.id)).length

    return { live, onboarding, followUps, assigned }
  }, [assignmentsByBusiness, businesses, outreach])

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

      <Card className={`overflow-hidden border ${businessTheme.border}`}>
        <div className={`bg-gradient-to-r ${businessTheme.gradient} px-6 py-6`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 shadow-sm ${businessTheme.icon}`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${businessTheme.text}`}>Business outreach should be obvious at a glance</p>
                <p className="mt-1 max-w-3xl text-sm text-surface-600">
                  Each business now shows ownership, helper assignments, onboarding steps, outreach pressure, and the direct links your team needs to keep momentum moving.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-amber-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Pipeline</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{businesses.length}</p>
              </div>
              <div className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-amber-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Active Build</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{summary.onboarding}</p>
              </div>
              <div className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-amber-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Live</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{summary.live}</p>
              </div>
              <div className="rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-amber-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Follow Ups</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{summary.followUps}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={`border ${businessTheme.border} ${businessTheme.surface}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${businessTheme.icon}`}>
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Assigned Outreach</p>
                <p className="text-lg font-semibold text-surface-900">{summary.assigned} businesses covered</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border ${causeTheme.border} ${causeTheme.surface}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${causeTheme.icon}`}>
                <Heart className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">School / Cause Links</p>
                <p className="text-lg font-semibold text-surface-900">
                  {businesses.filter(business => !!business.linked_cause_id).length} businesses linked to a local cause
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Next Best Action</p>
              <p className="mt-1 text-lg font-semibold text-surface-900">Use scripts before the next follow-up</p>
              <p className="mt-1 text-sm text-surface-500">Jump straight into the script engine for any business below.</p>
            </div>
            <Link href="/crm/scripts">
              <Button>
                Open Scripts <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

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
                const latestOutreach = businessOutreach[0]
                const nextFollowUp = businessOutreach
                  .filter(activity => activity.next_step || activity.next_step_date)
                  .slice()
                  .sort((left, right) => {
                    const leftTime = left.next_step_date ? new Date(left.next_step_date).getTime() : Number.MAX_SAFE_INTEGER
                    const rightTime = right.next_step_date ? new Date(right.next_step_date).getTime() : Number.MAX_SAFE_INTEGER
                    return leftTime - rightTime
                  })[0]
                const dueTask = businessTasks
                  .slice()
                  .sort((left, right) => new Date(left.due_date || 0).getTime() - new Date(right.due_date || 0).getTime())[0]

                return (
                  <Card key={business.id} className={`overflow-hidden border ${businessTheme.border}`}>
                    <div className={`bg-gradient-to-r ${businessTheme.gradient} px-5 py-4`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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

                    <CardContent className="space-y-5 p-5">
                      <div className="grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
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
                                            Open CRM
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

                        <div className="space-y-3 rounded-2xl border border-surface-200 bg-surface-50 p-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Ownership</p>
                            {owner ? (
                              <Link href={`/admin/users/${owner.id}`} className="mt-2 inline-flex text-sm font-semibold text-surface-900 transition-colors hover:text-brand-700">
                                {owner.full_name}
                              </Link>
                            ) : (
                              <p className="mt-2 text-sm font-semibold text-surface-900">Unassigned owner</p>
                            )}
                            <p className="text-xs text-surface-500">
                              {owner ? 'Primary outreach owner' : 'Needs a clear owner'}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Assigned Helpers</p>
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
                                <span className="text-xs text-surface-400">No helpers assigned yet</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Open Tasks</p>
                          <p className="mt-1 text-xl font-semibold text-surface-900">{businessTasks.length}</p>
                          <p className="mt-1 text-xs text-surface-500">
                            {dueTask?.due_date ? `Next due ${formatDate(dueTask.due_date)}` : 'No due date set'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Outreach Activity</p>
                          <p className="mt-1 text-xl font-semibold text-surface-900">{businessOutreach.length}</p>
                          <p className="mt-1 text-xs text-surface-500">
                            {latestOutreach ? `${latestOutreach.type.replace('_', ' ')} · ${formatDate(latestOutreach.created_at)}` : 'No outreach logged yet'}
                          </p>
                          <p className="mt-1 text-xs text-surface-500">
                            {nextFollowUp?.next_step
                              ? `${nextFollowUp.next_step}${nextFollowUp.next_step_date ? ` by ${formatDate(nextFollowUp.next_step_date)}` : ''}`
                              : 'No follow-up scheduled'}
                          </p>
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

                      <div className="flex flex-wrap gap-2">
                        <Link href={`/crm/businesses/${business.id}`}>
                          <Button variant="outline" size="sm">
                            <Store className="h-3.5 w-3.5" /> Open CRM
                          </Button>
                        </Link>
                        <Link href={`/crm/scripts?business=${business.id}`}>
                          <Button size="sm">
                            <MessageSquare className="h-3.5 w-3.5" /> Generate Script
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
                              <ArrowRight className="h-3.5 w-3.5" /> Campaign
                            </Button>
                          </Link>
                        )}
                        {city && (
                          <Link href={`/crm/cities/${city.id}`}>
                            <Button variant="outline" size="sm">
                              <MapPin className="h-3.5 w-3.5" /> City Progress
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
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
