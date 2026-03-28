'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Heart,
  Loader2,
  MapPin,
  PlusCircle,
  Target,
  TrendingUp,
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
  getLaunchPhaseLabel,
  getUrgencyVariant,
} from '@/lib/claimed-stakeholder-workflow'
import { useBusinesses, useCauses, useCities, useCityAccessRequests, useContacts, useOutreach, useStakeholderAssignments, useTasks } from '@/lib/supabase/hooks'

export function LaunchPartnerDashboardPage() {
  const { profile } = useAuth()
  const { data: cityAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'city' })
  const { data: businessAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'business' })
  const { data: causeAssignments } = useStakeholderAssignments({ stakeholder_id: profile.id, entity_type: 'cause' })
  const { data: cities } = useCities()
  const { data: businesses, loading: businessesLoading } = useBusinesses()
  const { data: causes, loading: causesLoading } = useCauses()
  const { data: contacts } = useContacts()
  const { data: tasks, loading: tasksLoading } = useTasks({ assigned_to: profile.id })
  const { data: outreach, loading: outreachLoading } = useOutreach({ performed_by: profile.id })
  const { data: requests } = useCityAccessRequests({ requester_id: profile.id })

  const accessibleCityIds = React.useMemo(
    () => getAccessibleCityIds(profile, cityAssignments),
    [cityAssignments, profile]
  )
  const cityMap = React.useMemo(() => new Map(cities.map((city) => [city.id, `${city.name}, ${city.state}`])), [cities])
  const assignedCities = React.useMemo(
    () => cities.filter((city) => accessibleCityIds.includes(city.id)),
    [accessibleCityIds, cities]
  )

  const cityBusinesses = React.useMemo(
    () => businesses.filter((business) => business.city_id && accessibleCityIds.includes(business.city_id)),
    [accessibleCityIds, businesses]
  )
  const cityCauses = React.useMemo(
    () => causes.filter((cause) => cause.city_id && accessibleCityIds.includes(cause.city_id)),
    [accessibleCityIds, causes]
  )

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

  const claimedBusinessMap = React.useMemo(() => {
    const map = new Map<string, (typeof businessAssignments)[number]>()
    for (const assignment of businessAssignments) {
      if (assignment.status === 'active') map.set(assignment.entity_id, assignment)
    }
    return map
  }, [businessAssignments])

  const claimedCauseMap = React.useMemo(() => {
    const map = new Map<string, (typeof causeAssignments)[number]>()
    for (const assignment of causeAssignments) {
      if (assignment.status === 'active') map.set(assignment.entity_id, assignment)
    }
    return map
  }, [causeAssignments])

  const claimedBusinesses = React.useMemo(() => {
    return cityBusinesses
      .filter((business) => claimedBusinessMap.has(business.id))
      .map((business) => ({
        business,
        queue: buildBusinessQueueState({
          business,
          assignment: claimedBusinessMap.get(business.id),
          contactsCount: contactsByBusiness.get(business.id) || 0,
          tasks: tasksByEntity.businessMap.get(business.id) || [],
          outreach: outreachByEntity.businessMap.get(business.id) || [],
        }),
      }))
  }, [cityBusinesses, claimedBusinessMap, contactsByBusiness, outreachByEntity.businessMap, tasksByEntity.businessMap])

  const claimedCauses = React.useMemo(() => {
    return cityCauses
      .filter((cause) => claimedCauseMap.has(cause.id))
      .map((cause) => ({
        cause,
        queue: buildCauseQueueState({
          cause,
          assignment: claimedCauseMap.get(cause.id),
          tasks: tasksByEntity.causeMap.get(cause.id) || [],
          outreach: outreachByEntity.causeMap.get(cause.id) || [],
        }),
      }))
  }, [cityCauses, claimedCauseMap, outreachByEntity.causeMap, tasksByEntity.causeMap])

  const nextActions = React.useMemo(() => {
    const items = [
      ...claimedBusinesses.map((item) => ({
        id: `business-${item.business.id}`,
        name: item.business.name,
        type: 'Business',
        city: item.business.city_id ? cityMap.get(item.business.city_id) || 'City not set' : 'City not set',
        href: `/partner/businesses`,
        queue: item.queue,
      })),
      ...claimedCauses.map((item) => ({
        id: `cause-${item.cause.id}`,
        name: item.cause.name,
        type: item.cause.type === 'school' ? 'School' : 'Cause',
        city: item.cause.city_id ? cityMap.get(item.cause.city_id) || 'City not set' : 'City not set',
        href: `/partner/community`,
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
      .slice(0, 10)
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
          ctaLabel: item.type === 'Business' ? 'Open businesses' : 'Open community',
          priority:
            item.queue.urgency === 'blocked' || item.queue.urgency === 'overdue'
              ? ('high' as const)
              : ('medium' as const),
          badge: `${item.type} / ${item.city}`,
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
        id: 'partner-suggestion-city',
        title: 'Add a new inquiry',
        detail: 'Look for the next business or school in your city that should be pulled into the launch pipeline.',
        href: '/partner/city',
        ctaLabel: 'Open city view',
      },
      {
        id: 'partner-suggestion-follow-up',
        title: oldestOpenItem ? `Follow up with ${oldestOpenItem.name}` : 'Follow up with the oldest open item',
        detail: oldestOpenItem
          ? 'This is the oldest claimed stakeholder that still needs a next step to move the city forward.'
          : 'When the urgent queue is clear, use your oldest open stakeholder to create the next bit of momentum.',
        href: oldestOpenItem?.href || '/partner/businesses',
        ctaLabel: 'Open stakeholder',
      },
      {
        id: 'partner-suggestion-expand',
        title: 'Find a new growth gap',
        detail: 'Scan city performance and identify the next weak spot in businesses, schools, or activation.',
        href: '/partner/city',
        ctaLabel: 'Review city',
      },
    ],
    [oldestOpenItem]
  )

  const avgHundredListCompletion = React.useMemo(() => {
    if (cityBusinesses.length === 0) return 0
    const totalPercent = cityBusinesses.reduce((sum, business) => {
      const count = contactsByBusiness.get(business.id) || 0
      return sum + Math.min(100, Math.round((count / 100) * 100))
    }, 0)
    return Math.round(totalPercent / cityBusinesses.length)
  }, [cityBusinesses, contactsByBusiness])

  const loading = businessesLoading || causesLoading || tasksLoading || outreachLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-3 text-sm text-surface-500">Loading your city workflow...</span>
      </div>
    )
  }

  if (assignedCities.length === 0) {
    return (
      <EmptyState
        icon={<MapPin className="h-8 w-8" />}
        title="No cities assigned yet"
        description="As soon as a city is assigned to you, this dashboard becomes your city growth command center."
        action={{ label: 'Request City Access', onClick: () => { window.location.href = '/partner/requests' } }}
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={assignedCities.length === 1 ? `Grow ${assignedCities[0].name}` : 'Launch Partner Workflow'}
        description="Use this like a city work queue: what is claimed, what is blocked, and where the city still needs growth."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/partner/requests">
                Request access to new city
                <PlusCircle className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/partner/businesses">
                Work businesses
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-brand-100 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.13),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,251,235,0.96))] shadow-panel">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <Badge variant="warning" className="w-fit">City-level execution</Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-surface-900">
              Launch partners should see where the city is moving, and where it is stuck.
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-surface-600">
              You can claim businesses and schools / causes inside your approved cities, but you also need a wider city view. That means city coverage, claimed execution, activation health, and clear signals about what is blocked.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Total businesses" value={cityBusinesses.length} icon={<Building2 className="h-5 w-5" />} />
            <StatCard label="Total schools / causes" value={cityCauses.length} icon={<Heart className="h-5 w-5" />} />
            <StatCard label="Claimed in queue" value={claimedBusinesses.length + claimedCauses.length} icon={<Target className="h-5 w-5" />} />
            <StatCard label="Avg. 100-list completion" value={`${avgHundredListCompletion}%`} icon={<TrendingUp className="h-5 w-5" />} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Businesses active" value={cityBusinesses.filter((business) => business.stage === 'live').length} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Businesses in setup" value={cityBusinesses.filter((business) => ['lead', 'contacted', 'interested', 'in_progress', 'onboarded'].includes(business.stage)).length} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Claimed businesses" value={claimedBusinesses.length} icon={<Target className="h-5 w-5" />} />
        <StatCard label="Blocked / waiting" value={blockedItems.length} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {nextActions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Immediate next steps</CardTitle>
              <CardDescription>Claim businesses or community stakeholders from your city pages to turn this into a real queue.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<Target className="h-6 w-6" />}
                title="Nothing claimed yet"
                description="Claim businesses or community stakeholders from your city pages to turn this into a real queue."
              />
            </CardContent>
          </Card>
        ) : (
          <StakeholderActionQueue
            title="Immediate next steps"
            description="This is the launch-partner queue for anything blocked, overdue, or due today. When those are clear, the dashboard points you to the next three smart moves."
            items={immediateItems}
            suggestions={suggestedItems}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Blocked / Waiting</CardTitle>
            <CardDescription>Surface what is blocked so you can unblock the city, not just touch it again.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {blockedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-8 text-sm text-surface-500">
                Nothing is blocked right now. Keep the city moving.
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
              <CardTitle>Claimed Businesses</CardTitle>
              <CardDescription>Operational ownership inside your city, not just visibility.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/partner/businesses">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {claimedBusinesses.length === 0 ? (
              <EmptyState icon={<Building2 className="h-6 w-6" />} title="No businesses claimed yet" description="Claim businesses in your city to turn them into owned workflow items." />
            ) : (
              claimedBusinesses.slice(0, 5).map(({ business, queue }) => (
                <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{business.name}</p>
                      <p className="mt-1 text-xs text-surface-500">{queue.workflowLabel} / {getLaunchPhaseLabel(business.launch_phase)}</p>
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
              <CardTitle>Claimed Schools / Causes</CardTitle>
              <CardDescription>See what is still waiting on materials, meetings, or activation.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/partner/community">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {claimedCauses.length === 0 ? (
              <EmptyState icon={<Heart className="h-6 w-6" />} title="No community stakeholders claimed yet" description="Claim schools or causes in your city to drive their activation." />
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

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>City Snapshot</CardTitle>
            <CardDescription>See the footprint you are responsible for right now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignedCities.map((city) => {
              const businessCount = cityBusinesses.filter((business) => business.city_id === city.id).length
              const causeCount = cityCauses.filter((cause) => cause.city_id === city.id).length
              const liveBusinesses = cityBusinesses.filter((business) => business.city_id === city.id && business.stage === 'live').length

              return (
                <div key={city.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-surface-900">{city.name}, {city.state}</p>
                      <p className="mt-1 text-sm text-surface-500">{businessCount} businesses / {causeCount} schools or causes / {liveBusinesses} live</p>
                    </div>
                    <Badge variant="info">Assigned</Badge>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>City Access Requests</CardTitle>
            <CardDescription>Expansion requests stay visible while you grow the cities you already have.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-surface-500">No pending or submitted city requests yet.</p>
            ) : (
              requests.slice(0, 4).map((request) => (
                <div key={request.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{request.requested_city_name}</p>
                      <p className="mt-1 text-xs text-surface-500">{request.reason || 'No reason added'}</p>
                    </div>
                    <Badge variant={request.status === 'approved' ? 'success' : request.status === 'declined' ? 'danger' : 'warning'}>
                      {request.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
