'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Heart,
  Loader2,
  Sparkles,
  Target,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { StakeholderActionQueue } from '@/components/dashboard/stakeholder-action-queue'
import { useAuth } from '@/lib/auth/context'
import {
  buildBusinessQueueState,
  buildCauseQueueState,
  formatDueLabel,
  getAccessibleCityIds,
  getUrgencyVariant,
} from '@/lib/claimed-stakeholder-workflow'
import { useBusinesses, useCauses, useCities, useContacts, useOutreach, useOutreachScripts, useStakeholderAssignments, useTasks } from '@/lib/supabase/hooks'

export function FieldOutreachDashboardPage() {
  const { profile } = useAuth()
  const { data: cities } = useCities()
  const { data: businesses, loading: businessesLoading } = useBusinesses()
  const { data: causes, loading: causesLoading } = useCauses()
  const { data: contacts } = useContacts()
  const { data: cityAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'city' })
  const { data: businessAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'business' })
  const { data: causeAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'cause' })
  const { data: tasks, loading: tasksLoading } = useTasks({ assigned_to: profile.id })
  const { data: outreach, loading: outreachLoading } = useOutreach({ performed_by: profile.id })
  const { data: scripts, loading: scriptsLoading } = useOutreachScripts({ created_by: profile.id })

  const accessibleCityIds = React.useMemo(
    () => getAccessibleCityIds(profile, cityAssignments),
    [cityAssignments, profile]
  )
  const cityMap = React.useMemo(() => new Map(cities.map((city) => [city.id, `${city.name}, ${city.state}`])), [cities])

  const businessAssignmentMap = React.useMemo(() => {
    const map = new Map<string, (typeof businessAssignments)[number]>()
    for (const assignment of businessAssignments) {
      if (assignment.status === 'active') map.set(assignment.entity_id, assignment)
    }
    return map
  }, [businessAssignments])

  const causeAssignmentMap = React.useMemo(() => {
    const map = new Map<string, (typeof causeAssignments)[number]>()
    for (const assignment of causeAssignments) {
      if (assignment.status === 'active') map.set(assignment.entity_id, assignment)
    }
    return map
  }, [causeAssignments])

  const contactsByBusiness = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const contact of contacts) {
      if (!contact.business_id) continue
      map.set(contact.business_id, (map.get(contact.business_id) || 0) + 1)
    }
    return map
  }, [contacts])

  const tasksByEntity = React.useMemo(() => {
    const businessMap = new Map<string, typeof tasks>()
    const causeMap = new Map<string, typeof tasks>()
    for (const task of tasks) {
      if (!task.entity_id) continue
      if (task.entity_type === 'business') businessMap.set(task.entity_id, [...(businessMap.get(task.entity_id) || []), task])
      if (task.entity_type === 'cause') causeMap.set(task.entity_id, [...(causeMap.get(task.entity_id) || []), task])
    }
    return { businessMap, causeMap }
  }, [tasks])

  const outreachByEntity = React.useMemo(() => {
    const businessMap = new Map<string, typeof outreach>()
    const causeMap = new Map<string, typeof outreach>()
    for (const item of outreach) {
      if (item.business_id) businessMap.set(item.business_id, [...(businessMap.get(item.business_id) || []), item])
      if (item.cause_id) causeMap.set(item.cause_id, [...(causeMap.get(item.cause_id) || []), item])
    }
    return { businessMap, causeMap }
  }, [outreach])

  const claimedBusinesses = React.useMemo(() => {
    return businesses
      .filter((business) => businessAssignmentMap.has(business.id))
      .map((business) => ({
        business,
        queue: buildBusinessQueueState({
          business,
          assignment: businessAssignmentMap.get(business.id),
          contactsCount: contactsByBusiness.get(business.id) || 0,
          tasks: tasksByEntity.businessMap.get(business.id) || [],
          outreach: outreachByEntity.businessMap.get(business.id) || [],
        }),
      }))
  }, [businessAssignmentMap, businesses, contactsByBusiness, outreachByEntity.businessMap, tasksByEntity.businessMap])

  const claimedCauses = React.useMemo(() => {
    return causes
      .filter((cause) => causeAssignmentMap.has(cause.id))
      .map((cause) => ({
        cause,
        queue: buildCauseQueueState({
          cause,
          assignment: causeAssignmentMap.get(cause.id),
          tasks: tasksByEntity.causeMap.get(cause.id) || [],
          outreach: outreachByEntity.causeMap.get(cause.id) || [],
        }),
      }))
  }, [causeAssignmentMap, causes, outreachByEntity.causeMap, tasksByEntity.causeMap])

  const nextActions = React.useMemo(() => {
    const items = [
      ...claimedBusinesses.map((item) => ({
        id: `business-${item.business.id}`,
        type: 'Business',
        name: item.business.name,
        href: `/crm/scripts?business=${encodeURIComponent(item.business.id)}`,
        city: item.business.city_id ? cityMap.get(item.business.city_id) || 'City not set' : 'City not set',
        queue: item.queue,
      })),
      ...claimedCauses.map((item) => ({
        id: `cause-${item.cause.id}`,
        type: item.cause.type === 'school' ? 'School' : 'Cause',
        name: item.cause.name,
        href: `/crm/causes/${item.cause.id}`,
        city: item.cause.city_id ? cityMap.get(item.cause.city_id) || 'City not set' : 'City not set',
        queue: item.queue,
      })),
    ]

    return items
      .sort((left, right) => {
        const urgencyWeight = { blocked: 0, overdue: 1, today: 2, upcoming: 3, on_track: 4 }
        const urgencyGap = urgencyWeight[left.queue.urgency] - urgencyWeight[right.queue.urgency]
        if (urgencyGap !== 0) return urgencyGap
        return (left.queue.nextActionDueDate || '').localeCompare(right.queue.nextActionDueDate || '')
      })
      .slice(0, 8)
  }, [cityMap, claimedBusinesses, claimedCauses])

  const blockedItems = React.useMemo(
    () => nextActions.filter((item) => item.queue.blockedReason || item.queue.waitingOn),
    [nextActions]
  )
  const immediateItems = React.useMemo(
    () =>
      nextActions
        .filter((item) => item.queue.urgency === 'blocked' || item.queue.urgency === 'overdue' || item.queue.urgency === 'today')
        .map((item) => ({
          id: item.id,
          title: item.name,
          detail: item.queue.nextAction,
          href: item.href,
          ctaLabel: item.type === 'Business' ? 'Open business' : 'Open school / cause',
          priority:
            item.queue.urgency === 'blocked' || item.queue.urgency === 'overdue'
              ? ('high' as const)
              : ('medium' as const),
          badge: `${item.type} / ${item.queue.workflowLabel}`,
          dueLabel: `Due: ${formatDueLabel(item.queue.nextActionDueDate)}`,
        })),
    [nextActions]
  )
  const oldestOpenItem = React.useMemo(
    () =>
      [...nextActions]
        .filter((item) => item.queue.workflowStage !== 'live')
        .sort((left, right) => {
          const leftValue = left.queue.lastActivityAt || left.queue.nextActionDueDate || '9999-12-31'
          const rightValue = right.queue.lastActivityAt || right.queue.nextActionDueDate || '9999-12-31'
          return leftValue.localeCompare(rightValue)
        })
        .at(0),
    [nextActions]
  )
  const suggestedItems = React.useMemo(
    () => [
      {
        id: 'field-suggestion-new-business',
        title: 'Add a new inquiry',
        detail: 'Find and claim another business in your approved city footprint so the pipeline keeps moving.',
        href: '/workspace/businesses',
        ctaLabel: 'Claim business',
      },
      {
        id: 'field-suggestion-follow-up',
        title: oldestOpenItem ? `Follow up with ${oldestOpenItem.name}` : 'Follow up with the oldest open stakeholder',
        detail: oldestOpenItem
          ? 'This is the oldest claimed stakeholder that still needs a next step to move forward.'
          : 'When the urgent queue is clear, use your oldest open stakeholder to create new momentum.',
        href: oldestOpenItem?.href || '/workspace/businesses',
        ctaLabel: 'Open record',
      },
      {
        id: 'field-suggestion-school',
        title: 'Find a new school or cause',
        detail: 'Balance your queue by claiming a school or cause that still needs activation help.',
        href: '/workspace/community',
        ctaLabel: 'Claim community',
      },
    ],
    [oldestOpenItem]
  )

  const loading = businessesLoading || causesLoading || tasksLoading || outreachLoading || scriptsLoading
  const myCityLabels = accessibleCityIds.map((cityId) => cityMap.get(cityId)).filter(Boolean) as string[]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-3 text-sm text-surface-500">Loading your claimed workflow...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Claimed Workflow"
        description="Your dashboard is now a work queue: what you own, what is next, and what is blocked."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/workspace/businesses">
                Claim Businesses
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/workspace/community">
                Claim Schools / Causes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden border-indigo-100 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.14),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,242,255,0.92))] shadow-panel">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Badge variant="info" className="w-fit">Execution-first dashboard</Badge>
            <div className="space-y-2">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-surface-900">
                Everything you have claimed should move because of what you do next.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-surface-600">
                You can claim businesses and schools / causes inside {myCityLabels.join(' / ') || 'your approved city footprint'}, own the next step, use the right scripts and materials, and keep every stakeholder moving toward live.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Role</p>
                <p className="mt-2 text-sm text-surface-800">Role controls capability, not ownership.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Claim</p>
                <p className="mt-2 text-sm text-surface-800">Claiming makes that stakeholder your responsibility.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Stage</p>
                <p className="mt-2 text-sm text-surface-800">Stage determines the next real action and what is blocking it.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Claimed businesses" value={claimedBusinesses.length} icon={<Building2 className="h-5 w-5" />} />
            <StatCard label="Claimed schools / causes" value={claimedCauses.length} icon={<Heart className="h-5 w-5" />} />
            <StatCard label="Blocked / waiting" value={blockedItems.length} icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard label="Scripts used" value={scripts.length} icon={<Sparkles className="h-5 w-5" />} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {nextActions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Immediate next steps</CardTitle>
              <CardDescription>Claim your first stakeholder to turn this into a real work queue.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title="Claim your first stakeholder"
                description="Once you claim a business or school / cause, the next actions will show up here."
              />
            </CardContent>
          </Card>
        ) : (
          <StakeholderActionQueue
            title="Immediate next steps"
            description="Anything blocked, overdue, or due today stays here until you move it. Once it is handled, it drops out of the overview."
            items={immediateItems}
            suggestions={suggestedItems}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Blocked / Waiting</CardTitle>
            <CardDescription>These items need a unblocker, not just another touchpoint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-8 text-sm text-surface-500">
                Nothing is blocked right now. Keep working the next actions while the lane is open.
              </div>
            ) : (
              blockedItems.map((item) => (
                <div key={`${item.id}-blocked`} className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-danger-700">{item.name}</p>
                    <Badge variant="danger">{item.queue.urgencyLabel}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-danger-700">{item.queue.blockedReason || item.queue.waitingOn || 'Needs attention'}</p>
                  <p className="mt-1 text-xs text-danger-700/80">{item.queue.nextAction}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>My Claimed Businesses</CardTitle>
              <CardDescription>Track business onboarding ownership all the way to live.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/workspace/businesses">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {claimedBusinesses.length === 0 ? (
              <EmptyState icon={<Building2 className="h-6 w-6" />} title="No businesses claimed yet" description="Claim a business to make it part of your active queue." />
            ) : (
              claimedBusinesses.slice(0, 5).map(({ business, queue }) => (
                <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{business.name}</p>
                      <p className="mt-1 text-xs text-surface-500">{queue.workflowLabel} / {business.category || 'Local business'}</p>
                    </div>
                    <Badge variant={getUrgencyVariant(queue.urgency)}>{queue.urgencyLabel}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-surface-700">{queue.nextAction}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>My Claimed Schools / Causes</CardTitle>
              <CardDescription>See what is live, what needs materials, and what still needs activation.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/workspace/community">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {claimedCauses.length === 0 ? (
              <EmptyState icon={<Heart className="h-6 w-6" />} title="No schools or causes claimed yet" description="Claim a school or cause to make it part of your queue." />
            ) : (
              claimedCauses.slice(0, 5).map(({ cause, queue }) => (
                <div key={cause.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{cause.name}</p>
                      <p className="mt-1 text-xs text-surface-500">{queue.workflowLabel} / {cause.type || 'Community'}</p>
                    </div>
                    <Badge variant={getUrgencyVariant(queue.urgency)}>{queue.urgencyLabel}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-surface-700">{queue.nextAction}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Support Layer</CardTitle>
          <CardDescription>Keep the scripts, outreach logging, and tasks close to the execution work.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Link href="/crm/scripts" className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50">
            <p className="text-sm font-semibold text-surface-900">Outreach Scripts</p>
            <p className="mt-2 text-xs leading-5 text-surface-500">Use the new step-by-step wizard and pull from past drafts when that helps you move faster.</p>
          </Link>
          <Link href="/crm/outreach" className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50">
            <p className="text-sm font-semibold text-surface-900">Outreach Log</p>
            <p className="mt-2 text-xs leading-5 text-surface-500">Every touchpoint should go back into CRM so the next person sees the real history.</p>
          </Link>
          <Link href="/materials/mine" className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50">
            <p className="text-sm font-semibold text-surface-900">Relevant Materials</p>
            <p className="mt-2 text-xs leading-5 text-surface-500">Jump straight into the materials that help the stakeholder you are currently moving.</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
