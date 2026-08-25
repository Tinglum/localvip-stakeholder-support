import type { NavItem } from '@/lib/constants'
import { ROLE_THEMES, ROLES } from '@/lib/constants'
import type { Profile, UserRole, UserRoleSubtype } from '@/lib/types/database'
import { BOOMERANG_SURFACE } from '@/lib/engagement-codes'

export type StakeholderShell =
  | 'admin'
  | 'business'
  | 'consumer'
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
  consumer: [],
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

/**
 * FOUR TABS, plus the Boomerang list for a business that opted in. Home is
 * read-only status; My Business is the editable surface; Grow is how you bring
 * in other businesses, causes and LocalVIP members; Materials is QR and
 * printable assets.
 *
 * The old nine items are absorbed, not deleted — Dashboard+Activity → Home,
 * My Business+Setup → My Business, My Network+Grow → Grow,
 * Materials+Template Library → Materials. Every old route still resolves via
 * the redirects in `next.config.js`.
 */
const BUSINESS_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'My Business', href: '/portal/business', icon: 'Store', minLevel: 0 },
  { label: 'Grow', href: '/portal/grow', icon: 'Megaphone', minLevel: 0 },
  { label: 'Materials', href: '/portal/materials', icon: 'FileDown', minLevel: 0 },
]

/**
 * The Boomerang list gets its OWN tab rather than a section inside Grow, because
 * it is a different product from the LocalVIP referral that Grow is about, and
 * because a business that declined it must not see it at all.
 */
export const BUSINESS_BOOMERANG_NAV_HREF = '/portal/boomerang'

const BUSINESS_BOOMERANG_NAV_ITEM: NavItem = {
  label: BOOMERANG_SURFACE.tab,
  href: BUSINESS_BOOMERANG_NAV_HREF,
  icon: 'Users',
  minLevel: 0,
}

/**
 * The first-run wizard is no longer a nav item at all — it is reached from the
 * "Needs your input" panel on Home and from `?step=` deep links. Kept as an
 * export because the shell still filters on it when setup is complete.
 */
export const BUSINESS_SETUP_NAV_HREF = '/portal/setup'

const CONSUMER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'My Wallet', href: '/portal/me/wallet', icon: 'TrendingUp', minLevel: 0 },
  { label: 'My Network', href: '/portal/me/network', icon: 'Users', minLevel: 0 },
  { label: 'Pay it Forward', href: '/portal/me/pay-it-forward', icon: 'HandHeart', minLevel: 0 },
  { label: 'My Transactions', href: '/portal/me/transactions', icon: 'ScrollText', minLevel: 0 },
  { label: 'My Causes', href: '/portal/me/causes', icon: 'Heart', minLevel: 0 },
]

const SHARED_OPERATOR_CRM_ITEMS: NavItem = {
  label: 'CRM',
  href: '/crm',
  icon: 'Building2',
  minLevel: 0,
  children: [
    { label: 'Businesses', href: '/crm/businesses', icon: 'Store', minLevel: 0 },
    { label: 'Schools / Causes', href: '/crm/causes', icon: 'Heart', minLevel: 0 },
    { label: 'Customers', href: '/crm/contacts', icon: 'Users', minLevel: 0 },
    { label: 'Cities', href: '/crm/cities', icon: 'MapPin', minLevel: 0 },
    { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', minLevel: 0 },
    { label: 'Outreach', href: '/crm/outreach', icon: 'Send', minLevel: 0 },
    { label: 'Tasks', href: '/crm/tasks', icon: 'CheckSquare', minLevel: 0 },
  ],
}

/**
 * Field, Launch Partner and Influencer — the three "Enabler" shells — share one
 * Materials tab. It is a different surface from `/materials/mine` (the user's own
 * files): this one is about the businesses and causes they are ASSIGNED to, which
 * previously could only be reached by impersonating the account.
 *
 * Declared once so the three shells cannot drift, and exported so `canAccessPath`
 * gates the exact path the nav links to.
 */
export const ENABLER_MATERIALS_NAV_HREF = '/materials/enablers'

const ENABLER_MATERIALS_NAV_ITEM: NavItem = {
  label: 'Materials',
  href: ENABLER_MATERIALS_NAV_HREF,
  icon: 'FileDown',
  minLevel: 0,
}

const FIELD_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  SHARED_OPERATOR_CRM_ITEMS,
  { label: 'My Businesses', href: '/workspace/businesses', icon: 'Store', minLevel: 0 },
  { label: 'My Schools / Causes', href: '/workspace/community', icon: 'Heart', minLevel: 0 },
  { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', minLevel: 0 },
  { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', minLevel: 0 },
  { label: 'My Tasks', href: '/crm/tasks', icon: 'CheckSquare', minLevel: 0 },
  ENABLER_MATERIALS_NAV_ITEM,
  // Renamed from 'Materials': this is the user's OWN library. The assigned-account
  // surface above owns the plain 'Materials' name.
  { label: 'My Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
  { label: 'My Stats', href: '/analytics/me', icon: 'BarChart3', minLevel: 0 },
]

const LAUNCH_PARTNER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  SHARED_OPERATOR_CRM_ITEMS,
  { label: 'My City', href: '/partner/city', icon: 'MapPin', minLevel: 0 },
  { label: 'Businesses', href: '/partner/businesses', icon: 'Store', minLevel: 0 },
  { label: 'Community', href: '/partner/community', icon: 'Heart', minLevel: 0 },
  { label: 'City Requests', href: '/partner/requests', icon: 'UserPlus', minLevel: 0 },
  ENABLER_MATERIALS_NAV_ITEM,
  // Renamed from 'Materials': this is the user's OWN library. The assigned-account
  // surface above owns the plain 'Materials' name.
  { label: 'My Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
]

const COMMUNITY_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'Business', href: '/community/businesses', icon: 'Store', minLevel: 0 },
  { label: 'Supporters', href: '/community/supporters', icon: 'Users', minLevel: 0 },
]

const INFLUENCER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  { label: 'Share', href: '/influencer/share', icon: 'Megaphone', minLevel: 0 },
  { label: 'My Links', href: '/influencer/links', icon: 'QrCode', minLevel: 0 },
  { label: 'Stats', href: '/influencer/stats', icon: 'BarChart3', minLevel: 0 },
  ENABLER_MATERIALS_NAV_ITEM,
  // Renamed from 'Materials': this is the user's OWN library. The assigned-account
  // surface above owns the plain 'Materials' name.
  { label: 'My Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 0 },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  {
    label: 'CRM', href: '/crm', icon: 'Building2', minLevel: 0,
    children: [
      { label: 'Businesses', href: '/crm/businesses', icon: 'Store', minLevel: 0 },
      { label: 'Causes', href: '/crm/causes', icon: 'Heart', minLevel: 0 },
      { label: 'Customers', href: '/crm/contacts', icon: 'Users', minLevel: 0 },
      { label: 'Team', href: '/crm/stakeholders', icon: 'UserCheck', minLevel: 0 },
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
      { label: 'Team', href: '/onboarding/stakeholder', icon: 'UserPlus', minLevel: 0 },
    ],
  },
  { label: 'Analytics', href: '/analytics', icon: 'TrendingUp', minLevel: 0 },
  {
    label: 'Admin', href: '/admin', icon: 'Settings', minLevel: 0,
    children: [
      { label: 'Team', href: '/admin/stakeholders', icon: 'FolderKanban', minLevel: 0 },
      { label: 'Material Tasks', href: '/admin/material-engine/tasks', icon: 'ListChecks', minLevel: 0 },
      { label: 'Template Manager', href: '/admin/material-engine/templates', icon: 'LayoutTemplate', minLevel: 0 },
      // Bulk generation is a write across many accounts at once, so it sits with
      // the other material-engine operator tools rather than in the CRM.
      { label: 'Bulk Generate', href: '/admin/material-engine/bulk-generate', icon: 'Send', minLevel: 0 },
      { label: 'Users', href: '/admin/users', icon: 'Users', minLevel: 0 },
      // Both review queues are SysAdmin-only, so they carry Settings' minLevel
      // rather than the shell default the other admin children use.
      { label: 'Ripple Moderation', href: '/admin/ripple-moderation', icon: 'ShieldAlert', minLevel: 100 },
      { label: 'Business Nominations', href: '/admin/nominations', icon: 'Sparkles', minLevel: 100 },
      { label: 'Settings', href: '/admin/settings', icon: 'Settings', minLevel: 100 },
      { label: 'Bug Center', href: '/admin/bugs', icon: 'Bug', minLevel: 0 },
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

function readMetadataValue(profile: Profile, key: string) {
  const metadata = (profile.metadata as Record<string, unknown> | null) || {}
  return metadata[key]
}

function normalizeQaAudienceValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function readQaRoleSignals(profile: Profile) {
  const metadata = (profile.metadata as Record<string, unknown> | null) || {}
  const qaRoles = Array.isArray(metadata.qa_roles) ? metadata.qa_roles : []
  const qaClaims = (metadata.qa_claims && typeof metadata.qa_claims === 'object') ? metadata.qa_claims as Record<string, unknown> : {}
  const claimRoles = Array.isArray(qaClaims.roles) ? qaClaims.roles : []
  return [
    normalizeQaAudienceValue(metadata.qa_profile_role),
    normalizeQaAudienceValue(qaClaims.role),
    ...qaRoles.map((value) => normalizeQaAudienceValue(value)).filter((value): value is string => !!value),
    ...claimRoles.map((value) => normalizeQaAudienceValue(value)).filter((value): value is string => !!value),
  ].filter((value): value is string => !!value)
}

function isConsumerProfile(profile: Profile) {
  if (profile.role !== 'community' || deriveSubtype(profile) !== null) return false

  const consumerType = normalizeQaAudienceValue(readMetadataValue(profile, 'view_as_consumer_type') ?? readMetadataValue(profile, 'consumer_type'))
  if (consumerType && consumerType !== 'normal' && consumerType !== '0') {
    return false
  }

  const accountType = normalizeQaAudienceValue(readMetadataValue(profile, 'view_as_account_type') ?? readMetadataValue(profile, 'qa_account_type'))
  if (accountType === '4' || accountType === 'consumer') {
    return true
  }

  return readQaRoleSignals(profile).some((signal) => signal.includes('consumer') || signal.includes('customer') || signal.includes('client'))
}

export function getStakeholderShell(profile: Profile): StakeholderShell {
  if (isConsumerProfile(profile)) {
    return 'consumer'
  }

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

  if (shell === 'consumer') {
    return 'Client'
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

export function getPersistedRoleForShell(shell: StakeholderShell, subtype: UserRoleSubtype): UserRole {
  if (shell === 'admin') {
    return subtype === 'super' ? 'super_admin' : subtype === 'internal' ? 'internal_admin' : 'admin'
  }

  if (shell === 'consumer') {
    return 'community'
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
    case 'consumer':
      return 'Search my wallet, transactions, or network...'
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

export interface StakeholderAccessOptions {
  /** Business shell only: drop the Setup item once every setup step is finished. */
  businessSetupComplete?: boolean
  /**
   * Business shell only: this business opted in to the Boomerang list, so it
   * gets the tab. Absent or false hides it — a business that declined, or was
   * never asked, must not see the feature anywhere.
   */
  boomerangEnabled?: boolean
}

function getNavItems(shell: StakeholderShell, options?: StakeholderAccessOptions) {
  switch (shell) {
    case 'business': {
      const items = options?.businessSetupComplete
        ? BUSINESS_NAV_ITEMS.filter((item) => item.href !== BUSINESS_SETUP_NAV_HREF)
        : BUSINESS_NAV_ITEMS
      // Inserted after Grow rather than appended, so the two growth surfaces sit
      // together and Materials stays last.
      if (!options?.boomerangEnabled) return items
      const at = items.findIndex((item) => item.href === '/portal/grow')
      if (at < 0) return [...items, BUSINESS_BOOMERANG_NAV_ITEM]
      return [...items.slice(0, at + 1), BUSINESS_BOOMERANG_NAV_ITEM, ...items.slice(at + 1)]
    }
    case 'consumer':
      return CONSUMER_NAV_ITEMS
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

export function getStakeholderAccess(profile: Profile, options?: StakeholderAccessOptions): StakeholderAccess {
  const shell = getStakeholderShell(profile)
  const subtype = deriveSubtype(profile)

  return {
    shell,
    subtype,
    label: getRoleLabel(shell, subtype),
    themeRole: getPersistedRoleForShell(shell, subtype),
    searchPlaceholder: getSearchPlaceholder(shell),
    navItems: getNavItems(shell, options),
    fallbackPath: '/dashboard',
  }
}

export function canAccessPath(profile: Profile, pathname: string) {
  const { shell } = getStakeholderAccess(profile)
  const operatorCrmPrefixes = [
    '/crm/businesses',
    '/crm/causes',
    '/crm/contacts',
    '/crm/cities',
    '/crm/scripts',
    '/crm/outreach',
    '/crm/tasks',
  ]

  if (shell === 'admin') return true

  if (shell === 'business') {
    return [
      '/dashboard',
      '/portal/setup',
      '/portal/business',
      '/portal/clients',
      '/portal/network',
      '/portal/grow',
      // Reachable by the business shell as a route; whether there is anything to
      // see is decided by the page against the opt-in. Gating it here would
      // depend on business data this function does not have, and a wrong answer
      // while that data loads would lock out a business that did opt in.
      BUSINESS_BOOMERANG_NAV_HREF,
      '/portal/templates',
      '/portal/activity',
      '/portal/materials',
      '/materials/mine',
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  if (shell === 'consumer') {
    return [
      '/dashboard',
      '/portal/me',
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  if (shell === 'field') {
    if (
      pathname === '/dashboard'
      || pathname.startsWith('/workspace')
      || pathname.startsWith('/materials/mine')
      || pathname.startsWith(ENABLER_MATERIALS_NAV_HREF)
      || pathname.startsWith('/analytics/me')
    ) {
      return true
    }

    return operatorCrmPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  if (shell === 'launch_partner') {
    return [
      '/dashboard',
      '/partner/city',
      '/partner/businesses',
      '/partner/community',
      '/partner/requests',
      '/materials/mine',
      ENABLER_MATERIALS_NAV_HREF,
      ...operatorCrmPrefixes,
    ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  if (shell === 'community') {
    return [
      '/dashboard',
      '/community/supporters',
      '/community/businesses',
      '/community/materials',
      '/community/qr',
      '/community/tasks',
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
    ENABLER_MATERIALS_NAV_HREF,
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
