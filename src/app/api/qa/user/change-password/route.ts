import { NextRequest, NextResponse } from 'next/server'
import { changeQaUserPassword, type QaUserChangePasswordInput } from '@/lib/auth/qa-api'
import { parseJsonRequest, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const body = await parseJsonRequest<QaUserChangePasswordInput>(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A password payload is required.' }, { status: 400 })
  }

  try {
    const result = await changeQaUserPassword(body)
    return NextResponse.json(result ?? { success: true })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA password could not be changed.')
  }
}
