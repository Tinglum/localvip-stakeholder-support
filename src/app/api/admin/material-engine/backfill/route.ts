import { NextResponse } from 'next/server'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import { generateMaterialsForStakeholder } from '@/lib/server/material-engine'
import type { Stakeholder, StakeholderCode, GeneratedMaterial } from '@/lib/types/database'

export async function POST() {
  const context = await getAdminRouteContext()
  if ('error' in context) return context.error

  const supabase = context.supabase

  // Fetch all active stakeholders that have codes set up
  const { data: stakeholders } = await (supabase.from('stakeholders') as any)
    .select('id, name, type, status')
    .in('status', ['active', 'pending']) as { data: Stakeholder[] | null }

  if (!stakeholders || stakeholders.length === 0) {
    return NextResponse.json({ message: 'No stakeholders to process.', processed: 0 })
  }

  // For each stakeholder, check if they have codes and if they need generation
  const results: Array<{ stakeholderId: string; name: string; status: string; error?: string }> = []

  for (const stakeholder of stakeholders) {
    // Check if stakeholder has codes
    const { data: codes } = await (supabase.from('stakeholder_codes') as any)
      .select('id, referral_code, connection_code')
      .eq('stakeholder_id', stakeholder.id)
      .maybeSingle() as { data: StakeholderCode | null }

    if (!codes || !codes.referral_code || !codes.connection_code) {
      results.push({ stakeholderId: stakeholder.id, name: stakeholder.name, status: 'skipped_no_codes' })
      continue
    }

    // Check existing generated materials
    const { data: existing } = await (supabase.from('generated_materials') as any)
      .select('id, generation_status, is_outdated')
      .eq('stakeholder_id', stakeholder.id) as { data: GeneratedMaterial[] | null }

    const hasGenerated = existing && existing.some((m) => m.generation_status === 'generated')
    const hasOutdated = existing && existing.some((m) => m.is_outdated)

    if (hasGenerated && !hasOutdated) {
      results.push({ stakeholderId: stakeholder.id, name: stakeholder.name, status: 'skipped_up_to_date' })
      continue
    }

    try {
      await generateMaterialsForStakeholder(supabase, stakeholder.id, context.profile.id)
      results.push({ stakeholderId: stakeholder.id, name: stakeholder.name, status: 'generated' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed.'
      results.push({ stakeholderId: stakeholder.id, name: stakeholder.name, status: 'failed', error: message })
    }
  }

  const generated = results.filter((r) => r.status === 'generated').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status.startsWith('skipped')).length

  return NextResponse.json({
    message: `Backfill complete. Generated: ${generated}, Failed: ${failed}, Skipped: ${skipped}`,
    processed: results.length,
    generated,
    failed,
    skipped,
    results,
  })
}
