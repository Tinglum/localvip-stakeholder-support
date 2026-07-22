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

  const redirectTo = session
    ? getQaLogoutUrl(publicOrigin, session.idToken)
    : `${publicOrigin}/`

  const response = NextResponse.json({ ok: true, redirectTo })
  clearQaSessionCookies(response)
  clearDemoSessionCookie(response)

  return response
}
