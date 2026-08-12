'use client'

/**
 * HOME — status, earnings, network size, next step. READ-ONLY.
 *
 * Absorbs the old Activity tab: the full invite/join timeline now lives at the
 * bottom of this page instead of on its own route.
 *
 * The ONE accented card on this page is "Needs your input" — the summary of
 * unfinished, owner-actionable work. Everything else uses the neutral
 * treatment, because nothing else here changes data. If you are adding a card
 * that writes something, it belongs on My Business or Grow, not here.
 */

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Info,
  Network,
  Sparkles,
  Store,
  Tag,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StripeFinancialCard } from '@/components/business/stripe-financial-card'
import { BusinessAdvocacyPanel } from '@/components/business/business-advocacy-panel'
import { ActionSection, InfoSection, InfoStat, SurfaceLegend } from '@/components/business/business-surfaces'
import { useAuth } from '@/lib/auth/context'
import {
  getActivationLabel,
  getActivationTone,
  getBusinessActivationStatus,
  getBusinessLaunchPhase,
  getBusinessQaAccountId,
  getContactDisplayName,
  getContactListStatus,
  getNetworkMilestone,
  isBoomerangEnabledForBusiness,
  isCreatedToday,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import { BOOMERANG_SURFACE } from '@/lib/engagement-codes'
import { BUSINESS_BOOMERANG_NAV_HREF } from '@/lib/stakeholder-access'
import { useBusinessSetupStatus } from '@/lib/business-setup-status'
import { useBusinesses, useContacts, useOffers } from '@/lib/supabase/hooks'
import { cn, formatDateTime, formatNumber } from '@/lib/utils'
import type { Contact } from '@/lib/types/database'

type TimelineItem = {
  id: string
  label: string
  detail: string
  at: string
  tone: 'default' | 'info' | 'success'
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
  const { state: liveSetupState } = useBusinessSetupStatus(profile)

  const qaAccountId = getBusinessQaAccountId(business)
  const networkSize = useNetworkSize(qaAccountId)

  // Refresh quietly when the owner returns to the tab, plus a calm 60s tick
  // while the page is actually visible — no constant background polling.
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
  const boomerangEnabled = isBoomerangEnabledForBusiness(business)
  const joinedCount = contacts.filter((contact) => getContactListStatus(contact) === 'joined').length
  const invitedCount = contacts.filter((contact) => getContactListStatus(contact) !== 'added').length
  const todayAdds = contacts.filter((contact) => isCreatedToday(contact.created_at)).length
  const conversionRate = invitedCount > 0 ? Math.round((joinedCount / invitedCount) * 100) : 0
  const liveOffers = offers.filter((offer) => offer.status === 'active').length
  const progressPercent = Math.min(100, Math.round((contacts.length / 100) * 100))
  const milestone = getNetworkMilestone(contacts.length)
  const timeline = buildTimeline(contacts)

  // The next action comes from the shared setup checklist, so Home and the
  // wizard can never disagree about what is left to do.
  const setup = liveSetupState
  const nextStep = setup.nextStep
  const nextStepHref = nextStep ? `/portal/setup?step=${nextStep.key}` : '/portal/grow?section=network'
  const explicitlyOnboarded =
    String(business.status || '') === 'pending_live_review' || String(business.status || '') === 'live'

  // "Needs your input" = every unfinished setup requirement, plus the growth
  // nudge when setup is done but the list has not been started.
  const needsInput: Array<{ key: string; label: string; description: string; href: string }> = setup.steps
    .filter((step) => !step.complete)
    .map((step) => ({
      key: step.key,
      label: step.label,
      description: step.description,
      href: `/portal/setup?step=${step.key}`,
    }))

  // "Add your first customers" means the Boomerang list, so it is only a next
  // step for a business that has one.
  if (needsInput.length === 0 && contacts.length === 0 && boomerangEnabled) {
    needsInput.push({
      key: 'first-contacts',
      label: 'Add your first customers',
      description: `Your setup is finished. Start your ${BOOMERANG_SURFACE.tab.toLowerCase()} so your network has somewhere to grow from.`,
      href: BUSINESS_BOOMERANG_NAV_HREF,
    })
  }

  const launchLabel =
    launchPhase === 'capturing_100'
      ? `Building your ${BOOMERANG_SURFACE.tab.toLowerCase()}`
      : launchPhase === 'ready_to_go_live'
        ? 'Ready to go live'
        : launchPhase === 'live'
          ? 'Live'
          : 'Setup'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${business.name}`}
        description="A quick read on where your business stands. Nothing on this page changes your data — use My Business to edit and Grow to add people."
        actions={
          explicitlyOnboarded ? (
            <Badge variant={getActivationTone(activationStatus)} dot>
              {getActivationLabel(activationStatus)}
            </Badge>
          ) : (
            <Link href={nextStepHref}>
              <Badge variant="danger" dot className="cursor-pointer px-3 py-1.5 hover:bg-red-100">
                ONBOARDING
              </Badge>
            </Link>
          )
        }
      />

      <SurfaceLegend />

      {/* The one accented card on Home. */}
      {needsInput.length > 0 ? (
        <ActionSection
          title="Needs your input"
          description={`${needsInput.length} thing${needsInput.length === 1 ? '' : 's'} only you can finish. Everything else on this page is just information.`}
          complete={false}
          statusLabel={`${needsInput.length} open`}
          actions={
            <Button asChild size="sm">
              <Link href={nextStepHref}>
                {nextStep ? 'Open the next one' : 'Get started'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          <ul className="space-y-2">
            {needsInput.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 transition-colors',
                    'hover:border-amber-300 hover:bg-amber-50/60',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600" />
                      <span className="text-sm font-semibold text-surface-900">{item.label}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-surface-600">{item.description}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-surface-400" />
                </Link>
              </li>
            ))}
          </ul>
        </ActionSection>
      ) : (
        <InfoSection title="Nothing needs your input" description="Setup is complete and your list is moving.">
          <p className="flex items-center gap-2 text-sm text-success-700">
            <CheckCircle2 className="h-4 w-4" />
            You are all caught up. Keep growing your network from the Grow tab.
          </p>
        </InfoSection>
      )}

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-[linear-gradient(135deg,_rgba(245,158,11,0.15),_rgba(255,255,255,0.96)_38%,_rgba(132,204,22,0.16)_100%)] px-6 py-6">
          {/* One column when the progress card is gated out, so the next-step
              copy fills the card instead of leaving a dead half. */}
          <div className={cn('grid gap-6', boomerangEnabled && 'lg:grid-cols-[1.15fr,0.85fr]')}>
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
                  {nextStep?.description
                    || 'Your setup is finished. Keep an eye on your network and keep the list moving.'}
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
                  {nextStep ? 'Open this step' : 'See my network'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Progress toward 100 is a Boomerang-list measure. It is not shown
                to a business that does not have one — there is nothing to
                progress toward, and the card would advertise the feature. */}
            {boomerangEnabled ? (
            <Link
              href={BUSINESS_BOOMERANG_NAV_HREF}
              aria-label={`Progress to 100: ${contacts.length} of 100 people added. Open my ${BOOMERANG_SURFACE.tab.toLowerCase()}.`}
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
                <Badge variant={activationStatus === 'active' ? 'success' : activationStatus === 'in_progress' ? 'info' : 'warning'}>
                  {milestone.label}
                </Badge>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
            ) : null}
          </div>
        </div>
      </Card>

      <InfoSection
        title="Your numbers"
        description="Read-only. Open Grow to change any of them."
        bodyClassName="p-5"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Joins, invites and conversion all count Boomerang-list contacts.
              For a business without a list they are structurally zero, which
              reads as a broken dashboard rather than an absent feature. */}
          {boomerangEnabled ? (
          <InfoStat
            label="Customers joined"
            value={formatNumber(joinedCount)}
            hint="People who finished joining through your business"
            icon={<Users className="h-5 w-5" />}
          />
          ) : null}
          <InfoStat
            label="Network size"
            value={networkSize === null ? '—' : formatNumber(networkSize)}
            hint="People connected across all 10 levels"
            icon={<Network className="h-5 w-5" />}
          />
          <InfoStat
            label="Offers live"
            value={formatNumber(liveOffers)}
            hint="Active offers on your business"
            icon={<Tag className="h-5 w-5" />}
          />
          {boomerangEnabled ? (
            <>
              <InfoStat label="Invites sent" value={formatNumber(invitedCount)} hint="Contacts you have invited so far" />
              <InfoStat label="Conversion rate" value={`${conversionRate}%`} hint="Invites that turned into joins" />
              <InfoStat label="Added today" value={formatNumber(todayAdds)} hint={`Launch phase: ${launchLabel}`} />
            </>
          ) : (
            <InfoStat label="Launch phase" value={launchLabel} hint="Where your business is in going live" />
          )}
        </div>
      </InfoSection>

      <StripeFinancialCard />

      <BusinessAdvocacyPanel businessId={qaAccountId} compact />

      {/* Absorbed from the old Activity tab. */}
      <InfoSection
        title="Recent activity"
        description="Every add, invite, and join on your list, newest first."
      >
        {timeline.length === 0 ? (
          <p className="text-sm text-surface-500">
            This fills in as you add people, invite them, and see them join through your business.
          </p>
        ) : (
          <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {timeline.slice(0, 50).map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {item.tone === 'success' ? (
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-success-600" />
                    ) : (
                      <BarChart3 aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-500" />
                    )}
                    <p className="text-sm font-semibold text-surface-900">{item.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-surface-500">{item.detail}</p>
                </div>
                <Badge variant={item.tone === 'success' ? 'success' : item.tone === 'info' ? 'info' : 'default'}>
                  {formatDateTime(item.at)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </InfoSection>
    </div>
  )
}

/** Total people in the business's network. Degrades to null when unavailable. */
function useNetworkSize(qaAccountId: string | null) {
  const [size, setSize] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!qaAccountId) {
      setSize(null)
      return
    }

    let cancelled = false
    fetch(`/api/dashboard/network/tree?accountId=${encodeURIComponent(qaAccountId)}&depth=10&period=all`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { totalNodes?: number; nodes?: unknown[] } | null) => {
        if (cancelled || !json) return
        const total =
          typeof json.totalNodes === 'number' ? json.totalNodes : Array.isArray(json.nodes) ? json.nodes.length : null
        setSize(total)
      })
      .catch(() => {
        if (!cancelled) setSize(null)
      })

    return () => {
      cancelled = true
    }
  }, [qaAccountId])

  return size
}

function buildTimeline(contacts: Contact[]): TimelineItem[] {
  return contacts
    .flatMap((contact) => {
      const name = getContactDisplayName(contact)
      const items: TimelineItem[] = [
        {
          id: `${contact.id}-added`,
          label: `${name} added`,
          detail: 'Added to your list',
          at: contact.created_at,
          tone: 'default',
        },
      ]

      if (contact.invited_at) {
        items.push({
          id: `${contact.id}-invited`,
          label: `${name} invited`,
          detail: 'Invite recorded',
          at: contact.invited_at,
          tone: 'info',
        })
      }

      if (contact.joined_at) {
        items.push({
          id: `${contact.id}-joined`,
          label: `${name} joined`,
          detail: 'Joined through your business list',
          at: contact.joined_at,
          tone: 'success',
        })
      }

      return items
    })
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
}
