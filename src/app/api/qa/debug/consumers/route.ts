import { NextResponse } from 'next/server'
import { fetchQaConsumerList } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'consumer'])
  if ('error' in access) return access.error

  const { session, shell } = access

  try {
    const consumers = await fetchQaConsumerList()
    return NextResponse.json({
      ok: true,
      source: 'qa',
      checkedEndpoint: '/api/dashboard/v1/Consumer',
      shell,
      qaSession: {
        email: session.qaClaims?.email || null,
        sub: session.qaClaims?.sub || null,
        roles: session.qaClaims?.roles || [],
        expiresAt: session.qaSession?.expiresAt || null,
        hasRefreshToken: !!session.qaSession?.refreshToken,
      },
      count: consumers.length,
      sample: consumers.slice(0, 3),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: 'qa',
      checkedEndpoint: '/api/dashboard/v1/Consumer',
      shell,
      qaSession: {
        email: session.qaClaims?.email || null,
        sub: session.qaClaims?.sub || null,
        roles: session.qaClaims?.roles || [],
        expiresAt: session.qaSession?.expiresAt || null,
        hasRefreshToken: !!session.qaSession?.refreshToken,
      },
      error: error instanceof Error ? error.message : 'QA consumer probe failed.',
    }, { status: 502 })
  }
}
