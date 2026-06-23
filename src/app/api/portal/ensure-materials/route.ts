import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

// QA-ONLY workspace preparation for a business's material library. No Supabase,
// no client-supplied id: resolves the business account from the session (the
// impersonated target's QA user id, or the signed-in QA subject). Stakeholders
// were removed from the backend, so materials are keyed directly by the business
// account. It does NOT generate every template — businesses choose templates from
// /portal/templates and only chosen/generated rows appear in My Materials.
export async function POST() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const candidate = session.viewingAs?.targetUserId
    ?? (session.qaClaims?.sub != null ? Number(session.qaClaims.sub) : null)
  const userId = candidate != null && Number.isFinite(Number(candidate)) ? Number(candidate) : null
  if (!userId) return NextResponse.json({ error: 'No business identity in session.' }, { status: 400 })

  try {
    // QA user id -> business account id.
    const byUserRes = await fetchQaApi(`/api/dashboard/v1/Business/by-user/${userId}`)
    const byUser = await parseQaResponse<{ accountId?: number }>(byUserRes, 'Could not resolve business.')
    const businessId = byUser?.accountId != null ? String(byUser.accountId) : null
    if (!businessId) return NextResponse.json({ error: 'No business account found for this user.' }, { status: 404 })

    // Count already-generated materials for this business (GET returns { items, totalCount }).
    const existingRes = await fetchQaApi(`/api/dashboard/v1/GeneratedMaterial?businessAccountId=${encodeURIComponent(businessId)}`)
    const existing = await parseQaResponse<{ items?: unknown[]; totalCount?: number } | unknown[]>(existingRes, 'Could not load materials.')
    const generated = Array.isArray(existing)
      ? existing.length
      : (existing?.totalCount ?? existing?.items?.length ?? 0)

    return NextResponse.json({ success: true, businessId, generated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare your materials.' },
      { status: 400 },
    )
  }
}
