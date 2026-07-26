'use client'

import * as React from 'react'
import { ArrowRight, BarChart3, CheckCircle2, Users } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import {
  getBusinessActivationStatus,
  getContactDisplayName,
  getContactListStatus,
  getNetworkMilestone,
  isCreatedToday,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import { useBusinesses, useContacts } from '@/lib/supabase/hooks'
import { formatDateTime } from '@/lib/utils'

export function BusinessActivityPage() {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(
    () => {
      const filters: Record<string, string> = {}
      if (profile.business_id) {
        filters.id = profile.business_id
      } else {
        filters.owner_id = profile.id
      }
      return filters
    },
    [profile.business_id, profile.id]
  )
  const { data: businesses, loading: businessesLoading } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const contactFilters = React.useMemo<Record<string, string>>(
    () => {
      const filters: Record<string, string> = {}
      filters.business_id = business?.id || '__none__'
      return filters
    },
    [business?.id]
  )
  const { data: contacts, loading: contactsLoading, refetch } = useContacts(contactFilters)

  React.useEffect(() => {
    if (!business) return

    const interval = window.setInterval(() => {
      refetch({ silent: true })
    }, 5000)

    return () => window.clearInterval(interval)
  }, [business, refetch])

  if (businessesLoading || (business && contactsLoading)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your activity...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8" />}
        title="Activity will show up here"
        description="We couldn't find your business details for this account yet."
      />
    )
  }

  const invitedCount = contacts.filter((contact) => getContactListStatus(contact) !== 'added').length
  const joinedCount = contacts.filter((contact) => getContactListStatus(contact) === 'joined').length
  const todayAdds = contacts.filter((contact) => isCreatedToday(contact.created_at)).length
  const conversionRate = invitedCount > 0 ? Math.round((joinedCount / invitedCount) * 100) : 0
  const activationStatus = getBusinessActivationStatus(business, contacts)
  const milestone = getNetworkMilestone(contacts.length)
  const timeline = contacts.flatMap((contact) => {
    const items: Array<{
      id: string
      label: string
      detail: string
      at: string
      tone: 'default' | 'info' | 'success'
    }> = [
      {
        id: `${contact.id}-added`,
        label: `${getContactDisplayName(contact)} added`,
        detail: 'Added to your list',
        at: contact.created_at,
        tone: 'default' as const,
      },
    ]

    if (contact.invited_at) {
      items.push({
        id: `${contact.id}-invited`,
        label: `${getContactDisplayName(contact)} invited`,
        detail: 'Invite recorded',
        at: contact.invited_at,
        tone: 'info' as const,
      })
    }

    if (contact.joined_at) {
      items.push({
        id: `${contact.id}-joined`,
        label: `${getContactDisplayName(contact)} joined`,
        detail: 'Joined through your business list',
        at: contact.joined_at,
        tone: 'success' as const,
      })
    }

    return items
  }).sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity"
        description="Track invites, joins, and how close you are to activating your network."
        actions={
          <Link href="/portal/clients">
            <Button>
              <Users className="h-4 w-4" /> Open My 100 List
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/portal/clients" label="Invites sent" value={invitedCount} hint="Follow up from your 100 list" />
        <MetricCard href="/portal/network#joined-customers" label="Customers joined" value={joinedCount} hint="See who joined your team" />
        <MetricCard href="/portal/clients" label="Conversion rate" value={`${conversionRate}%`} hint="Invites that turned into joins" />
        <MetricCard href="/portal/clients" label="Added today" value={todayAdds} hint="Keep adding in small batches" />
      </div>

      {/* Progress to 100 is owned by the 100 list. Here it is one compact line
          that links there — no second progress bar. */}
      <Link
        href="/portal/clients"
        aria-label={`Progress to 100: ${contacts.length} of 100 added, ${milestone.label}. Open my 100 list.`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-surface-300 hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Progress to 100</p>
          <p className="mt-1 text-lg font-semibold text-surface-900">
            {contacts.length} / 100 added
            <span className="ml-2 text-sm font-normal text-surface-500">
              {activationStatus === 'active' ? 'Active' : activationStatus === 'in_progress' ? 'In progress' : 'Not started'}
            </span>
          </p>
        </div>
        <span className="flex items-center gap-2">
          <Badge variant={activationStatus === 'active' ? 'success' : activationStatus === 'in_progress' ? 'info' : 'warning'}>
            {milestone.label}
          </Badge>
          <ArrowRight className="h-4 w-4 text-surface-400" />
        </span>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-surface-500">Your recent activity will appear here as you build your list.</p>
          ) : (
            <div className="space-y-3">
              {timeline.slice(0, 20).map((item) => (
                <Link
                  key={item.id}
                  href="/portal/clients"
                  aria-label={`${item.label}. ${item.detail}. Open my 100 list.`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.tone === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-success-600" />
                      ) : (
                        <BarChart3 className="h-4 w-4 text-brand-500" />
                      )}
                      <p className="text-sm font-semibold text-surface-900">{item.label}</p>
                    </div>
                    <p className="mt-1 text-xs text-surface-500">{item.detail}</p>
                  </div>
                  <Badge variant={item.tone === 'success' ? 'success' : item.tone === 'info' ? 'info' : 'default'}>
                    {formatDateTime(item.at)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  href,
  label,
  value,
  hint,
}: {
  href: string
  label: string
  value: React.ReactNode
  hint: string
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}. ${hint}`}
      className="group block rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-surface-900">{value}</p>
      <p className="mt-2 flex items-center gap-1 text-sm text-surface-500">
        {hint}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  )
}
