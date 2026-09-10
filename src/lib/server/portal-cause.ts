import {
  PORTAL_CAUSE_COOKIE,
  readSignedPortalCausePayload,
  signPortalCausePayload,
} from '@/lib/auth/qa-auth'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export { PORTAL_CAUSE_COOKIE }

/**
 * Pinning which CAUSE a portal session opens.
 *
 * Deliberately mirrors portal-business.ts. One user can own several accounts —
 * a business and a cause at once — since owner email stopped being unique, and
 * a session that only knows the user id resolves to whichever account the
 * by-user lookup returns first. That is why "Real log in as Cause" landed on the
 * business: there was a pin for businesses and none for causes.
 */

const PORTAL_CAUSE_COOKIE_MAX_AGE = 60 * 60 * 12

export interface PortalCauseAccount {
  accountId: number
  name: string | null
  ownerEmail: string | null
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/**
 * Every cause account `userId` belongs to.
 *
 * The authority for "does this user belong to that cause" — an admin-supplied
 * account id is only trusted after it appears here. Returns null (not []) when
 * the lookup itself failed, so a caller can tell "no causes" from "could not
 * check" and refuse rather than guess.
 */
export async function fetchPortalCauseAccounts(userId: number): Promise<PortalCauseAccount[] | null> {
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Nonprofit/by-user/${userId}/accounts`)
    if (!res.ok) return null
    const json = await parseQaResponse<{ accounts?: unknown[] } | unknown[]>(res, 'Could not list causes.')
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
      .filter((row): row is PortalCauseAccount => row !== null)
  } catch {
    return null
  }
}

export function portalCauseCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PORTAL_CAUSE_COOKIE_MAX_AGE,
  }
}

export type PortalCauseSelectionResult =
  | { ok: true; cookie: { name: string; value: string } }
  | { ok: false; reason: 'not-a-member' | 'unverifiable' }

/**
 * Verify the cause belongs to the user, then mint the signed selection cookie.
 *
 * An unverifiable membership is refused rather than allowed through: an admin
 * can name any account id, and opening someone else's cause portal because a
 * lookup was briefly down is not a failure mode worth having.
 */
export async function buildPortalCauseSelection(
  userId: number,
  accountId: number,
): Promise<PortalCauseSelectionResult> {
  const accounts = await fetchPortalCauseAccounts(userId)
  if (accounts === null) return { ok: false, reason: 'unverifiable' }
  if (!accounts.some((account) => account.accountId === accountId)) return { ok: false, reason: 'not-a-member' }

  const value = await signPortalCausePayload({
    userId,
    accountId,
    since: new Date().toISOString(),
  })
  return { ok: true, cookie: { name: PORTAL_CAUSE_COOKIE, value } }
}

/** Read the requested cause account id off a login-as request body. */
export function readRequestedCauseAccountId(body: Record<string, unknown>): number | null {
  return toPositiveInt(body.causeAccountId ?? null)
}

export { readSignedPortalCausePayload }
