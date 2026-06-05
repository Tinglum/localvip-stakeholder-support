import { NextResponse } from 'next/server'
import { getQaUserProfile } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const { session, shell } = access

  try {
    const profile = await getQaUserProfile()
    return NextResponse.json({
      ok: true,
      source: 'qa',
      checkedEndpoint: '/api/dashboard/v1/User/profile',
      shell,
      qaSession: {
        email: session.qaClaims?.email || null,
        sub: session.qaClaims?.sub || null,
        roles: session.qaClaims?.roles || [],
        expiresAt: session.qaSession?.expiresAt || null,
        hasRefreshToken: !!session.qaSession?.refreshToken,
      },
      profile,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: 'qa',
      checkedEndpoint: '/api/dashboard/v1/User/profile',
      shell,
      qaSession: {
        email: session.qaClaims?.email || null,
        sub: session.qaClaims?.sub || null,
        roles: session.qaClaims?.roles || [],
        expiresAt: session.qaSession?.expiresAt || null,
        hasRefreshToken: !!session.qaSession?.refreshToken,
      },
      error: error instanceof Error ? error.message : 'QA profile probe failed.',
    }, { status: 502 })
  }
}
