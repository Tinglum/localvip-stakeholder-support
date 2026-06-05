import { NextResponse } from 'next/server'
import { fetchQaBusinessList } from '@/lib/server/qa-dashboard-businesses'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const { session, shell } = access

  try {
    const businesses = await fetchQaBusinessList()
    return NextResponse.json({
      ok: true,
      source: 'qa',
      checkedEndpoint: '/api/dashboard/v1/Business',
      shell,
      qaSession: {
        email: session.qaClaims?.email || null,
        sub: session.qaClaims?.sub || null,
        roles: session.qaClaims?.roles || [],
        expiresAt: session.qaSession?.expiresAt || null,
        hasRefreshToken: !!session.qaSession?.refreshToken,
      },
      count: businesses.length,
      sample: businesses.slice(0, 3),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: 'qa',
      checkedEndpoint: '/api/dashboard/v1/Business',
      shell,
      qaSession: {
        email: session.qaClaims?.email || null,
        sub: session.qaClaims?.sub || null,
        roles: session.qaClaims?.roles || [],
        expiresAt: session.qaSession?.expiresAt || null,
        hasRefreshToken: !!session.qaSession?.refreshToken,
      },
      error: error instanceof Error ? error.message : 'QA business probe failed.',
    }, { status: 502 })
  }
}
