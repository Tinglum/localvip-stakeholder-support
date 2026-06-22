/**
 * SECURE "Real log in as" — genuine authenticated session as a target user.
 *
 * Unlike `/api/admin/view-as` and `/api/dashboard/login-as` (which set a
 * read-only `lvip_view_as` overlay cookie on top of the admin's own session),
 * this route starts a *real* session as the target user:
 *
 *   1. Strictly gate to super-admins (QA session + admin shell).
 *   2. Call the super-admin-gated backend endpoint
 *      POST /api/dashboard/v1/Admin/LoginAs { targetUserId }
 *      which mints a genuine IdentityServer-signed access token for the target
 *      (same signing key the API validates against, carrying the exact claims
 *      ProfileService emits). No password is ever involved — see SECURITY note.
 *   3. Stash the *admin's* current QA session cookies under a backup name so the
 *      companion DELETE ("Return to admin") can restore the original session.
 *   4. Overwrite the live QA session cookies (lvip_qa_*) with the minted token,
 *      so `getAuthenticatedSession` resolves a real session AS the target user —
 *      identical to what they'd get logging in themselves.
 *
 * ── SECURITY: why no password ──────────────────────────────────────────────
 * Passwords are hashed with ASP.NET Identity and are not retrievable or
 * reversible; there is no code path that returns or decrypts them. Impersonation
 * never touches credentials — the backend, having already authenticated the
 * caller as a SysAdmin, *mints a fresh signed token* for the target user. The
 * result is a real session without ever knowing or exposing the user's password.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { qaAdminLoginAs, QaApiError } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'
import {
  QA_COOKIE_NAMES,
  buildQaSessionFromTokens,
  setQaSessionCookies,
} from '@/lib/auth/qa-auth'

// Backup copies of the admin's own session cookies while impersonating, so we
// can restore the genuine admin session on exit. Mirrors QA_COOKIE_NAMES.
const ADMIN_BACKUP_PREFIX = 'lvip_admin_real_session__'
const IMPERSONATION_FLAG = 'lvip_real_impersonation'

const QA_SESSION_COOKIE_KEYS = [
  QA_COOKIE_NAMES.accessToken,
  QA_COOKIE_NAMES.idToken,
  QA_COOKIE_NAMES.refreshToken,
  QA_COOKIE_NAMES.expiresAt,
  QA_COOKIE_NAMES.scopes,
] as const

export async function POST(request: NextRequest) {
  // Strict gate: must be an authenticated QA admin (super-admin shell).
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const jar = cookies()

  let body: { targetUserId?: number | string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const targetUserId =
    typeof body.targetUserId === 'number' ? body.targetUserId : Number(body.targetUserId)
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json(
      { error: 'A positive integer targetUserId is required.' },
      { status: 400 },
    )
  }

  // Defense in depth: never let an admin "real log in as" themselves — that is a
  // no-op that would clobber their own backup with an impersonation flag.
  const actingNumericId = access.session.localProfileId
  if (actingNumericId && String(actingNumericId) === String(targetUserId)) {
    return NextResponse.json({ error: 'Cannot log in as yourself.' }, { status: 400 })
  }

  try {
    // Backend mints a genuine signed token for the target user (SysAdmin-gated).
    const result = await qaAdminLoginAs(targetUserId)

    const session = buildQaSessionFromTokens({
      accessToken: result.accessToken,
      idToken: null,
      // Intentionally no refresh token: an impersonation session is short-lived
      // and must NOT silently renew. When the minted token expires the admin is
      // dropped back to login, which is the safe default for impersonation.
      refreshToken: null,
      expiresIn: result.expiresIn,
      grantedScopes: result.scope ?? null,
    })

    const response = NextResponse.json({
      ok: true,
      realSession: true,
      target: {
        userId: result.user.id,
        email: result.user.email,
        accountType: result.user.accountType,
      },
    })

    const secure = process.env.NODE_ENV === 'production'

    // 1) Back up the admin's current session cookies (only if not already
    //    impersonating — avoids overwriting the original admin backup when an
    //    admin chains "real log in as" twice without returning).
    const alreadyImpersonating = jar.get(IMPERSONATION_FLAG)?.value === '1'
    if (!alreadyImpersonating) {
      for (const name of QA_SESSION_COOKIE_KEYS) {
        const current = jar.get(name)?.value
        if (current) {
          response.cookies.set(`${ADMIN_BACKUP_PREFIX}${name}`, current, {
            httpOnly: true,
            sameSite: 'lax',
            secure,
            path: '/',
            maxAge: 60 * 60 * 8, // backup outlives a 1h impersonation token
          })
        }
      }
    }

    // 2) Overwrite the live QA session with the impersonation token → real
    //    authenticated session as the target user.
    setQaSessionCookies(response, session)

    // 3) Mark the impersonation so exit/UI can detect it. Readable by client so
    //    a banner can render; the security boundary is the httpOnly token cookie.
    response.cookies.set(IMPERSONATION_FLAG, '1', {
      httpOnly: false,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: Math.max(result.expiresIn, 300),
    })

    // 4) Clear any stale plain View-As overlay so the two mechanisms can't stack.
    response.cookies.set('lvip_view_as', '', { path: '/', maxAge: 0 })

    return response
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json(
      { error: 'Real log in as could not be completed.' },
      { status: 500 },
    )
  }
}

/**
 * Return to the admin's own session: restore the backed-up admin cookies and
 * clear the impersonation token. Available to anyone holding the backup (the
 * impersonated session itself), since the only thing it can do is hand control
 * back to the original admin session it was created from.
 */
export async function DELETE() {
  const jar = cookies()
  const response = NextResponse.json({ ok: true, restored: true })
  const secure = process.env.NODE_ENV === 'production'

  let restoredAny = false
  for (const name of QA_SESSION_COOKIE_KEYS) {
    const backup = jar.get(`${ADMIN_BACKUP_PREFIX}${name}`)?.value
    if (backup) {
      restoredAny = true
      response.cookies.set(name, backup, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
    } else {
      // No backup for this key → ensure the impersonation value is cleared.
      response.cookies.set(name, '', { path: '/', maxAge: 0 })
    }
    // Always expire the backup copy.
    response.cookies.set(`${ADMIN_BACKUP_PREFIX}${name}`, '', { path: '/', maxAge: 0 })
  }

  response.cookies.set(IMPERSONATION_FLAG, '', { path: '/', maxAge: 0 })
  response.cookies.set('lvip_view_as', '', { path: '/', maxAge: 0 })

  if (!restoredAny) {
    return NextResponse.json(
      { error: 'No admin session backup found to restore.' },
      { status: 409 },
    )
  }

  return response
}
