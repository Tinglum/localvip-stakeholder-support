import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { toFrontendShape } from '@/lib/qa/dashboard-entity-map'
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
  const session = await getAuthenticatedSession()

  // QA path: delegate to backend StakeholderCode + Stakeholder endpoints.
  if (session?.source === 'qa') {
    try {
      // 1. Look up stakeholder by owner email via QA stakeholder list
      const stakeholdersRes = await fetchQaApi(`/api/dashboard/v1/Stakeholder?email=${encodeURIComponent(email)}`)
      const stakeholdersJson = await parseQaResponse<unknown>(stakeholdersRes, 'Failed to load stakeholder.')
      const items =
        Array.isArray(stakeholdersJson) ? stakeholdersJson
        : (stakeholdersJson && typeof stakeholdersJson === 'object' && Array.isArray((stakeholdersJson as Record<string, unknown>).items))
          ? (stakeholdersJson as Record<string, unknown>).items as unknown[]
          : []
      const shaped = (toFrontendShape('stakeholders', items) as Array<{ id: string; type: string; email?: string | null }>) || []
      const stakeholder = shaped.find((s) => (s.email || '').toLowerCase() === email.toLowerCase()) || shaped[0]
      if (!stakeholder) {
        return NextResponse.json({ error: 'No stakeholder found for that email.' }, { status: 404 })
      }

      const normalizedReferral = referral_code ? normalizeStakeholderCode(referral_code) : null
      const normalizedConnection = connection_code ? normalizeStakeholderCode(connection_code) : null

      const updateFields: Record<string, string> = {}
      if (normalizedReferral) updateFields.referral_code = normalizedReferral
      if (normalizedConnection) {
        updateFields.connection_code = normalizedConnection
        updateFields.join_url = buildStakeholderJoinUrl(stakeholder.type as StakeholderType, normalizedConnection)
      }

      if (Object.keys(updateFields).length > 0) {
        // Look up existing code row for this stakeholder so we can PUT instead of POST.
        const lookupRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode/${encodeURIComponent(stakeholder.id)}`)
        let existingId: string | null = null
        if (lookupRes.ok) {
          const lookupJson = await parseQaResponse<unknown>(lookupRes, '').catch(() => null)
          const arr = Array.isArray(lookupJson) ? lookupJson
            : (lookupJson && typeof lookupJson === 'object' && Array.isArray((lookupJson as Record<string, unknown>).items))
              ? (lookupJson as Record<string, unknown>).items as Array<{ id?: string | number }>
              : []
          if (arr[0]?.id != null) existingId = String(arr[0].id)
        }

        if (existingId) {
          const putRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode/${encodeURIComponent(existingId)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stakeholderId: stakeholder.id, ...updateFields }),
          })
          await parseQaResponse<unknown>(putRes, 'Failed to update stakeholder codes.')
        } else {
          const postRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ stakeholderId: stakeholder.id, ...updateFields }),
          })
          await parseQaResponse<unknown>(postRes, 'Failed to create stakeholder codes.')
        }
      }

      // Re-fetch
      const codeRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode?stakeholderId=${encodeURIComponent(stakeholder.id)}`)
      const codeJson = await parseQaResponse<unknown>(codeRes, 'Failed to reload stakeholder codes.').catch(() => null)
      const codeItems =
        Array.isArray(codeJson) ? codeJson
        : (codeJson && typeof codeJson === 'object' && Array.isArray((codeJson as Record<string, unknown>).items))
          ? (codeJson as Record<string, unknown>).items as unknown[]
          : []
      const codeShaped = (toFrontendShape('stakeholder_codes', codeItems) as Array<{ referral_code: string | null; connection_code: string | null }>) || []
      const codes = codeShaped[0] || { referral_code: null, connection_code: null }

      return NextResponse.json({
        success: true,
        stakeholder_id: stakeholder.id,
        referral_code: codes.referral_code ?? null,
        connection_code: codes.connection_code ?? null,
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to update stakeholder codes.' },
        { status: 500 },
      )
    }
  }

  // Demo / Supabase path (unchanged)
  const supabase = createServiceClient()

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('id')
    .ilike('email', email)
    .maybeSingle() as { data: { id: string } | null }

  if (!profile) {
    return NextResponse.json({ error: 'No profile found for that email.' }, { status: 404 })
  }

  const { data: stakeholder } = await (supabase.from('stakeholders') as any)
    .select('id, type')
    .eq('profile_id', profile.id)
    .maybeSingle() as { data: { id: string; type: string } | null }

  if (!stakeholder) {
    return NextResponse.json({ error: 'No stakeholder found for that profile.' }, { status: 404 })
  }

  const normalizedReferral = referral_code ? normalizeStakeholderCode(referral_code) : null
  const normalizedConnection = connection_code ? normalizeStakeholderCode(connection_code) : null

  if (normalizedReferral) {
    const { data: conflict } = await (supabase.from('stakeholder_codes') as any)
      .select('stakeholder_id')
      .ilike('referral_code', normalizedReferral)
      .maybeSingle() as { data: { stakeholder_id: string } | null }
    if (conflict && conflict.stakeholder_id !== stakeholder.id) {
      return NextResponse.json({ error: `Referral code "${normalizedReferral}" is already in use.` }, { status: 409 })
    }
  }

  if (normalizedConnection) {
    const { data: conflict } = await (supabase.from('stakeholder_codes') as any)
      .select('stakeholder_id')
      .ilike('connection_code', normalizedConnection)
      .maybeSingle() as { data: { stakeholder_id: string } | null }
    if (conflict && conflict.stakeholder_id !== stakeholder.id) {
      return NextResponse.json({ error: `Connection code "${normalizedConnection}" is already in use.` }, { status: 409 })
    }
  }

  const updateFields: Record<string, string> = {}
  if (normalizedReferral) updateFields.referral_code = normalizedReferral
  if (normalizedConnection) {
    updateFields.connection_code = normalizedConnection
    updateFields.join_url = buildStakeholderJoinUrl(stakeholder.type as StakeholderType, normalizedConnection)
  }

  if (Object.keys(updateFields).length > 0) {
    const { data: existing } = await (supabase.from('stakeholder_codes') as any)
      .select('id')
      .eq('stakeholder_id', stakeholder.id)
      .maybeSingle() as { data: { id: string } | null }

    if (existing) {
      const { error } = await (supabase.from('stakeholder_codes') as any)
        .update(updateFields)
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: 'Failed to update codes.' }, { status: 500 })
    } else {
      const { error } = await (supabase.from('stakeholder_codes') as any)
        .insert({ stakeholder_id: stakeholder.id, ...updateFields })
      if (error) return NextResponse.json({ error: 'Failed to insert codes.' }, { status: 500 })
    }
  }

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
