'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Briefcase,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Send,
  Shield,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { BRANDS, ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import {
  useBusinesses,
  useCampaigns,
  useCauses,
  useCities,
  useOrganizations,
  useOutreach,
  useRecord,
  useStakeholderAssignments,
  useTasks,
} from '@/lib/supabase/hooks'
import type { Profile } from '@/lib/types/database'

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  super_admin: 'danger',
  internal_admin: 'warning',
  school_leader: 'info',
  cause_leader: 'info',
  business_onboarding: 'success',
  influencer: 'default',
  affiliate: 'default',
  volunteer: 'default',
  intern: 'default',
}

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.id as string
  const { data: user, loading } = useRecord<Profile>('profiles', userId)
  const { data: cities } = useCities()
  const { data: organizations } = useOrganizations()
  const { data: assignments } = useStakeholderAssignments({ stakeholder_id: userId })
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: campaigns } = useCampaigns()
  const { data: tasks } = useTasks()
  const { data: outreach } = useOutreach()

  const city = React.useMemo(() => cities.find(item => item.id === user?.city_id), [cities, user?.city_id])
  const organization = React.useMemo(() => organizations.find(item => item.id === user?.organization_id), [organizations, user?.organization_id])

  const ownedBusinesses = React.useMemo(() => businesses.filter(item => item.owner_id === userId), [businesses, userId])
  const ownedCauses = React.useMemo(() => causes.filter(item => item.owner_id === userId), [causes, userId])
  const ownedCampaigns = React.useMemo(() => campaigns.filter(item => item.owner_id === userId), [campaigns, userId])
  const userTasks = React.useMemo(() => tasks.filter(item => item.assigned_to === userId || item.created_by === userId).slice(0, 8), [tasks, userId])
  const userOutreach = React.useMemo(() => outreach.filter(item => item.performed_by === userId).slice(0, 8), [outreach, userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading user...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="User not found"
        description="This profile could not be loaded."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.full_name}
        description="Role, coverage, assignments, and recent activity for this stakeholder."
        breadcrumb={[
          { label: 'Admin', href: '/admin/users' },
          { label: 'Users', href: '/admin/users' },
          { label: user.full_name },
        ]}
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-surface-50 via-white to-surface-100 px-6 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar name={user.full_name} src={user.avatar_url} size="lg" />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ROLE_BADGE_VARIANT[user.role] || 'default'}>
                    <Shield className="h-3 w-3" /> {ROLES[user.role]?.label || user.role}
                  </Badge>
                  <Badge variant={user.brand_context === 'hato' ? 'hato' : 'info'}>
                    {BRANDS[user.brand_context]?.label || user.brand_context}
                  </Badge>
                  <Badge variant={user.status === 'active' ? 'success' : 'default'} dot>
                    {user.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
                  <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                    <Mail className="h-4 w-4" /> {user.email}
                  </a>
                  {city && (
                    <Link href={`/crm/cities/${city.id}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                      <MapPin className="h-4 w-4" /> {city.name}, {city.state}
                    </Link>
                  )}
                  {organization && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-4 w-4" /> {organization.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Assignments</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{assignments.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Businesses</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{ownedBusinesses.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Causes</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{ownedCauses.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaigns</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{ownedCampaigns.length}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Assigned Coverage</p>
            </div>
            {assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.map(assignment => (
                  <div key={assignment.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium capitalize text-surface-900">{assignment.entity_type}</p>
                      <Badge variant={assignment.status === 'active' ? 'success' : 'default'} dot>
                        {assignment.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-surface-500">{assignment.role || 'Stakeholder assignment'}</p>
                    <div className="mt-3">
                      {assignment.entity_type === 'business' && (
                        <Link href={`/crm/businesses/${assignment.entity_id}`}>
                          <Button variant="outline" size="sm"><Store className="h-3.5 w-3.5" /> Open Business</Button>
                        </Link>
                      )}
                      {assignment.entity_type === 'cause' && (
                        <Link href={`/crm/causes/${assignment.entity_id}`}>
                          <Button variant="outline" size="sm"><Heart className="h-3.5 w-3.5" /> Open Cause</Button>
                        </Link>
                      )}
                      {assignment.entity_type === 'campaign' && (
                        <Link href={`/campaigns/${assignment.entity_id}`}>
                          <Button variant="outline" size="sm"><Megaphone className="h-3.5 w-3.5" /> Open Campaign</Button>
                        </Link>
                      )}
                      {assignment.entity_type === 'city' && (
                        <Link href={`/crm/cities/${assignment.entity_id}`}>
                          <Button variant="outline" size="sm"><MapPin className="h-3.5 w-3.5" /> Open City</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No direct assignments found for this user.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Owned Records</p>
            </div>
            <div className="space-y-3">
              {ownedBusinesses.slice(0, 4).map(business => (
                <Link key={business.id} href={`/crm/businesses/${business.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">{business.name}</p>
                  <p className="text-sm text-surface-500">{business.category || 'Business'}</p>
                </Link>
              ))}
              {ownedCauses.slice(0, 4).map(cause => (
                <Link key={cause.id} href={`/crm/causes/${cause.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">{cause.name}</p>
                  <p className="text-sm text-surface-500">{cause.type}</p>
                </Link>
              ))}
              {ownedCampaigns.slice(0, 4).map(campaign => (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                  <p className="font-medium text-surface-900">{campaign.name}</p>
                  <p className="text-sm text-surface-500">{campaign.description || 'Campaign record'}</p>
                </Link>
              ))}
              {ownedBusinesses.length === 0 && ownedCauses.length === 0 && ownedCampaigns.length === 0 && (
                <p className="text-sm text-surface-400">This user does not currently own businesses, causes, or campaigns.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Recent Tasks</p>
            </div>
            {userTasks.length > 0 ? (
              <div className="space-y-3">
                {userTasks.map(task => (
                  <div key={task.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <p className="font-medium text-surface-900">{task.title}</p>
                    <p className="mt-1 text-sm text-surface-500">{task.description || 'No description provided.'}</p>
                    <p className="mt-2 text-xs text-surface-400">
                      {task.due_date ? `Due ${formatDate(task.due_date)}` : `Created ${formatDate(task.created_at)}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No tasks found for this user.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Recent Outreach</p>
            </div>
            {userOutreach.length > 0 ? (
              <div className="space-y-3">
                {userOutreach.map(activity => (
                  <div key={activity.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-surface-900">{activity.subject || activity.type.replace('_', ' ')}</p>
                      <Badge variant="default">{activity.type.replace('_', ' ')}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-surface-500">{activity.body || activity.outcome || 'No details captured.'}</p>
                    <p className="mt-2 text-xs text-surface-400">{formatDate(activity.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No outreach logged by this user yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
