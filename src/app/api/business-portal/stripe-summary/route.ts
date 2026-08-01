import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

// Money summary for the signed-in business: balances, next payout, last-30-day
// volume, and the most recent payments. Proxies GET /api/dashboard/v1/StripeConnect/summary.
//
// The upstream response has no lifetime-volume field — do not invent one.
//
// The panel this feeds is a dashboard tile, not a page, so a bad day upstream
// must not turn into a red error box. Every failure path — no QA session,
// non-2xx, non-JSON, thrown fetch — resolves to the same quiet shape:
// `{ connected: false, unavailable: true }`, which renders as a placeholder.
// Failures are logged server-side so a real outage is still visible to us.
// This route must not return a non-200.
const UNAVAILABLE = { connected: false, unavailable: true } as const

export interface StripeSummaryPayment {
  id: string
  amount: number
  currency: string
  created: string
  customerName: string | null
  status: string
}

export interface StripeSummary {
  connected: boolean
  unavailable?: boolean
  currency?: string
  availableBalance?: number
  pendingBalance?: number
  nextPayoutAmount?: number | null
  nextPayoutDate?: string | null
  last30DaysVolume?: number
  last30DaysCount?: number
  recentPayments?: StripeSummaryPayment[]
}

function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function normalizePayments(value: unknown): StripeSummaryPayment[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry, index) => ({
      id: toStringOrNull(entry.id) || `payment-${index}`,
      amount: toNumber(entry.amount) ?? 0,
      currency: toStringOrNull(entry.currency) || 'USD',
      created: toStringOrNull(entry.created) || '',
      customerName: toStringOrNull(entry.customerName),
      status: toStringOrNull(entry.status) || 'unknown',
    }))
}

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.source !== 'qa') {
    // Demo/non-QA sessions have no Stripe Connect concept.
    return NextResponse.json(UNAVAILABLE)
  }

  try {
    const res = await fetchQaApi('/api/dashboard/v1/StripeConnect/summary')
    if (!res.ok) {
      console.error('[business stripe summary] upstream returned', res.status)
      return NextResponse.json(UNAVAILABLE)
    }

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('json')) return NextResponse.json(UNAVAILABLE)

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!json || typeof json !== 'object') return NextResponse.json(UNAVAILABLE)

    const summary: StripeSummary = {
      connected: json.connected === true,
      currency: toStringOrNull(json.currency) || 'USD',
      availableBalance: toNumber(json.availableBalance) ?? 0,
      pendingBalance: toNumber(json.pendingBalance) ?? 0,
      nextPayoutAmount: toNumber(json.nextPayoutAmount) ?? null,
      nextPayoutDate: toStringOrNull(json.nextPayoutDate),
      last30DaysVolume: toNumber(json.last30DaysVolume) ?? 0,
      last30DaysCount: toNumber(json.last30DaysCount) ?? 0,
      recentPayments: normalizePayments(json.recentPayments),
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[business stripe summary] proxy failed', error)
    return NextResponse.json(UNAVAILABLE)
  }
}
