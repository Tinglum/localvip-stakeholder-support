import { NextRequest, NextResponse } from 'next/server'
import {
  clearQaSessionCookies,
  getQaAccountLogoutUrl,
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

  // Both paths end QA's session and return here; they differ only in how.
  //
  //  - Valid id_token: the standard OIDC end-session flow, which IdentityServer is
  //    built around.
  //  - Stale id_token: /connect/endsession cannot identify the client without a
  //    usable hint, so it ignores post_logout_redirect_uri and its fallback lands
  //    the user on QA's own login page. Go straight to /Account/Logout?returnTo=,
  //    which signs out and redirects back (the backend accepts returnTo only if it
  //    is a registered post-logout URL).
  //
  // The hint goes stale an hour into a session, so the second path is the common
  // one in practice.
  const redirectTo = isIdTokenUsableAsHint(session?.idToken)
    ? getQaLogoutUrl(publicOrigin, session?.idToken)
    : getQaAccountLogoutUrl(publicOrigin)

  const response = NextResponse.json({ ok: true, redirectTo })
  clearQaSessionCookies(response)
  clearDemoSessionCookie(response)

  return response
}
