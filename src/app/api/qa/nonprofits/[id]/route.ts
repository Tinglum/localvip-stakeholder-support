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
 * duplicate). Forwarded to the QA Account /crm endpoint. */
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
    if (Object.keys(crmPayload).length === 0) {
      return NextResponse.json({ error: 'No supported CRM fields in the request.' }, { status: 400 })
    }

    const res = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${qaNonprofitId}/crm`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(crmPayload),
    })
    const json = await parseQaResponse<unknown>(res, 'Failed to update cause CRM fields.')
    return NextResponse.json(json)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA cause CRM fields could not be updated.')
  }
}
