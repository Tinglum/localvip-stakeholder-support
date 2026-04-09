import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getQaSessionFromCookieStore, resolveProfileForQaSession } from '@/lib/auth/qa-auth'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { getStakeholderShell, type StakeholderShell } from '@/lib/stakeholder-access'
import type { Profile } from '@/lib/types/database'

interface OperatorRouteContext {
  supabase: ReturnType<typeof createServiceClient>
  profile: Profile
  shell: StakeholderShell
}

async function loadProfileByEmail(
  supabase: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  return (data || null) as Profile | null
}

export async function getOperatorRouteContext(
  allowedShells: StakeholderShell[] = ['admin', 'field', 'launch_partner'],
): Promise<OperatorRouteContext | { error: NextResponse }> {
  const supabase = createServiceClient()
  const qaSession = getQaSessionFromCookieStore(cookies())

  let profile: Profile | null = null

  if (qaSession) {
    profile = await resolveProfileForQaSession(
      qaSession.claims,
      (email) => loadProfileByEmail(supabase, email),
    )
  } else {
    const authSupabase = createServerSupabaseClient()
    const { data: authData } = await authSupabase.auth.getUser()

    if (!authData.user) {
      return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single<Profile>()

    profile = (data || null) as Profile | null
  }

  if (!profile) {
    return { error: NextResponse.json({ error: 'Profile not found.' }, { status: 404 }) }
  }

  const shell = getStakeholderShell(profile)
  if (!allowedShells.includes(shell)) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return { supabase, profile, shell }
}
