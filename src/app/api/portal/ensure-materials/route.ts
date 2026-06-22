import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { ensureQaBusinessStakeholderContext } from '@/lib/server/qa-business-stakeholders'

export const dynamic = 'force-dynamic'

// QA-ONLY workspace preparation for a business's material library. No Supabase,
// no client-supplied id: resolves the business from the session (the
// impersonated target's QA user id, or the signed-in QA subject), then ensures
// its QA stakeholder context. It intentionally does NOT generate every template:
// businesses choose templates from /portal/templates, and only chosen/generated
// rows should appear in My Materials.
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

    const context = await ensureQaBusinessStakeholderContext(businessId)
    const stakeholderId = String(context.stakeholder.id)

    const existingRes = await fetchQaApi(`/api/dashboard/v1/GeneratedMaterial?stakeholderId=${encodeURIComponent(stakeholderId)}`)
    const existing = (await parseQaResponse<Array<Record<string, unknown>>>(existingRes, 'Could not load materials.')) || []

    return NextResponse.json({ success: true, businessId, stakeholderId, generated: existing.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare your materials.' },
      { status: 400 },
    )
  }
}
