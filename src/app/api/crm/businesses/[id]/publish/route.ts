import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { getQaAccountIdFromLocal } from '@/lib/server/qa-dashboard-shared'
import { parseStripeOnboardingStatus } from '@/lib/stripe-onboarding'
import { ensureQaBusinessReferralAssets } from '@/lib/server/qa-business-stakeholders'

type QaOffer = {
  offerType?: string | null
  offer_type?: string | null
  type?: string | null
  headline?: string | null
  title?: string | null
  discountValue?: number | string | null
  discount_value?: number | string | null
  cashbackPercent?: number | string | null
  cashback_percent?: number | string | null
}

function parseQaId(value: string) {
  const candidate = value.startsWith('qa-') ? value.slice(3) : value
  return /^\d+$/.test(candidate) ? Number(candidate) : null
}

function asItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items
  }
  return []
}

function getOfferType(offer: QaOffer) {
  return String(offer.offerType || offer.offer_type || offer.type || '').toLowerCase()
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin'])
  if ('error' in context) return context.error

  let qaBusinessId = parseQaId(params.id)
  if (qaBusinessId === null) {
    const { data: localBusiness } = await context.supabase
      .from('businesses')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    qaBusinessId = localBusiness ? getQaAccountIdFromLocal(localBusiness) : null
  }

  if (qaBusinessId === null) {
    return NextResponse.json(
      { error: 'This business is not linked to a QA account and cannot be published.' },
      { status: 400 },
    )
  }

  try {
    const detailResponse = await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}`)
    const detail = await parseQaResponse<{
      active?: boolean
      crmStatus?: string | null
      name?: string | null
      ownerEmail?: string | null
      ownerPhone?: string | null
      ownerUserId?: number | null
      city?: string | null
      category?: string | null
      linkedCauseAccountId?: number | null
      imageUrl?: string | null
      referralCode?: string | null
    }>(
      detailResponse,
      'Failed to verify the business review state.',
    )
    if (!detail) {
      return NextResponse.json({ error: 'The QA business could not be found.' }, { status: 404 })
    }
    if (detail.crmStatus === 'live' && detail.active) {
      return NextResponse.json({ success: true, qaBusinessId, business: detail })
    }
    const missingProfileItems = [
      !detail.name?.trim() && 'business name',
      !(detail.ownerEmail?.trim() || detail.ownerPhone?.trim()) && 'email or phone',
      !detail.ownerUserId && 'owner',
      !detail.city?.trim() && 'city',
      !detail.category?.trim() && 'category',
      !detail.linkedCauseAccountId && 'cause',
      !detail.imageUrl?.trim() && 'logo',
      !detail.referralCode?.trim() && 'referral code',
    ].filter((item): item is string => Boolean(item))

    const offersResponse = await fetchQaApi(`/api/dashboard/v1/Offer?businessAccountId=${qaBusinessId}`)
    const offersPayload = await parseQaResponse<unknown>(offersResponse, 'Failed to verify business offers.')
    const offers = asItems<QaOffer>(offersPayload)
    const captureOffer = offers.find((offer) => getOfferType(offer) === 'capture')
    const cashbackOffer = offers.find((offer) => getOfferType(offer) === 'cashback')
    const cashbackValue = Number(
      cashbackOffer?.cashbackPercent
      ?? cashbackOffer?.cashback_percent
      ?? cashbackOffer?.discountValue
      ?? cashbackOffer?.discount_value,
    )
    if (!captureOffer || !(captureOffer.headline || captureOffer.title)?.trim()) {
      missingProfileItems.push('customer capture offer')
    }
    if (!Number.isFinite(cashbackValue) || cashbackValue < 5 || cashbackValue > 25) {
      missingProfileItems.push('cashback percentage')
    }
    if (missingProfileItems.length > 0) {
      return NextResponse.json(
        { error: `Complete required onboarding first: ${missingProfileItems.join(', ')}.` },
        { status: 409 },
      )
    }

    // QA owns the canonical onboarding contract. Re-run it immediately before
    // activation so stale CRM status can never bypass missing required setup.
    const onboardingResponse = await fetchQaApi(
      `/api/dashboard/v1/Onboarding/business/${qaBusinessId}/complete`,
      { method: 'PATCH' },
    )
    await parseQaResponse(
      onboardingResponse,
      'Required onboarding must be complete before this business can go live.',
    )

    // Codes and the customer-facing QR are required launch assets. Ensuring
    // them here also protects publishing initiated outside the onboarding UI.
    await ensureQaBusinessReferralAssets(String(qaBusinessId))

    const stripeResponse = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${qaBusinessId}`)
    const stripePayload = await parseQaResponse<unknown>(stripeResponse, 'Failed to verify Stripe readiness.')
    const stripeStatus = parseStripeOnboardingStatus(stripePayload)
    if (stripeStatus?.status !== 'complete') {
      return NextResponse.json(
        { error: 'Stripe onboarding must be complete before this business can go live.' },
        { status: 409 },
      )
    }

    const statusResponse = await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: true }),
    })
    const business = await parseQaResponse(statusResponse, 'Failed to activate the business.')

    try {
      const crmResponse = await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}/crm`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'live', status: 'live' }),
      })
      await parseQaResponse(crmResponse, 'Failed to mark the business live in CRM.')
    } catch (error) {
      // Do not leave the customer-facing account active if the dashboard still
      // says it is waiting for review.
      await fetchQaApi(`/api/dashboard/v1/Business/${qaBusinessId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: false }),
      }).catch(() => null)
      throw error
    }

    return NextResponse.json({ success: true, qaBusinessId, business })
  } catch (error) {
    console.error('[crm business publish] failed', { businessId: params.id, error })
    return NextResponse.json({ error: 'The business could not be published.' }, { status: 502 })
  }
}
