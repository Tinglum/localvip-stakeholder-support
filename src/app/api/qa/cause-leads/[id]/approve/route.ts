import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import {
  CAUSE_LEAD_API,
  causeLeadUnavailableResponse,
  isCauseLeadEndpointMissing,
} from '@/lib/server/cause-lead-route'

/**
 * Approve a cause sign-up: the backend registers the real NonProfit account and
 * attaches it to the sponsor who shared the link. Admin only — this is the step
 * that turns anonymous form input into a live record.
 *
 * The body carries the reviewer's corrections, most importantly `address1`. The
 * public form does not require a street address and the registration path does,
 * so for most leads this request is the only place the address exists. It is
 * forwarded, never logged.
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
    // An approval with no corrections is valid when the lead already carries a
    // street address; the backend rejects it with a clear message when not.
    body = {}
  }

  try {
    const res = await fetchQaApi(`${CAUSE_LEAD_API}/${id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    // Throws on any non-2xx, so a failed registration can never leave here as
    // a success payload.
    const data = await parseQaJsonResponse(res, 'Failed to approve the cause sign-up.')
    return NextResponse.json(data)
  } catch (error) {
    if (isCauseLeadEndpointMissing(error)) return causeLeadUnavailableResponse()
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'The cause sign-up could not be approved.')
  }
}
