import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasQaSession } from '@/lib/auth/qa-auth'
import { hasDemoSession } from '@/lib/auth/demo-auth'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const hasQaAuth = hasQaSession(request)
  const hasDemoAuth = hasDemoSession(request)
  let supabaseUser = null

  if (!hasDemoAuth && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({
              request: { headers: request.headers },
            })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    try {
      const { data } = await supabase.auth.getUser()
      supabaseUser = data.user
    } catch {
      supabaseUser = null
    }
  }

  const pathname = request.nextUrl.pathname
  const isLoginRoute = pathname.startsWith('/login')
  const isAuthRoute = isLoginRoute ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  const isPublicRoute = pathname === '/' ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/join/') ||
    pathname.startsWith('/api/join/') ||
    pathname.startsWith('/support/') ||
    pathname.startsWith('/api/support/') ||
    pathname.startsWith('/api/auth/demo-login') ||
    pathname.startsWith('/api/auth/qa/') ||
    pathname.startsWith('/api/auth/session') ||
    pathname.startsWith('/api/auth/logout')

  if (!hasQaAuth && !hasDemoAuth && !supabaseUser && !isAuthRoute && !isPublicRoute) {
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
