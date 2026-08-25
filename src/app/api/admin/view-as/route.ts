/**
 * Sysadmin "View As" mode.
 *
 * Sets a server-readable cookie carrying the target user's id + role + email.
 * The dashboard layer (`getAuthenticatedSession` → `useAuth`) checks for this
 * cookie and swaps the active profile so the entire UI — sidebar, permission
 * checks, data queries — mirrors what the target user would see.
 *
 * A yellow `ViewAsBanner` overlays the experience so the sysadmin always
 * knows they're impersonating, and can return with one click.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { readSignedViewAsPayload, signViewAsPayload } from '@/lib/auth/qa-auth'
import { resolveUserDisplayName } from '@/lib/auth/display-name'
import { requireQaRouteAccess } from '@/lib/server/qa-route'
import {
  PORTAL_BUSINESS_COOKIE,
  buildPortalBusinessSelection,
  portalBusinessCookieOptions,
  readRequestedBusinessAccountId,
  toPositiveInt,
} from '@/lib/server/portal-business'
import type { UserRole } from '@/lib/types/database'

interface QaUserLookup {
  id: number
  email: string
  firstName?: string
  lastName?: string
  accountType?: string | number
  consumerType?: string
  roles?: string[]
}

const COOKIE_NAME = 'lvip_view_as'
const COOKIE_MAX_AGE = 60 * 60 * 4 // 4 hours

// Roles are the reliable persona signal on QA — `accountType` is frequently null
// on the user/list/detail responses, so mapping on it alone misclassifies (e.g. a
// BusinessAdmin with a null accountType would fall through to 'community'). Mirror
// the entity-type priority used by the main login role mapper.
function mapRolesToRole(roles: string[] | undefined): UserRole | null {
  if (!roles || roles.length === 0) return null
  const r = roles.map((role) => role.toLowerCase())
  if (r.some((x) => x.includes('sysadmin') || x.includes('superadmin') || (x.includes('super') && x.includes('admin')))) return 'super_admin'
  if (r.some((x) => x.includes('business'))) return 'business'
  if (r.some((x) => x.includes('school'))) return 'school_leader'
  if (r.some((x) => x.includes('nonprofit') || x.includes('cause'))) return 'cause_leader'
  if (r.some((x) => x.includes('admin'))) return 'super_admin'
  if (r.some((x) => x.includes('launch') || x.includes('partner') || x.includes('onboarding'))) return 'launch_partner'
  if (r.some((x) => x.includes('intern'))) return 'intern'
  if (r.some((x) => x.includes('volunteer'))) return 'volunteer'
  if (r.some((x) => x.includes('influencer'))) return 'influencer'
  if (r.some((x) => x.includes('consumer') || x.includes('customer') || x.includes('client'))) return 'community'
  return null
}

// Normalize the various user-lookup shapes QA returns into a flat record. The
// `User/{id}` route in particular wraps the user in `{ roles, user: {...} }`;
// treating that envelope as the user leaves accountType/email/name undefined.
function normalizeUserLookup(json: unknown, fallbackId: number): QaUserLookup | null {
  if (!json || typeof json !== 'object') return null
  const record = json as Record<string, unknown>
  const inner = (record.user && typeof record.user === 'object' ? record.user : record) as Record<string, unknown>
  const roles = Array.isArray(record.roles)
    ? (record.roles as unknown[]).map(String)
    : Array.isArray(inner.roles)
      ? (inner.roles as unknown[]).map(String)
      : undefined
  const idValue = inner.id ?? record.id ?? fallbackId
  return {
    id: typeof idValue === 'number' ? idValue : Number(idValue) || fallbackId,
    email: typeof inner.email === 'string' ? inner.email : '',
    firstName: typeof inner.firstName === 'string' ? inner.firstName : undefined,
    lastName: typeof inner.lastName === 'string' ? inner.lastName : undefined,
    accountType: (inner.accountType ?? record.accountType) as string | number | undefined,
    consumerType: (inner.consumerType ?? record.consumerType) as string | undefined,
    roles,
  }
}

/**
 * Map the backend AccountType enum to the frontend Profile.role string.
 * Backend enum values (App/Data/Enums.cs, AccountType):
 *   0 = Unknown, 1 = System, 2 = Business, 3 = NonProfit, 4 = Consumer, 5 = Employee
 *
 * NOTE: an earlier version of this comment claimed 0 = SysAdmin / 1 = Stripe /
 * 5 = Field and mapped 0 -> super_admin. Unknown(0) is what half-created accounts
 * get, so that silently presented them as super admins. Unknown now falls through
 * to the safest role; System(1) is the actual admin value.
 */
function mapAccountTypeToRole(accountType: unknown, consumerType?: string | null): UserRole {
  const at = typeof accountType === 'number'
    ? accountType
    : typeof accountType === 'string' && /^\d+$/.test(accountType)
      ? Number(accountType)
      : null

  const normalizedConsumerType = typeof consumerType === 'string' ? consumerType.trim().toLowerCase() : null

  if (at === 4) {
    if (normalizedConsumerType === 'intern') return 'intern'
    if (normalizedConsumerType === 'volunteer') return 'volunteer'
    if (normalizedConsumerType === 'influencer') return 'influencer'
    if (normalizedConsumerType === 'launchteampartner') return 'launch_partner'
  }

  switch (at) {
    case 1: return 'super_admin'   // System
    case 2: return 'business'
    case 3: return 'cause_leader'
    case 4: return 'community'
    case 5: return 'field'         // Employee
    case 0:                        // Unknown — never infer admin from a missing type
    default: return 'community'
  }
}

async function fetchUserById(userId: number): Promise<QaUserLookup | null> {
  // Try Consumer first (gives consumerType) — only a genuine consumer 200s here.
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Consumer/${userId}`)
    if (res.ok) {
      const normalized = normalizeUserLookup(await res.json(), userId)
      if (normalized) return { ...normalized, accountType: 4 }
    }
  } catch {}

  // Admin user list — returns accountType + consumerType + roles per user.
  try {
    const res = await fetchQaApi('/api/dashboard/v1/User/list?pageSize=500')
    if (res.ok) {
      const json = await res.json()
      const items = Array.isArray(json) ? json : (json?.items ?? [])
      const match = items.find((u: { id?: number }) => u?.id === userId)
      if (match) return normalizeUserLookup(match, userId)
    }
  } catch {}

  // Last resort: the {id} route — returns a { roles, user: {...} } envelope, so
  // it MUST be normalized (treating the envelope as the user leaves accountType,
  // email and name undefined → misclassified as 'community' with a blank name).
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/User/${userId}`)
    if (res.ok) return normalizeUserLookup(await res.json(), userId)
  } catch {}

  return null
}

export async function POST(request: NextRequest) {
  // Gate the impersonation route itself: only an admin/operator may start a
  // "View As" overlay. This must run BEFORE any cookie is set, independent of
  // any downstream check.
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  let body: { userId?: number | string; businessAccountId?: number | string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const userId = typeof body.userId === 'number' ? body.userId : Number(body.userId)
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: 'A positive integer userId is required.' }, { status: 400 })
  }

  try {
    const user = await fetchUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 })
    }

    // Prefer the roles-based mapping (reliable); fall back to accountType only
    // when the user carries no role claims.
    const role = mapRolesToRole(user.roles) ?? mapAccountTypeToRole(user.accountType, user.consumerType)
    const payload = {
      userId: user.id,
      email: user.email,
      // Use the shared resolver: a raw first+last join here re-introduced the
      // "string string" placeholder for accounts created via Swagger, because this
      // name is written straight onto Profile.full_name by applyViewAsOverride and
      // so bypasses the session profile's own sanitization.
      name: resolveUserDisplayName({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isSuperAdmin: role === 'super_admin',
      }),
      role,
      accountType: user.accountType,
      consumerType: user.consumerType,
      since: new Date().toISOString(),
    }

    // Carry the SELECTED business (the one whose CRM page the admin clicked from)
    // into the session. Without it the portal resolves from the user alone and an
    // owner of several businesses always lands in the same one.
    const requestedBusinessAccountId = readRequestedBusinessAccountId(body as Record<string, unknown>)
    let businessAccountId: number | null = null
    let portalCookie: { name: string; value: string } | null = null
    if (requestedBusinessAccountId != null) {
      const selection = await buildPortalBusinessSelection(user.id, requestedBusinessAccountId)
      if (!selection.ok) {
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
      portalCookie = selection.cookie
      businessAccountId = requestedBusinessAccountId
    } else {
      // No business named — clear any stale selection so the previous target's
      // business cannot bleed into this one.
    }

    // Same problem and same guarantee for causes: a leader of several nonprofits
    // must land in the one whose CRM page the admin clicked, not whichever the
    // by-user lookup happens to return first. Verified against the backend before
    // it reaches the session, so a caller cannot name a cause the user is not in.
    const requestedCauseAccountId = toPositiveInt(
      (body as Record<string, unknown>).causeAccountId ?? null,
    )
    let causeAccountId: number | null = null
    if (requestedCauseAccountId != null) {
      const membership = await fetchQaApi(
        `/api/dashboard/v1/Nonprofit/by-user/${userId}/accounts`,
      ).catch(() => null)

      if (!membership || !membership.ok) {
        return NextResponse.json(
          { error: 'Could not verify the cause belongs to this user.' },
          { status: 502 },
        )
      }

      // The endpoint wraps its rows: `{ accounts: [{ accountId, name, ownerEmail }] }`.
      // Reading only a bare array or `items` found nothing and rejected every cause
      // with "That cause does not belong to this user."
      const raw = (await membership.json().catch(() => null)) as unknown
      const envelope = (raw ?? {}) as { accounts?: unknown; items?: unknown }
      const list: unknown[] = Array.isArray(raw)
        ? raw
        : Array.isArray(envelope.accounts)
          ? envelope.accounts
          : Array.isArray(envelope.items)
            ? envelope.items
            : []
      const belongs = list.some(entry => {
        const record = entry as Record<string, unknown>
        return toPositiveInt(record.accountId ?? record.AccountId ?? record.id ?? null)
          === requestedCauseAccountId
      })

      if (!belongs) {
        return NextResponse.json(
          { error: 'That cause does not belong to this user.' },
          { status: 403 },
        )
      }
      causeAccountId = requestedCauseAccountId
    }

    const response = NextResponse.json({
      ok: true,
      viewingAs: { ...payload, businessAccountId, causeAccountId },
    })
    response.cookies.set({
      name: COOKIE_NAME,
      value: await signViewAsPayload({
        ...payload,
        causeAccountId: causeAccountId ?? undefined,
      }),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    if (portalCookie) {
      response.cookies.set({ name: portalCookie.name, value: portalCookie.value, ...portalBusinessCookieOptions() })
    } else {
      response.cookies.set({ name: PORTAL_BUSINESS_COOKIE, value: '', path: '/', maxAge: 0 })
    }
    return response
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to start View As.' }, { status: 500 })
  }
}

export async function DELETE() {
  const jar = cookies()
  jar.delete(COOKIE_NAME)
  jar.delete(PORTAL_BUSINESS_COOKIE)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const jar = cookies()
  const cookie = jar.get(COOKIE_NAME)?.value
  if (!cookie) return NextResponse.json({ viewingAs: null })
  const payload = await readSignedViewAsPayload(cookie)
  return NextResponse.json({ viewingAs: payload })
}
