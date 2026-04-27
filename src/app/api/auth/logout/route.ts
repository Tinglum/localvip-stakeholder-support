import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { clearQaSessionCookies, getQaLogoutUrl, getQaSessionFromCookieStore, getRequestPublicOrigin } from '@/lib/auth/qa-auth'

export async function POST(request: NextRequest) {
  const session = getQaSessionFromCookieStore(request.cookies)
  const publicOrigin = getRequestPublicOrigin(request)

  const redirectTo = session
    ? getQaLogoutUrl(publicOrigin, session.idToken)
    : new URL('/login', publicOrigin).toString()

  const response = NextResponse.json({ ok: true, redirectTo })

  // Clear QA session cookies
  clearQaSessionCookies(response)

  // Sign out of Supabase server-side so that server-set session cookies are
  // definitively cleared. The client-side supabase.auth.signOut() call in the
  // topbar handles local state, but the authoritative session cookies were
  // written by the server-side bridge and must be removed here.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
              response.cookies.set({ name, value, ...options })
            },
            remove(name: string, options: CookieOptions) {
              response.cookies.set({ name, value: '', ...options })
            },
          },
        },
      )
      await supabase.auth.signOut()
    } catch {
      // Non-fatal — QA cookies are already cleared above
    }
  }

  return response
}
