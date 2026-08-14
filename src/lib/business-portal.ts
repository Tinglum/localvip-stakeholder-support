import type {
  Business,
  BusinessActivationStatus,
  BusinessLaunchPhase,
  BusinessContactStatus,
  Contact,
  Profile,
  UserRole,
} from '@/lib/types/database'
import { isBoomerangEnabled } from '@/lib/engagement-codes'

type BusinessPortalOwnershipRecord = Pick<Business, 'id' | 'email' | 'website' | 'owner_id'>

export interface BusinessPortalData {
  logo_url?: string
  cover_photo_url?: string
  offer_title?: string
  offer_description?: string
  offer_value?: string
  description?: string
  tagline?: string
  avg_ticket?: string
  products_services?: string[] | string
  community_impact_total?: number
  transactions_count?: number
  linked_cause_name?: string
  capture_offer_title?: string
  capture_offer_description?: string
  capture_offer_value?: string
  hundred_list_interest?: 'interested' | 'not_now'
  hundred_list_interest_recorded_at?: string
  hundred_list_activation_status?: 'requested' | 'in_setup' | 'active' | 'not_requested'
  /**
   * Opt-in: show this business in the anonymous referrer typeahead a new signup
   * uses to name who referred them. Null/undefined = never answered, which
   * resolves to visible for a business.
   */
  is_visible_in_referrer_search?: boolean | null
  cashback_offer_value?: string
  portal_activation_review_state?: 'pending' | 'approved'
  portal_activation_requested_at?: string
  portal_activation_requested_by?: string
  portal_activation_reviewed_at?: string
  portal_activation_reviewed_by?: string
}

export interface BusinessPortalActivationReview {
  state: 'pending' | 'approved' | null
  requestedAt: string | null
  requestedBy: string | null
  reviewedAt: string | null
  reviewedBy: string | null
}

const FIELD_OUTREACH_ROLES: UserRole[] = ['field', 'intern', 'volunteer']

export function isBusinessRole(role: UserRole): boolean {
  return role === 'business'
}

export function isFieldOutreachRole(role: UserRole): boolean {
  return FIELD_OUTREACH_ROLES.includes(role)
}

function normalizeDomain(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null

  try {
    const url = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`)

    return url.hostname.replace(/^www\./, '')
  } catch {
    const sanitized = trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '')
    return sanitized.split('/')[0] || null
  }
}

function getEmailDomain(email?: string | null): string | null {
  if (!email) return null
  const [, domain] = email.trim().toLowerCase().split('@')
  return domain ? domain.replace(/^www\./, '') : null
}

export function shouldTreatAsBusinessUser(
  profile: Profile,
  ownedBusinesses: BusinessPortalOwnershipRecord[],
): boolean {
  if (isBusinessRole(profile.role)) return true
  if (!ownedBusinesses.length) return false

  const metadata = profile.metadata as Record<string, unknown> | null
  if (
    profile.business_id
    || metadata?.portal_role === 'business'
    || metadata?.account_type === 'business'
    || metadata?.business_user === true
  ) {
    return true
  }

  const profileDomain = getEmailDomain(profile.email)
  if (!profileDomain) return false

  return ownedBusinesses.some((business) => {
    const businessEmailDomain = getEmailDomain(business.email)
    const businessWebsiteDomain = normalizeDomain(business.website)

    return profileDomain === businessEmailDomain || profileDomain === businessWebsiteDomain
  })
}

export function normalizeBusinessProfile(
  profile: Profile,
  ownedBusinesses: BusinessPortalOwnershipRecord[],
): Profile {
  if (!shouldTreatAsBusinessUser(profile, ownedBusinesses)) {
    return profile
  }

  const profileDomain = getEmailDomain(profile.email)
  const matchedBusiness =
    ownedBusinesses.find((business) => {
      const businessEmailDomain = getEmailDomain(business.email)
      const businessWebsiteDomain = normalizeDomain(business.website)

      return !!profileDomain && (
        profileDomain === businessEmailDomain
        || profileDomain === businessWebsiteDomain
      )
    })
    || ownedBusinesses.find((business) => business.id === profile.business_id)
    || ownedBusinesses[0]
  const scopedBusinessId = matchedBusiness?.id || profile.business_id || null
  const metadata = (profile.metadata as Record<string, unknown> | null) || {}

  return {
    ...profile,
    role: 'business',
    business_id: scopedBusinessId,
    metadata: {
      ...metadata,
      original_role: metadata.original_role || profile.role,
      portal_role: 'business',
    },
  }
}

export function getBusinessPortalData(business: Business | null | undefined): BusinessPortalData {
  if (!business?.metadata || typeof business.metadata !== 'object') return {}
  return business.metadata as BusinessPortalData
}

export function getBusinessPortalActivationReview(
  business: Business | null | undefined,
): BusinessPortalActivationReview {
  const data = getBusinessPortalData(business)
  const metadataState = data.portal_activation_review_state
  const state =
    metadataState === 'pending' || metadataState === 'approved'
      ? metadataState
      : business && business.stage !== 'live' && business.launch_phase === 'ready_to_go_live' && business.activation_status !== 'active'
        ? 'pending'
        : null

  return {
    state,
    requestedAt: typeof data.portal_activation_requested_at === 'string' ? data.portal_activation_requested_at : null,
    requestedBy: typeof data.portal_activation_requested_by === 'string' ? data.portal_activation_requested_by : null,
    reviewedAt: typeof data.portal_activation_reviewed_at === 'string' ? data.portal_activation_reviewed_at : null,
    reviewedBy: typeof data.portal_activation_reviewed_by === 'string' ? data.portal_activation_reviewed_by : null,
  }
}

export function isBusinessPendingLiveReview(business: Business | null | undefined): boolean {
  return getBusinessPortalActivationReview(business).state === 'pending'
}

/**
 * Which business a business-portal surface is scoped to. Returns null - never
 * a guess - when the profile does not positively resolve to exactly one.
 *
 * The trailing `|| businesses[0]` used to be here for a caller with no
 * business_id and no ownership match. For a genuine business user that never
 * happens, so it was silent for years - but a super admin has no business_id
 * and owns nothing, and every /portal/* route allows admin through
 * (`canAccessPath`). Loading the page then silently attached the admin's
 * session to whatever business happened to be first in an unfiltered list -
 * an arbitrary business's Boomerang QR, profile fields, and live-review
 * submission became editable through a URL nobody chose. All nine callers of
 * this function already treat null as "nothing to show yet" (an explicit
 * guard, or a null-safe helper downstream), so returning null instead of a
 * guess costs nothing and closes that hole.
 */
export function resolveScopedBusiness(profile: Profile, businesses: Business[]): Business | null {
  if (profile.business_id) {
    return businesses.find((business) => business.id === profile.business_id) || null
  }

  return businesses.find((business) => business.owner_user_id === profile.id || business.owner_id === profile.id) || null
}

/** Accepts a numeric id in either number or string form. */
function asNumericId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim()
  return null
}

/**
 * The numeric QA account id behind a business record — the key every network
 * endpoint is scoped by.
 *
 * Businesses reach the portal through several shapes and each one carries the id
 * somewhere different, which is why this used to come back null on records that
 * were perfectly well connected:
 *
 * - server-merged records (`mergeBusinessRecord`, `buildSyntheticBusiness`) put it
 *   on `external_id` and on `metadata.qaAccountId` / `qaBusinessId`;
 * - the client mapper the business portal actually uses
 *   (`mapQaBusinessRecordToBusiness` in `lib/supabase/hooks`) never sets
 *   `external_id` at all — there the id is the record's own `id`, plus
 *   `metadata.qaId` / `metadata.qaBusinessId`;
 * - CRM-shaped records nest it under `metadata.qaApi.id`.
 *
 * All of those are checked here so the network tree resolves whenever the data is
 * present anywhere. Null means the business genuinely has no network account yet
 * (a local/demo record with a UUID id and no QA linkage).
 */
export function getBusinessQaAccountId(
  business:
    | { id?: string | null; external_id?: string | null; metadata?: Record<string, unknown> | null }
    | null
    | undefined,
): string | null {
  if (!business) return null

  const fromExternalId = asNumericId(business.external_id)
  if (fromExternalId) return fromExternalId

  const meta = (business.metadata as Record<string, unknown> | null) || {}
  const fromMetadata =
    asNumericId(meta.qaAccountId) ??
    asNumericId(meta.qaBusinessId) ??
    asNumericId(meta.qa_account_id) ??
    asNumericId(meta.qaId)
  if (fromMetadata) return fromMetadata

  const qaApi = meta.qaApi
  if (qaApi && typeof qaApi === 'object') {
    const nested = asNumericId((qaApi as Record<string, unknown>).id)
    if (nested) return nested
  }

  // Last resort: QA-sourced records are keyed by the account id itself. A local
  // record has a UUID here, which fails the numeric test and falls through.
  return asNumericId(business.id)
}

export function getBusinessProducts(business: Business): string[] {
  const data = getBusinessPortalData(business)
  const rawProducts = business.products_services ?? data.products_services ?? []

  if (Array.isArray(rawProducts)) {
    return rawProducts
      .map((value) => `${value}`.trim())
      .filter(Boolean)
  }

  return `${rawProducts}`
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function getBusinessAvgTicket(business: Business): string | null {
  const data = getBusinessPortalData(business)
  return business.avg_ticket || data.avg_ticket || null
}

export function getBusinessDescription(business: Business): string {
  const data = getBusinessPortalData(business)
  return business.public_description || data.description || data.tagline || 'Tell customers what makes your business worth coming back to.'
}

export function getBusinessOfferTitle(business: Business): string {
  const data = getBusinessPortalData(business)
  return data.capture_offer_title || data.offer_title || 'Join our list and get access to exclusive offers'
}

/**
 * Whether this business opted in to the Boomerang list.
 *
 * `hundred_list_interest` was recorded during onboarding and then consulted
 * nowhere, so a business that answered "Not right now" kept seeing the whole
 * feature. Every business-facing Boomerang surface now gates on this. The
 * never-answered case is deliberately closed - see `isBoomerangEnabled`.
 */
export function isBoomerangEnabledForBusiness(business: Business | null | undefined): boolean {
  if (!business) return false
  return isBoomerangEnabled(getBusinessPortalData(business).hundred_list_interest ?? null)
}

export function getBusinessLaunchPhase(business: Business, contacts: Contact[]): BusinessLaunchPhase {
  if (business.launch_phase) return business.launch_phase

  const data = getBusinessPortalData(business)
  const hasProfile = !!business.name && !!business.category && !!(business.public_description || data.description)
  if (!hasProfile) return 'setup'
  if (business.stage === 'live') return 'live'
  if (data.hundred_list_interest === 'interested' && contacts.length < 100) return 'capturing_100'
  return 'ready_to_go_live'
}

export function getContactDisplayName(contact: Contact): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Unnamed contact'
}

export function getContactPrimaryChannel(contact: Contact): string {
  return contact.phone || contact.email || 'Add phone or email'
}

export function splitFullName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) return { first_name: '', last_name: '' }

  const [first_name, ...rest] = trimmed.split(' ')
  return {
    first_name,
    last_name: rest.join(' '),
  }
}

export function getContactListStatus(contact: Contact): BusinessContactStatus {
  if (contact.list_status) return contact.list_status
  if (contact.joined_at) return 'joined'
  if (contact.invited_at) return 'invited'

  const metadata = contact.metadata as Record<string, unknown> | null
  const metadataStatus = metadata?.list_status
  if (metadataStatus === 'joined' || metadataStatus === 'invited' || metadataStatus === 'added') {
    return metadataStatus
  }

  return 'added'
}

export function getContactTag(contact: Contact): string | null {
  if (contact.tag) return contact.tag

  const metadata = contact.metadata as Record<string, unknown> | null
  const metadataTag = metadata?.tag
  return typeof metadataTag === 'string' && metadataTag.trim() ? metadataTag.trim() : null
}

export function getBusinessActivationStatus(business: Business, contacts: Contact[]): BusinessActivationStatus {
  if (business.activation_status) return business.activation_status

  const phase = getBusinessLaunchPhase(business, contacts)
  if (phase === 'live' || phase === 'ready_to_go_live') return 'active'
  if (phase === 'capturing_100') return 'in_progress'
  if (contacts.length > 0) return 'in_progress'
  return 'not_started'
}

export function getActivationLabel(status: BusinessActivationStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'in_progress':
      return 'In Progress'
    default:
      return 'Not Started'
  }
}

export function getActivationTone(status: BusinessActivationStatus): 'success' | 'info' | 'warning' {
  switch (status) {
    case 'active':
      return 'success'
    case 'in_progress':
      return 'info'
    default:
      return 'warning'
  }
}

export function getNetworkMilestone(total: number) {
  if (total >= 100) {
    return {
      label: 'Fully activated',
      description: 'You have a strong launch list ready to support your business.',
      progress: 100,
    }
  }

  if (total >= 50) {
    return {
      label: 'Strong network',
      description: 'You are building a powerful base of regulars and supporters.',
      progress: total,
    }
  }

  if (total >= 10) {
    return {
      label: 'Building momentum',
      description: 'Keep going. The people you already know can carry the launch.',
      progress: total,
    }
  }

  return {
    label: 'Getting started',
    description: 'Start with the first people who already know and trust your business.',
    progress: total,
  }
}

export function isCreatedToday(date: string) {
  const now = new Date()
  const created = new Date(date)
  return now.getFullYear() === created.getFullYear()
    && now.getMonth() === created.getMonth()
    && now.getDate() === created.getDate()
}
