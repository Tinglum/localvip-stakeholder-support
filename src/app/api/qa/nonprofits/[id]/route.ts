import { NextResponse } from 'next/server'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'community'])
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
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'community'])
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
    if (typeof body.name === 'string' && body.name.trim()) profilePayload.name = body.name.trim()
    if (body.phone === null || typeof body.phone === 'string') profilePayload.ownerPhone = body.phone
    if (body.address === null || typeof body.address === 'string') profilePayload.address1 = body.address
    if (body.email === null || typeof body.email === 'string') profilePayload.ownerEmail = body.email

    // The Website box on the setup dialog was collected, sent, and dropped here:
    // there was no forwarding line, and until now no column behind it either.
    if (body.website === null || typeof body.website === 'string') profilePayload.website = body.website

    // The backend stores a city NAME and STATE on the account; it has no concept
    // of the dashboard's city id. Only city_id was ever sent, so it matched
    // nothing here and the city silently failed to save while the dialog still
    // reported success. The caller resolves the name/state from the record it
    // already has loaded.
    if (typeof body.city_name === 'string' && body.city_name.trim()) {
      profilePayload.city = body.city_name.trim()
    }
    if (typeof body.city_state === 'string' && body.city_state.trim()) {
      profilePayload.state = body.city_state.trim()
    }

    // Organisation type. The backend keys school/PTA/booster detection off
    // Category, which is what the GET above reads back to derive `type`.
    if (typeof body.type === 'string' && body.type.trim()) {
      profilePayload.category = body.type.trim()
    }
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
