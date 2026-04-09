import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import {
  ensureCommunitySupportResource,
  userCanManageCommunitySupport,
} from '@/lib/server/community-support'

export async function GET(request: NextRequest) {
  const causeId = request.nextUrl.searchParams.get('causeId')

  if (!causeId) {
    return NextResponse.json({ error: 'causeId is required.' }, { status: 400 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { profile } = session
  const supabase = createServiceClient()

  const { data: cause } = await supabase
    .from('causes')
    .select('*')
    .eq('id', causeId)
    .single()

  if (!cause) {
    return NextResponse.json({ error: 'Cause not found.' }, { status: 404 })
  }

  if (!userCanManageCommunitySupport(profile, cause)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resource = await ensureCommunitySupportResource(supabase, cause, profile.id)
  return NextResponse.json(resource)
}
