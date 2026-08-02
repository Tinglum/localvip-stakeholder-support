import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

/**
 * ── Which cause is a portal session being opened for? ────────────────────────
 *
 * Cause counterpart to `lib/server/portal-business`. The cause portal resolved
 * the nonprofit from the user alone (first `AccountUsers` membership), so a
 * leader of several causes always landed in the same one and could not reach the
 * others — clicking "Log in as Cause in webapp" on cause A could open cause B.
 *
 * The difference from the business module is deliberate and worth stating: the
 * DASHBOARD itself renders no cause portal surface (nothing here calls
 * `/CausePortal/*`), so there is no `lvip_portal_cause` cookie and no
 * `resolvePortalCauseId`. The only place a cause portal session is opened is the
 * webapp handoff, which carries the id in the URL fragment and re-verifies it on
 * its own side. This module exists so the dashboard refuses to launch a cause the
 * target user does not belong to in the first place.
 */

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
 * Every nonprofit account `userId` belongs to, oldest membership first.
 *
 * This is the authority for "does this user belong to that cause" — an
 * admin-supplied account id is only ever trusted after it turns up in this list.
 * Returns null (not []) when the lookup itself failed, so callers can tell
 * "no causes" apart from "could not check".
 */
export async function fetchPortalCauseAccounts(userId: number): Promise<PortalCauseAccount[] | null> {
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Nonprofit/by-user/${userId}/accounts`)
    if (!res.ok) {
      // Log WHY. Returning a bare null here meant every upstream failure -
      // 403 role, 404 route, 500 - surfaced identically as "could not verify",
      // which is unactionable from the browser.
      const body = await res.text().catch(() => '')
      console.error(
        `[portal-cause] cause account lookup failed for user ${userId}: ` +
          `${res.status} ${res.statusText} ${body.slice(0, 300)}`,
      )
      return null
    }
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
  } catch (error) {
    console.error(
      `[portal-cause] cause account lookup threw for user ${userId}:`,
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

/**
 * Confirm `accountId` is one of `userId`'s causes.
 *
 * An admin can name any cause account when launching a portal session, so the id
 * is never taken on trust. An unverifiable lookup counts as "no" — honouring an
 * id we could not check is exactly how a hand-crafted request would open an
 * arbitrary cause's donation history.
 */
export async function userBelongsToCauseAccount(userId: number, accountId: number): Promise<boolean> {
  const accounts = await fetchPortalCauseAccounts(userId)
  if (accounts === null) return false
  return accounts.some((account) => account.accountId === accountId)
}

export type PortalCauseSelectionResult = { ok: true } | { ok: false; reason: 'not-a-member' | 'unverifiable' }

/**
 * Membership gate for a cause portal launch. Mirrors
 * `buildPortalBusinessSelection` minus the signed cookie, which has no consumer
 * on the dashboard side (see the module note above).
 */
export async function verifyPortalCauseSelection(
  userId: number,
  accountId: number,
): Promise<PortalCauseSelectionResult> {
  const accounts = await fetchPortalCauseAccounts(userId)
  if (accounts === null) return { ok: false, reason: 'unverifiable' }
  if (!accounts.some((account) => account.accountId === accountId)) return { ok: false, reason: 'not-a-member' }
  return { ok: true }
}

/** Read the requested cause account id off a login-as request body. */
export function readRequestedCauseAccountId(body: Record<string, unknown>): number | null {
  return toPositiveInt(body.causeAccountId ?? null)
}
