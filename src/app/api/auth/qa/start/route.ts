import { NextRequest, NextResponse } from 'next/server'
import { createOauthState, createPkcePair, getQaAuthorizationUrl, QA_COOKIE_NAMES, sanitizeReturnTo } from '@/lib/auth/qa-auth'

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get('returnTo'))
  const debug = request.nextUrl.searchParams.get('debug') === '1'

  // Use the canonical app URL (if configured) as the origin for the OAuth
  // callback. On Netlify, request.nextUrl.origin reports the internal HTTP
  // origin (http://...) while the browser is on HTTPS, so comparing full
  // origins causes redirect loops. We compare hostnames instead and always
  // prefer the configured URL so the OAuth redirect URI and cookies land on
  // the correct external host.
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || null
  const requestOrigin = request.nextUrl.origin.replace(/\/+$/, '')
  const configuredHost = configuredAppUrl ? new URL(configuredAppUrl).hostname : null
  const requestHost = new URL(requestOrigin).hostname

  // If the request is coming from a different host (e.g. a deploy preview),
  // redirect to the canonical host so cookies are set on the right domain.
  if (configuredHost && configuredHost !== requestHost && !debug) {
    const redirectUrl = new URL('/api/auth/qa/start', configuredAppUrl!)
    redirectUrl.searchParams.set('returnTo', returnTo)
    return NextResponse.redirect(redirectUrl)
  }

  // Use the canonical URL as the OAuth base origin (preserves HTTPS)
  const oauthOrigin = configuredAppUrl || requestOrigin

  const state = createOauthState()
  const pkce = createPkcePair()
  const authorization = await getQaAuthorizationUrl(oauthOrigin, {
    returnTo,
    state,
    verifier: pkce.verifier,
  })

  const secure = process.env.NODE_ENV === 'production'

  console.log('[qa-start]', {
    requestOrigin,
    oauthOrigin,
    configuredAppUrl,
    requestHost,
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
      requestOrigin,
      oauthOrigin,
      configuredAppUrl,
      requestHost,
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
