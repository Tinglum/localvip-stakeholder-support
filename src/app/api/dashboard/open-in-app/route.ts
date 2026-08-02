import { NextRequest, NextResponse } from 'next/server'
import { qaAdminLoginAs, QaApiError } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'
import { buildPortalBusinessSelection, readRequestedBusinessAccountId } from '@/lib/server/portal-business'
import { readRequestedCauseAccountId, verifyPortalCauseSelection } from '@/lib/server/portal-cause'

export const dynamic = 'force-dynamic'

const WEBAPP_URL = (process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://my.localvip.com').replace(/\/+$/, '')

// Admin: open the webapp as a customer, business owner, or cause owner. Mints a
// genuine, short-lived QA token (SysAdmin-gated on the backend) and returns a my.localvip.com
// handoff URL. The token rides in the URL FRAGMENT so it never hits a server log
// or Referer header; the webapp verifies it (JWKS) before establishing a session.
export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  let body: {
    targetUserId?: number | string
    businessAccountId?: number | string
    causeAccountId?: number | string
  } = {}
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

  // Which business the admin launched from. The webapp used to re-derive the
  // business from the user alone, so an owner of several businesses landed in
  // whichever one the backend's by-user lookup returned first — clicking
  // "Log in as Business" on business A could open business B. We now carry the
  // id across, but only after confirming the target user really belongs to it:
  // the id comes from a browser, and an unverified one would let a hand-crafted
  // request open an arbitrary business. Same check the internal portal uses.
  const requestedBusinessAccountId = readRequestedBusinessAccountId(body as Record<string, unknown>)
  let verifiedBusinessAccountId: number | null = null
  if (requestedBusinessAccountId != null) {
    const selection = await buildPortalBusinessSelection(targetUserId, requestedBusinessAccountId)
    if (!selection.ok) {
      // Fail closed. Silently opening "some other" business is exactly the bug
      // this change exists to remove.
      return NextResponse.json(
        {
          error:
            selection.reason === 'not-a-member'
              ? 'That business does not belong to this user.'
              : 'Could not verify the business belongs to this user.',
        },
        { status: selection.reason === 'not-a-member' ? 403 : 502 },
      )
    }
    verifiedBusinessAccountId = requestedBusinessAccountId
  }

  // Same story for causes: the cause portal resolved the nonprofit from the user
  // alone, so a leader of several causes always landed in the same one. Verified
  // the same way, and fails closed for the same reason.
  const requestedCauseAccountId = readRequestedCauseAccountId(body as Record<string, unknown>)
  let verifiedCauseAccountId: number | null = null
  if (requestedCauseAccountId != null) {
    const selection = await verifyPortalCauseSelection(targetUserId, requestedCauseAccountId)
    if (!selection.ok) {
      return NextResponse.json(
        {
          error:
            selection.reason === 'not-a-member'
              ? 'That cause does not belong to this user.'
              : 'Could not verify the cause belongs to this user.',
        },
        { status: selection.reason === 'not-a-member' ? 403 : 502 },
      )
    }
    verifiedCauseAccountId = requestedCauseAccountId
  }

  try {
    const result = await qaAdminLoginAs(targetUserId)
    // Both values ride in the URL FRAGMENT, which is never sent to a server,
    // logged, or leaked via Referer. The webapp re-verifies `b` against the
    // signed-in user before honouring it — this is a hint, not an authority.
    const url =
      `${WEBAPP_URL}/auth/app-handoff#t=${encodeURIComponent(result.accessToken)}` +
      (verifiedBusinessAccountId != null ? `&b=${encodeURIComponent(String(verifiedBusinessAccountId))}` : '') +
      (verifiedCauseAccountId != null ? `&c=${encodeURIComponent(String(verifiedCauseAccountId))}` : '')
    return NextResponse.json({
      url,
      target: {
        userId: result.user.id,
        email: result.user.email,
        businessAccountId: verifiedBusinessAccountId,
        causeAccountId: verifiedCauseAccountId,
      },
    })
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Could not open the webapp as this user.' }, { status: 500 })
  }
}
