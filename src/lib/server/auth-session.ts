import { cookies } from 'next/headers'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildFallbackQaProfile,
  getQaSessionFromCookieStore,
  type QaAuthClaims,
  type QaSession,
} from '@/lib/auth/qa-auth'
import type { Profile } from '@/lib/types/database'

export type AuthSource = 'qa' | 'supabase'

export interface ResolvedAuthSession {
  profile: Profile
  userId: string
  source: AuthSource
  qaClaims?: QaAuthClaims
  qaSession?: QaSession
}

type ServiceClient = ReturnType<typeof createServiceClient>

async function loadProfileByEmail(
  supabase: ServiceClient,
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

async function loadProfileById(
  supabase: ServiceClient,
  id: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return (data || null) as Profile | null
}

/**
 * Resolve the currently authenticated user from either a QA OAuth session or
 * a Supabase session. Returns null if neither is present. When a QA session
 * is present but no local profile matches, a synthetic fallback profile is
 * returned so the role mapping from the QA claims still drives authorization.
 */
export async function getAuthenticatedSession(): Promise<ResolvedAuthSession | null> {
  const cookieStore = cookies()
  const service = createServiceClient()

  // 1. Try QA session first
  const qaSession = getQaSessionFromCookieStore(cookieStore)
  if (qaSession) {
    const email = qaSession.claims.email?.toLowerCase() || null
    let profile: Profile | null = null
    if (email) {
      profile = await loadProfileByEmail(service, email)
    }
    if (!profile) {
      profile = buildFallbackQaProfile(qaSession.claims)
    }
    return {
      profile,
      userId: profile.id,
      source: 'qa',
      qaClaims: qaSession.claims,
      qaSession,
    }
  }

  // 2. Fall back to Supabase session
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (user) {
      const profile = (await loadProfileById(service, user.id)) || ({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        avatar_url: null,
        role: (user.user_metadata?.role as Profile['role']) || 'field',
        role_subtype: (user.user_metadata?.role_subtype as Profile['role_subtype']) || null,
        brand_context: 'localvip',
        organization_id: null,
        city_id: null,
        business_id: user.user_metadata?.business_id || null,
        phone: null,
        referral_code: null,
        status: 'active',
        metadata: { auth_source: 'supabase_fallback' },
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Profile)

      return {
        profile,
        userId: user.id,
        source: 'supabase',
      }
    }
  }

  return null
}

/**
 * Convenience: returns the authenticated profile or throws. Use in API routes
 * where an unauthenticated caller should be rejected outright.
 */
export async function requireAuthenticatedSession(): Promise<ResolvedAuthSession> {
  const session = await getAuthenticatedSession()
  if (!session) {
    throw new UnauthorizedError('Unauthorized.')
  }
  return session
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
