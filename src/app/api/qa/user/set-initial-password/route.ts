import { NextRequest, NextResponse } from 'next/server'
import { setQaInitialPassword } from '@/lib/auth/qa-api'
import { parseJsonRequest, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

// First-login "set your password" step. Requires an authenticated QA session (the
// user has just signed in with their temporary password); the backend additionally
// only honours it while the force-reset flag is set.
export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const body = await parseJsonRequest<{ newPassword?: unknown }>(request)
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  try {
    const result = await setQaInitialPassword(newPassword)
    return NextResponse.json(result ?? { success: true })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The password could not be set.')
  }
}
