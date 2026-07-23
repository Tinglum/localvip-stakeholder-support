import { NextRequest, NextResponse } from 'next/server'
import {
  clearQaSessionCookies,
  getQaLogoutUrl,
  getQaSessionFromCookieStore,
  getRequestPublicOrigin,
  isIdTokenUsableAsHint,
} from '@/lib/auth/qa-auth'
import { clearDemoSessionCookie } from '@/lib/auth/demo-auth'

export async function POST(request: NextRequest) {
  // allowExpired: an expired access token is a normal state at logout time. The
  // strict read returned null there, which skipped QA sign-out entirely and left
  // the SSO cookie behind.
  const session = getQaSessionFromCookieStore(request.cookies, { allowExpired: true })
  const publicOrigin = getRequestPublicOrigin(request)

  // Only hand the browser to QA's endsession when we have a usable id_token_hint.
  //
  // Without one, IdentityServer cannot identify the client, so it ignores
  // post_logout_redirect_uri and its fallback redirects to "~/Dashboard" — an
  // authenticated page — stranding the user on QA's login screen. Landing on our
  // own /login beats that dead end.
  //
  // Trade-off: in that case QA's SSO cookie is not cleared, so signing back in may
  // not re-prompt for credentials. Our own session is fully cleared either way, and
  // the alternative is the current behaviour of stranding the user on QA.
  const canEndQaSession = isIdTokenUsableAsHint(session?.idToken)

  const redirectTo = canEndQaSession
    ? getQaLogoutUrl(publicOrigin, session?.idToken)
    : `${publicOrigin}/login?signout=1`

  const response = NextResponse.json({ ok: true, redirectTo })
  clearQaSessionCookies(response)
  clearDemoSessionCookie(response)

  return response
}
