import { NextRequest, NextResponse } from 'next/server'
import { fetchQaBusinessList } from '@/lib/server/qa-dashboard-businesses'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { filterQaBusinessesForAccess } from '@/lib/server/qa-business-access'

export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'business'])
  if ('error' in access) return access.error

  try {
    const businesses = filterQaBusinessesForAccess(access.shell, access.session.profile, await fetchQaBusinessList())
    const routeId = request.nextUrl.searchParams.get('id')
    const qaId = request.nextUrl.searchParams.get('qaId')
    const targetId = (routeId || qaId || '').trim()

    if (!targetId) {
      return NextResponse.json(businesses)
    }

    const filtered = businesses.filter((business) => String(business.id) === targetId)
    return NextResponse.json(filtered)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA business list could not be loaded.')
  }
}

/**
 * Create a business by proxying to the backend's POST /api/dashboard/v1/Business.
 * If the body includes `primaryUserId`, the backend links that user as the
 * primary contact (creates the AccountUser row + Branch.io shortlink).
 */
export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  let body: Record<string, unknown> | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  try {
    const res = await fetchQaApi('/api/dashboard/v1/Business', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await parseQaJsonResponse(res, 'Failed to create business.')
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof QaApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Failed.' }, { status: 500 })
  }
}
