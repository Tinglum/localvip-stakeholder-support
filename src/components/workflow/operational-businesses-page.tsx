'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Building2, Loader2, MapPin, QrCode, Search, Sparkles, Store } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth/context'
import {
  buildBusinessQueueState,
  formatDueLabel,
  getAccessibleCityIds,
  getAccessibleEntitySummary,
  getLaunchPhaseLabel,
  getUrgencyVariant,
  getWorkflowStageOptions,
  isEntityVisibleInCityScope,
  parseWorkflowAssignmentMetadata,
  toAssignmentPatch,
} from '@/lib/claimed-stakeholder-workflow'
import { getBusinessAvgTicket, getBusinessDescription, getBusinessProducts } from '@/lib/business-portal'
import {
  useAuditLogInsert,
  useBusinesses,
  useBusinessUpdate,
  useCities,
  useContacts,
  useOutreach,
  useStakeholderAssignmentDelete,
  useStakeholderAssignmentInsert,
  useStakeholderAssignments,
  useStakeholderAssignmentUpdate,
  useTaskInsert,
  useTasks,
} from '@/lib/supabase/hooks'
import { ClaimWorkflowEditor, type ClaimWorkflowEditorValues } from '@/components/workflow/claim-workflow-editor'
import type { Business, StakeholderAssignment } from '@/lib/types/database'

interface OperationalBusinessesPageProps {
  mode: 'field' | 'launch_partner'
}

type BusinessFilter = 'all' | 'needs_contact' | 'waiting_on_assets' | 'setup_in_progress' | 'ready_to_go_live' | 'live' | 'blocked'

const FILTER_LABELS: Record<BusinessFilter, string> = {
  all: 'All claimed businesses',
  needs_contact: 'Needs contact',
  waiting_on_assets: 'Waiting on assets',
  setup_in_progress: 'Setup in progress',
  ready_to_go_live: 'Ready to go live',
  live: 'Live',
  blocked: 'Blocked / waiting',
}

function matchBusinessFilter(stage: string, filter: BusinessFilter, blockedReason: string | null) {
  if (filter === 'all') return true
  if (filter === 'blocked') return !!blockedReason
  if (filter === 'needs_contact') return ['claimed', 'first_outreach_sent', 'contact_made'].includes(stage)
  if (filter === 'waiting_on_assets') return stage === 'awaiting_assets'
  if (filter === 'setup_in_progress') return ['interested', 'profile_setup_needed', 'capture_offer_setup', 'cashback_offer_setup'].includes(stage)
  if (filter === 'ready_to_go_live') return stage === 'ready_to_go_live'
  return stage === 'live'
}

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

export function OperationalBusinessesPage({ mode }: OperationalBusinessesPageProps) {
  const { profile, roleLabel } = useAuth()
  const { data: businesses, loading: businessesLoading, refetch: refetchBusinesses } = useBusinesses()
  const { data: cities } = useCities()
  const { data: contacts } = useContacts()
  const { data: cityAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'city' })
  const { data: claimedAssignments, refetch: refetchAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'business' })
  const { data: tasks, refetch: refetchTasks } = useTasks({ assigned_to: profile.id })
  const { data: outreach, refetch: refetchOutreach } = useOutreach({ performed_by: profile.id })
  const { insert: insertAssignment, loading: claimLoading, error: claimError } = useStakeholderAssignmentInsert()
  const { update: updateAssignment, loading: updateLoading, error: updateError } = useStakeholderAssignmentUpdate()
  const { remove: removeAssignment } = useStakeholderAssignmentDelete()
  const { update: updateBusiness } = useBusinessUpdate()
  const { insert: insertTask } = useTaskInsert()
  const { insert: insertAuditLog } = useAuditLogInsert()
  const [filter, setFilter] = React.useState<BusinessFilter>('all')
  const [search, setSearch] = React.useState('')
  const [statusMessageById, setStatusMessageById] = React.useState<Record<string, string>>({})

  const accessibleCityIds = React.useMemo(
    () => getAccessibleCityIds(profile, cityAssignments),
    [cityAssignments, profile]
  )

  const cityMap = React.useMemo(() => new Map(cities.map((city) => [city.id, `${city.name}, ${city.state}`])), [cities])
  const contactsByBusiness = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const contact of contacts) {
      if (!contact.business_id) continue
      map.set(contact.business_id, (map.get(contact.business_id) || 0) + 1)
    }
    return map
  }, [contacts])

  const tasksByBusiness = React.useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const task of tasks) {
      if (task.entity_type !== 'business' || !task.entity_id) continue
      map.set(task.entity_id, [...(map.get(task.entity_id) || []), task])
    }
    return map
  }, [tasks])

  const outreachByBusiness = React.useMemo(() => {
    const map = new Map<string, typeof outreach>()
    for (const item of outreach) {
      if (!item.business_id) continue
      map.set(item.business_id, [...(map.get(item.business_id) || []), item])
    }
    return map
  }, [outreach])

  const assignmentMap = React.useMemo(() => {
    const map = new Map<string, StakeholderAssignment>()
    for (const assignment of claimedAssignments) {
      if (assignment.status !== 'active') continue
      map.set(assignment.entity_id, assignment)
    }
    return map
  }, [claimedAssignments])

  const scopedBusinesses = React.useMemo(
    () => businesses.filter((business) => isEntityVisibleInCityScope(business.city_id, accessibleCityIds)),
    [accessibleCityIds, businesses]
  )

  const searchNeedle = search.trim().toLowerCase()
  const claimableBusinesses = React.useMemo(() => {
    return scopedBusinesses.filter((business) => {
      const haystack = [
        business.name,
        business.category,
        business.address,
        business.city_id ? cityMap.get(business.city_id) : '',
        getBusinessProducts(business).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return !searchNeedle || haystack.includes(searchNeedle)
    })
  }, [cityMap, scopedBusinesses, searchNeedle])

  const claimedBusinesses = React.useMemo(() => {
    return claimableBusinesses
      .filter((business) => assignmentMap.has(business.id))
      .map((business) => {
        const assignment = assignmentMap.get(business.id) || null
        const queue = buildBusinessQueueState({
          business,
          assignment,
          contactsCount: contactsByBusiness.get(business.id) || 0,
          tasks: tasksByBusiness.get(business.id) || [],
          outreach: outreachByBusiness.get(business.id) || [],
        })

        return {
          business,
          assignment,
          queue,
          metadata: parseWorkflowAssignmentMetadata(assignment),
        }
      })
      .filter((item) => matchBusinessFilter(item.queue.workflowStage, filter, item.queue.blockedReason))
      .sort((left, right) => {
        const urgencyWeight = { blocked: 0, overdue: 1, today: 2, upcoming: 3, on_track: 4 }
        const urgencyGap = urgencyWeight[left.queue.urgency] - urgencyWeight[right.queue.urgency]
        if (urgencyGap !== 0) return urgencyGap
        return (left.queue.nextActionDueDate || '').localeCompare(right.queue.nextActionDueDate || '')
      })
  }, [assignmentMap, claimableBusinesses, contactsByBusiness, filter, outreachByBusiness, tasksByBusiness])

  const availableBusinesses = React.useMemo(
    () => claimableBusinesses.filter((business) => !assignmentMap.has(business.id)),
    [assignmentMap, claimableBusinesses]
  )

  async function refreshAll() {
    refetchAssignments({ silent: true })
    refetchBusinesses({ silent: true })
    refetchTasks({ silent: true })
    refetchOutreach({ silent: true })
  }

  async function upsertWorkflow(business: Business, values: ClaimWorkflowEditorValues, assignment?: StakeholderAssignment | null) {
    const patch = toAssignmentPatch('business', {
      ...values,
      claimedByRole: roleLabel,
    })

    const nextTaskTitle = values.nextAction.trim() || 'Next business step'
    const auditBase = {
      entity_type: 'business',
      entity_id: business.id,
      user_id: profile.id,
    }

    if (assignment) {
      const savedAssignment = await updateAssignment(assignment.id, {
        role: patch.role,
        status: patch.status,
        claimed_at: assignment.claimed_at || patch.claimed_at,
        next_action: patch.next_action,
        next_action_due_date: patch.next_action_due_date,
        metadata: {
          ...(assignment.metadata || {}),
          ...(patch.metadata || {}),
        },
      })

      if (!savedAssignment) throw new Error(updateError || 'Unable to save workflow right now.')
    } else {
      const insertedAssignment = await insertAssignment({
        stakeholder_id: profile.id,
        entity_type: 'business',
        entity_id: business.id,
        assigned_by: profile.id,
        role: patch.role,
        status: patch.status,
        claimed_at: patch.claimed_at,
        next_action: patch.next_action,
        next_action_due_date: patch.next_action_due_date,
        metadata: (patch.metadata ? { ...patch.metadata } : {}) as Record<string, unknown>,
      })

      if (!insertedAssignment) throw new Error(claimError || 'This business may already be claimed or outside your scope.')

      await insertTask({
        title: nextTaskTitle,
        description: `Claimed workflow step for ${business.name}.`,
        priority: 'high',
        status: 'pending',
        assigned_to: profile.id,
        created_by: profile.id,
        entity_type: 'business',
        entity_id: business.id,
        due_date: patch.next_action_due_date,
        metadata: {
          source: 'claimed_stakeholder_workflow',
          workflow_stage: values.workflowStage,
        },
      })
    }

    await updateBusiness(business.id, {
      stage: patch.entityStage,
    })

    await insertAuditLog({
      ...auditBase,
      action: assignment ? 'workflow.business.updated' : 'workflow.business.claimed',
      old_values: (assignment ? { ...assignment } : null) as Record<string, unknown> | null,
      new_values: {
        workflow_stage: values.workflowStage,
        next_action: patch.next_action,
        next_action_due_date: patch.next_action_due_date,
        blocked_reason: values.blockedReason || null,
      } as Record<string, unknown>,
      metadata: {
        role_shell: mode,
      },
    })

    setStatusMessageById((current) => ({
      ...current,
      [business.id]: assignment ? 'Workflow saved.' : 'Business claimed and moved into your queue.',
    }))
    await refreshAll()
  }

  async function releaseClaim(business: Business, assignment: StakeholderAssignment) {
    await removeAssignment(assignment.id)
    await insertAuditLog({
      user_id: profile.id,
      action: 'workflow.business.released',
      entity_type: 'business',
      entity_id: business.id,
      old_values: { ...assignment } as Record<string, unknown>,
      new_values: null,
      metadata: {
        role_shell: mode,
      },
    })
    setStatusMessageById((current) => ({
      ...current,
      [business.id]: 'Claim released.',
    }))
    await refreshAll()
  }

  const loading = businessesLoading

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === 'launch_partner' ? 'City Business Workflow' : 'My Claimed Businesses'}
        description={mode === 'launch_partner'
          ? 'Claim businesses in your approved cities, move them through onboarding, and keep the next step obvious.'
          : 'Claim businesses in your approved city footprint and work them through the next real onboarding step.'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/crm/scripts">
                Open Script Wizard
                <Sparkles className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/materials/mine">
                Relevant Materials
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-brand-100 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.11),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] shadow-panel">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <Badge variant="info" className="w-fit">Claimed stakeholder workflow</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-surface-900">
              Role sets access. Claim sets responsibility. Stage sets the next action.
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-surface-600">
              {getAccessibleEntitySummary(profile, 'business')} Every claimed business should carry a stage, next action, due date, and any blocker so your dashboard behaves like a real execution queue instead of a passive list.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Claimed" value={claimedBusinesses.length} icon={<Store className="h-5 w-5" />} />
            <StatCard label="Blocked" value={claimedBusinesses.filter((item) => !!item.queue.blockedReason).length} icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard label="Ready to go live" value={claimedBusinesses.filter((item) => item.queue.workflowStage === 'ready_to_go_live').length} icon={<QrCode className="h-5 w-5" />} />
            <StatCard label="Live" value={claimedBusinesses.filter((item) => item.queue.workflowStage === 'live').length} icon={<Building2 className="h-5 w-5" />} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_15rem]">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-surface-400">Search businesses in scope</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, category, area, or product..." className="pl-9" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-surface-400">Stage filter</label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as BusinessFilter)}
              className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
            >
              {Object.entries(FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Claimed businesses</CardTitle>
            <CardDescription>These are the businesses you currently own from the next-step perspective.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-surface-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading business workflow...
              </div>
            ) : claimedBusinesses.length === 0 ? (
              <EmptyState
                icon={<Store className="h-8 w-8" />}
                title="No claimed businesses yet"
                description="Claim a business from your city scope to make it show up in your work queue."
              />
            ) : (
              claimedBusinesses.map(({ business, assignment, queue, metadata }) => {
                const contactsCount = contactsByBusiness.get(business.id) || 0
                const launchPhase = business.launch_phase

                return (
                  <div key={business.id} className="rounded-3xl border border-surface-200 bg-surface-0 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-surface-900">{business.name}</p>
                          <Badge variant={getUrgencyVariant(queue.urgency)}>{queue.urgencyLabel}</Badge>
                          <Badge variant="info">{queue.workflowLabel}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-surface-500">{business.category || 'Local business'} / {business.city_id ? cityMap.get(business.city_id) || 'City not set' : 'City not set'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Launch phase</p>
                        <p className="mt-1 text-sm font-medium text-surface-800">{getLaunchPhaseLabel(launchPhase)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl bg-surface-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Average spend</p>
                        <p className="mt-2 text-sm font-medium text-surface-800">{getBusinessAvgTicket(business) || 'Still missing'}</p>
                      </div>
                      <div className="rounded-2xl bg-surface-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">100-list progress</p>
                        <p className="mt-2 text-sm font-medium text-surface-800">{contactsCount} / 100</p>
                      </div>
                      <div className="rounded-2xl bg-surface-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Due</p>
                        <p className="mt-2 text-sm font-medium text-surface-800">{formatDueLabel(queue.nextActionDueDate)}</p>
                      </div>
                      <div className="rounded-2xl bg-surface-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Last activity</p>
                        <p className="mt-2 text-sm font-medium text-surface-800">{queue.lastActivityLabel}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Current next action</p>
                      <p className="mt-2 text-sm leading-6 text-surface-700">{queue.nextAction}</p>
                      {queue.blockedReason && (
                        <p className="mt-3 text-sm font-medium text-danger-600">Blocked: {queue.blockedReason}</p>
                      )}
                      {queue.waitingOn && (
                        <p className="mt-1 text-xs text-surface-500">Waiting on: {queue.waitingOn}</p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`/crm/scripts?business=${encodeURIComponent(business.id)}`}>
                          Script for this business
                          <Sparkles className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/crm/businesses/${business.id}`}>
                          Open business record
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/materials/mine">
                          Materials
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>

                    <div className="mt-4">
                      <ClaimWorkflowEditor
                        entityType="business"
                        claimed
                        stageOptions={getWorkflowStageOptions('business')}
                        initialValues={{
                          workflowStage: queue.workflowStage,
                          nextAction: queue.nextAction,
                          nextActionDueDate: toDateInput(queue.nextActionDueDate),
                          blockedReason: queue.blockedReason || '',
                          waitingOn: queue.waitingOn || '',
                          claimContext: typeof metadata.claim_context === 'string' ? metadata.claim_context : '',
                        }}
                        onClaim={async () => {}}
                        onSave={(values) => upsertWorkflow(business, values, assignment)}
                        onRelease={() => releaseClaim(business, assignment!)}
                        statusMessage={statusMessageById[business.id] || null}
                      />
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Products / services</p>
                        <p className="mt-2 text-sm leading-6 text-surface-700">{getBusinessProducts(business).join(', ') || 'Still missing from profile'}</p>
                      </div>
                      <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Profile summary</p>
                        <p className="mt-2 text-sm leading-6 text-surface-700">{getBusinessDescription(business)}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available in your scope</CardTitle>
            <CardDescription>Claim the next businesses that should move through onboarding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableBusinesses.length === 0 ? (
              <EmptyState
                icon={<MapPin className="h-8 w-8" />}
                title="Nothing new to claim right now"
                description="Everything visible in your city scope is already in your queue, or you need more city access."
              />
            ) : (
              availableBusinesses.slice(0, 12).map((business) => {
                const queue = buildBusinessQueueState({
                  business,
                  contactsCount: contactsByBusiness.get(business.id) || 0,
                  tasks: [],
                  outreach: [],
                })

                return (
                  <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{business.name}</p>
                        <p className="mt-1 text-xs text-surface-500">{business.category || 'Local business'} / {business.city_id ? cityMap.get(business.city_id) || 'City not set' : 'City not set'}</p>
                      </div>
                      <Badge variant="outline">{queue.workflowLabel}</Badge>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-surface-600">{queue.nextAction}</p>

                    <div className="mt-4">
                      <ClaimWorkflowEditor
                        entityType="business"
                        claimed={false}
                        stageOptions={getWorkflowStageOptions('business')}
                        initialValues={{
                          workflowStage: queue.workflowStage,
                          nextAction: queue.nextAction,
                          nextActionDueDate: '',
                          blockedReason: '',
                          waitingOn: '',
                          claimContext: '',
                        }}
                        onClaim={(values) => upsertWorkflow(business, values, null)}
                        onSave={async () => {}}
                        onRelease={async () => {}}
                        disabled={claimLoading || updateLoading}
                        statusMessage={statusMessageById[business.id] || null}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
