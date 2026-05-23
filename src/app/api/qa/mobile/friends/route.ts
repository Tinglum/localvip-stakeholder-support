import { NextResponse } from 'next/server'
import { fetchFriendList } from '@/lib/server/qa-mobile-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  try {
    const data = await fetchFriendList()
    return NextResponse.json(data)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Failed to load friend list.')
  }
}
