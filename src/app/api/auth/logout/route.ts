import { NextRequest, NextResponse } from 'next/server'
import { clearQaSessionCookies, getQaLogoutUrl, getQaSessionFromCookieStore, getRequestPublicOrigin } from '@/lib/auth/qa-auth'

export async function POST(request: NextRequest) {
  const session = getQaSessionFromCookieStore(request.cookies)
  const publicOrigin = getRequestPublicOrigin(request)

  const redirectTo = session
    ? getQaLogoutUrl(publicOrigin, session.idToken)
    : new URL('/login', publicOrigin).toString()
  const response = NextResponse.json({ ok: true, redirectTo })
  clearQaSessionCookies(response)
  return response
}
