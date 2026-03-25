export type UserRole =
  | 'super_admin'
  | 'internal_admin'
  | 'school_leader'
  | 'cause_leader'
  | 'business_onboarding'
  | 'influencer'
  | 'affiliate'
  | 'volunteer'
  | 'intern'

export type Brand = 'localvip' | 'hato'

export type EntityStatus = 'active' | 'inactive' | 'pending' | 'archived'

export type OnboardingStage =
  | 'lead'
  | 'contacted'
  | 'interested'
  | 'in_progress'
  | 'onboarded'
  | 'live'
  | 'paused'
  | 'declined'

export type OutreachType =
  | 'call'
  | 'email'
  | 'text'
  | 'in_person'
  | 'social_media'
  | 'referral'
  | 'other'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type QrCodeFormat = 'png' | 'svg'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      organizations: {
        Row: Organization
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Organization, 'id'>>
      }
      cities: {
        Row: City
        Insert: Omit<City, 'id' | 'created_at'>
        Update: Partial<Omit<City, 'id'>>
      }
      campaigns: {
        Row: Campaign
        Insert: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Campaign, 'id'>>
      }
      businesses: {
        Row: Business
        Insert: Omit<Business, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Business, 'id'>>
      }
      causes: {
        Row: Cause
        Insert: Omit<Cause, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Cause, 'id'>>
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Contact, 'id'>>
      }
      stakeholder_assignments: {
        Row: StakeholderAssignment
        Insert: Omit<StakeholderAssignment, 'id' | 'created_at'>
        Update: Partial<Omit<StakeholderAssignment, 'id'>>
      }
      outreach_activities: {
        Row: OutreachActivity
        Insert: Omit<OutreachActivity, 'id' | 'created_at'>
        Update: Partial<Omit<OutreachActivity, 'id'>>
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Task, 'id'>>
      }
      notes: {
        Row: Note
        Insert: Omit<Note, 'id' | 'created_at'>
        Update: Partial<Omit<Note, 'id'>>
      }
      onboarding_flows: {
        Row: OnboardingFlow
        Insert: Omit<OnboardingFlow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OnboardingFlow, 'id'>>
      }
      onboarding_steps: {
        Row: OnboardingStep
        Insert: Omit<OnboardingStep, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OnboardingStep, 'id'>>
      }
      materials: {
        Row: Material
        Insert: Omit<Material, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Material, 'id'>>
      }
      material_assignments: {
        Row: MaterialAssignment
        Insert: Omit<MaterialAssignment, 'id' | 'created_at'>
        Update: Partial<Omit<MaterialAssignment, 'id'>>
      }
      qr_codes: {
        Row: QrCode
        Insert: Omit<QrCode, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<QrCode, 'id'>>
      }
      qr_code_collections: {
        Row: QrCodeCollection
        Insert: Omit<QrCodeCollection, 'id' | 'created_at'>
        Update: Partial<Omit<QrCodeCollection, 'id'>>
      }
      qr_code_events: {
        Row: QrCodeEvent
        Insert: Omit<QrCodeEvent, 'id' | 'scanned_at'>
        Update: Partial<Omit<QrCodeEvent, 'id'>>
      }
      redirects: {
        Row: Redirect
        Insert: Omit<Redirect, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Redirect, 'id'>>
      }
      referrals: {
        Row: Referral
        Insert: Omit<Referral, 'id' | 'created_at'>
        Update: Partial<Omit<Referral, 'id'>>
      }
      analytics_rollups: {
        Row: AnalyticsRollup
        Insert: Omit<AnalyticsRollup, 'id' | 'created_at'>
        Update: Partial<Omit<AnalyticsRollup, 'id'>>
      }
      tags: {
        Row: Tag
        Insert: Omit<Tag, 'id'>
        Update: Partial<Omit<Tag, 'id'>>
      }
      entity_tags: {
        Row: EntityTag
        Insert: Omit<EntityTag, 'id'>
        Update: Partial<Omit<EntityTag, 'id'>>
      }
      audit_logs: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      brand: Brand
      entity_status: EntityStatus
      onboarding_stage: OnboardingStage
      outreach_type: OutreachType
      task_priority: TaskPriority
      task_status: TaskStatus
    }
  }
}

// ─── Row Types ───────────────────────────────────────────────

export interface Profile {
  id: string // references auth.users.id
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  brand_context: Brand
  organization_id: string | null
  city_id: string | null
  phone: string | null
  referral_code: string | null
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  type: 'school' | 'nonprofit' | 'church' | 'company' | 'government' | 'other'
  brand: Brand
  city_id: string | null
  website: string | null
  email: string | null
  phone: string | null
  address: string | null
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface City {
  id: string
  name: string
  state: string
  country: string
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Campaign {
  id: string
  name: string
  description: string | null
  brand: Brand
  city_id: string | null
  start_date: string | null
  end_date: string | null
  status: EntityStatus
  owner_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Business {
  id: string
  name: string
  website: string | null
  email: string | null
  phone: string | null
  address: string | null
  city_id: string | null
  category: string | null
  brand: Brand
  stage: OnboardingStage
  owner_id: string | null
  source: string | null
  source_detail: string | null
  campaign_id: string | null
  duplicate_of: string | null
  external_id: string | null
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Cause {
  id: string
  name: string
  type: 'school' | 'nonprofit' | 'church' | 'community' | 'other'
  organization_id: string | null
  website: string | null
  email: string | null
  phone: string | null
  address: string | null
  city_id: string | null
  brand: Brand
  stage: OnboardingStage
  owner_id: string | null
  source: string | null
  source_detail: string | null
  campaign_id: string | null
  duplicate_of: string | null
  external_id: string | null
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  business_id: string | null
  cause_id: string | null
  organization_id: string | null
  owner_id: string | null
  source: string | null
  duplicate_of: string | null
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface StakeholderAssignment {
  id: string
  stakeholder_id: string // profile id
  entity_type: 'business' | 'cause' | 'campaign' | 'city'
  entity_id: string
  role: string | null
  assigned_by: string | null
  status: EntityStatus
  created_at: string
}

export interface OutreachActivity {
  id: string
  type: OutreachType
  subject: string | null
  body: string | null
  entity_type: 'business' | 'cause' | 'contact'
  entity_id: string
  performed_by: string
  campaign_id: string | null
  outcome: string | null
  next_step: string | null
  next_step_date: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_to: string | null
  created_by: string
  entity_type: string | null
  entity_id: string | null
  due_date: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  content: string
  entity_type: 'business' | 'cause' | 'contact' | 'campaign' | 'onboarding_flow'
  entity_id: string
  created_by: string
  is_internal: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface OnboardingFlow {
  id: string
  name: string
  entity_type: 'business' | 'cause' | 'stakeholder'
  entity_id: string
  brand: Brand
  stage: OnboardingStage
  owner_id: string | null
  campaign_id: string | null
  started_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface OnboardingStep {
  id: string
  flow_id: string
  title: string
  description: string | null
  sort_order: number
  is_required: boolean
  is_completed: boolean
  completed_by: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Material {
  id: string
  title: string
  description: string | null
  type: 'one_pager' | 'flyer' | 'pdf' | 'script' | 'email_template' | 'print_asset' | 'qr_asset' | 'other'
  brand: Brand
  file_url: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  thumbnail_url: string | null
  category: string | null
  use_case: string | null
  target_roles: UserRole[]
  campaign_id: string | null
  city_id: string | null
  is_template: boolean
  version: number
  status: EntityStatus
  created_by: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface MaterialAssignment {
  id: string
  material_id: string
  stakeholder_id: string
  assigned_by: string | null
  created_at: string
}

export interface QrCode {
  id: string
  name: string
  short_code: string
  destination_url: string
  redirect_url: string // the trackable URL that redirects
  brand: Brand
  logo_url: string | null
  foreground_color: string
  background_color: string
  frame_text: string | null
  campaign_id: string | null
  city_id: string | null
  stakeholder_id: string | null
  business_id: string | null
  cause_id: string | null
  collection_id: string | null
  destination_preset: string | null
  scan_count: number
  version: number
  status: EntityStatus
  created_by: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface QrCodeCollection {
  id: string
  name: string
  description: string | null
  brand: Brand
  created_by: string
  status: EntityStatus
  created_at: string
}

export interface QrCodeEvent {
  id: string
  qr_code_id: string
  event_type: 'scan' | 'redirect' | 'signup' | 'conversion'
  ip_address: string | null
  user_agent: string | null
  referrer: string | null
  city: string | null
  country: string | null
  metadata: Record<string, unknown> | null
  scanned_at: string
}

export interface Redirect {
  id: string
  short_code: string
  destination_url: string
  qr_code_id: string | null
  click_count: number
  status: EntityStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface Referral {
  id: string
  referrer_id: string
  referral_code: string
  entity_type: 'business' | 'cause' | 'user'
  entity_id: string | null
  campaign_id: string | null
  status: 'pending' | 'converted' | 'expired'
  converted_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AnalyticsRollup {
  id: string
  period: 'daily' | 'weekly' | 'monthly'
  period_start: string
  dimension_type: string // 'city', 'campaign', 'stakeholder', 'material', 'qr_code'
  dimension_id: string
  metric: string
  value: number
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Tag {
  id: string
  name: string
  category: string | null
}

export interface EntityTag {
  id: string
  tag_id: string
  entity_type: string
  entity_id: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
