'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  FileText,
  Heart,
  Store,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BusinessJoinQrCard } from '@/components/business/business-join-qr-card'
import { useAuth } from '@/lib/auth/context'
import { getBusinessJoinCaptureData } from '@/lib/business-join'
import {
  getActivationLabel,
  getActivationTone,
  getBusinessActivationStatus,
  getBusinessPortalData,
  getBusinessProducts,
  getContactDisplayName,
  getContactListStatus,
  getNetworkMilestone,
  isCreatedToday,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import { useBusinesses, useContacts } from '@/lib/supabase/hooks'
import { formatDateTime } from '@/lib/utils'
import type { Contact } from '@/lib/types/database'

type ActivityItem = {
  id: string
  title: string
  detail: string
  createdAt: string
  tone: 'default' | 'success' | 'info'
}

export function BusinessDashboardPage() {
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
      refetch()
    }, 12000)

    return () => window.clearInterval(interval)
  }, [business, refetch])

  if (businessesLoading || (business && contactsLoading)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your business portal...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Store className="h-8 w-8" />}
        title="Your business portal is almost ready"
        description="A business needs to be linked to this account before we can show your dashboard."
      />
    )
  }

  const portal = getBusinessPortalData(business)
  const capture = getBusinessJoinCaptureData(business)
  const hasCaptureReady = !!(capture.join_url || capture.qr_code_id)
  const activationStatus = getBusinessActivationStatus(business, contacts)
  const milestone = getNetworkMilestone(contacts.length)
  const invitedCount = contacts.filter((contact) => getContactListStatus(contact) !== 'added').length
  const joinedCount = contacts.filter((contact) => getContactListStatus(contact) === 'joined').length
  const todayAdds = contacts.filter((contact) => isCreatedToday(contact.created_at)).length
  const communityImpact = Number(portal.community_impact_total || 0)
  const transactions = Number(portal.transactions_count || 0)
  const progressPercent = Math.min(100, Math.round((contacts.length / 100) * 100))

  const nextSteps = [
    {
      label: 'Build your 100 List',
      href: '/portal/clients',
      complete: contacts.length > 0,
      detail: contacts.length > 0 ? `${contacts.length} people added so far` : 'Start with the first 10 people who already know your business',
    },
    {
      label: 'Invite your first 10 customers',
      href: '/portal/clients',
      complete: invitedCount >= 10,
      detail: invitedCount > 0 ? `${invitedCount} invited` : 'Mark people invited as you reach out',
    },
    {
      label: 'Share your LocalVIP link',
      href: '/portal/clients',
      complete: hasCaptureReady,
      detail: hasCaptureReady ? 'Your QR and join page are ready to use in-store' : 'Your QR and join page will appear in My 100 List',
    },
    {
      label: 'Review your business profile',
      href: '/portal/business',
      complete: !!business.category && !!(business.public_description || portal.description),
      detail: business.category ? `Category set to ${business.category}` : 'Add your category, description, and offer details',
    },
    {
      label: 'Track your activity',
      href: '/portal/activity',
      complete: contacts.length > 0,
      detail: todayAdds > 0 ? `${todayAdds} added today` : 'Watch invites and joins in one place',
    },
  ]

  const activityFeed = buildActivityFeed(contacts)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${business.name}`}
        description="Here's how to grow your business and support your community."
        actions={
          <Badge variant={getActivationTone(activationStatus)} dot>
            {getActivationLabel(activationStatus)}
          </Badge>
        }
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-amber-50 via-white to-lime-50 px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-surface-900">Next Steps</p>
                <p className="mt-1 max-w-2xl text-sm text-surface-600">
                  Keep this simple: add your people, invite them, and make it easy for them to support your business.
                </p>
              </div>
              <div className="space-y-2">
                {nextSteps.map((step) => (
                  <Link
                    key={step.label}
                    href={step.href}
                    className="flex items-start gap-3 rounded-2xl border border-white/90 bg-white/85 px-4 py-3 shadow-sm transition-all hover:border-surface-200 hover:bg-white"
                  >
                    {step.complete ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-surface-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-surface-900">{step.label}</p>
                      <p className="mt-1 text-xs text-surface-500">{step.detail}</p>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-surface-300" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/90 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Progress to 100</p>
                  <p className="mt-2 text-3xl font-bold text-surface-900">{contacts.length} / 100</p>
                </div>
                <Badge variant="warning">{milestone.label}</Badge>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-brand-500 to-lime-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-surface-600">{milestone.description}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Invited</p>
                  <p className="mt-1 text-2xl font-semibold text-surface-900">{invitedCount}</p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Joined</p>
                  <p className="mt-1 text-2xl font-semibold text-surface-900">{joinedCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          icon={<Users className="h-5 w-5" />}
          label="Total customers referred"
          value={joinedCount}
          detail={`${contacts.length} total in your list`}
        />
        <SnapshotCard
          icon={<Heart className="h-5 w-5" />}
          label="Total community impact"
          value={`$${communityImpact.toFixed(2)}`}
          detail="Updates as LocalVIP activity grows"
        />
        <SnapshotCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Total transactions"
          value={transactions}
          detail="Shown when transaction data is available"
        />
        <SnapshotCard
          icon={<Store className="h-5 w-5" />}
          label="Activation status"
          value={getActivationLabel(activationStatus)}
          detail={business.category || 'Set your business category'}
        />
      </div>

      <BusinessJoinQrCard
        business={business}
        totalClients={contacts.length}
        todayAdds={todayAdds}
        progressPercent={progressPercent}
        compact
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-surface-800">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            href="/portal/clients"
            icon={<Users className="h-5 w-5" />}
            title="Build Your 100 List"
            description="Add the people who already know and support your business."
          />
          <QuickAction
            href="/portal/clients"
            icon={<ArrowRight className="h-5 w-5" />}
            title="Invite Customers"
            description="Mark outreach as you text, call, and talk to people."
          />
          <QuickAction
            href="/materials/mine"
            icon={<FileText className="h-5 w-5" />}
            title="View Materials"
            description="Open the scripts and flyers meant for business owners."
          />
          <QuickAction
            href="/portal/business"
            icon={<Store className="h-5 w-5" />}
            title="View My Business Profile"
            description="Keep your offer, products, and profile details current."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Activity Feed</CardTitle>
              <Link href="/portal/activity">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {activityFeed.length === 0 ? (
              <p className="text-sm text-surface-500">Your activity feed will fill in as you add and invite people from your list.</p>
            ) : (
              <div className="space-y-3">
                {activityFeed.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{item.title}</p>
                        <p className="mt-1 text-xs text-surface-500">{item.detail}</p>
                      </div>
                      <Badge variant={item.tone === 'success' ? 'success' : item.tone === 'info' ? 'info' : 'default'}>
                        {formatDateTime(item.createdAt)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Offer</p>
              <p className="mt-2 text-lg font-semibold text-surface-900">{portal.offer_title || 'Add your offer on My Business'}</p>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Products / Services</p>
              <p className="mt-2 text-sm text-surface-700">
                {getBusinessProducts(business).length > 0
                  ? getBusinessProducts(business).join(', ')
                  : 'Add your main products and services so LocalVIP can explain your business clearly.'}
              </p>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Description</p>
              <p className="mt-2 text-sm leading-6 text-surface-700">{business.public_description || portal.description || 'Describe what makes your business special.'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function buildActivityFeed(contacts: Contact[]): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const contact of contacts) {
    items.push({
      id: `${contact.id}-added`,
      title: `${getContactDisplayName(contact)} added to your 100 list`,
      detail: 'A new supporter was added to your business network.',
      createdAt: contact.created_at,
      tone: 'default',
    })

    if (contact.invited_at) {
      items.push({
        id: `${contact.id}-invited`,
        title: `${getContactDisplayName(contact)} marked as invited`,
        detail: 'You recorded an invite for this person.',
        createdAt: contact.invited_at,
        tone: 'info',
      })
    }

    if (contact.joined_at) {
      items.push({
        id: `${contact.id}-joined`,
        title: `${getContactDisplayName(contact)} joined`,
        detail: 'This person has now joined through your business list.',
        createdAt: contact.joined_at,
        tone: 'success',
      })
    }
  }

  return items
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6)
}

function SnapshotCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  detail: string
}) {
  return (
    <Card className="border-surface-200">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-surface-900">{value}</p>
          </div>
          <div className="rounded-2xl bg-surface-100 p-3 text-surface-600">{icon}</div>
        </div>
        <p className="text-sm text-surface-500">{detail}</p>
      </CardContent>
    </Card>
  )
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link href={href}>
      <Card className="h-full border-surface-200 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <CardContent className="flex h-full items-start gap-4 p-5">
          <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-surface-900">{title}</p>
            <p className="mt-1 text-sm text-surface-500">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
