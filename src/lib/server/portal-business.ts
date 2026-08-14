import { cookies } from 'next/headers'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import {
  PORTAL_BUSINESS_COOKIE,
  readSignedPortalBusinessPayload,
  signPortalBusinessPayload,
} from '@/lib/auth/qa-auth'
import type { ResolvedAuthSession } from '@/lib/server/auth-session'

export { PORTAL_BUSINESS_COOKIE }

export interface PortalBusinessAccount {
  accountId: number
  name: string | null
  ownerEmail: string | null
}

/** Shared id parsing so business and cause selections accept exactly the same shapes. */
export function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/** The QA user id this session acts as (impersonation target, else the subject). */
export function resolvePortalUserId(session: ResolvedAuthSession): number | null {
  return toPositiveInt(session.viewingAs?.targetUserId ?? session.qaClaims?.sub ?? null)
}

/**
 * Every business account `userId` belongs to, oldest membership first.
 *
 * This is the authority for "does this user belong to that business" — an
 * admin-supplied account id is only ever trusted after it turns up in this list.
 * Returns null (not []) when the lookup itself failed, so callers can tell
 * "no businesses" apart from "could not check".
 */
export async function fetchPortalBusinessAccounts(userId: number): Promise<PortalBusinessAccount[] | null> {
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Business/by-user/${userId}/accounts`)
    if (!res.ok) {
      // See portal-cause.ts: a bare null made every upstream failure look the
      // same from the browser, which is unactionable when it goes wrong.
      const body = await res.text().catch(() => '')
      console.error(
        `[portal-business] business account lookup failed for user ${userId}: ` +
          `${res.status} ${res.statusText} ${body.slice(0, 300)}`,
      )
      return null
    }
    const json = await parseQaResponse<{ accounts?: unknown[] } | unknown[]>(res, 'Could not list businesses.')
    const rows = Array.isArray(json) ? json : Array.isArray(json?.accounts) ? json.accounts : []
    return rows
      .map((row) => {
        const record = (row ?? {}) as Record<string, unknown>
        const accountId = toPositiveInt(record.accountId ?? record.AccountId ?? record.id)
        if (accountId == null) return null
        return {
          accountId,
          name: typeof record.name === 'string' ? record.name : null,
          ownerEmail: typeof record.ownerEmail === 'string' ? record.ownerEmail : null,
        }
      })
      .filter((row): row is PortalBusinessAccount => row !== null)
  } catch {
    return null
  }
}

/** The legacy single-answer lookup (lowest AccountUsers row). Unchanged behaviour. */
async function fetchLegacyBusinessId(userId: number): Promise<number | null> {
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Business/by-user/${userId}`)
    const byUser = await parseQaResponse<{ accountId?: number }>(res, 'Could not resolve business.')
    return toPositiveInt(byUser?.accountId)
  } catch {
    return null
  }
}

/**
 * Confirm `accountId` is one of `userId`'s businesses.
 *
 * An admin can name any business account when launching a portal session, so the
 * id is never taken on trust: membership is checked against the backend. If the
 * membership lookup is unavailable we return false — an unverifiable id must not
 * be honoured, and the caller falls back to the by-user answer.
 */
export async function userBelongsToBusinessAccount(userId: number, accountId: number): Promise<boolean> {
  const accounts = await fetchPortalBusinessAccounts(userId)
  if (accounts !== null && accounts.some((account) => account.accountId === accountId)) return true
  // Owning the account is one path; being explicitly assigned to help it is the
  // other. Matches GeneratedMaterialController.CanAccessAccountAsync on the QA
  // backend exactly, so a caller this gate lets through is never rejected there.
  return userIsAssignedToAccount(userId, accountId, 'business')
}

/**
 * Whether `userId` has an active DashboardStakeholderAssignment for this
 * business or cause account — the "Enablers" connection, not ownership.
 */
export async function userIsAssignedToAccount(
  userId: number,
  accountId: number,
  entityType: 'business' | 'cause',
): Promise<boolean> {
  try {
    const res = await fetchQaApi(
      `/api/dashboard/v1/StakeholderAssignment`
      + `?stakeholderUserId=${encodeURIComponent(userId)}`
      + `&entityType=${encodeURIComponent(entityType)}`
      + `&entityId=${encodeURIComponent(accountId)}`,
    )
    if (!res.ok) return false
    const json = await parseQaResponse<{ items?: unknown[] } | unknown[]>(res, 'Could not check assignment.')
    const rows = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : []
    // The GetAll endpoint already defaults to active/non-released when no status
    // filter is supplied, so any row returned here is a live assignment.
    return rows.length > 0
  } catch {
    return false
  }
}

/**
 * Does this session carry admin authority *right now*?
 *
 * While impersonating, the session IS the business user (`profile.role` is the
 * target's), and admin authority must not leak back in — otherwise a view-as
 * session could name a business the target does not belong to.
 */
export function isPortalAdminSession(session: ResolvedAuthSession): boolean {
  if (session.viewingAs) return false
  const role = session.profile?.role ?? null
  return role === 'admin' || role === 'super_admin' || role === 'internal_admin'
}

export type PortalBusinessScope =
  | { ok: true; businessId: number }
  | { ok: false; error: string; status: 400 | 403 }

/**
 * Resolve the business a portal endpoint should act on, allowing an explicit id.
 *
 * The portal endpoints were session-scoped only, which made them unusable from
 * the admin Materials Library: an admin has no business of their own, so every
 * call 400'd and the generate dialog lost its logo, join link and referral code
 * with no way to say which business it should have used.
 *
 * `requested` arrives from the browser and is never taken on trust: an admin may
 * name any business, but anyone else only their own memberships (checked against
 * `fetchPortalBusinessAccounts`, the same authority the login-as flow uses).
 * With no `requested`, behaviour is exactly the old session-scoped resolution.
 */
export async function resolveScopedPortalBusinessId(
  session: ResolvedAuthSession,
  requested: unknown,
): Promise<PortalBusinessScope> {
  const hasRequest = requested != null && String(requested).trim() !== ''
  const explicit = hasRequest ? toPositiveInt(requested) : null

  if (!hasRequest) {
    const own = await resolvePortalBusinessId(session)
    if (own == null) return { ok: false, error: noPortalBusinessError(session), status: 400 }
    return { ok: true, businessId: own }
  }
  if (explicit == null) {
    return { ok: false, error: 'That business id is not valid.', status: 400 }
  }
  if (isPortalAdminSession(session)) return { ok: true, businessId: explicit }

  const userId = resolvePortalUserId(session)
  if (userId == null) return { ok: false, error: noPortalBusinessError(session), status: 400 }
  if (await userBelongsToBusinessAccount(userId, explicit)) return { ok: true, businessId: explicit }
  return { ok: false, error: 'You do not have access to that business.', status: 403 }
}

const PORTAL_BUSINESS_COOKIE_MAX_AGE = 60 * 60 * 8

/** Cookie attributes for the portal-business selection. httpOnly: it selects data scope. */
export function portalBusinessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PORTAL_BUSINESS_COOKIE_MAX_AGE,
  }
}

export type PortalBusinessSelectionResult =
  | { ok: true; cookie: { name: string; value: string } }
  | { ok: false; reason: 'not-a-member' | 'unverifiable' }

/**
 * Mint the signed selection cookie for `accountId`, but only after confirming with
 * the backend that `userId` actually belongs to that business.
 *
 * This is the security check for the whole feature: the account id arrives from an
 * admin's browser, and without this an admin could hand-craft a request and open
 * an arbitrary business's portal as an arbitrary user. Membership is never assumed
 * from the fact that the CRM page displayed the two together.
 */
export async function buildPortalBusinessSelection(
  userId: number,
  accountId: number,
): Promise<PortalBusinessSelectionResult> {
  const accounts = await fetchPortalBusinessAccounts(userId)
  if (accounts === null) return { ok: false, reason: 'unverifiable' }
  if (!accounts.some((account) => account.accountId === accountId)) return { ok: false, reason: 'not-a-member' }

  const value = await signPortalBusinessPayload({
    userId,
    accountId,
    since: new Date().toISOString(),
  })
  return { ok: true, cookie: { name: PORTAL_BUSINESS_COOKIE, value } }
}

/** Read the requested business account id off a login-as request body. */
export function readRequestedBusinessAccountId(body: Record<string, unknown>): number | null {
  return toPositiveInt(body.businessAccountId ?? null)
}

/** The explicit selection carried in the signed cookie, if it applies to this session. */
async function readSelectedBusinessId(userId: number): Promise<number | null> {
  const raw = cookies().get(PORTAL_BUSINESS_COOKIE)?.value
  const payload = await readSignedPortalBusinessPayload(raw)
  if (!payload) return null
  // The selection is bound to the user it was minted for; a cookie left over from
  // a previous impersonation must not leak into a different session.
  if (payload.userId !== userId) return null
  return payload.accountId
}

/**
 * Resolve the business account id for the current portal session.
 *
 * Order of preference:
 *  1. The business the admin explicitly launched from (session `viewingAs`, or the
 *     signed `lvip_portal_business` cookie — the latter also covers "Real log in
 *     as", which replaces the session outright and so has no `viewingAs`), but
 *     ONLY after the backend confirms the target user belongs to that account.
 *  2. The user's first business membership.
 *
 * Before this, the portal resolved from the user alone, so an owner of several
 * businesses always landed in whichever one had the lowest AccountUsers row —
 * clicking "Log in as Business" on business A could open business B's portal.
 */
export async function resolvePortalBusinessId(session: ResolvedAuthSession): Promise<number | null> {
  const userId = resolvePortalUserId(session)
  if (!userId) return null

  const explicit =
    toPositiveInt(session.viewingAs?.targetBusinessAccountId ?? null) ?? (await readSelectedBusinessId(userId))

  const accounts = await fetchPortalBusinessAccounts(userId)

  if (explicit != null) {
    if (accounts === null) {
      // Membership is unverifiable (older backend, or the call failed). Do not
      // honour an unverified admin-supplied id — fall through to the by-user answer.
    } else if (accounts.some((account) => account.accountId === explicit)) {
      return explicit
    }
  }

  if (accounts && accounts.length > 0) return accounts[0].accountId
  return fetchLegacyBusinessId(userId)
}

/**
 * The four portal endpoints below all need a business. When the caller has none,
 * a bare "Could not resolve your business account." is a dead end for the two
 * people who hit it most: a super admin browsing the portal (who has no business
 * of their own and must view-as one), and an owner whose account is not linked
 * yet. Say which case it is and what to do about it.
 */
export function noPortalBusinessError(session: { profile?: { role?: string | null; role_subtype?: string | null } | null }) {
  const role = session?.profile?.role ?? null
  const subtype = session?.profile?.role_subtype ?? null
  const isAdmin = role === 'super_admin' || (role === 'admin' && subtype === 'super')
  return isAdmin
    ? 'This page builds materials for one business, and your admin account is not a business. Open a business in CRM and use "Log in as Business" to work inside its portal.'
    : 'Your account is not linked to a business yet, so there is no referral link to build a QR from. Ask an administrator to link your business account.'
}
