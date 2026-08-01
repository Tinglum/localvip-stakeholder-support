import { NextResponse } from 'next/server'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaNonprofitId = parseQaRouteId(params.id)
  if (qaNonprofitId === null) {
    return NextResponse.json({ error: 'A numeric QA nonprofit id is required.' }, { status: 400 })
  }

  try {
    const nonprofit = await fetchQaCauseDetail(qaNonprofitId)
    return NextResponse.json(nonprofit)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA nonprofit detail could not be loaded.')
  }
}

/** PUT — CRM pipeline annotations for a cause (stage, status, campaign,
 * duplicate), forwarded to the QA Account /crm endpoint, plus the cause's own
 * profile settings (currently the referrer-search opt-in), forwarded to the
 * Nonprofit profile endpoint. A request may carry either or both. */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaNonprofitId = parseQaRouteId(params.id)
  if (qaNonprofitId === null) {
    return NextResponse.json({ error: 'A numeric QA nonprofit id is required.' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const crmKeyMap: Record<string, string> = {
      stage: 'stage',
      status: 'status',
      campaign_id: 'campaignId',
      duplicate_of: 'duplicateOfAccountId',
    }
    const crmPayload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (key in crmKeyMap) crmPayload[crmKeyMap[key]] = value
    }

    // Cause profile settings. The backend only applies keys that are present,
    // so we forward the flag only when the caller actually sent it.
    const profilePayload: Record<string, unknown> = {}
    const referrerVisibility = body.is_visible_in_referrer_search ?? body.isVisibleInReferrerSearch
    if (typeof referrerVisibility === 'boolean') {
      profilePayload.isVisibleInReferrerSearch = referrerVisibility
    }

    if (Object.keys(crmPayload).length === 0 && Object.keys(profilePayload).length === 0) {
      return NextResponse.json({ error: 'No supported cause fields in the request.' }, { status: 400 })
    }

    let result: unknown = null

    if (Object.keys(crmPayload).length > 0) {
      const res = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${qaNonprofitId}/crm`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(crmPayload),
      })
      result = await parseQaResponse<unknown>(res, 'Failed to update cause CRM fields.')
    }

    if (Object.keys(profilePayload).length > 0) {
      const res = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${qaNonprofitId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(profilePayload),
      })
      result = await parseQaResponse<unknown>(res, 'Failed to update the cause profile.')
    }

    return NextResponse.json(result)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA cause CRM fields could not be updated.')
  }
}
