import type {
  Business,
  BusinessActivationStatus,
  BusinessLaunchPhase,
  BusinessContactStatus,
  Contact,
  Profile,
  UserRole,
} from '@/lib/types/database'

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
  cashback_percent?: number
  capture_offer_title?: string
  capture_offer_description?: string
  capture_offer_value?: string
  cashback_offer_title?: string
  cashback_offer_description?: string
  cashback_offer_value?: string
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

export function resolveScopedBusiness(profile: Profile, businesses: Business[]): Business | null {
  if (profile.business_id) {
    return businesses.find((business) => business.id === profile.business_id) || null
  }

  return businesses.find((business) => business.owner_user_id === profile.id || business.owner_id === profile.id) || businesses[0] || null
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

export function getBusinessCashbackPercent(business: Business): number {
  const data = getBusinessPortalData(business)
  const percent = Number(data.cashback_percent || 10)
  if (Number.isNaN(percent)) return 10
  return Math.min(25, Math.max(5, percent))
}

export function getBusinessLaunchPhase(business: Business, contacts: Contact[]): BusinessLaunchPhase {
  if (business.launch_phase) return business.launch_phase

  const data = getBusinessPortalData(business)
  const hasProfile = !!business.name && !!business.category && !!(business.public_description || data.description)
  const hasCaptureOffer = !!(data.capture_offer_title || data.offer_title)
  const hasCashback = !!data.cashback_percent || !!data.cashback_offer_title

  if (!hasProfile || !hasCaptureOffer || !hasCashback) return 'setup'
  if (contacts.length >= 100) return business.stage === 'live' ? 'live' : 'ready_to_go_live'
  if (business.stage === 'live') return 'live'
  return 'capturing_100'
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
