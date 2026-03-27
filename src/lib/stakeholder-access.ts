import type { NavItem } from '@/lib/constants'
import { ROLE_THEMES, ROLES } from '@/lib/constants'
import type { Profile, UserRole, UserRoleSubtype } from '@/lib/types/database'

export type StakeholderShell =
  | 'admin'
  | 'business'
  | 'field'
  | 'launch_partner'
  | 'community'
  | 'influencer'

export interface StakeholderAccess {
  shell: StakeholderShell
  subtype: UserRoleSubtype
  label: string
  themeRole: UserRole
  searchPlaceholder: string
  navItems: NavItem[]
  fallbackPath: string
}

export const CANONICAL_STAKEHOLDER_ROLES: Array<{
  value: Extract<UserRole, 'admin' | 'business' | 'field' | 'launch_partner' | 'community' | 'influencer'>
  label: string
  description: string
}> = [
  { value: 'admin', label: 'Admin', description: 'Full system visibility and approval controls' },
  { value: 'business', label: 'Business', description: 'One business portal and owned-customer growth' },
  { value: 'field', label: 'Field', description: 'Intern and volunteer outreach workspace' },
  { value: 'launch_partner', label: 'Launch Partner', description: 'Assigned-city growth and activation' },
  { value: 'community', label: 'Community', description: 'School or cause supporter mobilization' },
  { value: 'influencer', label: 'Influencer', description: 'Referral and public share growth' },
]

export const STAKEHOLDER_SUBTYPE_OPTIONS: Record<
  StakeholderShell,
  Array<{ value: Exclude<UserRoleSubtype, null>; label: string }>
> = {
  admin: [
    { value: 'super', label: 'Super' },
    { value: 'internal', label: 'Internal' },
  ],
  business: [],
  field: [
    { value: 'intern', label: 'Intern' },
    { value: 'volunteer', label: 'Volunteer' },
  ],
  launch_partner: [],
  community: [
    { value: 'school', label: 'School' },
    { value: 'cause', label: 'Cause' },
  ],
  influencer: [],
}

const BUSINESS_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'Setup', href: '/portal/setup', icon: 'Rocket', minLevel: 0 },
  { label: 'My Business', href: '/portal/business', icon: 'Store', minLevel: 0 },
  { label: 'My 100 List', href: '/portal/clients', icon: 'Users', minLevel: 0 },
  { label: 'Grow with Other Businesses', href: '/portal/grow', icon: 'Megaphone', minLevel: 0 },
  { label: 'Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
  { label: 'Activity', href: '/portal/activity', icon: 'BarChart3', minLevel: 0 },
]

const FIELD_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'My Businesses', href: '/workspace/businesses', icon: 'Store', minLevel: 0 },
  { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', minLevel: 0 },
  { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', minLevel: 0 },
  { label: 'My Tasks', href: '/crm/tasks', icon: 'CheckSquare', minLevel: 0 },
  { label: 'Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
  { label: 'My Stats', href: '/analytics/me', icon: 'BarChart3', minLevel: 0 },
]

const LAUNCH_PARTNER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'My City', href: '/partner/city', icon: 'MapPin', minLevel: 0 },
  { label: 'Businesses', href: '/partner/businesses', icon: 'Store', minLevel: 0 },
  { label: 'Community', href: '/partner/community', icon: 'Heart', minLevel: 0 },
  { label: 'City Requests', href: '/partner/requests', icon: 'UserPlus', minLevel: 0 },
  { label: 'Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
]

const COMMUNITY_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'Supporters', href: '/community/supporters', icon: 'Users', minLevel: 0 },
  { label: 'Share', href: '/community/share', icon: 'Megaphone', minLevel: 0 },
  { label: 'Activity', href: '/community/activity', icon: 'BarChart3', minLevel: 0 },
  { label: 'Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
]

const INFLUENCER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'Share', href: '/influencer/share', icon: 'Megaphone', minLevel: 0 },
  { label: 'My Links', href: '/influencer/links', icon: 'QrCode', minLevel: 0 },
  { label: 'Stats', href: '/influencer/stats', icon: 'BarChart3', minLevel: 0 },
  { label: 'Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  {
    label: 'CRM', href: '/crm', icon: 'Building2', minLevel: 0,
    children: [
      { label: 'Businesses', href: '/crm/businesses', icon: 'Store', minLevel: 0 },
      { label: 'Causes', href: '/crm/causes', icon: 'Heart', minLevel: 0 },
      { label: 'Contacts', href: '/crm/contacts', icon: 'Users', minLevel: 0 },
      { label: 'Stakeholders', href: '/crm/stakeholders', icon: 'UserCheck', minLevel: 0 },
      { label: 'Cities', href: '/crm/cities', icon: 'MapPin', minLevel: 0 },
      { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', minLevel: 0 },
      { label: 'Outreach', href: '/crm/outreach', icon: 'Send', minLevel: 0 },
      { label: 'Tasks', href: '/crm/tasks', icon: 'CheckSquare', minLevel: 0 },
    ],
  },
  {
    label: 'QR Codes', href: '/qr', icon: 'QrCode', minLevel: 0,
    children: [
      { label: 'Generator', href: '/qr/generator', icon: 'Plus', minLevel: 0 },
      { label: 'My QR Codes', href: '/qr/mine', icon: 'QrCode', minLevel: 0 },
      { label: 'Collections', href: '/qr/collections', icon: 'FolderOpen', minLevel: 0 },
      { label: 'Analytics', href: '/qr/analytics', icon: 'BarChart3', minLevel: 0 },
    ],
  },
  {
    label: 'Materials', href: '/materials', icon: 'FileText', minLevel: 0,
    children: [
      { label: 'Library', href: '/materials/library', icon: 'Library', minLevel: 0 },
      { label: 'My Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
    ],
  },
  { label: 'Campaigns', href: '/campaigns', icon: 'Megaphone', minLevel: 0 },
  {
    label: 'Onboarding', href: '/onboarding', icon: 'Rocket', minLevel: 0,
    children: [
      { label: 'Business', href: '/onboarding/business', icon: 'Store', minLevel: 0 },
      { label: 'Cause', href: '/onboarding/cause', icon: 'Heart', minLevel: 0 },
      { label: 'Stakeholder', href: '/onboarding/stakeholder', icon: 'UserPlus', minLevel: 0 },
    ],
  },
  { label: 'Analytics', href: '/analytics', icon: 'TrendingUp', minLevel: 0 },
  {
    label: 'Admin', href: '/admin', icon: 'Settings', minLevel: 0,
    children: [
      { label: 'Stakeholders', href: '/admin/stakeholders', icon: 'FolderKanban', minLevel: 0 },
      { label: 'Material Tasks', href: '/admin/material-engine/tasks', icon: 'ListChecks', minLevel: 0 },
      { label: 'Template Manager', href: '/admin/material-engine/templates', icon: 'LayoutTemplate', minLevel: 0 },
      { label: 'Users', href: '/admin/users', icon: 'Users', minLevel: 0 },
      { label: 'Audit Log', href: '/admin/audit', icon: 'ScrollText', minLevel: 0 },
    ],
  },
]

function deriveSubtype(profile: Profile): UserRoleSubtype {
  if (profile.role_subtype) return profile.role_subtype

  switch (profile.role) {
    case 'super_admin':
      return 'super'
    case 'internal_admin':
      return 'internal'
    case 'school_leader':
      return 'school'
    case 'cause_leader':
      return 'cause'
    case 'intern':
      return 'intern'
    case 'volunteer':
      return 'volunteer'
    default:
      return null
  }
}

export function getSubtypeOptionsForRole(role: UserRole) {
  const shell = getStakeholderShell({ role } as Profile)
  return STAKEHOLDER_SUBTYPE_OPTIONS[shell]
}

export function normalizeSubtypeForRole(role: UserRole, subtype: UserRoleSubtype): UserRoleSubtype {
  const allowedValues = new Set(getSubtypeOptionsForRole(role).map((option) => option.value))
  if (subtype && allowedValues.has(subtype)) return subtype

  if (role === 'admin') return 'internal'
  if (role === 'field') return 'intern'
  if (role === 'community') return 'school'
  return null
}

export function getStakeholderShell(profile: Profile): StakeholderShell {
  switch (profile.role) {
    case 'admin':
    case 'super_admin':
    case 'internal_admin':
      return 'admin'
    case 'business':
      return 'business'
    case 'field':
    case 'intern':
    case 'volunteer':
      return 'field'
    case 'launch_partner':
    case 'business_onboarding':
      return 'launch_partner'
    case 'community':
    case 'school_leader':
    case 'cause_leader':
      return 'community'
    case 'influencer':
      return 'influencer'
    case 'affiliate':
      return 'influencer'
    default:
      return 'field'
  }
}

function getRoleLabel(shell: StakeholderShell, subtype: UserRoleSubtype) {
  if (shell === 'admin') {
    return subtype === 'super' ? 'Super Admin' : subtype === 'internal' ? 'Internal Admin' : 'Admin'
  }

  if (shell === 'community') {
    return subtype === 'school' ? 'School' : subtype === 'cause' ? 'Cause' : 'Community'
  }

  if (shell === 'field') {
    return subtype === 'intern' ? 'Intern' : subtype === 'volunteer' ? 'Volunteer' : 'Field'
  }

  if (shell === 'launch_partner') return 'Launch Partner'
  if (shell === 'business') return 'Business'
  return 'Influencer'
}

function getThemeRole(shell: StakeholderShell, subtype: UserRoleSubtype): UserRole {
  if (shell === 'admin') {
    return subtype === 'super' ? 'super_admin' : subtype === 'internal' ? 'internal_admin' : 'admin'
  }

  if (shell === 'community') {
    return subtype === 'school' ? 'school_leader' : subtype === 'cause' ? 'cause_leader' : 'community'
  }

  if (shell === 'field') {
    return subtype === 'intern' ? 'intern' : subtype === 'volunteer' ? 'volunteer' : 'field'
  }

  if (shell === 'launch_partner') return 'launch_partner'
  return shell
}

function getSearchPlaceholder(shell: StakeholderShell) {
  switch (shell) {
    case 'business':
      return 'Search my business portal...'
    case 'field':
      return 'Search my businesses, scripts, or tasks...'
    case 'launch_partner':
      return 'Search my city, businesses, or requests...'
    case 'community':
      return 'Search supporters, businesses, or materials...'
    case 'influencer':
      return 'Search share links, scans, or materials...'
    default:
      return 'Search anything...'
  }
}

function getNavItems(shell: StakeholderShell) {
  switch (shell) {
    case 'business':
      return BUSINESS_NAV_ITEMS
    case 'field':
      return FIELD_NAV_ITEMS
    case 'launch_partner':
      return LAUNCH_PARTNER_NAV_ITEMS
    case 'community':
      return COMMUNITY_NAV_ITEMS
    case 'influencer':
      return INFLUENCER_NAV_ITEMS
    default:
      return ADMIN_NAV_ITEMS
  }
}

export function getStakeholderAccess(profile: Profile): StakeholderAccess {
  const shell = getStakeholderShell(profile)
  const subtype = deriveSubtype(profile)

  return {
    shell,
    subtype,
    label: getRoleLabel(shell, subtype),
    themeRole: getThemeRole(shell, subtype),
    searchPlaceholder: getSearchPlaceholder(shell),
    navItems: getNavItems(shell),
    fallbackPath: '/dashboard',
  }
}

export function canAccessPath(profile: Profile, pathname: string) {
  const { shell } = getStakeholderAccess(profile)

  if (shell === 'admin') return true

  if (shell === 'business') {
    return [
      '/dashboard',
      '/portal/setup',
      '/portal/business',
      '/portal/clients',
      '/portal/grow',
      '/portal/activity',
      '/materials/mine',
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  if (shell === 'field') {
    if (
      pathname === '/dashboard'
      || pathname.startsWith('/workspace')
      || pathname.startsWith('/crm/scripts')
      || pathname.startsWith('/crm/outreach')
      || pathname.startsWith('/crm/tasks')
      || pathname.startsWith('/materials/mine')
      || pathname.startsWith('/analytics/me')
    ) {
      return true
    }

    return pathname.startsWith('/crm/businesses/') || pathname.startsWith('/crm/causes/')
  }

  if (shell === 'launch_partner') {
    return [
      '/dashboard',
      '/partner/city',
      '/partner/businesses',
      '/partner/community',
      '/partner/requests',
      '/materials/mine',
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  if (shell === 'community') {
    return [
      '/dashboard',
      '/community/supporters',
      '/community/share',
      '/community/activity',
      '/materials/mine',
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  return [
    '/dashboard',
    '/influencer/share',
    '/influencer/links',
    '/influencer/stats',
    '/materials/mine',
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function isAdminProfile(profile: Profile) {
  return getStakeholderShell(profile) === 'admin'
}

export function isBusinessProfile(profile: Profile) {
  return getStakeholderShell(profile) === 'business'
}

export function isFieldProfile(profile: Profile) {
  return getStakeholderShell(profile) === 'field'
}

export function getThemeForProfile(profile: Profile) {
  const access = getStakeholderAccess(profile)
  return ROLE_THEMES[access.themeRole]
}

export function getLevelForProfile(profile: Profile) {
  const access = getStakeholderAccess(profile)
  return ROLES[access.themeRole]?.level || 0
}
