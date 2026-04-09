import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
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
  const { stakeholderId, templateId } = body as { stakeholderId: string; templateId: string }

  if (!stakeholderId || !templateId) {
    return NextResponse.json({ error: 'stakeholderId and templateId are required.' }, { status: 400 })
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
