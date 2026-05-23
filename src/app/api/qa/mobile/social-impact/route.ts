import { NextRequest, NextResponse } from 'next/server'
import { fetchSocialImpact, fetchSocialImpactFriends } from '@/lib/server/qa-mobile-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const { searchParams } = request.nextUrl
  const scope = searchParams.get('scope')

  try {
    if (scope === 'friends') {
      const data = await fetchSocialImpactFriends()
      return NextResponse.json(data)
    }

    const data = await fetchSocialImpact()
    return NextResponse.json(data)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Failed to load social impact data.')
  }
}
