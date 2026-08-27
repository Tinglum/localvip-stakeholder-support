import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { parseStripeOnboardingStatus } from '@/lib/stripe-onboarding'
import { getAuthenticatedSession, type ResolvedAuthSession } from '@/lib/server/auth-session'
import { resolveScopedPortalBusinessId } from '@/lib/server/portal-business'

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

function getQaError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as Record<string, unknown>).error
  return typeof error === 'string' && error.trim() ? error.trim() : fallback
}

async function requireQaSession() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'Stripe onboarding is unavailable for this account.' }, { status: 409 }) }
  }
  return { session }
}

/**
 * The businessId arrives from the browser, so authentication alone is not enough:
 * without this an owner of business A could read — and start Stripe onboarding
 * for — business B. resolveScopedPortalBusinessId is the same authority the other
 * business-portal endpoints use (admins may name any business, everyone else only
 * their own memberships).
 */
async function resolveBusinessId(session: ResolvedAuthSession, request: Request) {
  const businessId = getBusinessId(request)
  if (businessId === null) {
    return { error: NextResponse.json({ error: 'A numeric QA businessId is required.' }, { status: 400 }) }
  }
  const scope = await resolveScopedPortalBusinessId(session, businessId)
  if (!scope.ok) return { error: NextResponse.json({ error: scope.error }, { status: scope.status }) }
  return { businessId: scope.businessId }
}

export async function GET(request: Request) {
  const access = await requireQaSession()
  if ('error' in access) return access.error

  const scoped = await resolveBusinessId(access.session, request)
  if ('error' in scoped) return scoped.error
  const { businessId } = scoped

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${businessId}`)
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('json') ? await response.json().catch(() => ({})) : {}
    if (!response.ok) {
      return NextResponse.json(
        { error: getQaError(payload, 'Stripe onboarding is unavailable right now.') },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 },
      )
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

  const scoped = await resolveBusinessId(access.session, request)
  if ('error' in scoped) return scoped.error
  const { businessId } = scoped

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/StripeConnect/business/${businessId}/onboarding-link`, { method: 'POST' })
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('json') ? await response.json().catch(() => ({})) : {}
    if (!response.ok) {
      const status = response.status >= 400 && response.status < 500 ? response.status : 502
      return NextResponse.json(
        { error: response.status === 409
          ? 'Stripe onboarding cannot be started for this account.'
          : getQaError(payload, 'A Stripe onboarding link could not be created.') },
        { status },
      )
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[business stripe onboarding] link proxy failed', { businessId, error })
    return NextResponse.json({ error: 'A Stripe onboarding link could not be created.' }, { status: 502 })
  }
}
