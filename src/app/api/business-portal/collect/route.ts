import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import type { ResolvedAuthSession } from '@/lib/server/auth-session'
import {
  ensureBusinessJoinResource,
  updateBusinessJoinQrAppearance,
  userCanManageBusinessJoin,
} from '@/lib/server/business-capture'
import type { BusinessJoinQrAppearance } from '@/lib/business-join'
import {
  buildQaBusinessJoinResource,
  updateQaBusinessStakeholderAppearance,
} from '@/lib/server/qa-business-stakeholders'
import { canAccessQaBusinessRecord } from '@/lib/server/qa-business-access'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import { fetchQaBusinessDetail } from '@/lib/server/qa-dashboard-businesses'

async function buildQaResource(session: ResolvedAuthSession, businessId: string) {
  const business = await fetchQaBusinessDetail(Number(businessId))
  const shell = getStakeholderShell(session.profile)
  if (!canAccessQaBusinessRecord(shell, session.profile, business)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resource = await buildQaBusinessJoinResource(businessId)
  return { resource }
}

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required.' }, { status: 400 })
  }
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  if (session.source === 'qa') {
    const result = await buildQaResource(session, businessId)
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
    const result = await buildQaResource(session, businessId)
    if (result instanceof NextResponse) return result
    const resource = await updateQaBusinessStakeholderAppearance(businessId, {
      foregroundColor: typeof payload.foregroundColor === 'string' ? payload.foregroundColor : undefined,
      backgroundColor: typeof payload.backgroundColor === 'string' ? payload.backgroundColor : undefined,
      frameText: typeof payload.frameText === 'string' ? payload.frameText : undefined,
      useBusinessLogo: typeof payload.useBusinessLogo === 'boolean' ? payload.useBusinessLogo : undefined,
      dotStyle: payload.dotStyle as BusinessJoinQrAppearance['dotStyle'] | undefined,
      cornerStyle: payload.cornerStyle as BusinessJoinQrAppearance['cornerStyle'] | undefined,
      gradientType: payload.gradientType as BusinessJoinQrAppearance['gradientType'] | undefined,
      gradientColors: Array.isArray(payload.gradientColors) ? payload.gradientColors as [string, string] : undefined,
    })
    return NextResponse.json(resource)
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
