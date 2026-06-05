import { NextRequest, NextResponse } from 'next/server'
import {
  clearQaSessionCookies,
  getQaLogoutUrl,
  getQaSessionFromCookieStore,
  getRequestPublicOrigin,
} from '@/lib/auth/qa-auth'
import { clearDemoSessionCookie } from '@/lib/auth/demo-auth'

export async function POST(request: NextRequest) {
  const session = getQaSessionFromCookieStore(request.cookies)
  const publicOrigin = getRequestPublicOrigin(request)

  const loginUrl = new URL('/login', publicOrigin)
  loginUrl.searchParams.set('signout', '1')

  const redirectTo = session
    ? getQaLogoutUrl(publicOrigin, session.idToken)
    : loginUrl.toString()

  const response = NextResponse.json({ ok: true, redirectTo })
  clearQaSessionCookies(response)
  clearDemoSessionCookie(response)

  return response
}
