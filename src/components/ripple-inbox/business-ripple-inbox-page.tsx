'use client'

/**
 * RIPPLE INBOX (business)
 * ────────────────────────
 * The actual recommendations customers wrote about this business. Businesses
 * previously saw only aggregate Ripple counters (see BusinessAdvocacyPanel) —
 * this is the first surface where they read a single recommendation.
 *
 * Framing matters: lead with the customer's own words, not the metrics, and
 * never imply the business can identify who wrote it. `displayName` is an
 * opt-in first name only; when it is null the card says "Anonymous".
 */

import * as React from 'react'
import { Eye, Loader2, MessageSquareQuote, Share2, ShoppingBag, Sparkles, Star, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { getBusinessQaAccountId, resolveScopedBusiness } from '@/lib/business-portal'
import { useBusinesses } from '@/lib/supabase/hooks'

interface RippleInboxItem {
  recommendationId: string
  preview: string
  tagLine: string | null
  standoutCode: string | null
  secondaryLabels: string[]
  rating: number | null
  displayName: string | null
  verifiedPurchaseAtUtc: string | null
  createdAtUtc: string | null
  shares: number
  views: number
  joins: number
  firstPurchases: number
}

interface RippleInboxResponse {
  businessAccountId: number
  total: number
  unavailable?: boolean
  items: RippleInboxItem[]
}

const EMPTY_RESPONSE: RippleInboxResponse = { businessAccountId: 0, total: 0, items: [] }

export function BusinessRippleInboxPage() {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(() => {
    const filters: Record<string, string> = {}
    if (profile.business_id) filters.id = profile.business_id
    else filters.owner_id = profile.id
    return filters
  }, [profile.business_id, profile.id])
  const { data: businesses } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const businessId = getBusinessQaAccountId(business)

  const [data, setData] = React.useState<RippleInboxResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!businessId) {
      setData({ ...EMPTY_RESPONSE, unavailable: true })
      return
    }
    const controller = new AbortController()
    setData(null)
    setError(null)
    fetch(`/api/business-portal/ripple-inbox?businessId=${encodeURIComponent(businessId)}&limit=50`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null
          throw new Error(body?.error || 'Could not load recommendations.')
        }
        return response.json() as Promise<RippleInboxResponse>
      })
      .then((value) => setData(value && typeof value === 'object' ? value : { ...EMPTY_RESPONSE, unavailable: true }))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Could not load recommendations.')
        setData({ ...EMPTY_RESPONSE, unavailable: true })
      })
    return () => controller.abort()
  }, [businessId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ripple inbox"
        description="What customers are saying when they recommend you. These are their own words — you never see who wrote it unless they chose to share a first name."
      />
      <Content data={data} error={error} />
    </div>
  )
}

function Content({ data, error }: { data: RippleInboxResponse | null; error: string | null }) {
  if (!data) {
    return (
      <Card className="flex items-center justify-center gap-2 border-surface-200 p-10 text-sm text-surface-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading recommendations...
      </Card>
    )
  }

  if (data.unavailable) {
    return (
      <Card className="border-dashed border-surface-300 bg-surface-50 p-8 text-center">
        <p className="font-semibold text-surface-900">Recommendations are not available yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-surface-500">
          {error || 'This inbox fills in automatically once the Ripple recommendation service is deployed.'}
        </p>
      </Card>
    )
  }

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareQuote className="h-6 w-6" />}
        title="No recommendations yet"
        description="Recommendations appear here after a customer pays with LocalVIP at your business and chooses to recommend you."
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-500">{data.total.toLocaleString()} recommendation{data.total === 1 ? '' : 's'}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.items.map((item) => (
          <RippleInboxCard key={item.recommendationId} item={item} />
        ))}
      </div>
    </div>
  )
}

function RippleInboxCard({ item }: { item: RippleInboxItem }) {
  const labels = [item.standoutCode, ...(item.secondaryLabels || [])].filter(
    (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index,
  )

  return (
    <Card className="flex h-full flex-col gap-4 border-surface-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <MessageSquareQuote aria-hidden="true" className="h-5 w-5 shrink-0 text-brand-500" />
        {item.rating != null ? <RatingStars rating={item.rating} /> : null}
      </div>

      {item.tagLine ? (
        <p className="text-base font-semibold leading-6 text-surface-900">&ldquo;{item.tagLine}&rdquo;</p>
      ) : null}

      <p className="text-sm leading-6 text-surface-700">{item.preview}</p>

      {labels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <Badge key={label} variant="info">{label}</Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-surface-100 pt-3">
        <div className="flex items-center gap-2 text-sm text-surface-600">
          <Sparkles className="h-3.5 w-3.5 text-surface-400" />
          <span className="font-medium text-surface-800">{item.displayName || 'Anonymous'}</span>
        </div>
        {item.verifiedPurchaseAtUtc ? (
          <Badge variant="success">Verified purchase &middot; {formatMonth(item.verifiedPurchaseAtUtc)}</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-surface-50 p-3">
        <MiniStat icon={<Share2 className="h-3.5 w-3.5" />} label="Shares" value={item.shares} />
        <MiniStat icon={<Eye className="h-3.5 w-3.5" />} label="Views" value={item.views} />
        <MiniStat icon={<UserPlus className="h-3.5 w-3.5" />} label="Joins" value={item.joins} />
        <MiniStat icon={<ShoppingBag className="h-3.5 w-3.5" />} label="First buys" value={item.firstPurchases} />
      </div>
    </Card>
  )
}

function RatingStars({ rating }: { rating: number }) {
  const rounded = Math.round(Math.min(5, Math.max(0, rating)))
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={index < rounded ? 'h-3.5 w-3.5 fill-warning-400 text-warning-400' : 'h-3.5 w-3.5 text-surface-300'}
        />
      ))}
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-surface-400">{icon}</span>
      <span className="text-sm font-bold text-surface-900">{value.toLocaleString()}</span>
      <span className="text-[10px] uppercase tracking-[0.1em] text-surface-500">{label}</span>
    </div>
  )
}

function formatMonth(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}
