/**
 * CRM "Log in as" for any node (customer / business / cause).
 *
 * Calls the QA Admin/LoginAs endpoint to validate the impersonation and obtain
 * the target's profile, then enters an impersonated session by reusing the
 * existing View-As cookie mechanism (the same cookie `getAuthenticatedSession`
 * overlays and `<ViewAsBanner />` renders an exit control for). This keeps the
 * admin's own QA session token intact so "Return to admin" is one click.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { qaAdminLoginAs, QaApiError } from '@/lib/auth/qa-api'
import { signViewAsPayload } from '@/lib/auth/qa-auth'
import { requireQaRouteAccess } from '@/lib/server/qa-route'
import type { UserRole } from '@/lib/types/database'

const COOKIE_NAME = 'lvip_view_as'
const COOKIE_MAX_AGE = 60 * 60 * 4 // 4 hours

// Mirror the AccountType→role mapping used by /api/admin/view-as.
function mapAccountTypeToRole(accountType: unknown): UserRole {
  const at = typeof accountType === 'number'
    ? accountType
    : typeof accountType === 'string' && /^\d+$/.test(accountType)
      ? Number(accountType)
      : null

  if (at === null && typeof accountType === 'string') {
    const normalized = accountType.trim().toLowerCase()
    if (normalized.includes('business')) return 'business'
    if (normalized.includes('cause') || normalized.includes('nonprofit') || normalized.includes('community')) return 'cause_leader'
    if (normalized.includes('admin')) return 'super_admin'
    if (normalized.includes('field')) return 'field'
    return 'community'
  }

  switch (at) {
    case 0: return 'super_admin'
    case 2: return 'business'
    case 3: return 'cause_leader'
    case 4: return 'community'
    case 5: return 'field'
    default: return 'community'
  }
}

export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  let body: { targetUserId?: number | string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const targetUserId = typeof body.targetUserId === 'number' ? body.targetUserId : Number(body.targetUserId)
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ error: 'A positive integer targetUserId is required.' }, { status: 400 })
  }

  try {
    const result = await qaAdminLoginAs(targetUserId)
    const role = mapAccountTypeToRole(result.user.accountType)

    const payload = {
      userId: typeof result.user.id === 'number' ? result.user.id : Number(result.user.id) || targetUserId,
      email: result.user.email,
      name: result.user.email,
      role,
      accountType: result.user.accountType,
      since: new Date().toISOString(),
    }

    cookies().set({
      name: COOKIE_NAME,
      value: await signViewAsPayload(payload),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })

    return NextResponse.json({ ok: true, viewingAs: payload })
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Login-as could not be completed.' }, { status: 500 })
  }
}

export async function DELETE() {
  cookies().delete(COOKIE_NAME)
  return NextResponse.json({ ok: true })
}
