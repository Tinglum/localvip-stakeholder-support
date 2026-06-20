import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { ensureQaBusinessStakeholderContext } from '@/lib/server/qa-business-stakeholders'

export const dynamic = 'force-dynamic'

// QA-ONLY auto-provision of a business's material library. No Supabase, no
// client-supplied id: resolves the business from the session (the impersonated
// target's QA user id, or the signed-in QA subject), ensures its QA stakeholder
// context, then generates any not-yet-generated default materials via QA.
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

    const templatesRes = await fetchQaApi('/api/dashboard/v1/MaterialTemplate')
    const templates = (await parseQaResponse<Array<Record<string, unknown>>>(templatesRes, 'Could not load templates.')) || []

    const existingRes = await fetchQaApi(`/api/dashboard/v1/GeneratedMaterial?stakeholderId=${encodeURIComponent(stakeholderId)}`)
    const existing = (await parseQaResponse<Array<Record<string, unknown>>>(existingRes, 'Could not load materials.')) || []
    const idOf = (row: Record<string, unknown>, ...keys: string[]) => {
      for (const k of keys) { const v = row[k]; if (v != null) return String(v) }
      return ''
    }
    const existingTemplateIds = new Set(existing.map((g) => idOf(g, 'templateId', 'TemplateId', 'template_id')))

    let generated = 0
    for (const tpl of templates) {
      const templateId = idOf(tpl, 'id', 'Id')
      if (!templateId || existingTemplateIds.has(templateId)) continue
      // Carry the template's folder/tags so the generated rows group correctly in
      // the My Materials view (the backend stores these verbatim, defaulting to
      // null otherwise).
      const libraryFolder = idOf(tpl, 'libraryFolder', 'LibraryFolder', 'library_folder') || undefined
      const tags = idOf(tpl, 'audienceTags', 'AudienceTags', 'audience_tags', 'tags', 'Tags') || undefined
      try {
        await fetchQaApi('/api/dashboard/v1/GeneratedMaterial', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stakeholderId, templateId, libraryFolder, tags }),
        })
        generated += 1
      } catch {
        // Skip a single template failure; provision the rest.
      }
    }

    return NextResponse.json({ success: true, businessId, stakeholderId, generated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare your materials.' },
      { status: 400 },
    )
  }
}
