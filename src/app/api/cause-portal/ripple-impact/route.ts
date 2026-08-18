import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

/**
 * Proxy to Dashboard/RippleCauseImpact.
 *
 * Which cause the caller may read is decided UPSTREAM, same as every other
 * `cause-portal` route: the .NET controller checks AccountUsers membership
 * (NonprofitAdmin) or SysAdmin status and 403s a cause the caller does not
 * belong to. This route does not re-derive that — it only forwards the query
 * parameters the endpoint understands.
 */
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.source !== 'qa') {
    return NextResponse.json(
      { error: 'The cause dashboard requires a QA-backed session.' },
      { status: 409 },
    )
  }

  const causeAccountId = request.nextUrl.searchParams.get('causeAccountId')
  if (!causeAccountId) {
    return NextResponse.json({ error: 'causeAccountId is required.' }, { status: 400 })
  }

  const query = new URLSearchParams({ causeAccountId })
  const limit = request.nextUrl.searchParams.get('limit')
  if (limit) query.set('limit', limit)

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/RippleCauseImpact?${query.toString()}`)
    const body = await response.arrayBuffer()
    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Ripple impact is temporarily unavailable.' }, { status: 502 })
  }
}
