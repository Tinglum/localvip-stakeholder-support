import { NAV_ITEMS, type NavItem } from '@/lib/constants'
import type {
  Business,
  BusinessActivationStatus,
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
}

export const BUSINESS_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'My Business', href: '/portal/business', icon: 'Store', minLevel: 0 },
  { label: 'My 100 List', href: '/portal/clients', icon: 'Users', minLevel: 0 },
  { label: 'Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
  { label: 'Activity', href: '/portal/activity', icon: 'BarChart3', minLevel: 0 },
]

export const FIELD_OUTREACH_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', minLevel: 0 },
  { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', minLevel: 0 },
  { label: 'My Tasks', href: '/crm/tasks', icon: 'CheckSquare', minLevel: 0 },
  { label: 'Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
  { label: 'My Stats', href: '/analytics', icon: 'BarChart3', minLevel: 0 },
]

const FIELD_OUTREACH_ROLES: UserRole[] = ['intern', 'volunteer', 'influencer', 'affiliate']

const BUSINESS_ALLOWED_PREFIXES = [
  '/dashboard',
  '/portal/business',
  '/portal/clients',
  '/portal/activity',
  '/materials/mine',
]

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

export function getSidebarNavItems(role: UserRole, userLevel: number): NavItem[] {
  if (isBusinessRole(role)) {
    return BUSINESS_NAV_ITEMS
  }

  if (isFieldOutreachRole(role)) {
    return FIELD_OUTREACH_NAV_ITEMS
  }

  return NAV_ITEMS.filter((item) => userLevel >= item.minLevel)
}

export function canBusinessAccessPath(pathname: string): boolean {
  return BUSINESS_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
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
  return data.offer_title || 'Join our list and get access to exclusive offers'
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

  const totalContacts = contacts.length
  const data = getBusinessPortalData(business)

  if (business.stage === 'live' || totalContacts >= 100) return 'active'
  if (totalContacts > 0 || !!data.offer_title || !!business.public_description || !!data.description) return 'in_progress'
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
