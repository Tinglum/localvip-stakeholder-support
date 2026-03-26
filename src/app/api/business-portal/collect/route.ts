import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  ensureBusinessJoinResource,
  getProfileForUser,
  userCanManageBusinessJoin,
} from '@/lib/server/business-capture'

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required.' }, { status: 400 })
  }

  const authSupabase = createServerSupabaseClient()
  const { data: authData } = await authSupabase.auth.getUser()

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
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
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  if (!userCanManageBusinessJoin(profile, business)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resource = await ensureBusinessJoinResource(supabase, business, authData.user.id)
  return NextResponse.json(resource)
}
