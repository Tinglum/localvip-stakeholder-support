import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isAdminProfile } from '@/lib/stakeholder-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!isAdminProfile(session.profile)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  if (session.source !== 'qa') return NextResponse.json({ unavailable: true, cases: [] })
  try {
    const response = await fetchQaApi('/api/dashboard/v1/PaymentRisk/cases?limit=100')
    if (!response.ok) return NextResponse.json({ unavailable: true, cases: [] })
    return NextResponse.json(await response.json())
  } catch {
    return NextResponse.json({ unavailable: true, cases: [] })
  }
}
