import { NextResponse } from 'next/server'
import { fetchQaBusinessDetail } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { canAccessQaBusinessRecord, normalizeQaBusinessSetupPayload } from '@/lib/server/qa-business-access'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'business'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  try {
    const business = await fetchQaBusinessDetail(qaBusinessId)
    if (!canAccessQaBusinessRecord(access.shell, access.session.profile, business)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
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
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'business'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  try {
    const business = await fetchQaBusinessDetail(qaBusinessId)
    if (!canAccessQaBusinessRecord(access.shell, access.session.profile, business)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const normalizedBody: Record<string, unknown> = { ...body }

    if (typeof normalizedBody.city_id === 'string' && /^\d+$/.test(normalizedBody.city_id)) {
      try {
        const cityRes = await fetchQaApi(`/api/dashboard/v1/City/${encodeURIComponent(normalizedBody.city_id)}`)
        const city = await parseQaResponse<Record<string, unknown> | null>(cityRes, 'Failed to resolve city.')
        if (city && typeof city.name === 'string' && !normalizedBody.city) normalizedBody.city = city.name
        if (city && typeof city.state === 'string' && !normalizedBody.state) normalizedBody.state = city.state
        if (city && typeof city.country === 'string' && !normalizedBody.country) normalizedBody.country = city.country
      } catch {
        // Leave the original payload intact and let unsupported-field reporting handle it.
      }
    }

    const { payload, unsupportedFields } = normalizeQaBusinessSetupPayload(normalizedBody)

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        {
          error: unsupportedFields.length > 0
            ? `These business fields are not supported by the QA API yet: ${unsupportedFields.join(', ')}`
            : 'A business update payload is required.',
        },
        { status: unsupportedFields.length > 0 ? 501 : 400 },
      )
    }

    const res = await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}/setup`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await parseQaResponse<unknown>(res, 'Failed to update business.')
    return NextResponse.json(json)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA business could not be updated.')
  }
}
