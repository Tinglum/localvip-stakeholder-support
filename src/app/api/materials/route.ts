import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import { toBackendShape, toFrontendShape } from '@/lib/qa/dashboard-entity-map'
import type { Material } from '@/lib/types/database'

function resolveQaActorUserId(session: Awaited<ReturnType<typeof getAuthenticatedSession>>) {
  const candidate = session?.viewingAs?.targetUserId
    ?? (session?.qaClaims?.sub != null ? Number(session.qaClaims.sub) : null)
  return candidate != null && Number.isFinite(Number(candidate)) ? Number(candidate) : null
}

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { profile } = session
  const shell = getStakeholderShell(profile)

  if (!['admin', 'field', 'launch_partner'].includes(shell)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  if (session.source === 'qa') {
    try {
      const res = await fetchQaApi('/api/dashboard/v1/Material')
      const json = await parseQaResponse<unknown>(res, 'Failed to load materials.')
      const items = Array.isArray(json) ? json
        : (json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).items))
          ? (json as Record<string, unknown>).items as unknown[]
          : []
      return NextResponse.json(items as Material[])
    } catch {
      return NextResponse.json([] as Material[])
    }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[materials-api] list failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as Material[])
}

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

  if (session.source === 'qa') {
    try {
      const createdByUserId = resolveQaActorUserId(session)
      // Convert the snake_case body to the backend's PascalCase shape. Sending
      // raw snake_case (is_template, file_url, ...) does NOT bind on the .NET
      // side — System.Text.Json matches case-insensitively but not across
      // underscores — so IsTemplate/FileUrl/etc. would silently stay default.
      const backendPayload = toBackendShape('materials', body as Record<string, unknown>)
      if (createdByUserId != null) backendPayload.CreatedByUserId = createdByUserId
      const res = await fetchQaApi('/api/dashboard/v1/Material', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(backendPayload),
      })
      const json = await parseQaResponse<unknown>(res, 'Failed to create material.')
      return NextResponse.json(toFrontendShape('materials', json) as Material)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to create material.' },
        { status: 500 },
      )
    }
  }

  const supabase = createServiceClient()

  // Ensure created_by is a real local profile ID (or null to avoid FK violation)
  const record: Record<string, unknown> = { ...body }
  record.created_by = session.localProfileId || null
  delete record.id
  delete record.created_at
  delete record.updated_at

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
