'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Heart,
  Info,
  Network,
  QrCode,
  Rocket,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'
import { NetworkTreeView } from '@/components/network/network-tree-view'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BusinessJoinQrCard } from '@/components/business/business-join-qr-card'
import { useAuth } from '@/lib/auth/context'
import { getBusinessJoinCaptureData } from '@/lib/business-join'
import { formatCashbackLabel, resolveBusinessOffer } from '@/lib/offers'
import {
  getActivationLabel,
  getActivationTone,
  getBusinessActivationStatus,
  getBusinessLaunchPhase,
  getBusinessPortalData,
  getBusinessProducts,
  getContactDisplayName,
  getContactListStatus,
  getNetworkMilestone,
  isCreatedToday,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import { useBusinesses, useContacts, useOffers } from '@/lib/supabase/hooks'
import { formatDateTime } from '@/lib/utils'
import type { Contact } from '@/lib/types/database'

type ActivityItem = {
  id: string
  title: string
  detail: string
  createdAt: string
  tone: 'default' | 'success' | 'info'
}

type GuidedStep = {
  key: string
  label: string
  shortLabel: string
  href: string
  ctaLabel: string
  complete: boolean
  detail: string
  why: string
  time: string
}

type BusinessDashboardTab = 'overview' | 'network'

function getBusinessQaAccountId(business: { external_id?: string | null; metadata?: Record<string, unknown> | null } | null): string | null {
  if (!business) return null
  if (business.external_id && /^\d+$/.test(business.external_id.trim())) {
    return business.external_id.trim()
  }
  const meta = (business.metadata as Record<string, unknown> | null) || {}
  const candidate = meta.qaAccountId ?? meta.qaBusinessId ?? meta.qa_account_id
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate)
  if (typeof candidate === 'string' && /^\d+$/.test(candidate.trim())) return candidate.trim()
  return null
}

export function BusinessDashboardPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = React.useState<BusinessDashboardTab>('overview')
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

  const contactFilters = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {}
    filters.business_id = business?.id || '__none__'
    return filters
  }, [business?.id])

  const { data: contacts, loading: contactsLoading, refetch } = useContacts(contactFilters)
  const { data: offers } = useOffers({ business_id: business?.id || '__none__' })

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
        description="A business needs to be linked to this account before we can show your simple setup steps."
      />
    )
  }

  const portal = getBusinessPortalData(business)
  const capture = getBusinessJoinCaptureData(business)
  const captureOffer = resolveBusinessOffer(business, offers, 'capture')
  const cashbackOffer = resolveBusinessOffer(business, offers, 'cashback')
  const hasCaptureReady = !!(capture.join_url || capture.qr_code_id)
  const activationStatus = getBusinessActivationStatus(business, contacts)
  const launchPhase = getBusinessLaunchPhase(business, contacts)
  const milestone = getNetworkMilestone(contacts.length)
  const invitedCount = contacts.filter((contact) => getContactListStatus(contact) !== 'added').length
  const joinedCount = contacts.filter((contact) => getContactListStatus(contact) === 'joined').length
  const todayAdds = contacts.filter((contact) => isCreatedToday(contact.created_at)).length
  const progressPercent = Math.min(100, Math.round((contacts.length / 100) * 100))
  const activityFeed = buildActivityFeed(contacts)
  // Beginner "do this now" signals (#22): added-but-not-invited, invited-but-not-joined.
  const addedNotInvited = Math.max(0, contacts.length - invitedCount)
  const invitedNotJoined = Math.max(0, invitedCount - joinedCount)

  const guidedSteps: GuidedStep[] = [
    {
      key: 'step-list',
      label: 'Build your first customer list',
      shortLabel: 'Start your list',
      href: '/portal/clients',
      ctaLabel: contacts.length > 0 ? 'Open my list' : 'Add your first people',
      complete: contacts.length > 0,
      detail: contacts.length > 0
        ? `${contacts.length} people are already in your list.`
        : 'Start with the first 10 people who already know your business.',
      why: 'This is how you build your first 100 supporters without cold outreach.',
      time: '5 to 10 minutes',
    },
    {
      key: 'step-invite',
      label: 'Invite people you already know',
      shortLabel: 'Invite people',
      href: '/portal/clients',
      ctaLabel: invitedCount > 0 ? 'Review invitations' : 'Start inviting',
      complete: invitedCount >= 10,
      detail: invitedCount > 0
        ? `${invitedCount} people have already been invited.`
        : 'Mark people as invited as you text, call, or talk to them in person.',
      why: 'Simple follow-up is what turns your list into real joins.',
      time: '10 minutes',
    },
    {
      key: 'step-qr',
      label: 'Share your join QR code',
      shortLabel: 'Share your QR',
      href: '/portal/clients',
      ctaLabel: hasCaptureReady ? 'Open QR tools' : 'Finish QR setup',
      complete: hasCaptureReady,
      detail: hasCaptureReady
        ? 'Your join link and QR code are ready to use in person.'
        : 'Your QR and join link will appear here once your setup is ready.',
      why: 'A visible QR code makes it easy for customers to join on the spot.',
      time: '2 minutes',
    },
    {
      key: 'step-profile',
      label: 'Check your business profile',
      shortLabel: 'Check profile',
      href: '/portal/business',
      ctaLabel: 'Review profile',
      complete: !!business.category && !!(business.public_description || portal.description),
      detail: business.category
        ? `Your business category is set to ${business.category}.`
        : 'Add your category, a short description, and your offer details.',
      why: 'A clear profile helps customers quickly understand what you offer.',
      time: '5 minutes',
    },
    {
      key: 'step-live',
      label: 'Get ready to go live',
      shortLabel: 'Go live',
      href: '/portal/setup',
      ctaLabel: 'Open setup',
      complete: launchPhase === 'ready_to_go_live' || launchPhase === 'live',
      detail:
        launchPhase === 'ready_to_go_live' || launchPhase === 'live'
          ? 'Your first 100 customers are in place and you are ready to grow.'
          : 'Complete your first 100 customers to unlock the live cashback phase.',
      why: 'This is the point where your setup turns into steady, repeatable growth.',
      time: 'Ongoing',
    },
  ]

  const qaAccountId = getBusinessQaAccountId(business)

  const pendingSteps = guidedSteps.filter((step) => !step.complete)
  const completedSteps = guidedSteps.filter((step) => step.complete)
  const nextStep = pendingSteps[0] || completedSteps[completedSteps.length - 1]
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
        description="This page shows the one best next step, what it means, and the simplest way to keep moving."
        actions={
          <Badge variant={getActivationTone(activationStatus)} dot>
            {getActivationLabel(activationStatus)}
          </Badge>
        }
      />

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-surface-200 bg-surface-50 p-1">
        {([
          { key: 'overview' as const, label: 'Overview', icon: <Rocket className="h-4 w-4" /> },
          { key: 'network' as const, label: 'Network', icon: <Network className="h-4 w-4" /> },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'network' ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-surface-900">Your business network</h2>
            <p className="mt-1 text-sm leading-6 text-surface-500">
              Everyone connected to {business.name} across up to 10 levels, and the earnings they help create. This view is read-only.
            </p>
          </div>
          {qaAccountId ? (
            <NetworkTreeView accountId={qaAccountId} nodeLabel="business" />
          ) : (
            <EmptyState
              icon={<Network className="h-8 w-8" />}
              title="Network is not connected yet"
              description="This business is not linked to a network account yet. Once it is fully set up on the platform, your downline will appear here."
            />
          )}
        </div>
      ) : (
      <>
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
                  {nextStep?.label || 'Your setup is in a strong place'}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-surface-600 sm:text-base">
                  {nextStep?.detail || 'Your main steps are complete. Keep your list active and keep sharing your business.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile
                  icon={<Clock3 className="h-4 w-4" />}
                  title="How long it takes"
                  description={nextStep?.time || 'A quick check-in'}
                />
                <InfoTile
                  icon={<Info className="h-4 w-4" />}
                  title="Why it matters"
                  description={nextStep?.why || 'It keeps your business growth moving in the right order.'}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={nextStep?.href || '/portal/clients'}>
                    {nextStep?.ctaLabel || 'Open next step'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/portal/setup">See full setup path</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/90 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
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
              <details className="mt-3 rounded-2xl border border-surface-200 bg-surface-50 px-3 py-2 text-xs text-surface-600">
                <summary className="cursor-pointer font-medium text-surface-700">What do Invited and Joined mean?</summary>
                <p className="mt-2 leading-6">
                  <strong>Invited</strong> = people you have already reached out to. <strong>Joined</strong> = people who
                  finished signing up to your list. Your goal is simply to turn Invited into Joined.
                </p>
              </details>
              <div className="mt-4 rounded-2xl border border-surface-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Done so far</p>
                <p className="mt-1 text-sm text-surface-700">
                  {completedSteps.length} of {guidedSteps.length} setup steps completed
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-surface-900">Your #1 growth tool: share your join QR</h2>
          <p className="mt-1 text-sm leading-6 text-surface-500">
            This is the fastest way to grow. Show it, let people scan, and they join your list on the spot.
          </p>
        </div>
        <BusinessJoinQrCard
          business={business}
          totalClients={contacts.length}
          todayAdds={todayAdds}
          progressPercent={progressPercent}
          compact
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Simple setup path</CardTitle>
            <p className="text-sm leading-6 text-surface-500">
              Work from top to bottom. Each step tells you what to do, why it matters, and how long it usually takes.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {guidedSteps.map((step) => (
              <div
                key={step.key}
                className={cn(
                  'rounded-2xl border p-4 shadow-sm transition-colors',
                  step.complete ? 'border-success-200 bg-success-50/60' : 'border-surface-200 bg-white'
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {step.complete ? (
                        <CheckCircle2 className="h-4 w-4 text-success-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-surface-300" />
                      )}
                      <p className="text-sm font-semibold text-surface-900">{step.label}</p>
                      <Badge variant={step.complete ? 'success' : 'info'}>
                        {step.complete ? 'Done' : 'Do next'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-surface-600">{step.detail}</p>
                    <div className="mt-3 grid gap-2 text-xs text-surface-500 sm:grid-cols-2">
                      <div className="rounded-xl bg-surface-50 px-3 py-2">
                        <span className="font-medium text-surface-700">Why this matters:</span> {step.why}
                      </div>
                      <div className="rounded-xl bg-surface-50 px-3 py-2">
                        <span className="font-medium text-surface-700">Typical time:</span> {step.time}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild size="sm" variant={step.complete ? 'outline' : 'default'}>
                      <Link href={step.href}>
                        {step.ctaLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What these words mean</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-surface-600">
              <PlainLanguageItem
                label="Customer capture offer"
                meaning="The simple offer you use to help people join your first 100-list. This is for early growth, not your long-term cashback."
              />
              <PlainLanguageItem
                label="LocalVIP cashback"
                meaning="The reward customers get back when your business is live and running normally."
              />
              <PlainLanguageItem
                label="Launch phase"
                meaning="This tells you whether you are still building your first 100 people, ready to go live, or already live."
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-surface-200">
            <CardHeader>
              <CardTitle>How to use your join QR</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4 text-sm leading-6 text-brand-800">
                Keep this very simple: show the QR, ask the customer to scan it, and tell them it is the easiest way
                to join your business list.
              </div>
              <ol className="space-y-3 text-sm text-surface-600">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-semibold text-surface-700">1</span>
                  <span>Keep the QR visible at the counter, till, table, or wherever people naturally pause.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-semibold text-surface-700">2</span>
                  <span>Use one short sentence: &quot;Scan this to join our LocalVIP list.&quot;</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-semibold text-surface-700">3</span>
                  <span>Check your list later and mark the people you already invited so nothing gets forgotten.</span>
                </li>
              </ol>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/portal/clients">
                    Open QR and join tools
                    <QrCode className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/materials/mine">Open business materials</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          icon={<Users className="h-5 w-5" />}
          label="People who have joined"
          value={joinedCount}
          detail={`${contacts.length} total people are in your list right now.`}
          explainer="This number shows how many people from your business list have already joined through your invite flow."
        />
        <SnapshotCard
          icon={<Heart className="h-5 w-5" />}
          label="Your join offer"
          value={captureOffer.value_label || captureOffer.headline}
          detail="This is the offer you use while building your first 100 people."
          explainer="Think of this as your early growth offer. It helps people join before you move into your ongoing live rewards."
        />
        <SnapshotCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Live cashback"
          value={formatCashbackLabel(cashbackOffer.cashback_percent)}
          detail="This is the standard reward customers receive when you are live."
          explainer="Once your setup is complete, this becomes the ongoing customer reward tied to your business."
        />
        <SnapshotCard
          icon={<Store className="h-5 w-5" />}
          label="Current stage"
          value={launchLabel}
          detail={business.category || 'Add your business category in your profile.'}
          explainer="This stage tells you how far along your business is, from setup through live operation."
        />
      </div>

      <div>
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-surface-900">Simple tools</h2>
          <p className="mt-1 text-sm leading-6 text-surface-500">
            These are the easiest places to go when you want to take action quickly.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SimpleToolCard
            href="/portal/clients"
            title="Open my 100 list"
            label="Best first step"
            description="Add people, invite them, and keep your list moving."
            icon={<Users className="h-5 w-5" />}
          />
          <SimpleToolCard
            href="/portal/business"
            title="Review my business profile"
            label="Profile check"
            description="Make sure your business description and category are easy to understand."
            icon={<Store className="h-5 w-5" />}
          />
          <SimpleToolCard
            href="/materials/mine"
            title="Open my materials"
            label="Helpful support"
            description="See the flyers, scripts, and tools made for business owners."
            icon={<FileText className="h-5 w-5" />}
          />
          <SimpleToolCard
            href="/portal/grow"
            title="Invite another business"
            label="Growth option"
            description="Use this when you are ready to help another local business join."
            icon={<Heart className="h-5 w-5" />}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Wins and what needs attention</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/portal/activity">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(addedNotInvited > 0 || invitedNotJoined > 0) && (
              <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Do this now</p>
                {addedNotInvited > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-amber-900">
                      {addedNotInvited} {addedNotInvited === 1 ? 'person is' : 'people are'} on your list but not invited yet.
                    </p>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/portal/clients">Invite them</Link>
                    </Button>
                  </div>
                )}
                {invitedNotJoined > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-amber-900">
                      {invitedNotJoined} invited {invitedNotJoined === 1 ? 'person hasn’t' : 'people haven’t'} joined yet — a friendly nudge helps.
                    </p>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/portal/clients">Follow up</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
            {activityFeed.length > 0 && (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-success-700">Recent wins</p>
            )}
            {activityFeed.length === 0 ? (
              <p className="text-sm text-surface-500">
                This area will fill in as you add people, invite them, and see them join through your business.
              </p>
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
            <CardTitle>Business basics at a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoPanel
              title="Customer capture offer"
              body={captureOffer.headline}
              detail={captureOffer.description || 'Add a short reason for someone to join your list.'}
              example="Example: Join our VIP list and get your first LocalVIP welcome perk."
            />
            <InfoPanel
              title="LocalVIP cashback"
              body={formatCashbackLabel(cashbackOffer.cashback_percent)}
              detail={cashbackOffer.description || 'Set the customer reward you want people to receive when you are live.'}
              example="Example: Customers receive cashback every time they shop with us through LocalVIP."
            />
            <InfoPanel
              title="Products and services"
              body={
                getBusinessProducts(business).length > 0
                  ? getBusinessProducts(business).join(', ')
                  : 'Add your main products or services.'
              }
              detail="People understand your business faster when the main things you sell are easy to read."
              example="Example: Coffee, pastries, catering, and custom cakes."
            />
            <InfoPanel
              title="Description"
              body={business.public_description || portal.description || 'Describe what makes your business special.'}
              detail="A short plain-English description is enough. Think about how you would explain the business out loud."
              example="Example: We are a neighborhood bakery known for fresh bread, custom cakes, and friendly service."
            />
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  )
}

function buildActivityFeed(contacts: Contact[]): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const contact of contacts) {
    items.push({
      id: `${contact.id}-added`,
      title: `${getContactDisplayName(contact)} was added to your list`,
      detail: 'You added another person who already knows your business.',
      createdAt: contact.created_at,
      tone: 'default',
    })

    if (contact.invited_at) {
      items.push({
        id: `${contact.id}-invited`,
        title: `${getContactDisplayName(contact)} was marked as invited`,
        detail: 'You recorded that you reached out to this person.',
        createdAt: contact.invited_at,
        tone: 'info',
      })
    }

    if (contact.joined_at) {
      items.push({
        id: `${contact.id}-joined`,
        title: `${getContactDisplayName(contact)} joined`,
        detail: 'This person completed the join flow through your business list.',
        createdAt: contact.joined_at,
        tone: 'success',
      })
    }
  }

  return items
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6)
}

function InfoTile({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
      <div className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-surface-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p>
    </div>
  )
}

function PlainLanguageItem({ label, meaning }: { label: string; meaning: string }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-sm font-semibold text-surface-900">{label}</p>
      <p className="mt-1 text-sm leading-6 text-surface-600">{meaning}</p>
    </div>
  )
}

function SnapshotCard({
  icon,
  label,
  value,
  detail,
  explainer,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  detail: string
  explainer: string
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
        <details className="rounded-2xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-600">
          <summary className="cursor-pointer font-medium text-surface-700">What this means</summary>
          <p className="mt-2 leading-6">{explainer}</p>
        </details>
      </CardContent>
    </Card>
  )
}

function InfoPanel({
  title,
  body,
  detail,
  example,
}: {
  title: string
  body: string
  detail: string
  example?: string
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-surface-900">{body}</p>
      <p className="mt-2 text-sm leading-6 text-surface-600">{detail}</p>
      {example ? (
        <details className="mt-3 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-600">
          <summary className="cursor-pointer font-medium text-surface-700">See an example</summary>
          <p className="mt-2 leading-6">{example}</p>
        </details>
      ) : null}
    </div>
  )
}

function SimpleToolCard({
  href,
  title,
  label,
  description,
  icon,
}: {
  href: string
  title: string
  label: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <CardContent className="flex h-full items-start gap-4 p-5">
          <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">{label}</p>
            <p className="mt-1 text-sm font-semibold text-surface-900">{title}</p>
            <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
