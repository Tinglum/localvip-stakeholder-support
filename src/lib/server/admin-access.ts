import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { createServiceClient } from '@/lib/supabase/server'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import type { Profile } from '@/lib/types/database'

export async function getAdminRouteContext() {
  const supabase = createServiceClient()
  const session = await getAuthenticatedSession()
  const profile = session?.profile || null
  const localProfileId = session?.localProfileId || null

  if (!profile || getStakeholderShell(profile) !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return {
    supabase,
    profile,
    localProfileId,
  }
}
