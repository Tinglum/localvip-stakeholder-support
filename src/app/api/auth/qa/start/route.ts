import { NextRequest, NextResponse } from 'next/server'
import { createOauthState, createPkcePair, getQaAuthorizationUrl, QA_COOKIE_NAMES, sanitizeReturnTo } from '@/lib/auth/qa-auth'

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const debug = request.nextUrl.searchParams.get('debug') === '1'

  // If the request origin differs from NEXT_PUBLIC_APP_URL, the cookies we set
  // here will never be sent back to the callback route (because QA will
  // redirect to the canonical app URL, not wherever the user started). Send
  // them to the canonical origin first so the cookies land on the right host.
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || null
  const requestOrigin = request.nextUrl.origin.replace(/\/+$/, '')
  if (configuredAppUrl && configuredAppUrl !== requestOrigin && !debug) {
    const redirectUrl = new URL('/api/auth/qa/start', configuredAppUrl)
    redirectUrl.searchParams.set('returnTo', returnTo)
    return NextResponse.redirect(redirectUrl)
  }

  const state = createOauthState()
  const pkce = createPkcePair()
  const authorization = await getQaAuthorizationUrl(requestOrigin, {
    returnTo,
    state,
    verifier: pkce.verifier,
  })

  const secure = process.env.NODE_ENV === 'production'

  console.log('[qa-start]', {
    requestOrigin,
    configuredAppUrl,
    redirectUri: authorization.redirectUri,
    authorizeUrl: authorization.url,
    cookieSecure: secure,
    nodeEnv: process.env.NODE_ENV,
    returnTo,
  })

  if (debug) {
    return NextResponse.json({
      ok: true,
      requestOrigin,
      configuredAppUrl,
      redirectUri: authorization.redirectUri,
      authorizeUrl: authorization.url,
      cookieSecure: secure,
      nodeEnv: process.env.NODE_ENV,
      clientId: process.env.QA_AUTH_CLIENT_ID || 'lvip_dashboard (default)',
      qaBaseUrl: process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com (default)',
    })
  }

  const response = NextResponse.redirect(authorization.url)

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
