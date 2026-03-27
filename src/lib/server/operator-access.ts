import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
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
  const authSupabase = createServerSupabaseClient()
  const { data: authData } = await authSupabase.auth.getUser()

  if (!authData.user) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single<Profile>()

  if (!profile) {
    return { error: NextResponse.json({ error: 'Profile not found.' }, { status: 404 }) }
  }

  const shell = getStakeholderShell(profile)
  if (!allowedShells.includes(shell)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return { supabase, profile, shell }
}
