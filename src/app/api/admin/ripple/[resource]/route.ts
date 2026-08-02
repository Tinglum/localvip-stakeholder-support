import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

async function authorize() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can manage LocalVIP Ripple.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'Ripple diagnostics require a QA-backed admin session.' }, { status: 409 }) }
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

export async function GET(request: NextRequest, { params }: { params: { resource: string } }) {
  const auth = await authorize()
  if (auth.error) return auth.error

  let upstreamPath: string
  if (params.resource === 'readiness') {
    upstreamPath = '/api/dashboard/v1/Ripple/readiness'
  } else if (params.resource === 'reconciliation') {
    const query = new URLSearchParams()
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')
    const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') || '100', 10)
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    query.set('limit', String(Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100))
    upstreamPath = `/api/dashboard/v1/Ripple/reconciliation?${query.toString()}`
  } else {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  try {
    return forward(await fetchQaApi(upstreamPath))
  } catch {
    return NextResponse.json({ error: 'Ripple diagnostics are temporarily unavailable.' }, { status: 502 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { resource: string } }) {
  const auth = await authorize()
  if (auth.error) return auth.error
  if (params.resource !== 'enabled') return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const payload = await request.json().catch(() => null) as { enabled?: unknown } | null
  if (typeof payload?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean.' }, { status: 400 })
  }

  try {
    const response = await fetchQaApi('/api/dashboard/v1/Ripple/enabled', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: payload.enabled }),
    })
    return forward(response)
  } catch {
    return NextResponse.json({ error: 'The Ripple kill switch could not be updated.' }, { status: 502 })
  }
}
