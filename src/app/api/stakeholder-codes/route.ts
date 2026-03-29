import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeStakeholderCode, buildStakeholderJoinUrl } from '@/lib/material-engine'
import type { StakeholderType } from '@/lib/types/database'

const schema = z.object({
  email: z.string().trim().email('A valid email is required.'),
  referral_code: z.string().trim().min(2).max(64).optional(),
  connection_code: z.string().trim().min(2).max(64).optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid payload.' },
      { status: 400 },
    )
  }

  const { email, referral_code, connection_code } = parsed.data

  const supabase = createServiceClient()

  // Look up profile by email
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('id')
    .ilike('email', email)
    .maybeSingle() as { data: { id: string } | null }

  if (!profile) {
    return NextResponse.json({ error: 'No profile found for that email.' }, { status: 404 })
  }

  // Find stakeholder linked to this profile
  const { data: stakeholder } = await (supabase.from('stakeholders') as any)
    .select('id, type')
    .eq('profile_id', profile.id)
    .maybeSingle() as { data: { id: string; type: string } | null }

  if (!stakeholder) {
    return NextResponse.json({ error: 'No stakeholder found for that profile.' }, { status: 404 })
  }

  const normalizedReferral = referral_code ? normalizeStakeholderCode(referral_code) : null
  const normalizedConnection = connection_code ? normalizeStakeholderCode(connection_code) : null

  // Check for conflicts
  if (normalizedReferral) {
    const { data: conflict } = await (supabase.from('stakeholder_codes') as any)
      .select('stakeholder_id')
      .ilike('referral_code', normalizedReferral)
      .maybeSingle() as { data: { stakeholder_id: string } | null }

    if (conflict && conflict.stakeholder_id !== stakeholder.id) {
      return NextResponse.json(
        { error: `Referral code "${normalizedReferral}" is already in use.` },
        { status: 409 },
      )
    }
  }

  if (normalizedConnection) {
    const { data: conflict } = await (supabase.from('stakeholder_codes') as any)
      .select('stakeholder_id')
      .ilike('connection_code', normalizedConnection)
      .maybeSingle() as { data: { stakeholder_id: string } | null }

    if (conflict && conflict.stakeholder_id !== stakeholder.id) {
      return NextResponse.json(
        { error: `Connection code "${normalizedConnection}" is already in use.` },
        { status: 409 },
      )
    }
  }

  // Build update payload only for provided codes
  const updateFields: Record<string, string> = {}
  if (normalizedReferral) updateFields.referral_code = normalizedReferral
  if (normalizedConnection) {
    updateFields.connection_code = normalizedConnection
    updateFields.join_url = buildStakeholderJoinUrl(stakeholder.type as StakeholderType, normalizedConnection)
  }

  if (Object.keys(updateFields).length > 0) {
    // Check if a row already exists
    const { data: existing } = await (supabase.from('stakeholder_codes') as any)
      .select('id')
      .eq('stakeholder_id', stakeholder.id)
      .maybeSingle() as { data: { id: string } | null }

    if (existing) {
      const { error } = await (supabase.from('stakeholder_codes') as any)
        .update(updateFields)
        .eq('id', existing.id)

      if (error) {
        return NextResponse.json({ error: 'Failed to update codes.' }, { status: 500 })
      }
    } else {
      const { error } = await (supabase.from('stakeholder_codes') as any)
        .insert({
          stakeholder_id: stakeholder.id,
          ...updateFields,
        })

      if (error) {
        return NextResponse.json({ error: 'Failed to insert codes.' }, { status: 500 })
      }
    }
  }

  // Reload final state
  const { data: codes } = await (supabase.from('stakeholder_codes') as any)
    .select('referral_code, connection_code')
    .eq('stakeholder_id', stakeholder.id)
    .maybeSingle() as { data: { referral_code: string | null; connection_code: string | null } | null }

  return NextResponse.json({
    success: true,
    stakeholder_id: stakeholder.id,
    referral_code: codes?.referral_code ?? null,
    connection_code: codes?.connection_code ?? null,
  })
}
