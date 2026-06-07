import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchQaBusinessDetail } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { canAccessQaBusinessRecord, normalizeQaBusinessSetupPayload } from '@/lib/server/qa-business-access'
import { getQaAccountIdFromLocal } from '@/lib/server/qa-dashboard-shared'

function buildLocalBusinessPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(body)) {
    switch (key) {
      case 'stage':
      case 'linked_cause_id':
      case 'campaign_id':
      case 'duplicate_of':
      case 'status':
      case 'source':
      case 'source_detail':
      case 'owner_id':
      case 'owner_user_id':
      case 'launch_phase':
      case 'activation_status':
      case 'linked_material_id':
      case 'linked_qr_code_id':
      case 'linked_qr_collection_id':
      case 'metadata':
      case 'logo_url':
      case 'cover_photo_url':
        patch[key] = value
        break
      default:
        break
    }
  }

  return patch
}

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

  try {
    const qaBusinessId = parseQaRouteId(params.id)
    if (qaBusinessId === null) {
      const supabase = createServiceClient()
      const { data: localBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', params.id)
        .maybeSingle()

      if (!localBusiness) {
        return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
      }

      const linkedQaBusinessId = getQaAccountIdFromLocal(localBusiness)
      if (linkedQaBusinessId !== null) {
        const qaBusiness = await fetchQaBusinessDetail(linkedQaBusinessId)
        if (!canAccessQaBusinessRecord(access.shell, access.session.profile, qaBusiness)) {
          return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
        }
      }

      const body = await request.json().catch(() => ({})) as Record<string, unknown>
      const localPatch = buildLocalBusinessPatch(body)
      if (Object.keys(localPatch).length === 0) {
        return NextResponse.json(
          { error: 'This route only supports local CRM workspace fields when addressed by a local business id.' },
          { status: 400 },
        )
      }

      const { data: updatedBusiness, error } = await (supabase.from('businesses') as any)
        .update(localPatch)
        .eq('id', params.id)
        .select('*')
        .single()

      if (error || !updatedBusiness) {
        return NextResponse.json({ error: error?.message || 'Business could not be updated.' }, { status: 500 })
      }

      return NextResponse.json(updatedBusiness)
    }

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
