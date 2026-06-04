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
import type { UserRole } from '@/lib/types/database'

interface QaUserLookup {
  id: number
  email: string
  firstName?: string
  lastName?: string
  accountType?: string | number
  consumerType?: string
}

const COOKIE_NAME = 'lvip_view_as'
const COOKIE_MAX_AGE = 60 * 60 * 4 // 4 hours

/**
 * Map the backend AccountType enum to the frontend Profile.role string.
 * Backend enum values (from Data/Enums.cs AccountType):
 *   0 = SysAdmin, 1 = Stripe, 2 = Business, 3 = NonProfit, 4 = Consumer, 5 = Field
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
    case 0: return 'super_admin'
    case 2: return 'business'
    case 3: return 'cause_leader'
    case 4: return 'community'
    case 5: return 'field'
    default: return 'community'
  }
}

async function fetchUserById(userId: number): Promise<QaUserLookup | null> {
  // Try Consumer first (most common view-as target — gives consumerType)
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Consumer/${userId}`)
    if (res.ok) {
      const json = await res.json()
      return { ...json, accountType: 4 }
    }
  } catch {}

  // Fall back: pull from the admin user list (we know this endpoint works
  // and returns accountType + consumerType for every user).
  try {
    const res = await fetchQaApi('/api/dashboard/v1/User/list?pageSize=500')
    if (res.ok) {
      const json = await res.json()
      const items = Array.isArray(json) ? json : (json?.items ?? [])
      const match = items.find((u: { id?: number }) => u?.id === userId)
      if (match) return match as QaUserLookup
    }
  } catch {}

  // Last resort: the {id} route
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/User/${userId}`)
    if (res.ok) return await res.json()
  } catch {}

  return null
}

export async function POST(request: NextRequest) {
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

    const role = mapAccountTypeToRole(user.accountType, user.consumerType)
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
      value: JSON.stringify(payload),
      httpOnly: false,
      sameSite: 'lax',
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
  try {
    return NextResponse.json({ viewingAs: JSON.parse(cookie) })
  } catch {
    return NextResponse.json({ viewingAs: null })
  }
}
