import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { ensureQaBusinessStakeholderContext } from '@/lib/server/qa-business-stakeholders'

export const dynamic = 'force-dynamic'

// QA-ONLY auto-provision of a business's material library. No Supabase.
// Ensures the QA stakeholder/context exists for the business, then generates
// any not-yet-generated default materials through the QA backend. This removes
// the manual "add as a stakeholder first" step.
export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const businessId = body?.businessId != null ? String(body.businessId) : null
  if (!businessId || !/^\d+$/.test(businessId)) {
    return NextResponse.json({ error: 'A numeric businessId is required.' }, { status: 400 })
  }

  try {
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
      try {
        await fetchQaApi('/api/dashboard/v1/GeneratedMaterial', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stakeholderId, templateId }),
        })
        generated += 1
      } catch {
        // Skip a single template failure; provision the rest.
      }
    }

    return NextResponse.json({ success: true, stakeholderId, generated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare your materials.' },
      { status: 400 },
    )
  }
}
