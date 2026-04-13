import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import {
  clearQaSessionCookies,
  exchangeCodeForSession,
  getRequestPublicOrigin,
  getQaRedirectUri,
  QA_COOKIE_NAMES,
  sanitizeReturnTo,
  setQaSessionCookies,
} from '@/lib/auth/qa-auth'
import { prepareSupabaseSessionForQaUser } from '@/lib/server/auth-session'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')
  const errorDescription = request.nextUrl.searchParams.get('error_description')

  const storedState = request.cookies.get(QA_COOKIE_NAMES.state)?.value || null
  const verifier = request.cookies.get(QA_COOKIE_NAMES.verifier)?.value || null
  const returnTo = sanitizeReturnTo(request.cookies.get(QA_COOKIE_NAMES.returnTo)?.value || '/dashboard')
  const publicOrigin = getRequestPublicOrigin(request)

  // Diagnostic: list every cookie we can see so we know if the browser dropped them
  const cookieNames = request.cookies.getAll().map((c) => c.name)
  console.log('[qa-callback]', {
    hasCode: !!code,
    hasState: !!state,
    hasStoredState: !!storedState,
    hasVerifier: !!verifier,
    stateMatches: !!(state && storedState && state === storedState),
    error,
    errorDescription,
    origin: request.nextUrl.origin,
    publicOrigin,
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

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    const missing: string[] = []
    if (!code) missing.push('code')
    if (!state) missing.push('state')
    if (!storedState) missing.push('stored_state_cookie')
    if (state && storedState && state !== storedState) missing.push('state_mismatch')
    if (!verifier) missing.push('pkce_verifier_cookie')
    const diagnostic = `QA login handshake failed. Missing: ${missing.join(', ')}. Seen cookies: ${cookieNames.join(', ') || 'none'}`
    const failure = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(diagnostic)}`, publicOrigin),
    )
    clearQaSessionCookies(failure)
    return failure
  }

  try {
    const session = await exchangeCodeForSession({
      code,
      verifier,
      redirectUri: getQaRedirectUri(publicOrigin),
    })

    setQaSessionCookies(cleanResponse, session)
    cleanResponse.cookies.set(QA_COOKIE_NAMES.state, '', { path: '/', maxAge: 0 })
    cleanResponse.cookies.set(QA_COOKIE_NAMES.verifier, '', { path: '/', maxAge: 0 })
    cleanResponse.cookies.set(QA_COOKIE_NAMES.returnTo, '', { path: '/', maxAge: 0 })

    // Bridge QA user into a real Supabase session so client-side RLS works.
    // 1. Service client generates a magic link OTP hash (admin operation)
    // 2. SSR client (anon key) verifies the OTP — this writes proper session cookies
    try {
      const prepared = await prepareSupabaseSessionForQaUser(session.claims)
      if (prepared) {
        const ssrClient = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              get(name: string) {
                return request.cookies.get(name)?.value
              },
              set(name: string, value: string, options: CookieOptions) {
                cleanResponse.cookies.set({ name, value, ...options })
              },
              remove(name: string, options: CookieOptions) {
                cleanResponse.cookies.set({ name, value: '', ...options })
              },
            },
          },
        )
        // Verify OTP on the SSR client so it writes proper session cookies
        const { data: otpData, error: otpError } = await ssrClient.auth.verifyOtp({
          type: 'magiclink',
          token_hash: prepared.hashedToken,
        })
        if (otpError || !otpData?.session) {
          console.warn('[qa-callback] Supabase OTP verify failed', otpError?.message)
        } else {
          console.log('[qa-callback] Supabase session bridged for', session.claims.email, otpData.session.user?.id)
        }
      }
    } catch (bridgeError) {
      // Non-fatal — QA session still works, just client-side RLS won't pass
      console.warn('[qa-callback] Supabase session bridge failed (non-fatal)', bridgeError)
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
