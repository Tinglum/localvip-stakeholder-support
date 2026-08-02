import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

const UNAVAILABLE = { enabled: false, unavailable: true } as const

export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.source !== 'qa') return NextResponse.json(UNAVAILABLE)

  const businessId = request.nextUrl.searchParams.get('businessId')
  const days = normalizeDays(request.nextUrl.searchParams.get('days'))
  if (!businessId || !/^\d+$/.test(businessId)) {
    return NextResponse.json({ error: 'A valid business is required.' }, { status: 400 })
  }

  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  const query = new URLSearchParams({
    businessId,
    from: from.toISOString(),
    to: to.toISOString(),
  })

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/Ripple/advocacy?${query.toString()}`)
    if (!response.ok) {
      if (response.status !== 404 && response.status !== 503) {
        console.error('[ripple advocacy] upstream returned', response.status)
      }
      return NextResponse.json(UNAVAILABLE)
    }
    const json = await response.json().catch(() => null)
    return NextResponse.json(normalizeSummary(json, days))
  } catch (error) {
    console.error('[ripple advocacy] proxy failed', error)
    return NextResponse.json(UNAVAILABLE)
  }
}

function normalizeDays(value: string | null) {
  const parsed = Number(value)
  return parsed === 7 || parsed === 90 ? parsed : 30
}

function count(record: Record<string, unknown>, key: string) {
  const value = Number(record[key])
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
}

function normalizeSummary(value: unknown, days: number) {
  if (!value || typeof value !== 'object') return UNAVAILABLE
  const record = value as Record<string, unknown>
  return {
    enabled: record.enabled === true,
    unavailable: record.unavailable === true,
    cutoverAtUtc: typeof record.cutoverAtUtc === 'string' ? record.cutoverAtUtc : null,
    rangeDays: count(record, 'rangeDays') || days,
    eligiblePurchases: count(record, 'eligiblePurchases'),
    composerOpened: count(record, 'composerOpened'),
    recommendationsShared: count(record, 'recommendationsShared'),
    trackedViews: count(record, 'trackedViews'),
    newMembers: count(record, 'newMembers'),
    newCustomerPurchases: count(record, 'newCustomerPurchases'),
    attributedRevenueCents: count(record, 'attributedRevenueCents'),
    communityFundingCents: count(record, 'communityFundingCents'),
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'USD',
  }
}
