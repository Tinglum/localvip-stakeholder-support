import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

type GeneratedRow = { templateId?: number | string | null }
type TemplateRow = { id?: number | string | null; isActive?: boolean | null }

function toRows<T>(payload: { items?: T[] } | T[] | null | undefined): T[] {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.items)) return payload.items
  return []
}

// QA-ONLY workspace preparation for a business's material library. No Supabase,
// no client-supplied id: resolves the business account from the session (the
// impersonated target's QA user id, or the signed-in QA subject). Stakeholders
// were removed from the backend, so materials are keyed directly by the business
// account.
//
// Lazy auto-generate (on first open): every ACTIVE template should exist as a
// generated material for the business. On each open we diff the active template
// list against what's already generated and generate only the missing ones — so
// a brand-new business gets the full set on first open, and any template added
// later is filled in the next time they open their library. The backend composes
// the PDF (join URL + QR) for each, so we only send { businessAccountId, templateId }.
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

    // What's already generated for this business, and which active templates exist.
    const [existingRes, templatesRes] = await Promise.all([
      fetchQaApi(`/api/dashboard/v1/GeneratedMaterial?businessAccountId=${encodeURIComponent(businessId)}`),
      fetchQaApi('/api/dashboard/v1/MaterialTemplate?isActive=true'),
    ])
    const existing = await parseQaResponse<{ items?: GeneratedRow[] } | GeneratedRow[]>(existingRes, 'Could not load materials.')
    const templates = await parseQaResponse<{ items?: TemplateRow[] } | TemplateRow[]>(templatesRes, 'Could not load templates.')

    const existingRows = toRows<GeneratedRow>(existing)
    const haveTemplateIds = new Set(
      existingRows
        .map((row) => (row?.templateId == null ? null : String(row.templateId)))
        .filter((id): id is string => id != null),
    )

    const missing = toRows<TemplateRow>(templates)
      .filter((t) => t?.isActive !== false && t?.id != null && !haveTemplateIds.has(String(t.id)))
      .map((t) => Number(t.id))
      .filter((id) => Number.isFinite(id))

    // Generate the missing templates. allSettled so one bad template doesn't
    // block the rest; the library reflects whatever succeeded.
    let created = 0
    if (missing.length > 0) {
      const results = await Promise.allSettled(
        missing.map((templateId) =>
          fetchQaApi('/api/dashboard/v1/GeneratedMaterial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessAccountId: Number(businessId), templateId }),
          }).then((res) => parseQaResponse(res, 'Material generation failed.')),
        ),
      )
      created = results.filter((r) => r.status === 'fulfilled').length
    }

    const generated = existingRows.length + created
    return NextResponse.json({ success: true, businessId, generated, created, attempted: missing.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare your materials.' },
      { status: 400 },
    )
  }
}
