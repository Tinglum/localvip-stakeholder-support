import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import {
  CAUSE_LEAD_API,
  causeLeadUnavailableResponse,
  isCauseLeadEndpointMissing,
} from '@/lib/server/cause-lead-route'

/**
 * Cause sign-ups awaiting review, from the public form at
 * my.localvip.com/home/causes.
 *
 * Admin only, matching the backend: CauseLeadController is
 * [AuthorizeBearer(Roles = SysAdmin)] on every endpoint except the anonymous
 * submit. Gated the same way as /api/qa/giveback-leads, its business twin.
 *
 * Leads are NOT causes — they live in their own backend table precisely so an
 * anonymous public form cannot write into Accounts — so they cannot be read
 * through /api/qa/nonprofits and need their own route.
 *
 * Nothing here logs the response. Every field on a lead except `campaign`, the
 * id and the status is PII.
 */
export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const status = request.nextUrl.searchParams.get('status') || 'pending'

  try {
    const res = await fetchQaApi(`${CAUSE_LEAD_API}?status=${encodeURIComponent(status)}`)
    const data = await parseQaJsonResponse(res, 'Failed to load cause sign-ups.')
    return NextResponse.json(data)
  } catch (error) {
    if (isCauseLeadEndpointMissing(error)) return causeLeadUnavailableResponse()
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'Cause sign-ups could not be loaded.')
  }
}
