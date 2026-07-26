import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { parseStripeOnboardingStatus } from '@/lib/stripe-onboarding'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

function parseQaBusinessId(value: string | null) {
  if (!value) return null
  const candidate = value.trim().startsWith('qa-') ? value.trim().slice(3) : value.trim()
  if (!/^\d+$/.test(candidate)) return null
  const parsed = Number(candidate)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function getBusinessId(request: Request) {
  return parseQaBusinessId(new URL(request.url).searchParams.get('businessId'))
}

async function requireQaSession() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'Stripe onboarding is unavailable for this account.' }, { status: 409 }) }
  }
  return { session }
}

export async function GET(request: Request) {
  const access = await requireQaSession()
  if ('error' in access) return access.error

  const businessId = getBusinessId(request)
  if (businessId === null) return NextResponse.json({ error: 'A numeric QA businessId is required.' }, { status: 400 })

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${businessId}`)
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('json') ? await response.json().catch(() => ({})) : {}
    if (!response.ok) {
      return NextResponse.json({ error: 'Stripe onboarding is unavailable right now.' }, { status: 502 })
    }

    const status = parseStripeOnboardingStatus(payload)
    if (!status) return NextResponse.json({ error: 'Stripe returned an invalid status response.' }, { status: 502 })

    return NextResponse.json({ ...status, onboardingUrl: null })
  } catch (error) {
    console.error('[business stripe onboarding] status proxy failed', { businessId, error })
    return NextResponse.json({ error: 'Stripe onboarding is unavailable right now.' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const access = await requireQaSession()
  if ('error' in access) return access.error

  const businessId = getBusinessId(request)
  if (businessId === null) return NextResponse.json({ error: 'A numeric QA businessId is required.' }, { status: 400 })

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${businessId}/onboarding-link`, { method: 'POST' })
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('json') ? await response.json().catch(() => ({})) : {}
    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? response.status : 502
      return NextResponse.json(
        { error: response.status === 409
          ? 'Stripe onboarding cannot be started for this account.'
          : 'A Stripe onboarding link could not be created.' },
        { status },
      )
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[business stripe onboarding] link proxy failed', { businessId, error })
    return NextResponse.json({ error: 'A Stripe onboarding link could not be created.' }, { status: 502 })
  }
}
