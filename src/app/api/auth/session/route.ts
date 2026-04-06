import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { Database, Profile } from '@/lib/types/database'
import { buildFallbackQaProfile, getQaSessionFromCookieStore, resolveProfileForQaSession } from '@/lib/auth/qa-auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

async function loadProfileByEmail(email: string): Promise<Profile | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  const service = createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  return (data || null) as Profile | null
}

export async function GET() {
  const qaSession = getQaSessionFromCookieStore(cookies())

  if (qaSession) {
    const profile = await resolveProfileForQaSession(qaSession.claims, loadProfileByEmail)
    return NextResponse.json({
      authenticated: true,
      source: 'qa',
      profile,
      claims: qaSession.claims,
      expiresAt: qaSession.expiresAt,
    })
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      const profile = (profileData || {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Demo User',
        avatar_url: null,
        role: user.user_metadata?.role || 'field',
        role_subtype: user.user_metadata?.role_subtype || null,
        brand_context: 'localvip',
        organization_id: null,
        city_id: null,
        business_id: user.user_metadata?.business_id || null,
        phone: null,
        referral_code: null,
        status: 'active',
        metadata: { auth_source: 'demo_supabase' },
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Profile

      return NextResponse.json({
        authenticated: true,
        source: 'demo',
        profile,
      })
    }
  }

  return NextResponse.json({
    authenticated: false,
    source: null,
    profile: null,
  })
}
