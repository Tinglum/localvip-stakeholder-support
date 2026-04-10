import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { createServiceClient } from '@/lib/supabase/server'
import { getStakeholderShell, type StakeholderShell } from '@/lib/stakeholder-access'
import type { Profile } from '@/lib/types/database'

interface OperatorRouteContext {
  supabase: ReturnType<typeof createServiceClient>
  profile: Profile
  shell: StakeholderShell
}

export async function getOperatorRouteContext(
  allowedShells: StakeholderShell[] = ['admin', 'field', 'launch_partner'],
): Promise<OperatorRouteContext | { error: NextResponse }> {
  const supabase = createServiceClient()
  const session = await getAuthenticatedSession()
  const profile = session?.profile || null

  if (!profile) {
    return { error: NextResponse.json({ error: 'Profile not found.' }, { status: 404 }) }
  }

  const shell = getStakeholderShell(profile)
  if (!allowedShells.includes(shell)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return { supabase, profile, shell }
}
