/**
 * Operator identity for the shared SuperAdmin login.
 *
 * GET    -> current operator for this login session (null if unset/stale)
 * POST   -> { operator: 'Rick' | 'Kenneth' | 'Jamaica' } set the choice
 * DELETE -> clear the choice
 *
 * The choice is signed and pinned to the current QA subject, and stored in a
 * session cookie. See `lib/auth/operator-identity` for the binding rules that stop
 * the choice leaking to a different account signed in on the same computer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import {
  OPERATORS,
  OPERATOR_COOKIE_NAME,
  isOperatorName,
  readSignedOperatorPayload,
  signOperatorPayload,
} from '@/lib/auth/operator-identity'
import { isSuperAdminRole } from '@/lib/auth/display-name'

export const dynamic = 'force-dynamic'

/**
 * Only the shared super-admin login gets an operator picker — for a personal
 * account the profile name is already the right attribution.
 */
async function requireSuperAdmin() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }
  // Must use isSuperAdminRole, not `role === 'super_admin'`: a QA SysAdmin maps to
  // { role: 'admin', roleSubtype: 'super' }, so the literal check 403'd for every
  // real admin and the picker silently never rendered.
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }
  const subject = (session.profile.metadata as Record<string, unknown> | null)?.qa_subject
  if (typeof subject !== 'string' || !subject) {
    return { error: NextResponse.json({ error: 'No QA subject on this session.' }, { status: 409 }) }
  }
  return { session, subject }
}

export async function GET() {
  const access = await requireSuperAdmin()
  if ('error' in access) return access.error

  const cookie = cookies().get(OPERATOR_COOKIE_NAME)?.value
  const payload = await readSignedOperatorPayload(cookie, access.subject)
  return NextResponse.json({ operator: payload?.operator ?? null, since: payload?.since ?? null, options: OPERATORS })
}

export async function POST(request: NextRequest) {
  const access = await requireSuperAdmin()
  if ('error' in access) return access.error

  let body: { operator?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isOperatorName(body.operator)) {
    return NextResponse.json(
      { error: `operator must be one of: ${OPERATORS.join(', ')}.` },
      { status: 400 },
    )
  }

  const payload = {
    operator: body.operator,
    subject: access.subject,
    since: new Date().toISOString(),
  }

  cookies().set({
    name: OPERATOR_COOKIE_NAME,
    value: await signOperatorPayload(payload),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // No maxAge: a session cookie, so the choice dies with the browser session.
  })

  return NextResponse.json({ operator: payload.operator, since: payload.since })
}

export async function DELETE() {
  const access = await requireSuperAdmin()
  if ('error' in access) return access.error

  cookies().delete(OPERATOR_COOKIE_NAME)
  return NextResponse.json({ operator: null })
}
