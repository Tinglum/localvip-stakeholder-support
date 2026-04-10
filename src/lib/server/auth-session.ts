import { cookies } from 'next/headers'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildFallbackQaProfile,
  getQaSessionFromCookieStore,
  type QaAuthClaims,
  type QaSession,
} from '@/lib/auth/qa-auth'
import { asUuid } from '@/lib/uuid'
import type { Profile } from '@/lib/types/database'

export type AuthSource = 'qa' | 'supabase'

export interface ResolvedAuthSession {
  profile: Profile
  userId: string
  localProfileId: string | null
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
 * Provision a real auth.users + profiles row for a QA OAuth user so that
 * downstream FK-constrained inserts (stakeholders.owner_user_id →
 * profiles.id → auth.users.id) work correctly.
 *
 * Returns the new profile row, or null if provisioning fails (caller should
 * fall back to the synthetic profile for read-only rendering).
 */
async function provisionQaProfileRow(
  service: ServiceClient,
  claims: QaAuthClaims,
): Promise<Profile | null> {
  const email = claims.email?.toLowerCase()
  if (!email) return null

  // Build the desired profile shape from QA claims (reuse fallback builder for role mapping)
  const fallback = buildFallbackQaProfile(claims)

  try {
    // 1. Create a Supabase auth user so we get a valid UUID (profiles.id FK → auth.users.id)
    const { data: authResult, error: authError } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fallback.full_name,
        role: fallback.role,
        qa_provisioned: true,
      },
    })

    if (authError || !authResult?.user) {
      console.warn('[auth-session] Could not provision auth user for QA user', email, authError?.message || 'no user returned')
      return null
    }

    const userId = authResult.user.id

    // 2. Insert the profiles row with that real UUID
    const { data: profile, error: profileError } = await (service.from('profiles') as any)
      .insert({
        id: userId,
        email,
        full_name: fallback.full_name,
        role: fallback.role,
        role_subtype: fallback.role_subtype,
        brand_context: 'localvip',
        status: 'active',
        metadata: {
          qa_provisioned: true,
          qa_sub: claims.sub,
          qa_roles: claims.roles,
        },
      })
      .select()
      .single()

    if (profileError) {
      console.error('[auth-session] Auth user created but profile insert failed', email, profileError)
      return null
    }

    console.log('[auth-session] Provisioned DB profile for QA user', email, userId)
    return profile as Profile
  } catch (err) {
    console.error('[auth-session] Unhandled error provisioning QA profile', err)
    return null
  }
}

/**
 * Resolve the currently authenticated user from either a QA OAuth session or
 * a Supabase session. Returns null if neither is present.
 *
 * For QA users without a local profile, we first attempt to **provision** a
 * real auth.users + profiles row so that FK-constrained writes work. If that
 * fails, a synthetic fallback profile is returned (adequate for read-only
 * pages but will cause FK errors on stakeholder/code inserts).
 */
export async function getAuthenticatedSession(): Promise<ResolvedAuthSession | null> {
  const cookieStore = cookies()
  const service = createServiceClient()

  // 1. Try QA session first
  const qaSession = getQaSessionFromCookieStore(cookieStore)
  if (qaSession) {
    const email = qaSession.claims.email?.toLowerCase() || null
    let profile: Profile | null = null

    // a. Try to find an existing profile by email
    if (email) {
      profile = await loadProfileByEmail(service, email)
    }

    // b. No match → provision a real auth user + profile row in the DB
    if (!profile) {
      profile = await provisionQaProfileRow(service, qaSession.claims)
    }

    // c. Last resort → synthetic fallback (read-only safe, FK writes will fail)
    if (!profile) {
      console.warn('[auth-session] Using synthetic fallback for QA user — FK writes will fail', email)
      profile = buildFallbackQaProfile(qaSession.claims)
    }

    return {
      profile,
      userId: profile.id,
      localProfileId: asUuid(profile.id),
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
        localProfileId: asUuid(user.id),
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
