import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { generateMaterialsForStakeholder } from '@/lib/server/material-engine'
import type { Stakeholder } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { profile } = session
  const supabase = createServiceClient()

  const body = await request.json()
  let { stakeholderId, templateId, businessId } = body as { stakeholderId?: string; templateId?: string; businessId?: string }

  if (!templateId || (!stakeholderId && !businessId)) {
    return NextResponse.json({ error: 'templateId and either stakeholderId or businessId are required.' }, { status: 400 })
  }

  if (session.source === 'qa') {
    // Stakeholders were removed from the backend — generate one template directly
    // against the business (or cause) account. The GeneratedMaterial endpoint
    // embeds the business QR and renders the file.
    const causeId = (body as { causeId?: string }).causeId
    if (!businessId && !causeId) {
      return NextResponse.json({ error: 'businessId (or causeId) is required.' }, { status: 400 })
    }
    try {
      const payload: Record<string, unknown> = { templateId: Number(templateId) }
      if (businessId) payload.businessAccountId = Number(businessId)
      if (causeId) payload.causeAccountId = Number(causeId)
      const res = await fetchQaApi('/api/dashboard/v1/GeneratedMaterial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await parseQaResponse<unknown>(res, 'Could not generate material.')
      return NextResponse.json({ success: true, result })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not generate material.' },
        { status: 400 },
      )
    }
  }

  if (!stakeholderId && businessId) {
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
    }

    const ensuredStakeholder = await import('@/lib/server/stakeholder-lifecycle')
      .then((module) => module.ensureBusinessStakeholderSetup(supabase, business as any, profile.id))
      .catch(() => null)

    stakeholderId = ensuredStakeholder?.id || undefined
  }

  if (!stakeholderId) {
    return NextResponse.json({ error: 'A stakeholder could not be prepared for this business.' }, { status: 400 })
  }

  // Verify the user owns this stakeholder
  const { data: stakeholder } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('id', stakeholderId)
    .single<Stakeholder>()

  if (!stakeholder) {
    return NextResponse.json({ error: 'Stakeholder not found.' }, { status: 404 })
  }

  const isOwner =
    stakeholder.owner_user_id === profile.id ||
    stakeholder.profile_id === profile.id

  if (!isOwner) {
    return NextResponse.json({ error: 'You do not have access to this stakeholder.' }, { status: 403 })
  }

  // Verify the template is a selfserve template
  const { data: template } = await (supabase.from('material_templates') as any)
    .select('tiers, is_active')
    .eq('id', templateId)
    .single() as { data: { tiers: string[]; is_active: boolean } | null }

  if (!template || !template.is_active || !template.tiers.includes('selfserve')) {
    return NextResponse.json({ error: 'Template not available for self-serve.' }, { status: 400 })
  }

  try {
    const result = await generateMaterialsForStakeholder(supabase, stakeholderId, profile.id, {
      templateId,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not generate material.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
