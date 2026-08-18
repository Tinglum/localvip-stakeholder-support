import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { resolveScopedPortalBusinessId } from '@/lib/server/portal-business'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50
const MIN_LIMIT = 1
const MAX_LIMIT = 200

function clampLimit(value: string | null) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, parsed))
}

async function forward(response: Response) {
  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  })
}

// The recommendations written about one business, in the business's own words.
// SysAdmin can name any business; a BusinessAdmin only their own membership —
// resolveScopedPortalBusinessId is the same authority every other business-portal
// endpoint uses, so an id supplied by the browser is never taken on trust.
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.source !== 'qa') {
    return NextResponse.json({ businessAccountId: 0, total: 0, unavailable: true, items: [] })
  }

  const scope = await resolveScopedPortalBusinessId(session, request.nextUrl.searchParams.get('businessId'))
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

  const query = new URLSearchParams({
    businessId: String(scope.businessId),
    limit: String(clampLimit(request.nextUrl.searchParams.get('limit'))),
  })

  try {
    return forward(await fetchQaApi(`/api/dashboard/v1/RippleBusinessInbox?${query.toString()}`))
  } catch {
    return NextResponse.json({ error: 'The recommendation inbox is temporarily unavailable.' }, { status: 502 })
  }
}
