import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

/**
 * Proxy to Dashboard/CausePortalController.
 *
 * Which cause the caller may read is decided UPSTREAM: the .NET controller checks
 * AccountUsers membership on every action and 403s a cause the caller does not
 * belong to. This route deliberately does not try to re-derive that — one
 * membership check, in one place, is the whole point. It only forwards a
 * whitelisted resource and the query parameters that resource understands.
 */
const RESOURCES = new Set([
  'Causes',
  'Overview',
  'Trend',
  'Contributions',
  'Contributions.csv',
  'Supporters',
])

const PASSTHROUGH_PARAMS = ['causeAccountId', 'fromUtc', 'toUtc', 'page', 'pageSize', 'months']

export async function GET(request: NextRequest, { params }: { params: { resource: string } }) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.source !== 'qa') {
    return NextResponse.json(
      { error: 'The cause dashboard requires a QA-backed session.' },
      { status: 409 },
    )
  }
  if (!RESOURCES.has(params.resource)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const query = new URLSearchParams()
  for (const name of PASSTHROUGH_PARAMS) {
    const value = request.nextUrl.searchParams.get(name)
    if (value) query.set(name, value)
  }
  const suffix = query.toString() ? `?${query.toString()}` : ''

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/CausePortal/${params.resource}${suffix}`)
    const body = await response.arrayBuffer()
    const headers: Record<string, string> = {
      'content-type': response.headers.get('content-type') || 'application/json',
    }
    const disposition = response.headers.get('content-disposition')
    if (disposition) headers['content-disposition'] = disposition
    return new NextResponse(body, { status: response.status, statusText: response.statusText, headers })
  } catch {
    return NextResponse.json({ error: 'The cause portal is temporarily unavailable.' }, { status: 502 })
  }
}
