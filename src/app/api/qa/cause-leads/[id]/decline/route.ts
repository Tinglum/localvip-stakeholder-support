import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import {
  CAUSE_LEAD_API,
  causeLeadUnavailableResponse,
  isCauseLeadEndpointMissing,
} from '@/lib/server/cause-lead-route'

/**
 * Decline a cause sign-up. Nothing is created; the row is kept as history with
 * the reviewer's reason. Admin only, matching the backend.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const id = parseQaRouteId(params.id)
  if (id === null) return NextResponse.json({ error: 'Invalid lead id.' }, { status: 400 })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    const res = await fetchQaApi(`${CAUSE_LEAD_API}/${id}/decline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await parseQaJsonResponse(res, 'Failed to decline the cause sign-up.')
    return NextResponse.json(data)
  } catch (error) {
    if (isCauseLeadEndpointMissing(error)) return causeLeadUnavailableResponse()
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'The cause sign-up could not be declined.')
  }
}
