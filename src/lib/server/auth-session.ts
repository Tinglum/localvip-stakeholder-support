import { cookies } from 'next/headers'
import {
  buildFallbackQaProfile,
  getQaSessionFromCookieStore,
  mapQaRoleFromSignals,
  readSignedViewAsPayload,
  type QaAuthClaims,
  type QaSession,
} from '@/lib/auth/qa-auth'
import { getDemoProfileByEmail, getDemoSessionEmailFromCookieStore } from '@/lib/auth/demo-auth'
import { fetchQaUserProfile, resolveQaSessionWithRefresh } from '@/lib/auth/qa-api'
import { sanitizeStakeholderCodeValue, sanitizeStakeholderUrl } from '@/lib/stakeholder-codes'
import { asUuid } from '@/lib/uuid'
import { isSuperAdminRole, resolveUserDisplayName } from '@/lib/auth/display-name'
import type { Profile, UserRole } from '@/lib/types/database'

export type AuthSource = 'qa' | 'demo'

export interface ResolvedAuthSession {
  profile: Profile
  userId: string
  localProfileId: string | null
  source: AuthSource
  qaClaims?: QaAuthClaims
  qaSession?: QaSession
  /**
   * Set when the access token was refreshed while resolving this session, meaning
   * the auth cookies are now stale and should be rewritten with `qaSession`.
   *
   * Only a Route Handler or Server Action may set cookies, so persistence is left
   * to the caller (see /api/auth/session). A Server Component still gets a working
   * session in-process even if nothing persists it.
   */
  qaSessionRefreshed?: boolean
  viewingAs?: {
    targetUserId: number
    targetEmail: string
    targetName: string
    targetRole: string
    targetConsumerType: string | null
    adminId: string
    adminEmail: string | null
  }
}

interface ViewAsCookiePayload {
  userId: number
  email: string
  name: string
  role: string
  accountType?: string | number
  consumerType?: string
  since: string
}

const AUTH_IO_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 1200 : 5000

function withTimeout<T>(promise: Promise<T>, timeoutMs = AUTH_IO_TIMEOUT_MS, label = 'auth operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function getViewAsPayload(cookieStore: ReturnType<typeof cookies>): Promise<ViewAsCookiePayload | null> {
  const raw = cookieStore.get('lvip_view_as')?.value
  if (!raw) return null
  // Verify the HMAC signature before trusting the impersonation payload. A forged
  // or edited cookie fails signature validation and is ignored.
  const verified = await readSignedViewAsPayload(raw)
  if (!verified) return null
  return verified as ViewAsCookiePayload
}

function applyViewAsOverride(
  session: ResolvedAuthSession,
  payload: ViewAsCookiePayload,
): ResolvedAuthSession {
  const original = session.profile
  if (original.role !== 'admin' && original.role !== 'super_admin' && original.role !== 'internal_admin') {
    return session
  }

  const targetProfile: Profile = {
    ...original,
    id: original.id,
    email: payload.email,
    full_name: payload.name,
    role: payload.role as Profile['role'],
    // Do NOT inherit the admin's own subtype (e.g. 'super'). It made
    // deriveSubtype() return the admin's value, which caused isConsumerProfile()
    // to bail and an impersonated CONSUMER to render the 'community' shell instead
    // of the consumer one. Null lets the subtype derive from the target's role.
    role_subtype: null,
    metadata: {
      ...(original.metadata as object || {}),
      view_as_target_user_id: payload.userId,
      view_as_target_email: payload.email,
      view_as_account_type: payload.accountType ?? null,
      view_as_consumer_type: payload.consumerType ?? null,
    },
  }

  return {
    ...session,
    profile: targetProfile,
    viewingAs: {
      targetUserId: payload.userId,
      targetEmail: payload.email,
      targetName: payload.name,
      targetRole: payload.role,
      targetConsumerType: payload.consumerType ?? null,
      adminId: original.id,
      adminEmail: original.email,
    },
  }
}

/**
 * Display name for the session profile. See `lib/auth/display-name` — the same
 * helper is used by the View As override, which is the other place full_name is set.
 */
function resolveDisplayName(
  qaProfile: Awaited<ReturnType<typeof fetchQaUserProfile>>,
  baseProfile: Profile,
  role: UserRole,
  subtype: string | null | undefined,
): string {
  return resolveUserDisplayName({
    firstName: qaProfile?.firstName,
    lastName: qaProfile?.lastName,
    email: qaProfile?.email,
    existing: baseProfile.full_name,
    isSuperAdmin: isSuperAdminRole(role, subtype),
  })
}

function mergeQaProfileIntoSessionProfile(
  baseProfile: Profile,
  qaClaims: QaAuthClaims,
  qaProfile: Awaited<ReturnType<typeof fetchQaUserProfile>>,
): Profile {
  const accountType = qaProfile?.accountType || null
  const profileRole = qaProfile?.role || null
  const nextRole = mapQaRoleFromSignals({
    claims: qaClaims,
    accountType,
    profileRole,
  })

  const fullName = resolveDisplayName(qaProfile, baseProfile, nextRole.role, nextRole.roleSubtype)

  return {
    ...baseProfile,
    full_name: fullName,
    role: nextRole.role,
    role_subtype: nextRole.roleSubtype ?? null,
    referral_code: sanitizeStakeholderCodeValue(qaProfile?.referralCode) ?? baseProfile.referral_code,
    metadata: {
      ...((baseProfile.metadata as Record<string, unknown> | null) || {}),
      auth_source: 'qa_oauth',
      qa_roles: qaClaims.roles,
      qa_claims: qaClaims.raw,
      qa_subject: qaClaims.sub || null,
      qa_account_type: accountType,
      qa_profile_role: profileRole,
      qa_shared_url: sanitizeStakeholderUrl(qaProfile?.sharedURL),
      qa_referral_link: sanitizeStakeholderUrl(qaProfile?.referralLink),
      qa_email: qaProfile?.email || qaClaims.email || null,
      qa_phone_number: qaProfile?.phoneNumber || null,
      qa_first_name: qaProfile?.firstName || null,
      qa_last_name: qaProfile?.lastName || null,
      qa_city: qaProfile?.city || null,
      qa_state: qaProfile?.state || null,
      qa_country: qaProfile?.country || null,
      qa_zip_code: qaProfile?.zipCode || null,
      qa_referral_synced_at: new Date().toISOString(),
      // First-login flag from the QA profile. The layout reads this to force the
      // invited owner through /set-password before using the dashboard.
      qa_force_password_reset: qaProfile?.forcePasswordReset === true,
    },
  }
}

function buildQaSessionProfile(
  qaSession: QaSession,
  qaProfile: Awaited<ReturnType<typeof fetchQaUserProfile>>,
): Profile {
  const fallback = buildFallbackQaProfile(qaSession.claims)
  return mergeQaProfileIntoSessionProfile(fallback, qaSession.claims, qaProfile)
}

export async function getAuthenticatedSession(): Promise<ResolvedAuthSession | null> {
  const cookieStore = cookies()
  const demoSessionEmail = getDemoSessionEmailFromCookieStore(cookieStore)
  // Refresh an expired access token rather than treating it as "no session".
  // Previously an expired token logged the user straight out to QA even though a
  // valid refresh token was sitting in the cookie.
  const resolved = await resolveQaSessionWithRefresh(cookieStore)
  const qaSession = resolved?.session ?? null

  if (!demoSessionEmail && !qaSession) {
    return null
  }

  if (demoSessionEmail) {
    const profile = getDemoProfileByEmail(demoSessionEmail)
    if (profile) {
      const baseSession: ResolvedAuthSession = {
        profile,
        userId: profile.id,
        localProfileId: asUuid(profile.id),
        source: 'demo',
      }
      const viewAs = await getViewAsPayload(cookieStore)
      return viewAs ? applyViewAsOverride(baseSession, viewAs) : baseSession
    }
  }

  if (qaSession) {
    const qaProfile = await withTimeout(
      fetchQaUserProfile(),
      AUTH_IO_TIMEOUT_MS,
      'QA profile sync',
    ).catch(() => null)

    const profile = buildQaSessionProfile(qaSession, qaProfile)

    // The QA `sub` claim is the numeric backend user id (the backend does
    // `sub.ToLong()` for _currentUser.UserId, which is what it stamps on
    // created_by columns). profile.id is a derived UUID, so it can't be used
    // to match ownership — expose the numeric id as localProfileId instead.
    const qaLocalProfileId =
      typeof qaSession.claims.sub === 'string' && /^\d+$/.test(qaSession.claims.sub.trim())
        ? qaSession.claims.sub.trim()
        : null

    const baseSession: ResolvedAuthSession = {
      profile,
      userId: profile.id,
      localProfileId: qaLocalProfileId,
      source: 'qa',
      qaClaims: qaSession.claims,
      qaSession,
      qaSessionRefreshed: resolved?.refreshed ?? false,
    }

    const viewAs = await getViewAsPayload(cookieStore)
    return viewAs ? applyViewAsOverride(baseSession, viewAs) : baseSession
  }

  return null
}

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
