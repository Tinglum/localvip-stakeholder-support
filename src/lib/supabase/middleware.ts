import { NextResponse, type NextRequest } from 'next/server'
import { getQaSessionFromCookieStore, getRequestPublicOrigin, hasRefreshableQaSession } from '@/lib/auth/qa-auth'
import { hasSysadminPinAccess, PIN_COOKIES } from '@/lib/auth/sysadmin-pin'
import { hasDemoSession } from '@/lib/auth/demo-auth'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams
  const hasOauthResponse = searchParams.has('code') || (searchParams.has('error') && searchParams.has('state'))
  const isQaCallbackRoute = pathname.startsWith('/api/auth/qa/callback')
  const isBrowserOidcRoute = pathname === '/' || pathname.startsWith('/login')

  const session = getQaSessionFromCookieStore(request.cookies, { allowExpired: true })
  const pinExempt = pathname === '/sysadmin-pin' || pathname === '/api/auth/sysadmin-pin' ||
    pathname === '/api/auth/login' || pathname === '/api/auth/logout' || pathname.startsWith('/api/auth/qa/') ||
    pathname === '/login' || pathname.startsWith('/_next/')
  const remembered = /^[a-f0-9]{64}$/.test(request.cookies.get(PIN_COOKIES.device)?.value || '')
  const needsPin = !await hasSysadminPinAccess(request.cookies, session)
  const entry = pathname === '/' || pathname === '/login'
  if (!hasOauthResponse && ((needsPin && !pinExempt) ||
      (remembered && (!session || needsPin) && entry && !searchParams.has('manual') && !searchParams.has('signout')))) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unlock your sysadmin session.', pinRequired: true }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
    const url = new URL('/sysadmin-pin', getRequestPublicOrigin(request))
    url.searchParams.set('returnTo', entry ? '/dashboard' : `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  if (hasOauthResponse && !isQaCallbackRoute && !isBrowserOidcRoute) {
    const callbackUrl = new URL('/api/auth/qa/callback', getRequestPublicOrigin(request))
    callbackUrl.search = request.nextUrl.search
    callbackUrl.searchParams.set('oauth_redirect_path', pathname)
    return NextResponse.redirect(callbackUrl)
  }

  // Refreshable, not strictly live: an expired access token with a refresh token
  // behind it is a working session, and bouncing it to /login here meant the
  // refresh could never run. Authorization is still enforced downstream by
  // getAuthenticatedSession, which redirects if the refresh actually fails.
  const hasQaAuth = hasRefreshableQaSession(request)
  const hasDemoAuth = hasDemoSession(request)
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const isLoginRoute = pathname.startsWith('/login')
  const isAuthRoute = isLoginRoute ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  const isPublicRoute = pathname === '/' ||
    pathname === '/sysadmin-pin' || pathname === '/api/auth/sysadmin-pin' ||
    // Invite auto-login lands here before any session exists.
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/join/') ||
    pathname.startsWith('/api/join/') ||
    pathname.startsWith('/support/') ||
    pathname.startsWith('/api/support/') ||
    pathname.startsWith('/api/auth/demo-login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/qa/') ||
    pathname.startsWith('/api/auth/session') ||
    pathname.startsWith('/api/auth/logout')

  if (!hasQaAuth && !hasDemoAuth && !isAuthRoute && !isPublicRoute) {
    const url = new URL('/login', getRequestPublicOrigin(request))
    url.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  // Skip the "already authenticated → /dashboard" redirect when the user
  // just signed out. Both paths land here:
  //   • Direct Supabase logout → /login?signout=1
  //   • QA logout → QA server → /login (no signout param, but session already gone)
  return response
}
