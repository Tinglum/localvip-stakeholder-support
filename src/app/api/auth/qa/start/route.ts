import { NextRequest, NextResponse } from 'next/server'
import { createOauthState, createPkcePair, getQaAuthorizationUrl, QA_COOKIE_NAMES, sanitizeReturnTo } from '@/lib/auth/qa-auth'

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const state = createOauthState()
  const pkce = createPkcePair()
  const authorization = await getQaAuthorizationUrl(request.nextUrl.origin, {
    returnTo,
    state,
    verifier: pkce.verifier,
  })

  const response = NextResponse.redirect(authorization.url)
  const secure = process.env.NODE_ENV === 'production'

  response.cookies.set(QA_COOKIE_NAMES.state, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 10,
  })
  response.cookies.set(QA_COOKIE_NAMES.verifier, pkce.verifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 10,
  })
  response.cookies.set(QA_COOKIE_NAMES.returnTo, returnTo, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 10,
  })

  return response
}
