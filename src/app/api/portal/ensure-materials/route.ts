import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { ensureQaBusinessStakeholderContext } from '@/lib/server/qa-business-stakeholders'
import { ensureBusinessStakeholderSetup } from '@/lib/server/stakeholder-lifecycle'
import { generateMaterialsForStakeholder } from '@/lib/server/material-engine'

export const dynamic = 'force-dynamic'

// Auto-provision a business's material library on demand. This removes the old
// "you must be added as a stakeholder first" step: a business viewing Materials
// gets its record + default materials generated automatically, no admin needed.
export async function POST() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { profile } = session
  const supabase = createServiceClient()

  try {
    // Resolve the business record for the signed-in profile.
    const businessQuery = supabase.from('businesses').select('*')
    const { data: business } = profile.business_id
      ? await businessQuery.eq('id', profile.business_id).maybeSingle()
      : await businessQuery.eq('owner_id', profile.id).maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'No business is linked to this account.' }, { status: 404 })
    }

    let stakeholderId: string | undefined
    const externalId = (business as { external_id?: string | null }).external_id

    if (session.source === 'qa' && externalId && /^\d+$/.test(String(externalId))) {
      const context = await ensureQaBusinessStakeholderContext(String(externalId))
      stakeholderId = String(context.stakeholder.id)
    } else {
      const ensured = await ensureBusinessStakeholderSetup(supabase, business as never, profile.id)
      stakeholderId = ensured?.id ? String(ensured.id) : undefined
    }

    if (!stakeholderId) {
      return NextResponse.json({ error: 'Could not prepare your material library.' }, { status: 400 })
    }

    // Generate the default material set (idempotent — skips already-generated).
    await generateMaterialsForStakeholder(supabase, stakeholderId, profile.id)

    return NextResponse.json({ success: true, stakeholderId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not prepare your materials.' },
      { status: 400 },
    )
  }
}
