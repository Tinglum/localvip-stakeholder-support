import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { isPersistentQaSession, setQaSessionCookies } from '@/lib/auth/qa-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAuthenticatedSession()

  if (session) {
    const response = NextResponse.json({
      authenticated: true,
      source: session.source,
      profile: session.profile,
      claims: session.qaClaims || null,
      expiresAt: session.qaSession?.expiresAt || null,
      localProfileId: session.localProfileId,
      viewingAs: session.viewingAs || null,
      // Surfaced for the first-login gate in the dashboard layout.
      forcePasswordReset:
        (session.profile.metadata as Record<string, unknown> | null)?.qa_force_password_reset === true,
    })

    // The session resolver refreshed an expired access token. Persist it here --
    // this is a Route Handler, the only place cookies may be written. Without this
    // the refresh would repeat on every request until the refresh token itself
    // expired, and the client would keep seeing a stale expiresAt.
    if (session.qaSessionRefreshed && session.qaSession) {
      // Carry the existing "keep me logged in" choice across the refresh rather
      // than defaulting — a refresh must not change how long the session lasts.
      setQaSessionCookies(response, session.qaSession, {
        persistent: isPersistentQaSession(cookies()),
      })
    }

    return response
  }

  return NextResponse.json({
    authenticated: false,
    source: null,
    profile: null,
  })
}
