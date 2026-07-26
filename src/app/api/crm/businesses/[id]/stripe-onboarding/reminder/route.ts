import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { resolveQaBusinessRouteId } from '@/lib/server/qa-business-route'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin'])
  if ('error' in context) return context.error

  let qaBusinessId: number | null
  try {
    qaBusinessId = await resolveQaBusinessRouteId(params.id, context.supabase)
  } catch (error) {
    console.error('[crm stripe onboarding] reminder business id resolution failed', { businessId: params.id, error })
    return NextResponse.json({ error: 'Stripe reminder could not be sent.' }, { status: 502 })
  }
  if (qaBusinessId === null) return NextResponse.json({ error: 'This business is not linked to a QA account.' }, { status: 400 })

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${qaBusinessId}/reminder`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? response.status : 502
      return NextResponse.json({ error: 'Stripe reminder could not be sent.' }, { status })
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error('[crm stripe onboarding] reminder proxy failed', { businessId: params.id, error })
    return NextResponse.json({ error: 'Stripe reminder could not be sent.' }, { status: 502 })
  }
}
