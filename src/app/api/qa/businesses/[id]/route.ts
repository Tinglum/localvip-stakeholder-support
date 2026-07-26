import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchQaBusinessDetail } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { canAccessQaBusinessRecord, normalizeQaBusinessSetupPayload } from '@/lib/server/qa-business-access'
import { getQaAccountIdFromLocal } from '@/lib/server/qa-dashboard-shared'
import { parseStripeOnboardingStatus } from '@/lib/stripe-onboarding'

function positiveQaId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function parseSocialLinks(value: unknown) {
  if (value === null || value === undefined || value === '') return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    return { ...value as Record<string, unknown> }
  }
  if (typeof value !== 'string') {
    throw new Error('QA returned SocialLinks in an unsupported format.')
  }

  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('QA returned SocialLinks in an unsupported format.')
  }
  return { ...parsed as Record<string, unknown> }
}

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
    const metadata = body.metadata && typeof body.metadata === 'object'
      ? body.metadata as Record<string, unknown>
      : null
    const isSubmittingForLiveReview =
      body.launch_phase === 'ready_to_go_live'
      || metadata?.portal_activation_review_state === 'pending'
    if (isSubmittingForLiveReview) {
      try {
        const stripeResponse = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${qaBusinessId}`)
        const stripePayload = await parseQaResponse<unknown>(stripeResponse, 'Stripe status could not be verified.')
        const stripeStatus = parseStripeOnboardingStatus(stripePayload)
        if (stripeStatus?.status !== 'complete') {
          return NextResponse.json(
            { error: 'Complete Stripe onboarding before submitting for live review.' },
            { status: 409 },
          )
        }
      } catch (error) {
        console.error('[qa business] Stripe live status check failed', { qaBusinessId, error })
        return NextResponse.json(
          { error: 'Stripe status could not be verified. Try again.' },
          { status: 502 },
        )
      }

      // Explicit onboarding completion is the gate for pending_live_review.
      // This is business-scoped on QA so legacy businesses without a local
      // dashboard flow cannot bypass the same completion contract.
      const onboardingCompletionResponse = await fetchQaApi(
        `/api/dashboard/v1/Onboarding/business/${qaBusinessId}/complete`,
        { method: 'PATCH' },
      )
      await parseQaResponse(
        onboardingCompletionResponse,
        'Onboarding could not be completed. Finish the setup requirements and try again.',
      )
    }

    // CRM pipeline annotations (stage, status, linked cause, campaign, duplicate)
    // are persisted via the dedicated /crm endpoint on the QA Account, not the
    // business profile setup. Split them out and forward only what's present.
    const crmKeyMap: Record<string, string> = {
      stage: 'stage',
      status: 'status',
      linked_cause_id: 'linkedCauseAccountId',
      campaign_id: 'campaignId',
      duplicate_of: 'duplicateOfAccountId',
    }
    const crmPayload: Record<string, unknown> = {}
    const normalizedBody: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (key in crmKeyMap) crmPayload[crmKeyMap[key]] = value
      else normalizedBody[key] = value
    }

    // QA's Account CRM fields are the durable source of truth for live review.
    // The dashboard's richer launch fields are local concepts, so translate them
    // into a CRM status that both the business and super-admin can read.
    const launchPhase = body.launch_phase
    const activationStatus = body.activation_status
    if (
      body.stage === 'live'
      || body.status === 'live'
      || launchPhase === 'live'
      || activationStatus === 'active'
    ) {
      return NextResponse.json(
        { error: 'Businesses can only be made live through the protected publish action.' },
        { status: 409 },
      )
    }
    if (
      launchPhase === 'ready_to_go_live'
      || metadata?.portal_activation_review_state === 'pending'
    ) {
      crmPayload.status = 'pending_live_review'
    }
    delete normalizedBody.launch_phase
    delete normalizedBody.activation_status

    let crmResult: unknown = null
    if (Object.keys(crmPayload).length > 0) {
      const crmRes = await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}/crm`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(crmPayload),
      })
      crmResult = await parseQaResponse<unknown>(crmRes, 'Failed to update CRM fields.')
    }

    // If the request was purely CRM annotations, we're done.
    if (Object.keys(normalizedBody).length === 0) {
      return NextResponse.json(crmResult ?? { id: qaBusinessId })
    }

    if ('website' in normalizedBody) {
      try {
        const qaBusiness = business as unknown as Record<string, unknown>
        const existingSocialLinks = parseSocialLinks(qaBusiness.socialLinks ?? qaBusiness.SocialLinks)
        const requestedWebsite = normalizedBody.website

        if (typeof requestedWebsite === 'string' && requestedWebsite.trim()) {
          existingSocialLinks.website = requestedWebsite.trim()
        } else if (requestedWebsite === null || requestedWebsite === '') {
          delete existingSocialLinks.website
        } else {
          return NextResponse.json(
            { error: 'Website must be a URL string, an empty string, or null.' },
            { status: 422 },
          )
        }

        normalizedBody.socialLinks = JSON.stringify(existingSocialLinks)
        delete normalizedBody.website
      } catch (error) {
        console.error('[qa business] SocialLinks could not be merged', { qaBusinessId, error })
        return NextResponse.json(
          {
            error: 'The existing QA social links could not be read safely. No website changes were saved.',
          },
          { status: 502 },
        )
      }
    }

    if ('city_id' in normalizedBody) {
      const cityId = positiveQaId(normalizedBody.city_id)
      if (cityId === null) {
        return NextResponse.json(
          {
            error: 'City must be selected from the QA city list so it has a numeric QA city ID.',
          },
          { status: 422 },
        )
      }

      try {
        const cityRes = await fetchQaApi(`/api/dashboard/v1/City/${cityId}`)
        const city = await parseQaResponse<Record<string, unknown> | null>(cityRes, 'Failed to resolve city.')
        if (city && typeof city.name === 'string' && !normalizedBody.city) normalizedBody.city = city.name
        if (city && typeof city.state === 'string' && !normalizedBody.state) normalizedBody.state = city.state
        if (city && typeof city.country === 'string' && !normalizedBody.country) normalizedBody.country = city.country
        if (!city || typeof city.name !== 'string' || !city.name.trim()) {
          return NextResponse.json(
            { error: 'The selected QA city could not be resolved. Choose the city again and retry.' },
            { status: 422 },
          )
        }
        delete normalizedBody.city_id
      } catch (error) {
        console.error('[qa business] City could not be resolved', { qaBusinessId, cityId, error })
        return NextResponse.json(
          { error: 'The selected QA city could not be resolved. Choose the city again and retry.' },
          { status: 502 },
        )
      }
    }

    const ownerKeys = ['owner_id', 'owner_user_id'] as const
    const suppliedOwnerKeys = ownerKeys.filter(key => key in normalizedBody)
    if (suppliedOwnerKeys.length > 0) {
      const ownerIds = suppliedOwnerKeys.map(key => positiveQaId(normalizedBody[key]))
      if (ownerIds.some(ownerId => ownerId === null)) {
        return NextResponse.json(
          {
            error: 'The selected owner is local-only and cannot be assigned in QA. Select a QA user with a numeric QA user ID.',
          },
          { status: 422 },
        )
      }

      const distinctOwnerIds = [...new Set(ownerIds as number[])]
      if (distinctOwnerIds.length > 1) {
        return NextResponse.json(
          { error: 'The owner fields identify different QA users. Select one QA owner and try again.' },
          { status: 422 },
        )
      }

      normalizedBody.primaryUserId = distinctOwnerIds[0]
      for (const key of ownerKeys) delete normalizedBody[key]
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
