import type { UserRole, Brand, OnboardingStage, EntityStatus, TaskPriority } from '@/lib/types/database'

// ─── Role definitions ────────────────────────────────────────

export const ROLES: Record<UserRole, { label: string; description: string; level: number }> = {
  admin: { label: 'Admin', description: 'Full system access', level: 100 },
  super_admin: { label: 'Super Admin', description: 'Full system access', level: 100 },
  internal_admin: { label: 'Internal Admin', description: 'Manage operations', level: 90 },
  community: { label: 'Community', description: 'Mobilize supporters and local participation', level: 50 },
  school_leader: { label: 'School Leader', description: 'Manage school onboarding', level: 50 },
  cause_leader: { label: 'Cause Leader', description: 'Manage cause onboarding', level: 50 },
  business: { label: 'Business', description: 'Manage one business portal', level: 0 },
  field: { label: 'Field', description: 'Activate businesses and community outreach', level: 20 },
  launch_partner: { label: 'Launch Partner', description: 'Grow assigned cities', level: 40 },
  business_onboarding: { label: 'Onboarding Partner', description: 'Onboard businesses', level: 40 },
  influencer: { label: 'Influencer', description: 'Promote and refer', level: 30 },
  affiliate: { label: 'Affiliate', description: 'Referral partner', level: 30 },
  volunteer: { label: 'Volunteer', description: 'Community support', level: 20 },
  intern: { label: 'Intern', description: 'Training and support', level: 20 },
}

export const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin', 'internal_admin']
export const LEADER_ROLES: UserRole[] = ['community', 'school_leader', 'cause_leader']
export const PARTNER_ROLES: UserRole[] = ['launch_partner', 'business_onboarding', 'influencer', 'affiliate']
export const FIELD_ROLES: UserRole[] = ['field', 'volunteer', 'intern']

export function isAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role)
}

export function hasMinLevel(role: UserRole, minLevel: number): boolean {
  return ROLES[role].level >= minLevel
}

// ─── Role theme colors ──────────────────────────────────────
export const ROLE_THEMES: Record<UserRole, { primary: string; accent: string; bg: string; sidebar: string; label: string }> = {
  admin:              { primary: '#1e3a8a', accent: '#1e40af', bg: 'bg-blue-50',    sidebar: 'border-blue-900',   label: 'Admin' },
  super_admin:        { primary: '#1e3a8a', accent: '#1e40af', bg: 'bg-blue-50',    sidebar: 'border-blue-900',   label: 'Super Admin' },
  internal_admin:     { primary: '#1d4ed8', accent: '#3b82f6', bg: 'bg-blue-50',    sidebar: 'border-blue-700',   label: 'Internal Admin' },
  community:          { primary: '#db2777', accent: '#f472b6', bg: 'bg-pink-50',    sidebar: 'border-pink-600',   label: 'Community' },
  school_leader:      { primary: '#db2777', accent: '#f472b6', bg: 'bg-pink-50',    sidebar: 'border-pink-600',   label: 'School Leader' },
  cause_leader:       { primary: '#e11d48', accent: '#fb7185', bg: 'bg-rose-50',    sidebar: 'border-rose-600',   label: 'Cause Leader' },
  business:           { primary: '#d97706', accent: '#84cc16', bg: 'bg-amber-50',   sidebar: 'border-amber-500',  label: 'Business' },
  field:              { primary: '#6366f1', accent: '#a5b4fc', bg: 'bg-indigo-50',  sidebar: 'border-indigo-400', label: 'Field' },
  launch_partner:     { primary: '#b45309', accent: '#84cc16', bg: 'bg-amber-50',   sidebar: 'border-amber-600',  label: 'Launch Partner' },
  business_onboarding:{ primary: '#d97706', accent: '#65a30d', bg: 'bg-amber-50',   sidebar: 'border-amber-600',  label: 'Onboarding Partner' },
  influencer:         { primary: '#7c3aed', accent: '#a78bfa', bg: 'bg-violet-50',  sidebar: 'border-violet-500', label: 'Influencer' },
  affiliate:          { primary: '#4f46e5', accent: '#818cf8', bg: 'bg-indigo-50',  sidebar: 'border-indigo-500', label: 'Affiliate' },
  volunteer:          { primary: '#d97706', accent: '#f59e0b', bg: 'bg-amber-50',   sidebar: 'border-amber-500',  label: 'Volunteer' },
  intern:             { primary: '#6366f1', accent: '#a5b4fc', bg: 'bg-indigo-50',  sidebar: 'border-indigo-400', label: 'Intern' },
}

// ─── Role-specific tools/links ──────────────────────────────
export const ROLE_TOOLS: Record<UserRole, { label: string; href: string; icon: string; description: string }[]> = {
  admin: [
    { label: 'User Management', href: '/admin/users', icon: 'Users', description: 'Manage all team members' },
    { label: 'System Analytics', href: '/analytics', icon: 'TrendingUp', description: 'Platform-wide metrics' },
    { label: 'Audit Log', href: '/admin/audit', icon: 'ScrollText', description: 'Review all actions' },
    { label: 'All Campaigns', href: '/campaigns', icon: 'Megaphone', description: 'Manage campaigns' },
  ],
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
  community: [
    { label: 'Supporters', href: '/community/supporters', icon: 'Users', description: 'See your supporter list' },
    { label: 'Share', href: '/community/share', icon: 'Megaphone', description: 'Grow your supporter base' },
    { label: 'Activity', href: '/community/activity', icon: 'BarChart3', description: 'Track supporter growth' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Community mobilization materials' },
    { label: 'Template Library', href: '/portal/templates', icon: 'LayoutTemplate', description: 'Browse and add templates' },
  ],
  business: [
    { label: 'Setup', href: '/portal/setup', icon: 'Rocket', description: 'Complete your business setup' },
    { label: 'My Business', href: '/portal/business', icon: 'Store', description: 'Update your business profile' },
    { label: 'My 100 List', href: '/portal/clients', icon: 'Users', description: 'Build your supporter list' },
    { label: 'Grow with Other Businesses', href: '/portal/grow', icon: 'Megaphone', description: 'Invite nearby businesses' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Customer-facing materials only' },
    { label: 'Template Library', href: '/portal/templates', icon: 'LayoutTemplate', description: 'Browse and add templates' },
    { label: 'Activity', href: '/portal/activity', icon: 'BarChart3', description: 'Track invites and joins' },
  ],
  field: [
    { label: 'My Businesses', href: '/workspace/businesses', icon: 'Store', description: 'Your active business list' },
    { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', description: 'Generate tailored local scripts' },
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record touchpoints' },
    { label: 'My Tasks', href: '/crm/tasks', icon: 'CheckSquare', description: 'Assigned work' },
    { label: 'My Stats', href: '/analytics/me', icon: 'BarChart3', description: 'Track your impact' },
  ],
  launch_partner: [
    { label: 'My City', href: '/partner/city', icon: 'MapPin', description: 'Watch your city performance' },
    { label: 'Businesses', href: '/partner/businesses', icon: 'Store', description: 'Grow the business pipeline' },
    { label: 'Community', href: '/partner/community', icon: 'Heart', description: 'Track schools and causes' },
    { label: 'City Requests', href: '/partner/requests', icon: 'UserPlus', description: 'Request new city access' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Launch-partner materials' },
  ],
  business_onboarding: [
    { label: 'My Businesses', href: '/onboarding/business', icon: 'Store', description: 'Businesses I onboard' },
    { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', description: 'Generate tailored scripts fast' },
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record activities' },
    { label: 'QR Codes', href: '/qr/mine', icon: 'QrCode', description: 'My QR codes' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Onboarding materials' },
  ],
  influencer: [
    { label: 'Share Dashboard', href: '/influencer/share', icon: 'Megaphone', description: 'Drive local referrals' },
    { label: 'My Links', href: '/influencer/links', icon: 'QrCode', description: 'Track personal share assets' },
    { label: 'My Stats', href: '/influencer/stats', icon: 'BarChart3', description: 'Track your impact' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Referral materials' },
  ],
  affiliate: [
    { label: 'My QR Codes', href: '/qr/mine', icon: 'QrCode', description: 'Share & track' },
    { label: 'My Stats', href: '/analytics', icon: 'BarChart3', description: 'Referral metrics' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Marketing materials' },
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record activities' },
  ],
  volunteer: [
    { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', description: 'Use guided local scripts' },
    { label: 'Log Outreach', href: '/crm/outreach', icon: 'Send', description: 'Record visits & calls' },
    { label: 'My Tasks', href: '/crm/tasks', icon: 'CheckSquare', description: 'Action items' },
    { label: 'Materials', href: '/materials/mine', icon: 'FileDown', description: 'Scripts & flyers' },
    { label: 'My QR Code', href: '/qr/mine', icon: 'QrCode', description: 'Your personal QR' },
  ],
  intern: [
    { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', description: 'Generate business-specific scripts' },
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

/** Community-friendly labels for cause/school leaders viewing business status */
export const COMMUNITY_BUSINESS_STATUS: Record<OnboardingStage, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  lead: { label: 'New', variant: 'default' },
  contacted: { label: 'Reached Out', variant: 'info' },
  interested: { label: 'Interested', variant: 'info' },
  in_progress: { label: 'Setting Up', variant: 'warning' },
  onboarded: { label: 'Ready', variant: 'success' },
  live: { label: 'Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  declined: { label: 'Not Participating', variant: 'danger' },
}

/** Community-friendly labels for the cause/school's own status */
export const COMMUNITY_CAUSE_STATUS: Record<OnboardingStage, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  lead: { label: 'Getting Started', variant: 'default' },
  contacted: { label: 'Getting Started', variant: 'info' },
  interested: { label: 'Getting Started', variant: 'info' },
  in_progress: { label: 'Setting Up', variant: 'warning' },
  onboarded: { label: 'Almost Ready', variant: 'success' },
  live: { label: 'Live & Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  declined: { label: 'Inactive', variant: 'danger' },
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
      { label: 'Outreach Scripts', href: '/crm/scripts', icon: 'FileText', minLevel: 20 },
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

export const MATERIAL_CATEGORIES = [
  { value: 'customer_capture', label: 'Customer Capture' },
  { value: 'localvip_live', label: 'LocalVIP Live' },
  { value: 'business_to_business', label: 'Business to Business' },
  { value: 'business_to_consumer', label: 'Business to Consumer' },
  { value: 'field_outreach', label: 'Field Outreach' },
  { value: 'launch_partner', label: 'Launch Partner' },
  { value: 'community_mobilization', label: 'Community Mobilization' },
  { value: 'influencer_referral', label: 'Influencer Referral' },
  { value: 'admin_internal', label: 'Admin Internal' },
  { value: 'business_onboarding', label: 'Business Onboarding' },
  { value: 'partner_outreach', label: 'Partner Outreach' },
  { value: 'internal_training', label: 'Internal Training' },
  { value: 'general', label: 'General' },
] as const
