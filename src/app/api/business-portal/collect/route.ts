import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import {
  ensureBusinessJoinResource,
  updateBusinessJoinQrAppearance,
  userCanManageBusinessJoin,
} from '@/lib/server/business-capture'

interface QrAppearance {
  foregroundColor?: string
  backgroundColor?: string
  frameText?: string
  useBusinessLogo?: boolean
  dotStyle?: string
  cornerStyle?: string
  gradientType?: string
  gradientColors?: string[]
}

const DEFAULT_APPEARANCE: QrAppearance = {
  foregroundColor: '#000000',
  backgroundColor: '#FFFFFF',
  frameText: 'Join now',
  useBusinessLogo: true,
  dotStyle: 'square',
  cornerStyle: 'square',
  gradientType: 'none',
  gradientColors: [],
}

/** Build a Business Join Resource from QA stakeholder + codes. */
async function buildQaResource(businessId: string): Promise<NextResponse | { resource: Record<string, unknown> }> {
  // 1. Find the stakeholder linked to this QA business
  const stakeholderRes = await fetchQaApi(`/api/dashboard/v1/Stakeholder?businessAccountId=${encodeURIComponent(businessId)}`)
  const stakeholderJson = await parseQaResponse<unknown>(stakeholderRes, 'Failed to load stakeholder.').catch(() => null)
  const items = Array.isArray(stakeholderJson) ? stakeholderJson
    : (stakeholderJson && typeof stakeholderJson === 'object' && Array.isArray((stakeholderJson as Record<string, unknown>).items))
      ? (stakeholderJson as Record<string, unknown>).items as Array<Record<string, unknown>>
      : []
  const stakeholder = items[0]
  if (!stakeholder?.id) {
    return NextResponse.json({ error: 'No stakeholder linked to this business.' }, { status: 404 })
  }

  // 2. Pull the stakeholder's metadata to extract qr_appearance
  let metadata: Record<string, unknown> = {}
  if (typeof stakeholder.metadata === 'string') {
    try { metadata = JSON.parse(stakeholder.metadata) } catch { metadata = {} }
  } else if (stakeholder.metadata && typeof stakeholder.metadata === 'object') {
    metadata = stakeholder.metadata as Record<string, unknown>
  }
  const appearance: QrAppearance = {
    ...DEFAULT_APPEARANCE,
    ...((metadata.qr_appearance as QrAppearance) || {}),
  }

  // 3. Pull codes to derive joinUrl
  const codeRes = await fetchQaApi(`/api/dashboard/v1/StakeholderCode/${encodeURIComponent(String(stakeholder.id))}`)
  const codeJson = await parseQaResponse<unknown>(codeRes, '').catch(() => null)
  const codes = Array.isArray(codeJson) ? codeJson
    : (codeJson && typeof codeJson === 'object' && Array.isArray((codeJson as Record<string, unknown>).items))
      ? (codeJson as Record<string, unknown>).items as Array<Record<string, unknown>>
      : []
  const codeRow = codes[0] || {}

  return {
    resource: {
      stakeholderId: stakeholder.id,
      joinUrl: codeRow.joinUrl || codeRow.JoinUrl || null,
      referralCode: codeRow.referralCode || codeRow.ReferralCode || null,
      connectionCode: codeRow.connectionCode || codeRow.ConnectionCode || null,
      appearance,
      offerTitle: stakeholder.name || null,
    },
  }
}

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required.' }, { status: 400 })
  }
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (session.source === 'qa') {
    const result = await buildQaResource(businessId)
    if (result instanceof NextResponse) return result
    return NextResponse.json(result.resource)
  }

  // Demo / Supabase path
  const access = await loadBusinessAccess(request)
  if (access.error) return access.error
  const resource = await ensureBusinessJoinResource(access.supabase, access.business, access.actorId)
  return NextResponse.json(resource)
}

export async function PATCH(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId is required.' }, { status: 400 })

  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'A QR appearance payload is required.' }, { status: 400 })
  }

  if (session.source === 'qa') {
    // Look up stakeholder
    const result = await buildQaResource(businessId)
    if (result instanceof NextResponse) return result
    const current = result.resource
    const stakeholderId = current.stakeholderId as string | number
    const currentAppearance = current.appearance as QrAppearance
    const nextAppearance: QrAppearance = {
      ...currentAppearance,
      ...(payload as QrAppearance),
    }

    // Pull stakeholder to merge metadata
    const sRes = await fetchQaApi(`/api/dashboard/v1/Stakeholder/${encodeURIComponent(String(stakeholderId))}`)
    const sJson = (await parseQaResponse<Record<string, unknown>>(sRes, 'Failed to load stakeholder.').catch(() => null)) || {}
    const sMeta = (sJson as Record<string, unknown>).metadata
    let meta: Record<string, unknown> = {}
    if (typeof sMeta === 'string') {
      try { meta = JSON.parse(sMeta) } catch { meta = {} }
    } else if (sMeta && typeof sMeta === 'object') {
      meta = sMeta as Record<string, unknown>
    }
    meta.qr_appearance = nextAppearance

    const putRes = await fetchQaApi(`/api/dashboard/v1/Stakeholder/${encodeURIComponent(String(stakeholderId))}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ metadata: JSON.stringify(meta) }),
    })
    await parseQaResponse<unknown>(putRes, 'Failed to update QR appearance.')
    return NextResponse.json({ ...current, appearance: nextAppearance })
  }

  // Demo path
  const access = await loadBusinessAccess(request)
  if (access.error) return access.error

  const resource = await updateBusinessJoinQrAppearance(access.supabase, access.business, access.actorId, {
    foregroundColor: typeof payload.foregroundColor === 'string' ? payload.foregroundColor : undefined,
    backgroundColor: typeof payload.backgroundColor === 'string' ? payload.backgroundColor : undefined,
    frameText: typeof payload.frameText === 'string' ? payload.frameText : undefined,
    useBusinessLogo: typeof payload.useBusinessLogo === 'boolean' ? payload.useBusinessLogo : undefined,
    dotStyle: payload.dotStyle,
    cornerStyle: payload.cornerStyle,
    gradientType: payload.gradientType,
    gradientColors: Array.isArray(payload.gradientColors) ? payload.gradientColors : undefined,
  })

  return NextResponse.json(resource)
}

async function loadBusinessAccess(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')

  if (!businessId) {
    return { error: NextResponse.json({ error: 'businessId is required.' }, { status: 400 }) }
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const { profile } = session
  const supabase = createServiceClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (!business) {
    return { error: NextResponse.json({ error: 'Business not found.' }, { status: 404 }) }
  }

  if (!userCanManageBusinessJoin(profile, business)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return {
    error: null,
    actorId: profile.id,
    supabase,
    business,
  }
}
