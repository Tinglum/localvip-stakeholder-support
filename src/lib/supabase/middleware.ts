import { NextResponse, type NextRequest } from 'next/server'
import { hasQaSession } from '@/lib/auth/qa-auth'
import { hasDemoSession } from '@/lib/auth/demo-auth'

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams
  const hasOauthResponse = searchParams.has('code') || (searchParams.has('error') && searchParams.has('state'))
  const isQaCallbackRoute = pathname.startsWith('/api/auth/qa/callback')
  const isBrowserOidcRoute = pathname === '/' || pathname.startsWith('/login')

  if (hasOauthResponse && !isQaCallbackRoute && !isBrowserOidcRoute) {
    const callbackUrl = request.nextUrl.clone()
    callbackUrl.pathname = '/api/auth/qa/callback'
    callbackUrl.searchParams.set('oauth_redirect_path', pathname)
    return NextResponse.redirect(callbackUrl)
  }

  const hasQaAuth = hasQaSession(request)
  const hasDemoAuth = hasDemoSession(request)
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const isLoginRoute = pathname.startsWith('/login')
  const isAuthRoute = isLoginRoute ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  const isPublicRoute = pathname === '/' ||
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
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  // Skip the "already authenticated → /dashboard" redirect when the user
  // just signed out. Both paths land here:
  //   • Direct Supabase logout → /login?signout=1
  //   • QA logout → QA server → /login (no signout param, but session already gone)
  return response
}
