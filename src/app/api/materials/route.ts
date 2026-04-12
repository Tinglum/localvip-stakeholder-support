import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import type { Material } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { profile } = session
  const shell = getStakeholderShell(profile)

  if (!['admin', 'field', 'launch_partner'].includes(shell)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  let body: Partial<Material>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.title || !body.type || !body.brand) {
    return NextResponse.json({ error: 'Title, type, and brand are required.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Ensure created_by is the real local profile ID
  const record = { ...body }
  if (session.localProfileId) {
    record.created_by = session.localProfileId
  }
  delete (record as Record<string, unknown>).id
  delete (record as Record<string, unknown>).created_at
  delete (record as Record<string, unknown>).updated_at

  const { data, error } = await (supabase.from('materials') as any)
    .insert(record)
    .select()
    .single()

  if (error) {
    console.error('[materials-api] insert failed', error)
    return NextResponse.json(
      { error: error.message || 'Material could not be created.', code: error.code, details: error.details },
      { status: 500 },
    )
  }

  return NextResponse.json(data as Material)
}
