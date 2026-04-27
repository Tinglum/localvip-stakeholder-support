import { NextRequest, NextResponse } from 'next/server'
import { submitQaReferralCode, type QaUserReferralCodeInput } from '@/lib/auth/qa-api'
import { parseJsonRequest, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const body = await parseJsonRequest<QaUserReferralCodeInput>(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A referral code payload is required.' }, { status: 400 })
  }

  try {
    const result = await submitQaReferralCode(body)
    return NextResponse.json(result ?? { success: true })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA referral code could not be submitted.')
  }
}
