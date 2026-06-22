import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

// Per-owner Stripe Connect onboarding status + link for the logged-in business.
// Proxies the QA backend's CustomerStripeOnBoarding endpoint, which returns the
// completion flag and — for an owner without a Connect account yet — CREATES the
// Express account and returns its onboarding link. So this both reports status
// and bootstraps onboarding (the "automatic first step").
export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.source !== 'qa') {
    // Demo/non-QA sessions have no Stripe Connect concept — treat as complete so
    // the setup card stays hidden.
    return NextResponse.json({ isOnboardingComplete: true, onboardingUrl: null })
  }

  try {
    const res = await fetchQaApi('/api/mobile/v1/Payment/CustomerStripeOnBoarding')
    const json = await parseQaResponse<{ onboardingUrl?: string | null; isOnboardingComplete?: boolean }>(
      res,
      'Failed to load Stripe onboarding status.',
    )
    return NextResponse.json({
      isOnboardingComplete: !!json?.isOnboardingComplete,
      onboardingUrl: json?.onboardingUrl ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Stripe onboarding is unavailable right now.' }, { status: 502 })
  }
}
