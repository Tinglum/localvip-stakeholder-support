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

function toPositiveInt(value: unknown): number | null {
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
  if (accounts === null) return false
  return accounts.some((account) => account.accountId === accountId)
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
