import { NextRequest, NextResponse } from 'next/server'
import { forgotQaUserPassword, type QaUserForgotPasswordInput } from '@/lib/auth/qa-api'
import { parseJsonRequest, qaRouteErrorResponse } from '@/lib/server/qa-route'

export async function POST(request: NextRequest) {
  const body = await parseJsonRequest<QaUserForgotPasswordInput>(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'An email payload is required.' }, { status: 400 })
  }

  try {
    const result = await forgotQaUserPassword(body)
    return NextResponse.json(result ?? { success: true })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA forgot-password request failed.')
  }
}
