import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export async function GET() {
  const session = await getAuthenticatedSession()

  if (session) {
    return NextResponse.json({
      authenticated: true,
      source: session.source === 'supabase' ? 'demo' : session.source,
      profile: session.profile,
      claims: session.qaClaims || null,
      expiresAt: session.qaSession?.expiresAt || null,
      localProfileId: session.localProfileId,
    })
  }

  return NextResponse.json({
    authenticated: false,
    source: null,
    profile: null,
  })
}
