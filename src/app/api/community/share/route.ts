import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  ensureCommunitySupportResource,
  getProfileForUser,
  userCanManageCommunitySupport,
} from '@/lib/server/community-support'

export async function GET(request: NextRequest) {
  const causeId = request.nextUrl.searchParams.get('causeId')

  if (!causeId) {
    return NextResponse.json({ error: 'causeId is required.' }, { status: 400 })
  }

  const authSupabase = createServerSupabaseClient()
  const { data: authData } = await authSupabase.auth.getUser()

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const [profile, causeResult] = await Promise.all([
    getProfileForUser(supabase, authData.user.id),
    supabase
      .from('causes')
      .select('*')
      .eq('id', causeId)
      .single(),
  ])

  const cause = causeResult.data || null

  if (!cause) {
    return NextResponse.json({ error: 'Cause not found.' }, { status: 404 })
  }

  if (!userCanManageCommunitySupport(profile, cause)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resource = await ensureCommunitySupportResource(supabase, cause, authData.user.id)
  return NextResponse.json(resource)
}
