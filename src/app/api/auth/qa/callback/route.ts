import { NextRequest, NextResponse } from 'next/server'
import {
  clearQaSessionCookies,
  exchangeCodeForSession,
  getQaRedirectUri,
  QA_COOKIE_NAMES,
  sanitizeReturnTo,
  setQaSessionCookies,
} from '@/lib/auth/qa-auth'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')
  const errorDescription = request.nextUrl.searchParams.get('error_description')

  const storedState = request.cookies.get(QA_COOKIE_NAMES.state)?.value || null
  const verifier = request.cookies.get(QA_COOKIE_NAMES.verifier)?.value || null
  const returnTo = sanitizeReturnTo(request.cookies.get(QA_COOKIE_NAMES.returnTo)?.value || '/dashboard')

  const cleanResponse = NextResponse.redirect(new URL(returnTo, request.nextUrl.origin))
  clearQaSessionCookies(cleanResponse)

  if (error) {
    const failure = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.nextUrl.origin),
    )
    clearQaSessionCookies(failure)
    return failure
  }

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    const failure = NextResponse.redirect(
      new URL('/login?error=The+QA+login+session+expired.+Please+try+again.', request.nextUrl.origin),
    )
    clearQaSessionCookies(failure)
    return failure
  }

  try {
    const session = await exchangeCodeForSession({
      code,
      verifier,
      redirectUri: getQaRedirectUri(request.nextUrl.origin),
    })

    setQaSessionCookies(cleanResponse, session)
    cleanResponse.cookies.set(QA_COOKIE_NAMES.state, '', { path: '/', maxAge: 0 })
    cleanResponse.cookies.set(QA_COOKIE_NAMES.verifier, '', { path: '/', maxAge: 0 })
    cleanResponse.cookies.set(QA_COOKIE_NAMES.returnTo, '', { path: '/', maxAge: 0 })
    return cleanResponse
  } catch (tokenError) {
    const failure = NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(tokenError instanceof Error ? tokenError.message : 'QA login failed.')}`,
        request.nextUrl.origin,
      ),
    )
    clearQaSessionCookies(failure)
    return failure
  }
}
