import { cookies } from 'next/headers'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildFallbackQaProfile,
  getQaSessionFromCookieStore,
  type QaAuthClaims,
  type QaSession,
} from '@/lib/auth/qa-auth'
import { fetchQaUserProfile } from '@/lib/auth/qa-api'
import { asUuid } from '@/lib/uuid'
import { normalizeStakeholderCode } from '@/lib/material-engine'
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
      // If user already exists, look them up via listUsers
      const alreadyRegistered = authError?.message?.toLowerCase().includes('already') ||
        authError?.message?.toLowerCase().includes('registered') ||
        authError?.message?.toLowerCase().includes('exists')

      if (alreadyRegistered) {
        // Scan through users to find by email (listUsers doesn't support email filter)
        const { data: listResult } = await service.auth.admin.listUsers({ perPage: 1000, page: 1 })
        const allUsers = listResult?.users || []
        const match = allUsers.find((u) => u.email?.toLowerCase() === email)
        if (match) {
          userId = match.id
          console.log('[auth-session] Found existing auth user for QA user', email, userId)
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
    //    Only include columns that exist in the profiles table schema.
    const { data: profile, error: profileError } = await (service.from('profiles') as any)
      .insert({
        id: userId,
        email,
        full_name: fallback.full_name,
        role: fallback.role,
        brand_context: 'localvip',
        status: 'active',
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
 * When the user has a live QA token, fetch their referral data and store it
 * in the profile row so it's available even after the QA token expires.
 */
async function syncQaReferralToProfile(
  service: ServiceClient,
  profileId: string,
  profile: Profile,
): Promise<Profile> {
  try {
    const qaProfile = await fetchQaUserProfile()
    if (!qaProfile?.referralCode) return profile

    const referralCode = normalizeStakeholderCode(qaProfile.referralCode)
    if (!referralCode) return profile

    // Only update if the profile doesn't already have it (avoid unnecessary writes)
    const metadataAlreadySet =
      profile.referral_code === referralCode &&
      (profile.metadata as Record<string, unknown> | null)?.qa_shared_url === qaProfile.sharedURL

    if (metadataAlreadySet) return profile

    const patch = {
      referral_code: referralCode,
      metadata: {
        ...((profile.metadata as Record<string, unknown> | null) || {}),
        qa_shared_url: qaProfile.sharedURL,
        qa_referral_link: qaProfile.referralLink,
        qa_referral_synced_at: new Date().toISOString(),
      },
    }

    const { data } = await (service.from('profiles') as any)
      .update(patch)
      .eq('id', profileId)
      .select()
      .single()

    return (data as Profile | null) || { ...profile, ...patch }
  } catch {
    // non-fatal — profile will still work, codes just won't be pre-filled
    return profile
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
      let profile = (await loadProfileById(service, user.id)) || ({
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

      // While the QA token is still live, sync referral code into the profile
      // so it's available even after the token expires.
      if (qaSession) {
        profile = await syncQaReferralToProfile(service, user.id, profile)
      }

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
): Promise<{ email: string; otp: string } | null> {
  const service = createServiceClient()
  const email = claims.email?.toLowerCase()
  if (!email) return null

  try {
    // 1. Ensure profile row exists first
    const existingProfile = await loadProfileByEmail(service, email)
    if (!existingProfile) {
      await provisionQaProfileRow(service, claims)
    }

    // 2. Generate a magic link — use the email_otp property (raw 6-digit code)
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError) {
      console.warn('[auth-session] Failed to generate magic link for QA user', email, linkError.message)
      return null
    }

    const otp = (linkData as any)?.properties?.email_otp
    if (!otp) {
      console.warn('[auth-session] No email_otp in generateLink response for', email,
        'keys:', Object.keys((linkData as any)?.properties || {}))
      return null
    }

    console.log('[auth-session] Prepared Supabase OTP for QA user', email)
    return { email, otp }
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
