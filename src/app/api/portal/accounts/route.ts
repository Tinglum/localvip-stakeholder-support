import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import {
  PORTAL_BUSINESS_COOKIE,
  buildPortalBusinessSelection,
  fetchPortalBusinessAccounts,
  portalBusinessCookieOptions,
  resolvePortalUserId,
} from '@/lib/server/portal-business'
import {
  PORTAL_CAUSE_COOKIE,
  buildPortalCauseSelection,
  fetchPortalCauseAccounts,
  portalCauseCookieOptions,
} from '@/lib/server/portal-cause'

export const dynamic = 'force-dynamic'

/**
 * The accounts this session can actually open, and the ability to switch.
 *
 * Someone who owns a business AND leads a cause had no way to see that, and no
 * way to move between them: the portal resolved whichever account the by-user
 * lookup happened to return first. This makes the set explicit and the choice
 * the user's.
 *
 * GET  -> { user, current, accounts[] }
 * POST -> { type: 'business' | 'cause', accountId } switches, verifying
 *         membership through the same helpers the admin login path uses, so a
 *         hand-crafted account id cannot open an account the user is not in.
 */

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const userId = resolvePortalUserId(session)
  if (userId == null) return NextResponse.json({ error: 'No user in session.' }, { status: 400 })

  const [businesses, causes] = await Promise.all([
    fetchPortalBusinessAccounts(userId),
    fetchPortalCauseAccounts(userId),
  ])

  const accounts = [
    ...(businesses || []).map(item => ({
      type: 'business' as const,
      accountId: item.accountId,
      name: item.name || `Business ${item.accountId}`,
    })),
    ...(causes || []).map(item => ({
      type: 'cause' as const,
      accountId: item.accountId,
      name: item.name || `Cause ${item.accountId}`,
    })),
  ]

  const currentCauseId = session.portalCauseAccountId ?? null
  const current = currentCauseId != null
    ? { type: 'cause' as const, accountId: currentCauseId }
    : session.profile?.business_id != null
      ? { type: 'business' as const, accountId: Number(session.profile.business_id) }
      : null

  return NextResponse.json({
    user: {
      name: session.profile?.full_name || session.profile?.email || null,
      email: session.profile?.email || null,
    },
    current,
    accounts,
    // null from either lookup means the check itself failed, which is different
    // from "belongs to none" - say so rather than showing a confidently empty list.
    incomplete: businesses === null || causes === null,
  })
}

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const userId = resolvePortalUserId(session)
  if (userId == null) return NextResponse.json({ error: 'No user in session.' }, { status: 400 })

  let body: { type?: string; accountId?: number | string } = {}
  try { body = await request.json() } catch { /* handled below */ }

  const accountId = Number(body.accountId)
  if (!Number.isFinite(accountId) || accountId <= 0) {
    return NextResponse.json({ error: 'An accountId is required.' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true, type: body.type, accountId })

  if (body.type === 'cause') {
    const selection = await buildPortalCauseSelection(userId, accountId)
    if (!selection.ok) {
      return NextResponse.json(
        {
          error: selection.reason === 'not-a-member'
            ? 'That cause does not belong to you.'
            : 'Could not verify that cause.',
        },
        { status: selection.reason === 'not-a-member' ? 403 : 502 },
      )
    }
    response.cookies.set(selection.cookie.name, selection.cookie.value, portalCauseCookieOptions())
    // Clearing the other pin matters as much as setting this one: a stale
    // business pin would otherwise keep overriding where the portal opens.
    response.cookies.set(PORTAL_BUSINESS_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  }

  if (body.type === 'business') {
    const selection = await buildPortalBusinessSelection(userId, accountId)
    if (!selection.ok) {
      return NextResponse.json(
        {
          error: selection.reason === 'not-a-member'
            ? 'That business does not belong to you.'
            : 'Could not verify that business.',
        },
        { status: selection.reason === 'not-a-member' ? 403 : 502 },
      )
    }
    response.cookies.set(selection.cookie.name, selection.cookie.value, portalBusinessCookieOptions())
    response.cookies.set(PORTAL_CAUSE_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  }

  return NextResponse.json({ error: 'type must be "business" or "cause".' }, { status: 400 })
}
