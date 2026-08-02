'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, HeartHandshake, Loader2, MousePointerClick, Share2, ShoppingBag, UserPlus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InfoSection, InfoStat } from '@/components/business/business-surfaces'

type RangeDays = 7 | 30 | 90

interface AdvocacySummary {
  enabled: boolean
  unavailable?: boolean
  rangeDays?: number
  eligiblePurchases: number
  composerOpened: number
  recommendationsShared: number
  trackedViews: number
  newMembers: number
  newCustomerPurchases: number
  attributedRevenueCents: number
  communityFundingCents: number
  currency?: string
}

const EMPTY: AdvocacySummary = {
  enabled: false,
  eligiblePurchases: 0,
  composerOpened: 0,
  recommendationsShared: 0,
  trackedViews: 0,
  newMembers: 0,
  newCustomerPurchases: 0,
  attributedRevenueCents: 0,
  communityFundingCents: 0,
}

export function BusinessAdvocacyPanel({ businessId, compact = false }: { businessId: string | null; compact?: boolean }) {
  const [days, setDays] = React.useState<RangeDays>(30)
  const [summary, setSummary] = React.useState<AdvocacySummary | null>(null)

  React.useEffect(() => {
    if (!businessId) {
      setSummary({ ...EMPTY, unavailable: true })
      return
    }
    const controller = new AbortController()
    setSummary(null)
    fetch(`/api/business-portal/ripple-advocacy?businessId=${encodeURIComponent(businessId)}&days=${days}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((value: AdvocacySummary | null) => setSummary(value && typeof value === 'object' ? value : { ...EMPTY, unavailable: true }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSummary({ ...EMPTY, unavailable: true })
      })
    return () => controller.abort()
  }, [businessId, days])

  if (compact) {
    return (
      <InfoSection
        title="Customer-powered growth"
        description="Verified customers can privately recommend your business. You see aggregate results, never customer or visitor identities."
        actions={<Button asChild variant="outline" size="sm"><Link href="/portal/grow?section=advocacy">View the funnel<ArrowRight className="h-4 w-4" /></Link></Button>}
      >
        <PanelState summary={summary} compact />
      </InfoSection>
    )
  }

  return (
    <InfoSection
      title="Customer-powered growth"
      description="From eligible purchases to new customers. Counts begin when Ripple is enabled and contain no customer identities."
      actions={
        <div className="flex rounded-xl border border-surface-200 bg-surface-50 p-1" aria-label="Reporting range">
          {([7, 30, 90] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${days === value ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-800'}`}
            >
              {value} days
            </button>
          ))}
        </div>
      }
    >
      <PanelState summary={summary} />
    </InfoSection>
  )
}

function PanelState({ summary, compact = false }: { summary: AdvocacySummary | null; compact?: boolean }) {
  if (!summary) return <p className="flex items-center gap-2 text-sm text-surface-500"><Loader2 className="h-4 w-4 animate-spin" />Loading recommendation results...</p>
  if (summary.unavailable) return <QuietState title="Recommendation reporting is not available yet" body="This panel will fill automatically when the Phase 1 service is deployed." />
  if (!summary.enabled) return <QuietState title="Customer recommendations are being prepared" body="Ripple is safely paused until its attribution and privacy readiness checks pass. No setup is required from you." badge="Coming soon" />
  if (summary.eligiblePurchases === 0) return <QuietState title="No eligible purchases in this range" body="Once a settled customer purchase qualifies, that customer can recommend your business from their Impact Moment." />

  if (compact) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <CompactFact label="Recommendations shared" value={summary.recommendationsShared} />
        <CompactFact label="Tracked views" value={summary.trackedViews} />
        <CompactFact label="New customers" value={summary.newCustomerPurchases} />
      </div>
    )
  }

  const stages = [
    ['Eligible purchases', summary.eligiblePurchases, ShoppingBag],
    ['Creator opened', summary.composerOpened, MousePointerClick],
    ['Recommendations shared', summary.recommendationsShared, Share2],
    ['Tracked views', summary.trackedViews, Users],
    ['New members', summary.newMembers, UserPlus],
    ['New customer purchases', summary.newCustomerPurchases, HeartHandshake],
  ] as const

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stages.map(([label, value, Icon], index) => (
          <div key={label} className="relative rounded-2xl border border-surface-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs uppercase tracking-[0.14em] text-surface-500">{index + 1}. {label}</p><p className="mt-2 text-3xl font-bold text-surface-900">{value.toLocaleString()}</p></div>
              <span className="rounded-xl bg-surface-100 p-2 text-surface-500"><Icon className="h-4 w-4" /></span>
            </div>
            {index > 0 ? <p className="mt-3 text-xs text-surface-500">{conversion(value, stages[index - 1][1])} from the previous step</p> : null}
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoStat label="Attributed purchase revenue" value={money(summary.attributedRevenueCents, summary.currency)} hint="Settled purchase value, excluding tips" />
        <InfoStat label="Community funding" value={money(summary.communityFundingCents, summary.currency)} hint="Cause funding from attributed first purchases" />
      </div>
      <p className="text-xs leading-5 text-surface-500">A tracked view requires consent and a visible human visit. A new customer purchase is a new member&apos;s first settled LocalVIP purchase at your business.</p>
    </div>
  )
}

function QuietState({ title, body, badge }: { title: string; body: string; badge?: string }) {
  return <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-5"><div className="flex items-center gap-2"><p className="font-semibold text-surface-900">{title}</p>{badge ? <Badge variant="info">{badge}</Badge> : null}</div><p className="mt-2 max-w-2xl text-sm leading-6 text-surface-500">{body}</p></div>
}

function CompactFact({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4"><p className="text-xs uppercase tracking-[0.14em] text-surface-500">{label}</p><p className="mt-1 text-2xl font-bold text-surface-900">{value.toLocaleString()}</p></div>
}

function conversion(value: number, prior: number) {
  if (prior <= 0) return '0%'
  return `${Math.round((value / prior) * 100)}%`
}

function money(cents: number, currency = 'USD') {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100) }
  catch { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100) }
}
