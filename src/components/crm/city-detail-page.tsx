'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardList,
  Heart,
  Loader2,
  MapPin,
  Megaphone,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ONBOARDING_STAGES, ROLES } from '@/lib/constants'
import { getEntityTheme } from '@/lib/entity-themes'
import { formatDate } from '@/lib/utils'
import {
  useBusinesses,
  useCampaigns,
  useCauses,
  useOutreach,
  useProfiles,
  useRecord,
  useTasks,
} from '@/lib/supabase/hooks'
import type { Business, Cause, City, OnboardingStage } from '@/lib/types/database'

const businessTheme = getEntityTheme('business')
const causeTheme = getEntityTheme('cause')

const STAGE_ORDER: OnboardingStage[] = ['lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live']

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

function StageColumn({
  title,
  items,
  theme,
  hrefBase,
}: {
  title: string
  items: Array<Business | Cause>
  theme: ReturnType<typeof getEntityTheme>
  hrefBase: string
}) {
  return (
    <Card className={`border ${theme.border}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-semibold ${theme.text}`}>{title}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${theme.badge}`}>
            {items.length}
          </span>
        </div>
        <div className="space-y-2">
          {items.length > 0 ? items.slice(0, 6).map(item => (
            <Link
              key={item.id}
              href={`${hrefBase}/${item.id}`}
              className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm transition-colors hover:border-surface-300 hover:bg-white"
            >
              <span className="font-medium text-surface-800">{item.name}</span>
              <Badge variant={getStageBadgeVariant(item.stage)} dot>
                {ONBOARDING_STAGES[item.stage].label}
              </Badge>
            </Link>
          )) : (
            <p className="text-sm text-surface-400">No records in this city yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function entityHref(entityType: string | null | undefined, entityId: string | null | undefined) {
  if (!entityType || !entityId) return null
  if (entityType === 'business') return `/crm/businesses/${entityId}`
  if (entityType === 'cause') return `/crm/causes/${entityId}`
  if (entityType === 'campaign') return `/campaigns/${entityId}`
  return null
}

export default function CityDetailPage() {
  const params = useParams()
  const cityId = params.id as string
  const { data: city, loading } = useRecord<City>('cities', cityId)
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: campaigns } = useCampaigns()
  const { data: profiles } = useProfiles()
  const { data: outreach } = useOutreach()
  const { data: tasks } = useTasks()

  const cityBusinesses = React.useMemo(() => businesses.filter(business => business.city_id === cityId), [businesses, cityId])
  const cityCauses = React.useMemo(() => causes.filter(cause => cause.city_id === cityId), [causes, cityId])
  const cityCampaigns = React.useMemo(() => campaigns.filter(campaign => campaign.city_id === cityId), [campaigns, cityId])
  const cityProfiles = React.useMemo(() => profiles.filter(profile => profile.city_id === cityId), [profiles, cityId])
  const businessMap = React.useMemo(() => new Map(cityBusinesses.map(business => [business.id, business])), [cityBusinesses])
  const causeMap = React.useMemo(() => new Map(cityCauses.map(cause => [cause.id, cause])), [cityCauses])
  const campaignMap = React.useMemo(() => new Map(cityCampaigns.map(campaign => [campaign.id, campaign])), [cityCampaigns])
  const profileMap = React.useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles])

  const businessIds = React.useMemo(() => new Set(cityBusinesses.map(business => business.id)), [cityBusinesses])
  const causeIds = React.useMemo(() => new Set(cityCauses.map(cause => cause.id)), [cityCauses])
  const recentOutreach = React.useMemo(() => outreach.filter(activity =>
    (activity.entity_type === 'business' && businessIds.has(activity.entity_id))
    || (activity.entity_type === 'cause' && causeIds.has(activity.entity_id))
    || (activity.campaign_id && cityCampaigns.some(campaign => campaign.id === activity.campaign_id))
  )
    .slice()
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 8), [businessIds, causeIds, cityCampaigns, outreach])

  const cityTasks = React.useMemo(() => tasks.filter(task =>
    (task.entity_type === 'business' && businessIds.has(task.entity_id || ''))
    || (task.entity_type === 'cause' && causeIds.has(task.entity_id || ''))
  )
    .slice()
    .sort((left, right) => {
      const leftTime = left.due_date ? new Date(left.due_date).getTime() : Number.MAX_SAFE_INTEGER
      const rightTime = right.due_date ? new Date(right.due_date).getTime() : Number.MAX_SAFE_INTEGER
      return leftTime - rightTime
    })
    .slice(0, 8), [businessIds, causeIds, tasks])

  const businessStageCounts = React.useMemo(() => {
    return STAGE_ORDER.map(stage => ({
      stage,
      count: cityBusinesses.filter(business => business.stage === stage).length,
    }))
  }, [cityBusinesses])

  const causeStageCounts = React.useMemo(() => {
    return STAGE_ORDER.map(stage => ({
      stage,
      count: cityCauses.filter(cause => cause.stage === stage).length,
    }))
  }, [cityCauses])

  const summary = React.useMemo(() => {
    const liveBusinesses = cityBusinesses.filter(business => business.stage === 'live').length
    const readyCauses = cityCauses.filter(cause => cause.stage === 'onboarded' || cause.stage === 'live').length
    const followUps = recentOutreach.filter(activity =>
      !!activity.next_step_date
      && new Date(activity.next_step_date).getTime() <= Date.now() + (1000 * 60 * 60 * 24 * 7)
    ).length
    const openTasks = cityTasks.filter(task => task.status !== 'completed').length

    return { liveBusinesses, readyCauses, followUps, openTasks }
  }, [cityBusinesses, cityCauses, cityTasks, recentOutreach])

  const roleCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    cityProfiles.forEach(profile => {
      counts.set(profile.role, (counts.get(profile.role) || 0) + 1)
    })
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
  }, [cityProfiles])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading city...</span>
      </div>
    )
  }

  if (!city) {
    return (
      <EmptyState
        icon={<MapPin className="h-8 w-8" />}
        title="City not found"
        description="This city record could not be loaded."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${city.name}, ${city.state}`}
        description="Business growth, school and cause progress, campaigns, and local team coverage in one view."
        breadcrumb={[
          { label: 'CRM', href: '/crm/cities' },
          { label: 'Cities', href: '/crm/cities' },
          { label: city.name },
        ]}
        actions={
          cityCampaigns[0] ? (
            <Link href={`/campaigns/${cityCampaigns[0].id}`}>
              <Button>
                <Megaphone className="h-4 w-4" /> Open Campaign
              </Button>
            </Link>
          ) : undefined
        }
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-surface-100 via-white to-surface-50 px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={city.status === 'active' ? 'success' : 'warning'} dot>
                  {city.status}
                </Badge>
                <span className="text-sm text-surface-500">{city.country}</span>
              </div>
              <p className="max-w-3xl text-sm text-surface-600">
                This page shows how far LocalVIP has come in {city.name} across businesses, schools and causes, campaign coverage, and the team working the market.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Businesses</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{cityBusinesses.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Schools / Causes</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{cityCauses.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaigns</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{cityCampaigns.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Team</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{cityProfiles.length}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className={`border ${businessTheme.border} ${businessTheme.surface}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${businessTheme.icon}`}>
                <Store className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Live Businesses</p>
                <p className="text-lg font-semibold text-surface-900">{summary.liveBusinesses}</p>
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
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Ready Causes</p>
                <p className="text-lg font-semibold text-surface-900">{summary.readyCauses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-surface-100 p-2 text-surface-700">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Follow Ups This Week</p>
                <p className="text-lg font-semibold text-surface-900">{summary.followUps}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-surface-100 p-2 text-surface-700">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Open Tasks</p>
                <p className="text-lg font-semibold text-surface-900">{summary.openTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={`border ${businessTheme.border}`}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${businessTheme.icon}`}>
                <Store className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-900">Business Progress</p>
                <p className="text-sm text-surface-500">
                  {cityBusinesses.filter(business => business.stage === 'live').length} live and {cityBusinesses.filter(business => business.stage === 'in_progress').length} actively onboarding
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {businessStageCounts.map(item => (
                <Badge key={item.stage} variant={getStageBadgeVariant(item.stage)} dot>
                  {ONBOARDING_STAGES[item.stage].label}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${causeTheme.border}`}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2 ${causeTheme.icon}`}>
                <Heart className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-surface-900">School / Cause Progress</p>
                <p className="text-sm text-surface-500">
                  {cityCauses.filter(cause => cause.stage === 'onboarded' || cause.stage === 'live').length} ready for local activation
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {causeStageCounts.map(item => (
                <Badge key={item.stage} variant={getStageBadgeVariant(item.stage)} dot>
                  {ONBOARDING_STAGES[item.stage].label}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StageColumn title="Businesses In This City" items={cityBusinesses} theme={businessTheme} hrefBase="/crm/businesses" />
        <StageColumn title="Schools / Causes In This City" items={cityCauses} theme={causeTheme} hrefBase="/crm/causes" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Campaigns</p>
            </div>
            {cityCampaigns.length > 0 ? (
              <div className="space-y-3">
                {cityCampaigns.map(campaign => (
                  <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 p-4 transition-colors hover:border-surface-300 hover:bg-white">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-surface-900">{campaign.name}</p>
                        <p className="mt-1 text-sm text-surface-500">{campaign.description || 'No description yet.'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-surface-500">
                          <span>{cityBusinesses.filter(business => business.campaign_id === campaign.id).length} businesses</span>
                          <span>{cityCauses.filter(cause => cause.campaign_id === campaign.id).length} causes</span>
                          {campaign.owner_id && profileMap.get(campaign.owner_id) && (
                            <span>Owner: {profileMap.get(campaign.owner_id)?.full_name}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'success' : 'default'} dot>
                        {campaign.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No campaigns linked to this city yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Team Coverage</p>
            </div>
            {cityProfiles.length > 0 ? (
              <div className="space-y-3">
                {roleCounts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {roleCounts.map(([role, count]) => (
                      <span key={role} className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-surface-600">
                        {ROLES[role as keyof typeof ROLES]?.label || role}: {count}
                      </span>
                    ))}
                  </div>
                )}
                {cityProfiles.map(profile => (
                  <Link key={profile.id} href={`/admin/users/${profile.id}`} className="flex items-center justify-between rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                    <div>
                      <p className="font-medium text-surface-900">{profile.full_name}</p>
                      <p className="text-sm text-surface-500">
                        {ROLES[profile.role]?.label || profile.role}
                        {' - '}
                        {businesses.filter(business => business.owner_id === profile.id).length} businesses
                        {', '}
                        {causes.filter(cause => cause.owner_id === profile.id).length} causes
                      </p>
                    </div>
                    <Badge variant={profile.status === 'active' ? 'success' : 'default'} dot>
                      {profile.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No stakeholders assigned to this city yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Recent Outreach</p>
            </div>
            {recentOutreach.length > 0 ? (
              <div className="space-y-3">
                {recentOutreach.map(activity => {
                  const href = entityHref(activity.entity_type, activity.entity_id) || entityHref('campaign', activity.campaign_id)
                  const entityName = activity.entity_type === 'business'
                    ? businessMap.get(activity.entity_id)?.name
                    : causeMap.get(activity.entity_id)?.name
                  const performer = profileMap.get(activity.performed_by)
                  const content = (
                    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-surface-900">{activity.subject || activity.type.replace('_', ' ')}</p>
                        <Badge variant="default">{activity.type.replace('_', ' ')}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-surface-500">{activity.body || activity.outcome || 'No detail captured.'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-surface-400">
                        <span>{formatDate(activity.created_at)}</span>
                        {entityName && <span>{entityName}</span>}
                        {performer && <span>{performer.full_name}</span>}
                        {activity.next_step && <span>Next: {activity.next_step}</span>}
                      </div>
                    </div>
                  )

                  return href ? (
                    <Link key={activity.id} href={href} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div key={activity.id}>{content}</div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No outreach logged for this city yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Open Tasks</p>
            </div>
            {cityTasks.length > 0 ? (
              <div className="space-y-3">
                {cityTasks.map(task => {
                  const href = entityHref(task.entity_type, task.entity_id)
                  const entityName = task.entity_type === 'business'
                    ? businessMap.get(task.entity_id || '')?.name
                    : causeMap.get(task.entity_id || '')?.name
                  const assignee = task.assigned_to ? profileMap.get(task.assigned_to) : null
                  const content = (
                    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-surface-900">{task.title}</p>
                        <Badge variant={task.status === 'completed' ? 'success' : 'warning'}>
                          {task.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-surface-500">{task.description || 'No description provided.'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-surface-400">
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}
                        </span>
                        {entityName && <span>{entityName}</span>}
                        {assignee && <span>Assigned to {assignee.full_name}</span>}
                      </div>
                    </div>
                  )

                  return href ? (
                    <Link key={task.id} href={href} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div key={task.id}>{content}</div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No open tasks connected to this city yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
