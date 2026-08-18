import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

async function authorize() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can moderate LocalVIP Ripple.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'Ripple moderation requires a QA-backed admin session.' }, { status: 409 }) }
  }
  return { error: null }
}

async function forward(response: Response) {
  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  })
}

export async function GET(request: NextRequest) {
  const auth = await authorize()
  if (auth.error) return auth.error

  const query = new URLSearchParams()
  const status = request.nextUrl.searchParams.get('status')
  query.set('status', status && status.trim() ? status.trim() : 'open')
  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)
  query.set('limit', String(Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 50))

  try {
    return forward(await fetchQaApi(`/api/dashboard/v1/Ripple/moderation?${query.toString()}`))
  } catch {
    return NextResponse.json({ error: 'The Ripple moderation queue is temporarily unavailable.' }, { status: 502 })
  }
}
