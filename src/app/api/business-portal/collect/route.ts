import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  ensureBusinessJoinResource,
  getProfileForUser,
  updateBusinessJoinQrAppearance,
  userCanManageBusinessJoin,
} from '@/lib/server/business-capture'

export async function GET(request: NextRequest) {
  const access = await loadBusinessAccess(request)
  if (access.error) return access.error

  const resource = await ensureBusinessJoinResource(access.supabase, access.business, access.actorId)
  return NextResponse.json(resource)
}

export async function PATCH(request: NextRequest) {
  const access = await loadBusinessAccess(request)
  if (access.error) return access.error

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'A QR appearance payload is required.' }, { status: 400 })
  }

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

  const authSupabase = createServerSupabaseClient()
  const { data: authData } = await authSupabase.auth.getUser()

  if (!authData.user) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const [profile, businessResult] = await Promise.all([
    getProfileForUser(supabase, authData.user.id),
    supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single(),
  ])

  const business = businessResult.data || null

  if (!business) {
    return { error: NextResponse.json({ error: 'Business not found.' }, { status: 404 }) }
  }

  if (!userCanManageBusinessJoin(profile, business)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return {
    error: null,
    actorId: authData.user.id,
    supabase,
    business,
  }
}
