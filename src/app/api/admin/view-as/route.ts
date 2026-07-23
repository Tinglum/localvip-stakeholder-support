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
import { requireQaRouteAccess } from '@/lib/server/qa-route'
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

  let body: { userId?: number | string } = {}
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
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
      role,
      accountType: user.accountType,
      consumerType: user.consumerType,
      since: new Date().toISOString(),
    }

    const jar = cookies()
    jar.set({
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
    return NextResponse.json({ error: 'Failed to start View As.' }, { status: 500 })
  }
}

export async function DELETE() {
  const jar = cookies()
  jar.delete(COOKIE_NAME)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const jar = cookies()
  const cookie = jar.get(COOKIE_NAME)?.value
  if (!cookie) return NextResponse.json({ viewingAs: null })
  const payload = await readSignedViewAsPayload(cookie)
  return NextResponse.json({ viewingAs: payload })
}
