import { NextRequest, NextResponse } from 'next/server'
import {
  clearQaSessionCookies,
  exchangeCodeForSession,
  getQaRedirectUri,
  getRequestPublicOrigin,
  QA_COOKIE_NAMES,
  readSignedQaOauthState,
  sanitizeReturnTo,
  setQaSessionCookies,
  QA_AUTH_CONFIG,
} from '@/lib/auth/qa-auth'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')
  const errorDescription = request.nextUrl.searchParams.get('error_description')
  const oauthRedirectPath = sanitizeReturnTo(
    request.nextUrl.searchParams.get('oauth_redirect_path') || '/api/auth/qa/callback',
  )

  const storedState = request.cookies.get(QA_COOKIE_NAMES.state)?.value || null
  const storedVerifier = request.cookies.get(QA_COOKIE_NAMES.verifier)?.value || null
  const storedReturnTo = request.cookies.get(QA_COOKIE_NAMES.returnTo)?.value || null
  const signedState = await readSignedQaOauthState(state)
  const verifier = signedState?.verifier || storedVerifier || null
  const returnTo = sanitizeReturnTo(signedState?.returnTo || storedReturnTo || '/dashboard')
  const publicOrigin = getRequestPublicOrigin(request)
  const stateIsValid = !!state && (!!signedState || (!!storedState && state === storedState))
  const authorizationRedirectUri = getQaRedirectUri(publicOrigin)

  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name)
  console.log('[qa-callback]', {
    hasCode: !!code,
    hasState: !!state,
    hasStoredState: !!storedState,
    hasSignedState: !!signedState,
    hasVerifier: !!verifier,
    stateMatches: !!(state && storedState && state === storedState),
    stateIsValid,
    error,
    errorDescription,
    origin: request.nextUrl.origin,
    publicOrigin,
    oauthRedirectPath,
    authorizationRedirectUri,
    cookieNames,
  })

  const cleanResponse = NextResponse.redirect(new URL(returnTo, publicOrigin))
  clearQaSessionCookies(cleanResponse)

  if (error) {
    const failure = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, publicOrigin),
    )
    clearQaSessionCookies(failure)
    return failure
  }

  if (!code || !state || !stateIsValid || !verifier) {
    const missing: string[] = []
    if (!code) missing.push('code')
    if (!state) missing.push('state')
    if (!stateIsValid) {
      if (!storedState && !signedState) {
        missing.push('stored_state_cookie_or_signed_state')
      } else {
        missing.push('state_mismatch')
      }
    }
    if (!verifier) missing.push('pkce_verifier_cookie_or_signed_state')

    const diagnostic = `QA login handshake failed. Missing: ${missing.join(', ')}. Seen cookies: ${cookieNames.join(', ') || 'none'}`
    const failure = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(diagnostic)}`, publicOrigin),
    )
    clearQaSessionCookies(failure)
    return failure
  }

  try {
    const chosenVerifier = signedState?.verifier || storedVerifier || verifier

    console.log('[qa-callback] exchanging code', {
      chosenRedirectUri: authorizationRedirectUri,
      usingSignedVerifier: chosenVerifier === signedState?.verifier,
      usingStoredVerifier: chosenVerifier === storedVerifier,
    })

    const session = await exchangeCodeForSession({
      code,
      verifier: chosenVerifier,
      redirectUri: authorizationRedirectUri,
    })

    setQaSessionCookies(cleanResponse, session)
    cleanResponse.cookies.set(QA_COOKIE_NAMES.state, '', { path: '/', maxAge: 0 })
    cleanResponse.cookies.set(QA_COOKIE_NAMES.verifier, '', { path: '/', maxAge: 0 })
    cleanResponse.cookies.set(QA_COOKIE_NAMES.returnTo, '', { path: '/', maxAge: 0 })

    try {
      const profileRes = await fetch(`${QA_AUTH_CONFIG.baseUrl}/api/dashboard/v1/User/profile`, {
        headers: { authorization: `Bearer ${session.accessToken}` },
        cache: 'no-store',
      })
      if (profileRes.ok) {
        const qaProfile = await profileRes.json() as {
          isStripeOnboardingComplete?: boolean
          accountType?: string
          role?: string
        }
        const isBusinessAccount = qaProfile.accountType === 'Business'
        const stripeIncomplete = qaProfile.isStripeOnboardingComplete === false
        console.log('[qa-callback] profile check', {
          accountType: qaProfile.accountType,
          role: qaProfile.role,
          isStripeOnboardingComplete: qaProfile.isStripeOnboardingComplete,
        })
        if (isBusinessAccount && stripeIncomplete) {
          const stripeOnboardingRedirect = NextResponse.redirect(`${QA_AUTH_CONFIG.baseUrl}/`)
          cleanResponse.cookies.getAll().forEach((cookie) => {
            stripeOnboardingRedirect.cookies.set(cookie)
          })
          console.log(`[qa-callback] Stripe onboarding incomplete - redirecting to ${QA_AUTH_CONFIG.baseUrl}`)
          return stripeOnboardingRedirect
        }
      }
    } catch (stripeCheckError) {
      console.warn('[qa-callback] Stripe onboarding check failed (non-fatal)', stripeCheckError)
    }

    return cleanResponse
  } catch (tokenError) {
    const failure = NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(tokenError instanceof Error ? tokenError.message : 'QA login failed.')}`,
        publicOrigin,
      ),
    )
    clearQaSessionCookies(failure)
    return failure
  }
}
