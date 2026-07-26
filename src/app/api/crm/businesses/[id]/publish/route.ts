import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { getQaAccountIdFromLocal } from '@/lib/server/qa-dashboard-shared'
import { parseStripeOnboardingStatus } from '@/lib/stripe-onboarding'

function parseQaId(value: string) {
  const candidate = value.startsWith('qa-') ? value.slice(3) : value
  return /^\d+$/.test(candidate) ? Number(candidate) : null
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
    if (detail.crmStatus !== 'pending_live_review') {
      return NextResponse.json(
        { error: 'This business has not submitted a live-review request.' },
        { status: 409 },
      )
    }
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
