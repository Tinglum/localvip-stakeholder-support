'use client'

/**
 * BUSINESS DASHBOARD — overview only.
 *
 * Everything here is a summary that links out. The setup checklist lives on
 * /portal/setup, the network on /portal/network, the activity timeline on
 * /portal/activity, and the 100-list progress on /portal/clients. Nothing on
 * this page renders a second copy of any of them.
 */

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Clock3,
  Info,
  Network,
  Rocket,
  Sparkles,
  Store,
  Tag,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StripeSetupCard } from '@/components/business/stripe-setup-card'
import { StripeFinancialCard } from '@/components/business/stripe-financial-card'
import { useAuth } from '@/lib/auth/context'
import {
  getActivationLabel,
  getActivationTone,
  getBusinessActivationStatus,
  getBusinessLaunchPhase,
  getBusinessQaAccountId,
  getContactDisplayName,
  getContactListStatus,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import { getBusinessSetupSignals, getBusinessSetupState } from '@/lib/business-setup'
import { useBusinesses, useContacts, useOffers } from '@/lib/supabase/hooks'
import { cn, formatDateTime, formatNumber } from '@/lib/utils'
import type { Contact } from '@/lib/types/database'

type ActivityPreviewItem = {
  id: string
  title: string
  createdAt: string
  tone: 'default' | 'success' | 'info'
}

export function BusinessDashboardPage() {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {}
    if (profile.business_id) {
      filters.id = profile.business_id
    } else {
      filters.owner_id = profile.id
    }
    return filters
  }, [profile.business_id, profile.id])

  const { data: businesses, loading: businessesLoading } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])

  const contactFilters = React.useMemo<Record<string, string>>(
    () => ({ business_id: business?.id || '__none__' }),
    [business?.id],
  )
  const { data: contacts, loading: contactsLoading, refetch } = useContacts(contactFilters)
  const { data: offers } = useOffers({ business_id: business?.id || '__none__' })

  const qaAccountId = getBusinessQaAccountId(business)
  const networkSize = useNetworkSize(qaAccountId)

  // Refresh quietly when the owner returns to the tab, plus a calm 60s tick while
  // the page is actually visible — no constant background polling.
  React.useEffect(() => {
    if (!business) return

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refetch({ silent: true })
    }
    document.addEventListener('visibilitychange', refreshIfVisible)
    const interval = window.setInterval(refreshIfVisible, 60000)

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible)
      window.clearInterval(interval)
    }
  }, [business, refetch])

  if (businessesLoading || (business && contactsLoading)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your business dashboard...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Store className="h-8 w-8" />}
        title="Your business dashboard is almost ready"
        description="We couldn't find your business details for this account yet."
      />
    )
  }

  const activationStatus = getBusinessActivationStatus(business, contacts)
  const launchPhase = getBusinessLaunchPhase(business, contacts)
  const joinedCount = contacts.filter((contact) => getContactListStatus(contact) === 'joined').length
  const liveOffers = offers.filter((offer) => offer.status === 'active').length
  const progressPercent = Math.min(100, Math.round((contacts.length / 100) * 100))
  const activityPreview = buildActivityPreview(contacts)

  // The one next action comes from the shared setup checklist, so the dashboard
  // and /portal/setup can never disagree about what is left to do.
  const setup = getBusinessSetupState(getBusinessSetupSignals({ business, offers, contacts }))
  const nextStep = setup.nextStep
  const nextStepHref = nextStep
    ? nextStep.href || `/portal/setup?step=${nextStep.key}`
    : '/portal/network'

  const launchLabel =
    launchPhase === 'capturing_100'
      ? 'Building your first 100'
      : launchPhase === 'ready_to_go_live'
        ? 'Ready to go live'
        : launchPhase === 'live'
          ? 'Live'
          : 'Setup'

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${business.name}`}
        description="A quick read on where your business stands. Open any card to work on it."
        actions={
          <Badge variant={getActivationTone(activationStatus)} dot>
            {getActivationLabel(activationStatus)}
          </Badge>
        }
      />

      {/* First step: connect Stripe so the business can actually get paid.
          Hidden automatically once onboarding is complete. */}
      <StripeSetupCard />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-[linear-gradient(135deg,_rgba(245,158,11,0.15),_rgba(255,255,255,0.96)_38%,_rgba(132,204,22,0.16)_100%)] px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Today&apos;s best next step
              </div>

              <div>
                <h2 className="text-3xl font-bold tracking-tight text-surface-900">
                  {nextStep?.label || 'Everything is set up'}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-surface-600 sm:text-base">
                  {nextStep?.description || 'Your setup is finished. Keep an eye on your network and keep the list moving.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-surface-600">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-surface-400" />
                  {nextStep?.time || 'A quick check-in'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Info className="h-4 w-4 text-surface-400" />
                  {nextStep?.why || 'Steady attention to your list is what keeps growth compounding.'}
                </span>
              </div>

              <Button asChild size="lg">
                <Link href={nextStepHref}>
                  {nextStep?.ctaLabel || (nextStep ? 'Open this step' : 'See my network')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <Link
              href="/portal/clients"
              aria-label={`Progress to 100: ${contacts.length} of 100 people added. Open my 100 list.`}
              className={cn(
                'group rounded-[1.75rem] border border-white/90 bg-white/90 p-5 shadow-sm transition-all',
                'hover:-translate-y-0.5 hover:shadow-card-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Progress to 100</p>
              <p className="mt-2 text-3xl font-bold text-surface-900">{contacts.length} / 100</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-brand-500 to-lime-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-4 flex items-center gap-1 text-sm text-surface-600">
                Open my 100 list
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          href="/portal/network#joined-customers"
          icon={<Users className="h-5 w-5" />}
          label="Customers joined"
          value={formatNumber(joinedCount)}
          hint="See everyone who joined your team"
        />
        <KpiTile
          href="/portal/network"
          icon={<Network className="h-5 w-5" />}
          label="Network size"
          value={networkSize === null ? '—' : formatNumber(networkSize)}
          hint={networkSize === null ? 'Open your network to see the levels' : 'People connected across all 10 levels'}
        />
        <KpiTile
          href="/portal/business"
          icon={<Tag className="h-5 w-5" />}
          label="Offers live"
          value={formatNumber(liveOffers)}
          hint="Review your capture offer and cashback"
        />
        <KpiTile
          href="/portal/setup"
          icon={<Rocket className="h-5 w-5" />}
          label="Launch phase"
          value={launchLabel}
          hint={`${setup.completedCount} of ${setup.totalSteps} setup steps finished`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <StripeFinancialCard />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Latest activity</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/portal/activity">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {activityPreview.length === 0 ? (
              <p className="text-sm text-surface-500">
                This fills in as you add people, invite them, and see them join through your business.
              </p>
            ) : (
              activityPreview.map((item) => (
                <Link
                  key={item.id}
                  href="/portal/activity"
                  aria-label={`${item.title}. Open the full activity timeline.`}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors',
                    'hover:border-surface-300 hover:bg-surface-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                  )}
                >
                  <p className="text-sm font-medium text-surface-900">{item.title}</p>
                  <Badge variant={item.tone === 'success' ? 'success' : item.tone === 'info' ? 'info' : 'default'}>
                    {formatDateTime(item.createdAt)}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Total people in the business's downline. Degrades to null when unavailable. */
function useNetworkSize(qaAccountId: string | null) {
  const [size, setSize] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!qaAccountId) {
      setSize(null)
      return
    }

    let cancelled = false
    fetch(`/api/dashboard/network/tree?accountId=${encodeURIComponent(qaAccountId)}&depth=10&period=all`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { totalNodes?: number; nodes?: unknown[] } | null) => {
        if (cancelled || !json) return
        const total = typeof json.totalNodes === 'number' ? json.totalNodes : Array.isArray(json.nodes) ? json.nodes.length : null
        setSize(total)
      })
      .catch(() => {
        if (!cancelled) setSize(null)
      })

    return () => { cancelled = true }
  }, [qaAccountId])

  return size
}

function buildActivityPreview(contacts: Contact[]): ActivityPreviewItem[] {
  const items: ActivityPreviewItem[] = []

  for (const contact of contacts) {
    const name = getContactDisplayName(contact)
    items.push({ id: `${contact.id}-added`, title: `${name} was added to your list`, createdAt: contact.created_at, tone: 'default' })
    if (contact.invited_at) {
      items.push({ id: `${contact.id}-invited`, title: `${name} was marked as invited`, createdAt: contact.invited_at, tone: 'info' })
    }
    if (contact.joined_at) {
      items.push({ id: `${contact.id}-joined`, title: `${name} joined`, createdAt: contact.joined_at, tone: 'success' })
    }
  }

  return items
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 3)
}

function KpiTile({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}. ${hint}`}
      className={cn(
        'group block rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition-all',
        'hover:-translate-y-0.5 hover:shadow-card-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
          <p className="mt-2 truncate text-3xl font-bold text-surface-900">{value}</p>
        </div>
        <span className="rounded-2xl bg-surface-100 p-3 text-surface-600">{icon}</span>
      </div>
      <p className="mt-3 flex items-center gap-1 text-sm text-surface-500">
        {hint}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  )
}
