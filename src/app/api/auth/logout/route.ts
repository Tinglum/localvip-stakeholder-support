import { NextRequest, NextResponse } from 'next/server'
import { clearQaSessionCookies, getQaLogoutUrl, getQaSessionFromCookieStore } from '@/lib/auth/qa-auth'

export async function POST(request: NextRequest) {
  const session = getQaSessionFromCookieStore(request.cookies)

  const redirectTo = session
    ? getQaLogoutUrl(request.nextUrl.origin, session.idToken)
    : new URL('/login', request.url).toString()
  const response = NextResponse.json({ ok: true, redirectTo })
  clearQaSessionCookies(response)
  return response
}
