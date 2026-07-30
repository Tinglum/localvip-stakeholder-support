import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isAdminProfile } from '@/lib/stakeholder-access'
import {
  normalizeStripeReadinessReport,
  STRIPE_READINESS_UNAVAILABLE,
  type StripeReadinessReport,
} from '@/lib/stripe-readiness'

export const dynamic = 'force-dynamic'

// Payment-readiness roll-up across every business, for admins only.
//
// The consumer webapp hides any business that cannot take a Stripe payment, so
// a business failing this check is invisible to customers. Admins need that as
// an alarm, not a buried metric.
//
// The upstream QA endpoint is not deployed yet, so EVERY failure path — non-2xx,
// non-JSON, parse failure, thrown fetch — resolves to the same quiet shape:
// `{ unavailable: true, businesses: [] }`. The UI renders a placeholder for that
// and must never read it as an all-clear. This route must not return a non-200
// to an authenticated admin.

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isAdminProfile(session.profile)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (session.source !== 'qa') {
    // Demo/non-QA sessions have no Stripe Connect data behind them.
    return NextResponse.json(STRIPE_READINESS_UNAVAILABLE satisfies StripeReadinessReport)
  }

  try {
    const res = await fetchQaApi('/api/dashboard/v1/StripeConnect/readiness-report')
    if (!res.ok) return NextResponse.json(STRIPE_READINESS_UNAVAILABLE)

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('json')) return NextResponse.json(STRIPE_READINESS_UNAVAILABLE)

    const json = (await res.json().catch(() => null)) as unknown
    const report = normalizeStripeReadinessReport(json)
    if (!report) return NextResponse.json(STRIPE_READINESS_UNAVAILABLE)

    return NextResponse.json(report)
  } catch {
    return NextResponse.json(STRIPE_READINESS_UNAVAILABLE)
  }
}
