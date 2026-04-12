import { NextRequest, NextResponse } from 'next/server'
import {
  clearQaSessionCookies,
  exchangeCodeForSession,
  getRequestPublicOrigin,
  getQaRedirectUri,
  QA_COOKIE_NAMES,
  sanitizeReturnTo,
  setQaSessionCookies,
} from '@/lib/auth/qa-auth'
import { provisionSupabaseSessionForQaUser } from '@/lib/server/auth-session'

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

    // Bridge QA user into a real Supabase session so client-side RLS works
    try {
      const supabaseSession = await provisionSupabaseSessionForQaUser(session.claims)
      if (supabaseSession) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
        const cookieName = `sb-${projectRef}-auth-token`
        const cookieValue = JSON.stringify({
          access_token: supabaseSession.accessToken,
          refresh_token: supabaseSession.refreshToken,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        })
        // Supabase JS client reads this chunked cookie for auth
        cleanResponse.cookies.set(cookieName, cookieValue, {
          path: '/',
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
        })
        console.log('[qa-callback] Supabase session bridged for', session.claims.email)
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
