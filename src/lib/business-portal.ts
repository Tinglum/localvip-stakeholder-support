import { NAV_ITEMS, type NavItem } from '@/lib/constants'
import type {
  Business,
  BusinessActivationStatus,
  BusinessContactStatus,
  Contact,
  Profile,
  UserRole,
} from '@/lib/types/database'

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

export function getSidebarNavItems(role: UserRole, userLevel: number): NavItem[] {
  if (isBusinessRole(role)) {
    return BUSINESS_NAV_ITEMS
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
