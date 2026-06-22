import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi } from '@/lib/auth/qa-api'

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
    // Use the dashboard StripeConnect endpoint (business Connect flow for the
    // current user) — NOT the mobile CustomerStripeOnBoarding, which branches on
    // the Consumer role and falsely reports business owners as "complete".
    const res = await fetchQaApi('/api/dashboard/v1/StripeConnect')
    const contentType = res.headers.get('content-type') || ''
    if (!res.ok) {
      // Surface the upstream status + a short detail so the cause is visible
      // (auth vs Stripe-config vs other) instead of a generic failure.
      const detail = contentType.includes('json')
        ? JSON.stringify(await res.json().catch(() => ({}))).slice(0, 400)
        : (await res.text().catch(() => '')).slice(0, 400)
      return NextResponse.json(
        { error: 'Stripe onboarding is unavailable right now.', upstreamStatus: res.status, detail },
        { status: 502 },
      )
    }
    const json = contentType.includes('json')
      ? (await res.json().catch(() => ({}))) as { onboardingUrl?: string | null; isOnboardingComplete?: boolean }
      : {}
    return NextResponse.json({
      isOnboardingComplete: !!json?.isOnboardingComplete,
      onboardingUrl: json?.onboardingUrl ?? null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Stripe onboarding is unavailable right now.', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    )
  }
}
