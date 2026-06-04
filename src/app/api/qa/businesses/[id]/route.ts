import { NextResponse } from 'next/server'
import { fetchQaBusinessDetail } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  try {
    const business = await fetchQaBusinessDetail(qaBusinessId)
    return NextResponse.json(business)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA business detail could not be loaded.')
  }
}

/** PUT — wire the business setup endpoint. Accepts the full BusinessSetupRequest
 * shape including businessHours and socialLinks. */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const res = await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}/setup`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await parseQaResponse<unknown>(res, 'Failed to update business.')
    return NextResponse.json(json)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA business could not be updated.')
  }
}
