import type { UserRole, Brand, OnboardingStage, EntityStatus, TaskPriority } from '@/lib/types/database'

// ─── Role definitions ────────────────────────────────────────

export const ROLES: Record<UserRole, { label: string; description: string; level: number }> = {
  super_admin: { label: 'Super Admin', description: 'Full system access', level: 100 },
  internal_admin: { label: 'Internal Admin', description: 'Manage operations', level: 90 },
  school_leader: { label: 'School Leader', description: 'Manage school onboarding', level: 50 },
  cause_leader: { label: 'Cause Leader', description: 'Manage cause onboarding', level: 50 },
  business_onboarding: { label: 'Onboarding Partner', description: 'Onboard businesses', level: 40 },
  influencer: { label: 'Influencer', description: 'Promote and refer', level: 30 },
  affiliate: { label: 'Affiliate', description: 'Referral partner', level: 30 },
  volunteer: { label: 'Volunteer', description: 'Community support', level: 20 },
  intern: { label: 'Intern', description: 'Training and support', level: 20 },
}

export const ADMIN_ROLES: UserRole[] = ['super_admin', 'internal_admin']
export const LEADER_ROLES: UserRole[] = ['school_leader', 'cause_leader']
export const PARTNER_ROLES: UserRole[] = ['business_onboarding', 'influencer', 'affiliate']
export const FIELD_ROLES: UserRole[] = ['volunteer', 'intern']

export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role)
}

export function hasMinLevel(role: UserRole, minLevel: number): boolean {
  return ROLES[role].level >= minLevel
}

// ─── Role theme colors ──────────────────────────────────────
export const ROLE_THEMES: Record<UserRole, { primary: string; accent: string; bg: string; sidebar: string; label: string }> = {
  super_admin:        { primary: '#dc2626', accent: '#ef4444', bg: 'bg-red-50',     sidebar: 'border-red-500',    label: 'Super Admin' },
  internal_admin:     { primary: '#ea580c', accent: '#f97316', bg: 'bg-orange-50',  sidebar: 'border-orange-500', label: 'Internal Admin' },
  school_leader:      { primary: '#0891b2', accent: '#06b6d4', bg: 'bg-cyan-50',    sidebar: 'border-cyan-500',   label: 'School Leader' },
  cause_leader:       { primary: '#7c3aed', accent: '#8b5cf6', bg: 'bg-violet-50',  sidebar: 'border-violet-500', label: 'Cause Leader' },
  business_onboarding:{ primary: '#2563eb', accent: '#3b82f6', bg: 'bg-blue-50',    sidebar: 'border-blue-500',   label: 'Onboarding Partner' },
  influencer:         { primary: '#db2777', accent: '#ec4899', bg: 'bg-pink-50',    sidebar: 'border-pink-500',   label: 'Influencer' },
  affiliate:          { primary: '#059669', accent: '#10b981', bg: 'bg-emerald-50', sidebar: 'border-emerald-500',label: 'Affiliate' },
  volunteer:          { primary: '#ca8a04', accent: '#eab308', bg: 'bg-yellow-50',  sidebar: 'border-yellow-500', label: 'Volunteer' },
  intern:             { primary: '#6366f1', accent: '#818cf8', bg: 'bg-indigo-50',  sidebar: 'border-indigo-500', label: 'Intern' },
}

// ─── Role-specific tools/links ──────────────────────────────
export const ROLE_TOOLS: Record<UserRole, { label: string; href: string; icon: string; description: string }[]> = {
  super_admin: [
    { label: 'User Management', href: '/admin/users', icon: 'Users', description: 'Manage all team members' },
    { label: 'System Analytics', href: '/analytics', icon: 'TrendingUp', description: 'Platform-wide metrics' },
    { label: 'Audit Log', href: '/admin/audit', icon: 'ScrollText', description: 'Review all actions' },
    { label: 'All Campaigns', href: '/campaigns', icon: 'Megaphone', description: 'Manage campaigns' },
  ],
  internal_admin: [
    { label: 'User Management', href: '/admin/users', icon: 'Users', description: 'Manage team members' },
    { label: 'Analytics', href: '/analytics', icon: 'TrendingUp', description: 'Platform metrics' },
    { label: 'Campaigns', href: '/campaigns', icon: 'Megaphone', description: 'Manage campaigns' },
    { label: 'CRM Overview', href: '/crm/businesses', icon: 'Store', description: 'All businesses' },
  ],
  school_leader: [
    { label: 'My Schools', href: '/crm/causes', icon: 'Heart', description: 'Schools I manage' },
    { label: 'Business Contacts', href: '/crm/businesses', icon: 'Store', description: 'Local businesses' },
    { label: 'Generate QR Code', href: '/qr/generator', icon: 'QrCode', description: 'Create QR codes' },
    { label: 'My Materials', href: '/materials/mine', icon: 'FileDown', description: 'HATO materials' },
  ],
  cause_leader: [
    { label: 'My Causes', href: '/crm/causes', icon: 'Heart', description: 'Causes I lead' },
    { label: 'Business Pipeline', href: '/onboarding/business', icon: 'Store', description: 'Onboarding pipeline' },
    { label: 'QR Codes', href: '/qr/mine', icon: 'QrCode', description: 'My QR codes' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Download materials' },
  ],
  business_onboarding: [
    { label: 'My Businesses', href: '/onboarding/business', icon: 'Store', description: 'Businesses I onboard' },
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record activities' },
    { label: 'QR Codes', href: '/qr/mine', icon: 'QrCode', description: 'My QR codes' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Onboarding materials' },
  ],
  influencer: [
    { label: 'My QR Codes', href: '/qr/mine', icon: 'QrCode', description: 'Share & track' },
    { label: 'Generate QR', href: '/qr/generator', icon: 'Plus', description: 'Create new QR' },
    { label: 'My Stats', href: '/analytics', icon: 'BarChart3', description: 'Track your impact' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Promo materials' },
  ],
  affiliate: [
    { label: 'My QR Codes', href: '/qr/mine', icon: 'QrCode', description: 'Share & track' },
    { label: 'My Stats', href: '/analytics', icon: 'BarChart3', description: 'Referral metrics' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Marketing materials' },
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record activities' },
  ],
  volunteer: [
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record visits & calls' },
    { label: 'My Tasks', href: '/crm/tasks', icon: 'CheckSquare', description: 'Action items' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Scripts & flyers' },
    { label: 'My QR Code', href: '/qr/mine', icon: 'QrCode', description: 'Your personal QR' },
  ],
  intern: [
    { label: 'My Tasks', href: '/crm/tasks', icon: 'CheckSquare', description: 'Assigned tasks' },
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record activities' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Training materials' },
    { label: 'My Stats', href: '/analytics', icon: 'BarChart3', description: 'Track progress' },
  ],
}

// ─── Brand definitions ───────────────────────────────────────

export const BRANDS: Record<Brand, { label: string; color: string; accent: string }> = {
  localvip: { label: 'LocalVIP', color: '#2563eb', accent: '#3b82f6' },
  hato: { label: 'Help A Teacher Out', color: '#ec8012', accent: '#f29a36' },
}

// ─── Stage definitions ───────────────────────────────────────

export const ONBOARDING_STAGES: Record<OnboardingStage, { label: string; color: string; order: number }> = {
  lead: { label: 'Lead', color: 'neutral', order: 0 },
  contacted: { label: 'Contacted', color: 'info', order: 1 },
  interested: { label: 'Interested', color: 'info', order: 2 },
  in_progress: { label: 'In Progress', color: 'warning', order: 3 },
  onboarded: { label: 'Onboarded', color: 'success', order: 4 },
  live: { label: 'Live', color: 'success', order: 5 },
  paused: { label: 'Paused', color: 'warning', order: 6 },
  declined: { label: 'Declined', color: 'danger', order: 7 },
}

export const STATUS_COLORS: Record<EntityStatus, string> = {
  active: 'chip-success',
  inactive: 'chip-neutral',
  pending: 'chip-warning',
  archived: 'chip-neutral',
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'chip-neutral',
  medium: 'chip-info',
  high: 'chip-warning',
  urgent: 'chip-danger',
}

// ─── Navigation ──────────────────────────────────────────────

export interface NavItem {
  label: string
  href: string
  icon: string
  children?: NavItem[]
  minLevel: number
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', minLevel: 0 },
  {
    label: 'CRM', href: '/crm', icon: 'Building2', minLevel: 40,
    children: [
      { label: 'Businesses', href: '/crm/businesses', icon: 'Store', minLevel: 40 },
      { label: 'Causes', href: '/crm/causes', icon: 'Heart', minLevel: 40 },
      { label: 'Contacts', href: '/crm/contacts', icon: 'Users', minLevel: 40 },
      { label: 'Stakeholders', href: '/crm/stakeholders', icon: 'UserCheck', minLevel: 40 },
      { label: 'Cities', href: '/crm/cities', icon: 'MapPin', minLevel: 40 },
      { label: 'Outreach', href: '/crm/outreach', icon: 'Send', minLevel: 20 },
      { label: 'Tasks', href: '/crm/tasks', icon: 'CheckSquare', minLevel: 20 },
    ],
  },
  {
    label: 'QR Codes', href: '/qr', icon: 'QrCode', minLevel: 20,
    children: [
      { label: 'Generator', href: '/qr/generator', icon: 'Plus', minLevel: 20 },
      { label: 'My QR Codes', href: '/qr/mine', icon: 'QrCode', minLevel: 20 },
      { label: 'Collections', href: '/qr/collections', icon: 'FolderOpen', minLevel: 40 },
      { label: 'Analytics', href: '/qr/analytics', icon: 'BarChart3', minLevel: 20 },
    ],
  },
  {
    label: 'Materials', href: '/materials', icon: 'FileText', minLevel: 20,
    children: [
      { label: 'Library', href: '/materials/library', icon: 'Library', minLevel: 20 },
      { label: 'My Materials', href: '/materials/mine', icon: 'FileDown', minLevel: 20 },
    ],
  },
  { label: 'Campaigns', href: '/campaigns', icon: 'Megaphone', minLevel: 40 },
  {
    label: 'Onboarding', href: '/onboarding', icon: 'Rocket', minLevel: 20,
    children: [
      { label: 'Business', href: '/onboarding/business', icon: 'Store', minLevel: 40 },
      { label: 'Cause', href: '/onboarding/cause', icon: 'Heart', minLevel: 40 },
      { label: 'Stakeholder', href: '/onboarding/stakeholder', icon: 'UserPlus', minLevel: 90 },
    ],
  },
  {
    label: 'Business Portal', href: '/portal', icon: 'Briefcase', minLevel: 0,
    children: [
      { label: 'My Business', href: '/portal/business', icon: 'Store', minLevel: 0 },
    ],
  },
  { label: 'Analytics', href: '/analytics', icon: 'TrendingUp', minLevel: 20 },
  {
    label: 'Admin', href: '/admin', icon: 'Settings', minLevel: 90,
    children: [
      { label: 'Users', href: '/admin/users', icon: 'Users', minLevel: 90 },
      { label: 'Roles', href: '/admin/roles', icon: 'Shield', minLevel: 100 },
      { label: 'Settings', href: '/admin/settings', icon: 'Settings', minLevel: 100 },
      { label: 'Audit Log', href: '/admin/audit', icon: 'ScrollText', minLevel: 90 },
    ],
  },
]

// ─── QR Code Destination Presets ─────────────────────────────

export const QR_DESTINATION_PRESETS = [
  { value: 'localvip_consumer', label: 'LocalVIP Consumer Landing', urlTemplate: 'https://localvip.com' },
  { value: 'localvip_business', label: 'LocalVIP Business Page', urlTemplate: 'https://localvip.com/business' },
  { value: 'localvip_cause', label: 'LocalVIP Cause Page', urlTemplate: 'https://localvip.com/cause' },
  { value: 'hato_landing', label: 'HATO Landing Page', urlTemplate: 'https://helpateacherout.com' },
  { value: 'referral', label: 'Stakeholder Referral Page', urlTemplate: 'https://localvip.com/ref/{code}' },
  { value: 'campaign', label: 'Campaign Landing', urlTemplate: 'https://localvip.com/c/{slug}' },
  { value: 'custom', label: 'Custom URL', urlTemplate: '' },
] as const

// ─── Material categories ─────────────────────────────────────

export const MATERIAL_TYPES = [
  { value: 'one_pager', label: 'One-Pager' },
  { value: 'flyer', label: 'Flyer' },
  { value: 'pdf', label: 'PDF Document' },
  { value: 'script', label: 'Outreach Script' },
  { value: 'email_template', label: 'Email Template' },
  { value: 'print_asset', label: 'Print Asset' },
  { value: 'qr_asset', label: 'QR-Linked Asset' },
  { value: 'other', label: 'Other' },
] as const

export const MATERIAL_USE_CASES = [
  { value: 'business_onboarding', label: 'Business Onboarding' },
  { value: 'cause_onboarding', label: 'Cause Onboarding' },
  { value: 'volunteer_outreach', label: 'Volunteer Outreach' },
  { value: 'influencer_outreach', label: 'Influencer Outreach' },
  { value: 'general', label: 'General' },
] as const
