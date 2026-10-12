import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export async function POST(request: Request) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.source !== 'qa') return NextResponse.json({ error: 'Stripe is unavailable for this account.' }, { status: 409 })
  const raw = new URL(request.url).searchParams.get('businessId')?.replace(/^qa-/, '') || ''
  const id = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid business.' }, { status: 400 })
  try {
    const response = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${id}/dashboard-link`, { method: 'POST' })
    const payload = await response.json().catch(() => ({}))
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Stripe dashboard is temporarily unavailable.' }, { status: 502 })
  }
}
