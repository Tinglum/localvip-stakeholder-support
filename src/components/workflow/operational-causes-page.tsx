'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Heart, Loader2, MapPin, Megaphone, School, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth/context'
import {
  buildCauseQueueState,
  formatDueLabel,
  getAccessibleCityIds,
  getAccessibleEntitySummary,
  getUrgencyVariant,
  getWorkflowStageOptions,
  isEntityVisibleInCityScope,
  parseWorkflowAssignmentMetadata,
  toAssignmentPatch,
} from '@/lib/claimed-stakeholder-workflow'
import {
  useAuditLogInsert,
  useCauses,
  useCauseUpdate,
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
import type { Cause, StakeholderAssignment } from '@/lib/types/database'

interface OperationalCausesPageProps {
  mode: 'field' | 'launch_partner'
}

type CauseFilter = 'all' | 'intro_needed' | 'materials_needed' | 'outreach_in_progress' | 'activation_blocked' | 'live'

const FILTER_LABELS: Record<CauseFilter, string> = {
  all: 'All claimed schools / causes',
  intro_needed: 'Intro needed',
  materials_needed: 'Materials needed',
  outreach_in_progress: 'Outreach in progress',
  activation_blocked: 'Activation blocked',
  live: 'Live',
}

function matchCauseFilter(stage: string, filter: CauseFilter, blockedReason: string | null) {
  if (filter === 'all') return true
  if (filter === 'activation_blocked') return !!blockedReason || ['business_connections_needed', 'ready_to_activate'].includes(stage)
  if (filter === 'intro_needed') return ['claimed', 'intro_made', 'meeting_needed'].includes(stage)
  if (filter === 'materials_needed') return ['interested', 'materials_shared'].includes(stage)
  if (filter === 'outreach_in_progress') return ['parent_pta_outreach_started', 'business_connections_needed', 'ready_to_activate'].includes(stage)
  return stage === 'live'
}

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

export function OperationalCausesPage({ mode }: OperationalCausesPageProps) {
  const { profile, roleLabel } = useAuth()
  const { data: causes, loading: causesLoading, refetch: refetchCauses } = useCauses()
  const { data: cities } = useCities()
  const { data: contacts } = useContacts()
  const { data: cityAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'city' })
  const { data: claimedAssignments, refetch: refetchAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'cause' })
  const { data: tasks, refetch: refetchTasks } = useTasks({ assigned_to: profile.id })
  const { data: outreach, refetch: refetchOutreach } = useOutreach({ performed_by: profile.id })
  const { insert: insertAssignment, loading: claimLoading, error: claimError } = useStakeholderAssignmentInsert()
  const { update: updateAssignment, loading: updateLoading, error: updateError } = useStakeholderAssignmentUpdate()
  const { remove: removeAssignment } = useStakeholderAssignmentDelete()
  const { update: updateCause } = useCauseUpdate()
  const { insert: insertTask } = useTaskInsert()
  const { insert: insertAuditLog } = useAuditLogInsert()
  const [filter, setFilter] = React.useState<CauseFilter>('all')
  const [search, setSearch] = React.useState('')
  const [statusMessageById, setStatusMessageById] = React.useState<Record<string, string>>({})

  const accessibleCityIds = React.useMemo(
    () => getAccessibleCityIds(profile, cityAssignments),
    [cityAssignments, profile]
  )
  const cityMap = React.useMemo(() => new Map(cities.map((city) => [city.id, `${city.name}, ${city.state}`])), [cities])
  const supportersByCause = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const contact of contacts) {
      if (!contact.cause_id) continue
      map.set(contact.cause_id, (map.get(contact.cause_id) || 0) + 1)
    }
    return map
  }, [contacts])
  const tasksByCause = React.useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const task of tasks) {
      if (task.entity_type !== 'cause' || !task.entity_id) continue
      map.set(task.entity_id, [...(map.get(task.entity_id) || []), task])
    }
    return map
  }, [tasks])
  const outreachByCause = React.useMemo(() => {
    const map = new Map<string, typeof outreach>()
    for (const item of outreach) {
      if (!item.cause_id) continue
      map.set(item.cause_id, [...(map.get(item.cause_id) || []), item])
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

  const scopedCauses = React.useMemo(
    () => causes.filter((cause) => isEntityVisibleInCityScope(cause.city_id, accessibleCityIds)),
    [accessibleCityIds, causes]
  )

  const searchNeedle = search.trim().toLowerCase()
  const visibleCauses = React.useMemo(() => {
    return scopedCauses.filter((cause) => {
      const haystack = [
        cause.name,
        cause.type,
        cause.address,
        cause.city_id ? cityMap.get(cause.city_id) : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return !searchNeedle || haystack.includes(searchNeedle)
    })
  }, [cityMap, scopedCauses, searchNeedle])

  const claimedCauses = React.useMemo(() => {
    return visibleCauses
      .filter((cause) => assignmentMap.has(cause.id))
      .map((cause) => {
        const assignment = assignmentMap.get(cause.id) || null
        const queue = buildCauseQueueState({
          cause,
          assignment,
          tasks: tasksByCause.get(cause.id) || [],
          outreach: outreachByCause.get(cause.id) || [],
        })

        return {
          cause,
          assignment,
          queue,
          metadata: parseWorkflowAssignmentMetadata(assignment),
        }
      })
      .filter((item) => matchCauseFilter(item.queue.workflowStage, filter, item.queue.blockedReason))
      .sort((left, right) => {
        const urgencyWeight = { blocked: 0, overdue: 1, today: 2, upcoming: 3, on_track: 4 }
        const urgencyGap = urgencyWeight[left.queue.urgency] - urgencyWeight[right.queue.urgency]
        if (urgencyGap !== 0) return urgencyGap
        return (left.queue.nextActionDueDate || '').localeCompare(right.queue.nextActionDueDate || '')
      })
  }, [assignmentMap, filter, outreachByCause, tasksByCause, visibleCauses])

  const availableCauses = React.useMemo(
    () => visibleCauses.filter((cause) => !assignmentMap.has(cause.id)),
    [assignmentMap, visibleCauses]
  )

  async function refreshAll() {
    refetchAssignments({ silent: true })
    refetchCauses({ silent: true })
    refetchTasks({ silent: true })
    refetchOutreach({ silent: true })
  }

  async function upsertWorkflow(cause: Cause, values: ClaimWorkflowEditorValues, assignment?: StakeholderAssignment | null) {
    const patch = toAssignmentPatch('cause', {
      ...values,
      claimedByRole: roleLabel,
    })

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
        entity_type: 'cause',
        entity_id: cause.id,
        assigned_by: profile.id,
        role: patch.role,
        status: patch.status,
        claimed_at: patch.claimed_at,
        next_action: patch.next_action,
        next_action_due_date: patch.next_action_due_date,
        metadata: (patch.metadata ? { ...patch.metadata } : {}) as Record<string, unknown>,
      })

      if (!insertedAssignment) throw new Error(claimError || 'This school or cause may already be claimed or outside your scope.')

      await insertTask({
        title: patch.next_action || 'Next school / cause step',
        description: `Claimed workflow step for ${cause.name}.`,
        priority: 'high',
        status: 'pending',
        assigned_to: profile.id,
        created_by: profile.id,
        entity_type: 'cause',
        entity_id: cause.id,
        due_date: patch.next_action_due_date,
        metadata: {
          source: 'claimed_stakeholder_workflow',
          workflow_stage: values.workflowStage,
        },
      })
    }

    await updateCause(cause.id, {
      stage: patch.entityStage,
    })

    await insertAuditLog({
      user_id: profile.id,
      action: assignment ? 'workflow.cause.updated' : 'workflow.cause.claimed',
      entity_type: 'cause',
      entity_id: cause.id,
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
      [cause.id]: assignment ? 'Workflow saved.' : 'School / cause claimed and added to your queue.',
    }))
    await refreshAll()
  }

  async function releaseClaim(cause: Cause, assignment: StakeholderAssignment) {
    await removeAssignment(assignment.id)
    await insertAuditLog({
      user_id: profile.id,
      action: 'workflow.cause.released',
      entity_type: 'cause',
      entity_id: cause.id,
      old_values: { ...assignment } as Record<string, unknown>,
      new_values: null,
      metadata: {
        role_shell: mode,
      },
    })
    setStatusMessageById((current) => ({
      ...current,
      [cause.id]: 'Claim released.',
    }))
    await refreshAll()
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={mode === 'launch_partner' ? 'City Community Workflow' : 'My Schools / Causes'}
        description={mode === 'launch_partner'
          ? 'Claim schools and causes in your approved cities and keep the activation queue moving.'
          : 'Claim the schools and causes you are personally moving forward, then keep each next step visible.'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/crm/outreach">
                Log Outreach
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/materials/mine">
                Community Materials
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-brand-100 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.11),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,253,244,0.96))] shadow-panel">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <Badge variant="success" className="w-fit">Claimed school / cause workflow</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-surface-900">
              Work the community side with the same discipline as the business side.
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-surface-600">
              {getAccessibleEntitySummary(profile, 'cause')} Each claimed school or cause should show the current stage, the next required action, and anything blocking activation so you always know what to move next.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Claimed" value={claimedCauses.length} icon={<School className="h-5 w-5" />} />
            <StatCard label="Blocked" value={claimedCauses.filter((item) => !!item.queue.blockedReason).length} icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard label="Ready to activate" value={claimedCauses.filter((item) => item.queue.workflowStage === 'ready_to_activate').length} icon={<Megaphone className="h-5 w-5" />} />
            <StatCard label="Live" value={claimedCauses.filter((item) => item.queue.workflowStage === 'live').length} icon={<Heart className="h-5 w-5" />} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_15rem]">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-surface-400">Search schools / causes in scope</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, type, city, or area..." className="pl-9" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-surface-400">Stage filter</label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as CauseFilter)}
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
            <CardTitle>Claimed schools / causes</CardTitle>
            <CardDescription>The community organizations you currently own from the next-step perspective.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {causesLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-surface-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading community workflow...
              </div>
            ) : claimedCauses.length === 0 ? (
              <EmptyState
                icon={<School className="h-8 w-8" />}
                title="No claimed schools or causes yet"
                description="Claim one from your approved city footprint to make it part of your work queue."
              />
            ) : (
              claimedCauses.map(({ cause, assignment, queue, metadata }) => (
                <div key={cause.id} className="rounded-3xl border border-surface-200 bg-surface-0 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-surface-900">{cause.name}</p>
                        <Badge variant={getUrgencyVariant(queue.urgency)}>{queue.urgencyLabel}</Badge>
                        <Badge variant="info">{queue.workflowLabel}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-surface-500">{cause.type || 'School / cause'} / {cause.city_id ? cityMap.get(cause.city_id) || 'City not set' : 'City not set'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Supporters</p>
                      <p className="mt-1 text-sm font-medium text-surface-800">{supportersByCause.get(cause.id) || 0}</p>
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

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-surface-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Due</p>
                      <p className="mt-2 text-sm font-medium text-surface-800">{formatDueLabel(queue.nextActionDueDate)}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Last activity</p>
                      <p className="mt-2 text-sm font-medium text-surface-800">{queue.lastActivityLabel}</p>
                    </div>
                    <div className="rounded-2xl bg-surface-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Type</p>
                      <p className="mt-2 text-sm font-medium text-surface-800">{cause.type || 'Community'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/crm/causes/${cause.id}`}>
                        Open record
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/crm/outreach">
                        Log outreach
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
                      entityType="cause"
                      claimed
                      stageOptions={getWorkflowStageOptions('cause')}
                      initialValues={{
                        workflowStage: queue.workflowStage,
                        nextAction: queue.nextAction,
                        nextActionDueDate: toDateInput(queue.nextActionDueDate),
                        blockedReason: queue.blockedReason || '',
                        waitingOn: queue.waitingOn || '',
                        claimContext: typeof metadata.claim_context === 'string' ? metadata.claim_context : '',
                      }}
                      onClaim={async () => {}}
                      onSave={(values) => upsertWorkflow(cause, values, assignment)}
                      onRelease={() => releaseClaim(cause, assignment!)}
                      statusMessage={statusMessageById[cause.id] || null}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available in your scope</CardTitle>
            <CardDescription>Claim the next school or cause that should move through activation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableCauses.length === 0 ? (
              <EmptyState
                icon={<MapPin className="h-8 w-8" />}
                title="Nothing new to claim right now"
                description="Everything visible in your city scope is already in your queue, or you need more city access."
              />
            ) : (
              availableCauses.slice(0, 12).map((cause) => {
                const queue = buildCauseQueueState({ cause })

                return (
                  <div key={cause.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{cause.name}</p>
                        <p className="mt-1 text-xs text-surface-500">{cause.type || 'School / cause'} / {cause.city_id ? cityMap.get(cause.city_id) || 'City not set' : 'City not set'}</p>
                      </div>
                      <Badge variant="outline">{queue.workflowLabel}</Badge>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-surface-600">{queue.nextAction}</p>

                    <div className="mt-4">
                      <ClaimWorkflowEditor
                        entityType="cause"
                        claimed={false}
                        stageOptions={getWorkflowStageOptions('cause')}
                        initialValues={{
                          workflowStage: queue.workflowStage,
                          nextAction: queue.nextAction,
                          nextActionDueDate: '',
                          blockedReason: '',
                          waitingOn: '',
                          claimContext: '',
                        }}
                        onClaim={(values) => upsertWorkflow(cause, values, null)}
                        onSave={async () => {}}
                        onRelease={async () => {}}
                        disabled={claimLoading || updateLoading}
                        statusMessage={statusMessageById[cause.id] || null}
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
