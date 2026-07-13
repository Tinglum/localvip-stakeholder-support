import { NextRequest, NextResponse } from 'next/server'
import { qaAdminLoginAs, QaApiError } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const WEBAPP_URL = (process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://my.localvip.com').replace(/\/+$/, '')

// Admin: "Open in app as this customer". Mints a genuine, short-lived QA token
// for the target user (SysAdmin-gated on the backend) and returns a my.localvip.com
// handoff URL. The token rides in the URL FRAGMENT so it never hits a server log
// or Referer header; the webapp verifies it (JWKS) before establishing a session.
export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  let body: { targetUserId?: number | string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const targetUserId =
    typeof body.targetUserId === 'number' ? body.targetUserId : Number(body.targetUserId)
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ error: 'A positive integer targetUserId is required.' }, { status: 400 })
  }

  try {
    const result = await qaAdminLoginAs(targetUserId)
    const url = `${WEBAPP_URL}/auth/app-handoff#t=${encodeURIComponent(result.accessToken)}`
    return NextResponse.json({
      url,
      target: { userId: result.user.id, email: result.user.email },
    })
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not open the app as this customer.' }, { status: 500 })
  }
}
