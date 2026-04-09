import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { generateMaterialsForStakeholder } from '@/lib/server/material-engine'
import type { GeneratedMaterial, Stakeholder } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { profile } = session
  const supabase = createServiceClient()

  const body = await request.json()
  const { generatedMaterialId } = body as { generatedMaterialId: string }

  if (!generatedMaterialId) {
    return NextResponse.json({ error: 'generatedMaterialId is required.' }, { status: 400 })
  }

  // Fetch the generated material
  const { data: generated } = await supabase
    .from('generated_materials')
    .select('*')
    .eq('id', generatedMaterialId)
    .single() as { data: GeneratedMaterial | null }

  if (!generated) {
    return NextResponse.json({ error: 'Generated material not found.' }, { status: 404 })
  }

  // Verify the user owns the stakeholder
  const { data: stakeholder } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('id', generated.stakeholder_id)
    .single<Stakeholder>()

  if (!stakeholder) {
    return NextResponse.json({ error: 'Stakeholder not found.' }, { status: 404 })
  }

  const isOwner =
    stakeholder.owner_user_id === profile.id ||
    stakeholder.profile_id === profile.id

  if (!isOwner) {
    return NextResponse.json({ error: 'You do not have access to this material.' }, { status: 403 })
  }

  try {
    const result = await generateMaterialsForStakeholder(supabase, stakeholder.id, profile.id, {
      templateId: generated.template_id,
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update material.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
