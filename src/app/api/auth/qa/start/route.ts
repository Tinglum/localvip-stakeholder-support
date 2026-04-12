import { NextRequest, NextResponse } from 'next/server'
import {
  createOauthState,
  createPkcePair,
  getQaAuthorizationUrl,
  getRequestPublicOrigin,
  QA_COOKIE_NAMES,
  sanitizeReturnTo,
} from '@/lib/auth/qa-auth'

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const debug = request.nextUrl.searchParams.get('debug') === '1'

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || null
  const publicOrigin = getRequestPublicOrigin(request)
  const configuredHost = configuredAppUrl ? new URL(configuredAppUrl).hostname : null
  const publicHost = new URL(publicOrigin).hostname

  // Only redirect when the browser is truly on a different public host.
  // Netlify may report an internal origin through request.nextUrl.origin,
  // so we rely on forwarded host/proto headers instead.
  if (configuredHost && configuredHost !== publicHost && !debug) {
    const redirectUrl = new URL('/api/auth/qa/start', configuredAppUrl!)
    redirectUrl.searchParams.set('returnTo', returnTo)
    return NextResponse.redirect(redirectUrl)
  }

  const oauthOrigin = configuredAppUrl || publicOrigin

  const state = createOauthState()
  const pkce = createPkcePair()
  const authorization = await getQaAuthorizationUrl(oauthOrigin, {
    returnTo,
    state,
    verifier: pkce.verifier,
  })

  const secure = process.env.NODE_ENV === 'production'

  console.log('[qa-start]', {
    requestOrigin: request.nextUrl.origin,
    publicOrigin,
    oauthOrigin,
    configuredAppUrl,
    publicHost,
    configuredHost,
    redirectUri: authorization.redirectUri,
    authorizeUrl: authorization.url,
    cookieSecure: secure,
    nodeEnv: process.env.NODE_ENV,
    returnTo,
  })

  if (debug) {
    return NextResponse.json({
      ok: true,
      requestOrigin: request.nextUrl.origin,
      publicOrigin,
      oauthOrigin,
      configuredAppUrl,
      publicHost,
      configuredHost,
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
