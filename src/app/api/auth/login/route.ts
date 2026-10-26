import { NextRequest, NextResponse } from 'next/server'
import { isWebappOnlyStaff, loginWithPassword, setQaSessionCookies, WEBAPP_ONLY_STAFF_MESSAGE } from '@/lib/auth/qa-auth'
import { beginSysadminPinLogin } from '@/lib/server/sysadmin-pin'

export const dynamic = 'force-dynamic'

// Native dashboard sign-in: authenticate with our own email/password form via the
// QA password grant and set the dashboard session cookies directly — no redirect
// to the QA IdentityServer login page.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) {
      return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 })
    }

    // "Keep me logged in on this device" — default on, matching the webapp. Only
    // an explicit false opts out into browser-session cookies.
    const persistent = body.keepLoggedIn !== false

    const session = await loginWithPassword(email, password)
    if (isWebappOnlyStaff(session.claims.roles)) {
      return NextResponse.json({ error: WEBAPP_ONLY_STAFF_MESSAGE }, { status: 403 })
    }
    const response = NextResponse.json({ ok: true, persistent })
    setQaSessionCookies(response, session, { persistent })
    await beginSysadminPinLogin(request, response, session)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not sign in.' },
      { status: 401 },
    )
  }
}
