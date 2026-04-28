import { cookies } from 'next/headers'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildFallbackQaProfile,
  getQaSessionFromCookieStore,
  type QaAuthClaims,
  type QaSession,
} from '@/lib/auth/qa-auth'
import { fetchQaUserProfile } from '@/lib/auth/qa-api'
import { sanitizeStakeholderCodeValue, sanitizeStakeholderUrl } from '@/lib/stakeholder-codes'
import { asUuid } from '@/lib/uuid'
import type { Business, Profile } from '@/lib/types/database'

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

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}

function readQaBusinessIdCandidates(claims?: QaAuthClaims) {
  const candidates = new Set<string>()
  const raw = claims?.raw || {}

  const add = (value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number') return
    const normalized = String(value).trim()
    if (/^\d+$/.test(normalized)) {
      candidates.add(normalized)
    }
  }

  add(raw.accountId)
  add(raw.accountID)
  add(raw.account_id)
  add(raw.businessId)
  add(raw.businessID)
  add(raw.business_id)
  add(raw.qaBusinessId)
  add(raw.qa_business_id)

  return Array.from(candidates)
}

function pickMatchedBusiness(
  businesses: Business[],
  profile: Profile,
  qaBusinessIdCandidates: string[],
) {
  if (!businesses.length) return null

  if (profile.business_id) {
    const existingLink = businesses.find((business) => business.id === profile.business_id)
    if (existingLink) return existingLink
  }

  const ownedByProfile = businesses.find((business) => business.owner_user_id === profile.id)
  if (ownedByProfile) return ownedByProfile

  if (qaBusinessIdCandidates.length > 0) {
    const qaIdMatch = businesses.filter((business) => business.external_id && qaBusinessIdCandidates.includes(business.external_id))
    if (qaIdMatch.length === 1) return qaIdMatch[0]
  }

  const importedQaBusinesses = businesses.filter((business) => business.source === 'qa_server' || !!business.external_id)
  if (importedQaBusinesses.length === 1) return importedQaBusinesses[0]

  return businesses.length === 1 ? businesses[0] : null
}

async function findLocalBusinessForProfile(
  service: ServiceClient,
  profile: Profile,
  qaClaims?: QaAuthClaims,
): Promise<Business | null> {
  const email = normalizeEmail(profile.email)
  if (!email) return null

  const qaBusinessIdCandidates = readQaBusinessIdCandidates(qaClaims)

  if (qaBusinessIdCandidates.length > 0) {
    const { data } = await service
      .from('businesses')
      .select('*')
      .in('external_id', qaBusinessIdCandidates)

    const directMatches = ((data || []) as Business[]).filter((business) => {
      const businessEmail = normalizeEmail(business.email)
      return !businessEmail || businessEmail === email
    })

    const matchedFromQaId = pickMatchedBusiness(directMatches, profile, qaBusinessIdCandidates)
    if (matchedFromQaId) return matchedFromQaId
  }

  const { data } = await service
    .from('businesses')
    .select('*')
    .ilike('email', email)
    .limit(10)

  return pickMatchedBusiness((data || []) as Business[], profile, qaBusinessIdCandidates)
}

async function linkBusinessUserToLocalBusiness(
  service: ServiceClient,
  profile: Profile,
  qaClaims?: QaAuthClaims,
): Promise<Profile> {
  if (profile.role !== 'business') return profile

  const business = await findLocalBusinessForProfile(service, profile, qaClaims)
  if (!business) return profile

  const nextBusinessId = business.id
  const needsProfileLink = profile.business_id !== nextBusinessId
  const canClaimBusinessOwner = !business.owner_user_id || business.owner_user_id === profile.id
  const needsBusinessOwnerLink = canClaimBusinessOwner && business.owner_user_id !== profile.id

  if (!needsProfileLink && !needsBusinessOwnerLink) {
    return profile
  }

  let nextProfile = profile

  if (needsProfileLink) {
    const { data } = await (service.from('profiles') as any)
      .update({ business_id: nextBusinessId })
      .eq('id', profile.id)
      .select()
      .single()

    nextProfile = (data as Profile | null) || { ...profile, business_id: nextBusinessId }
  }

  if (needsBusinessOwnerLink) {
    await (service.from('businesses') as any)
      .update({ owner_user_id: profile.id })
      .eq('id', nextBusinessId)
  } else if (business.owner_user_id && business.owner_user_id !== profile.id) {
    console.warn('[auth-session] Matched business already has a different owner_user_id', {
      profileId: profile.id,
      businessId: nextBusinessId,
      ownerUserId: business.owner_user_id,
    })
  }

  return needsProfileLink ? nextProfile : { ...profile, business_id: nextBusinessId }
}

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
      // If the existing profile has the wrong role for this QA account type, correct it.
      // This handles cases where role mapping was wrong on a previous login.
      if (existingProfile.role !== fallback.role && fallback.role !== 'field') {
        try {
          const { data: updatedProfile } = await (service.from('profiles') as any)
            .update({ role: fallback.role, role_subtype: fallback.role_subtype ?? null })
            .eq('id', userId)
            .select()
            .single()
          if (updatedProfile) {
            console.log('[auth-session] Corrected role for', email, existingProfile.role, '→', fallback.role)
            return updatedProfile as Profile
          }
        } catch {
          // Non-fatal — return existing profile unchanged
        }
      }
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
 * Also auto-links a business-role user to their local business record.
 */
async function syncQaReferralToProfile(
  service: ServiceClient,
  profileId: string,
  profile: Profile,
): Promise<Profile> {
  try {
    const qaProfile = await fetchQaUserProfile()

    const profileMetadata = ((profile.metadata as Record<string, unknown> | null) || {})
    const currentSharedUrl = typeof profileMetadata.qa_shared_url === 'string' ? profileMetadata.qa_shared_url : null
    const currentReferralLink = typeof profileMetadata.qa_referral_link === 'string' ? profileMetadata.qa_referral_link : null

    const nextReferralCode = sanitizeStakeholderCodeValue(qaProfile?.referralCode)
    const nextSharedUrl = sanitizeStakeholderUrl(qaProfile?.sharedURL)
    const nextReferralLink = sanitizeStakeholderUrl(qaProfile?.referralLink)

    const referralCode = nextReferralCode ?? sanitizeStakeholderCodeValue(profile.referral_code)
    const sharedUrl = nextSharedUrl ?? sanitizeStakeholderUrl(currentSharedUrl)
    const referralLink = nextReferralLink ?? sanitizeStakeholderUrl(currentReferralLink)

    // Only update if the profile doesn't already have it (avoid unnecessary writes)
    const metadataAlreadySet =
      profile.referral_code === referralCode &&
      currentSharedUrl === sharedUrl &&
      currentReferralLink === referralLink

    if (!metadataAlreadySet) {
      const patch = {
        referral_code: referralCode,
        metadata: {
          ...profileMetadata,
          qa_shared_url: sharedUrl,
          qa_referral_link: referralLink,
          qa_referral_synced_at: new Date().toISOString(),
        },
      }

      const { data } = await (service.from('profiles') as any)
        .update(patch)
        .eq('id', profileId)
        .select()
        .single()

      profile = (data as Profile | null) || { ...profile, ...patch }
    }

    // Auto-link business users to their local business record via referral code.
    if (profile.role === 'business' && !profile.business_id) {
      profile = await linkQaBusinessToProfile(service, profile, referralCode)
    }

    // Seed the business stakeholder's codes from QA so material generation
    // works even when an admin opens the CRM page (codes come from DB, not
    // from the owner's live QA session).
    if (profile.role === 'business' && profile.business_id) {
      // Extract connection code from sharedURL (e.g. "https://…/f5bzaapPF2b" → "f5bzaapPF2b")
      const connectionCode = sanitizeStakeholderCodeValue(sharedUrl?.split('/').pop() || '') || referralCode
      await seedBusinessStakeholderCodes(service, profile.business_id, referralCode, connectionCode, referralLink)
    }

    return profile
  } catch {
    // non-fatal — profile will still work, codes just won't be pre-filled
    return profile
  }
}

/**
 * Seed a business stakeholder's stakeholder_codes row with QA referral data.
 * Only fills in null fields — never overwrites values already in the DB.
 * This makes the codes available in the CRM and material engine even when
 * the business owner is not actively logged in.
 */
async function seedBusinessStakeholderCodes(
  service: ServiceClient,
  businessId: string,
  referralCode: string | null | undefined,
  connectionCode: string | null | undefined,
  referralLink: string | null | undefined,
): Promise<void> {
  try {
    const refCode = sanitizeStakeholderCodeValue(referralCode) || null
    const connCode = sanitizeStakeholderCodeValue(connectionCode) || null
    const joinUrl = sanitizeStakeholderUrl(referralLink) || null

    if (!refCode && !connCode && !joinUrl) return

    // Find the primary stakeholder for this business
    const { data: stakeholder } = await (service as any)
      .from('stakeholders')
      .select('id')
      .eq('business_id', businessId)
      .maybeSingle()

    const stakeholderId: string | null = (stakeholder as { id: string } | null)?.id || null
    if (!stakeholderId) return

    // Check existing codes row
    const { data: existing } = await (service as any)
      .from('stakeholder_codes')
      .select('id, referral_code, connection_code, join_url')
      .eq('stakeholder_id', stakeholderId)
      .maybeSingle()

    const existingRow = existing as { id: string; referral_code: string | null; connection_code: string | null; join_url: string | null } | null

    if (existingRow) {
      // Only patch fields that are still null
      const patch: Record<string, string | null> = {}
      if (!existingRow.referral_code && refCode) patch.referral_code = refCode
      if (!existingRow.connection_code && connCode) patch.connection_code = connCode
      if (!existingRow.join_url && joinUrl) patch.join_url = joinUrl
      if (Object.keys(patch).length > 0) {
        await (service as any)
          .from('stakeholder_codes')
          .update(patch)
          .eq('id', existingRow.id)
        console.log('[auth-session] Seeded stakeholder_codes for business', businessId, patch)
      }
    } else {
      // Insert new row
      await (service as any)
        .from('stakeholder_codes')
        .insert({ stakeholder_id: stakeholderId, referral_code: refCode, connection_code: connCode, join_url: joinUrl })
      console.log('[auth-session] Created stakeholder_codes for business', businessId)
    }
  } catch (err) {
    // Non-fatal
    console.warn('[auth-session] Failed to seed stakeholder_codes', err)
  }
}

/**
 * For a QA business-role user whose profile has no business_id yet, find the
 * matching local business (by referral code → stakeholder_codes, then by email
 * as fallback) and write the bidirectional link:
 *   profile.business_id   → business.id
 *   business.owner_user_id → profile.id
 */
async function linkQaBusinessToProfile(
  service: ServiceClient,
  profile: Profile,
  referralCode: string | null | undefined,
): Promise<Profile> {
  try {
    let businessId: string | null = null

    // 1. Match via referral code → stakeholder_codes → stakeholders.business_id
    const code = sanitizeStakeholderCodeValue(referralCode)
    if (code) {
      const { data: codeRow } = await (service as any)
        .from('stakeholder_codes')
        .select('stakeholder_id')
        .ilike('referral_code', code)
        .maybeSingle()

      const stakeholderIdFromCode = (codeRow as { stakeholder_id: string } | null)?.stakeholder_id || null
      if (stakeholderIdFromCode) {
        const { data: stakeholder } = await (service as any)
          .from('stakeholders')
          .select('business_id')
          .eq('id', stakeholderIdFromCode)
          .maybeSingle()
        businessId = (stakeholder as { business_id: string | null } | null)?.business_id || null
      }
    }

    // 2. Fall back to email match on businesses table
    if (!businessId && profile.email) {
      const { data: biz } = await service
        .from('businesses')
        .select('id')
        .ilike('email', profile.email)
        .maybeSingle()
      businessId = (biz as { id: string } | null)?.id || null
    }

    if (!businessId) return profile

    // Write profile.business_id
    const { data: updatedProfile } = await (service.from('profiles') as any)
      .update({ business_id: businessId })
      .eq('id', profile.id)
      .select()
      .single()

    // Write business.owner_user_id (only if not already claimed by someone else)
    await (service.from('businesses') as any)
      .update({ owner_user_id: profile.id })
      .eq('id', businessId)
      .is('owner_user_id', null)

    console.log('[auth-session] Auto-linked business user', profile.email, '→ business', businessId)
    return (updatedProfile as Profile | null) || { ...profile, business_id: businessId }
  } catch (err) {
    console.warn('[auth-session] Failed to auto-link business user to business', err)
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

      // Guard: if the QA token is for a DIFFERENT email than the Supabase session,
      // the Supabase session is stale (e.g. operator logged into QA as a business user
      // but the bridge didn't fully overwrite the old session). Fall through to the
      // QA-only path which will provision the correct identity.
      if (
        qaSession?.claims.email &&
        user.email &&
        qaSession.claims.email.toLowerCase() !== user.email.toLowerCase()
      ) {
        console.log(
          '[auth-session] QA session email differs from Supabase user email — using QA path',
          { qaEmail: qaSession.claims.email, supabaseEmail: user.email },
        )
        // fall through to path 2 below
      } else {

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

      // While the QA token is still live, QA is the source of truth for role.
      // Always apply the QA-derived role to the in-memory profile, and persist
      // it to the DB if it differs (best-effort, non-fatal).
      if (qaSession) {
        const expectedFromQa = buildFallbackQaProfile(qaSession.claims)
        const storedRole = profile.role
        // Apply QA role immediately so the returned profile is always correct,
        // regardless of what's stored in the DB row.
        profile = { ...profile, role: expectedFromQa.role, role_subtype: expectedFromQa.role_subtype ?? null }
        // Persist to DB if the stored role was wrong, so future non-QA sessions
        // also get the right role.
        if (storedRole !== expectedFromQa.role) {
          try {
            await (service.from('profiles') as any)
              .update({ role: expectedFromQa.role, role_subtype: expectedFromQa.role_subtype ?? null })
              .eq('id', user.id)
            console.log('[auth-session] Synced role (path-1) for', user.email, storedRole, '→', expectedFromQa.role)
          } catch {
            // Non-fatal.
          }
        }

        profile = await syncQaReferralToProfile(service, user.id, profile)
      }

      profile = await linkBusinessUserToLocalBusiness(service, profile, qaSession?.claims)

      return {
        profile,
        userId: user.id,
        localProfileId: asUuid(user.id),
        source: qaSession ? 'qa' : 'supabase',
        qaClaims: qaSession?.claims,
        qaSession: qaSession || undefined,
      }
      } // end else (emails match)
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

    // QA is the source of truth for role — always apply the QA-derived role.
    const expectedFromQa = buildFallbackQaProfile(qaSession.claims)
    const storedRole = profile.role
    profile = { ...profile, role: expectedFromQa.role, role_subtype: expectedFromQa.role_subtype ?? null }
    if (profileIsReal && storedRole !== expectedFromQa.role) {
      try {
        await (service.from('profiles') as any)
          .update({ role: expectedFromQa.role, role_subtype: expectedFromQa.role_subtype ?? null })
          .eq('id', profile.id)
        console.log('[auth-session] Synced role (path-2) for', email, storedRole, '→', expectedFromQa.role)
      } catch {
        // Non-fatal.
      }
    }

    // Sync referral codes into the profile row while the QA token is still live
    if (profileIsReal && profile) {
      profile = await syncQaReferralToProfile(service, profile.id, profile)
      profile = await linkBusinessUserToLocalBusiness(service, profile, qaSession.claims)
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
