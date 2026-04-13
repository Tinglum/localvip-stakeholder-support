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

    let userId: string | null = authResult?.user?.id || null

    if (authError || !userId) {
      // If user already exists, look them up instead of failing
      const alreadyRegistered = authError?.message?.toLowerCase().includes('already') ||
        authError?.message?.toLowerCase().includes('registered') ||
        authError?.message?.toLowerCase().includes('exists')

      if (alreadyRegistered) {
        const { data: listResult } = await service.auth.admin.listUsers({ perPage: 1, page: 1 })
        // listUsers doesn't filter by email, so use getUserByEmail if available
        // Fall back to listing and scanning
        const { data: existingUser } = await (service.auth.admin as any).getUserByEmail?.(email)
          .catch(() => ({ data: null })) ?? { data: null }
        if (existingUser?.user?.id) {
          userId = existingUser.user.id
          console.log('[auth-session] Found existing auth user for QA user', email, userId)
        } else {
          // Try to find via listing users
          const allUsers = listResult?.users || []
          const match = allUsers.find((u: any) => u.email?.toLowerCase() === email)
          if (match) {
            userId = match.id
            console.log('[auth-session] Found existing auth user via list for QA user', email, userId)
          }
        }
      }

      if (!userId) {
        console.warn('[auth-session] Could not provision auth user for QA user', email, authError?.message || 'no user returned')
        return null
      }
    }

    // 2. Check if a profiles row already exists for this auth user
    const existingProfile = await loadProfileById(service, userId)
    if (existingProfile) {
      console.log('[auth-session] Profile already exists for auth user', email, userId)
      return existingProfile
    }

    // 3. Insert the profiles row with that real UUID
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

  // 1. Try Supabase session FIRST — fastest path (just getUser + profile lookup).
  //    QA users with a bridged session will hit this path and skip the slow QA provisioning.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (user) {
      const qaSession = getQaSessionFromCookieStore(cookieStore)
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
        source: qaSession ? 'qa' : 'supabase',
        qaClaims: qaSession?.claims,
        qaSession: qaSession || undefined,
      }
    }
  }

  // 2. No Supabase session — try QA session (slower: email lookup + provisioning)
  const qaSession = getQaSessionFromCookieStore(cookieStore)
  if (qaSession) {
    const email = qaSession.claims.email?.toLowerCase() || null
    let profile: Profile | null = null
    let profileIsReal = false

    // a. Try to find an existing profile by email
    if (email) {
      profile = await loadProfileByEmail(service, email)
      if (profile) profileIsReal = true
    }

    // b. No match → provision a real auth user + profile row in the DB
    if (!profile) {
      profile = await provisionQaProfileRow(service, qaSession.claims)
      if (profile) profileIsReal = true
    }

    // c. Last resort → synthetic fallback (read-only safe, FK writes will fail)
    if (!profile) {
      console.warn('[auth-session] Using synthetic fallback for QA user — FK writes will fail', email)
      profile = buildFallbackQaProfile(qaSession.claims)
    }

    return {
      profile,
      userId: profile.id,
      localProfileId: profileIsReal ? asUuid(profile.id) : null,
      source: 'qa',
      qaClaims: qaSession.claims,
      qaSession,
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

/**
 * Ensure a real Supabase auth user + profile exist for a QA OAuth user
 * and generate a magic link OTP hash. The caller (QA callback) should
 * verify the OTP using the SSR client (anon key) so that proper session
 * cookies are written to the browser.
 *
 * Returns the hashed_token for verifyOtp, or null if provisioning failed.
 */
export async function prepareSupabaseSessionForQaUser(
  claims: QaAuthClaims,
): Promise<{ hashedToken: string } | null> {
  const service = createServiceClient()
  const email = claims.email?.toLowerCase()
  if (!email) return null

  try {
    // 1. Try generating a magic link directly — works if auth user already exists
    let linkData: any = null
    let linkError: any = null

    const firstTry = await service.auth.admin.generateLink({ type: 'magiclink', email })
    linkData = firstTry.data
    linkError = firstTry.error

    // 2. If user doesn't exist yet, provision them first then retry
    if (linkError) {
      console.log('[auth-session] Magic link failed, provisioning auth user first', email, linkError.message)
      const profile = await provisionQaProfileRow(service, claims)
      if (!profile) {
        console.warn('[auth-session] Cannot create Supabase session — provisioning failed', email)
        return null
      }
      const retry = await service.auth.admin.generateLink({ type: 'magiclink', email })
      linkData = retry.data
      linkError = retry.error
    }

    if (linkError || !linkData?.properties?.hashed_token) {
      console.warn('[auth-session] Failed to generate magic link for QA user', email, linkError?.message)
      return null
    }

    // 3. Ensure profile row exists for this auth user
    const existingProfile = await loadProfileByEmail(service, email)
    if (!existingProfile) {
      await provisionQaProfileRow(service, claims)
    }

    console.log('[auth-session] Prepared Supabase magic link for QA user', email)
    return { hashedToken: linkData.properties.hashed_token }
  } catch (err) {
    console.error('[auth-session] Unhandled error preparing Supabase session for QA user', err)
    return null
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
