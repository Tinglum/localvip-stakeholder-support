import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

const NOMINATION_STATUSES = ['received', 'contacted', 'onboarding', 'joined', 'declined'] as const

async function authorizeNominations() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can manage business nominations.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'Business nominations require a QA-backed admin session.' }, { status: 409 }) }
  }
  return { error: null }
}

async function forwardQaResponse(response: Response) {
  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  })
}

export async function GET(request: NextRequest) {
  const auth = await authorizeNominations()
  if (auth.error) return auth.error

  const query = new URLSearchParams()
  const status = request.nextUrl.searchParams.get('status')
  if (status) {
    if (!(NOMINATION_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Unknown nomination status.' }, { status: 400 })
    }
    query.set('status', status)
  }
  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)
  query.set('limit', String(Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 100))

  try {
    return forwardQaResponse(await fetchQaApi(`/api/dashboard/v1/BusinessNomination?${query.toString()}`))
  } catch {
    return NextResponse.json({ error: 'Business nominations are temporarily unavailable.' }, { status: 502 })
  }
}
