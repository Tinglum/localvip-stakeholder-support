export type UserRole =
  | 'admin'
  | 'super_admin'
  | 'internal_admin'
  | 'community'
  | 'school_leader'
  | 'cause_leader'
  | 'business'
  | 'field'
  | 'launch_partner'
  | 'business_onboarding'
  | 'influencer'
  | 'affiliate'
  | 'volunteer'
  | 'intern'

export type UserRoleSubtype =
  | 'super'
  | 'internal'
  | 'intern'
  | 'volunteer'
  | 'school'
  | 'cause'
  | null

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
export type BusinessActivationStatus = 'not_started' | 'in_progress' | 'active'
export type BusinessLaunchPhase = 'setup' | 'capturing_100' | 'ready_to_go_live' | 'live'
export type BusinessContactStatus = 'added' | 'invited' | 'joined'
export type OutreachScriptTier = 'good' | 'better' | 'best' | 'ultra'
export type OutreachScriptChannel = 'in_person' | 'text_dm' | 'email' | 'leave_behind'
export type OutreachScriptStatus =
  | 'not_started'
  | 'copied'
  | 'sent'
  | 'delivered'
  | 'replied'
  | 'interested'
  | 'not_interested'
  | 'follow_up_needed'

export type QrCodeFormat = 'png' | 'svg'
export type OfferType = 'capture' | 'cashback'
export type OfferStatus = 'draft' | 'active' | 'paused' | 'archived'
export type BusinessReferralStatus = 'draft' | 'sent' | 'responded' | 'converted' | 'closed'
export type CityAccessRequestStatus = 'pending' | 'approved' | 'declined'
export type StakeholderType =
  | 'business'
  | 'school'
  | 'cause'
  | 'launch_partner'
  | 'influencer'
  | 'field'
  | 'community'
export type MaterialLibraryFolder =
  | 'share_with_customers'
  | 'share_with_businesses'
  | 'share_with_schools'
  | 'share_with_parents'
  | 'share_with_pta'
export type MaterialTemplateOutputFormat = 'svg' | 'png' | 'pdf'
export type GeneratedMaterialStatus = 'pending' | 'generated' | 'failed'
export type AdminTaskStatus = 'needs_setup' | 'ready_to_generate' | 'generated' | 'failed'

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
      offers: {
        Row: Offer
        Insert: Omit<Offer, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Offer, 'id'>>
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
      stakeholders: {
        Row: Stakeholder
        Insert: Omit<Stakeholder, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Stakeholder, 'id'>>
      }
      stakeholder_codes: {
        Row: StakeholderCode
        Insert: Omit<StakeholderCode, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StakeholderCode, 'id'>>
      }
      material_templates: {
        Row: MaterialTemplate
        Insert: Omit<MaterialTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MaterialTemplate, 'id'>>
      }
      generated_materials: {
        Row: GeneratedMaterial
        Insert: Omit<GeneratedMaterial, 'id' | 'updated_at'>
        Update: Partial<Omit<GeneratedMaterial, 'id'>>
      }
      admin_tasks: {
        Row: AdminTask
        Insert: Omit<AdminTask, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AdminTask, 'id'>>
      }
      business_referrals: {
        Row: BusinessReferral
        Insert: Omit<BusinessReferral, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<BusinessReferral, 'id'>>
      }
      city_access_requests: {
        Row: CityAccessRequest
        Insert: Omit<CityAccessRequest, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CityAccessRequest, 'id'>>
      }
      outreach_activities: {
        Row: OutreachActivity
        Insert: Omit<OutreachActivity, 'id' | 'created_at'>
        Update: Partial<Omit<OutreachActivity, 'id'>>
      }
      outreach_scripts: {
        Row: OutreachScript
        Insert: Omit<OutreachScript, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OutreachScript, 'id'>>
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
      outreach_script_tier: OutreachScriptTier
      outreach_script_channel: OutreachScriptChannel
      outreach_script_status: OutreachScriptStatus
      offer_type: OfferType
      offer_status: OfferStatus
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
  role_subtype?: UserRoleSubtype
  brand_context: Brand
  organization_id: string | null
  city_id: string | null
  business_id?: string | null
  phone: string | null
  referral_code: string | null
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface Offer {
  id: string
  business_id: string
  offer_type: OfferType
  status: OfferStatus
  headline: string
  description: string | null
  value_type: string | null
  value_label: string | null
  cashback_percent: number | null
  starts_at: string | null
  ends_at: string | null
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
  owner_user_id?: string | null
  source: string | null
  source_detail: string | null
  campaign_id: string | null
  linked_cause_id: string | null
  linked_material_id: string | null
  linked_qr_code_id: string | null
  linked_qr_collection_id: string | null
  duplicate_of: string | null
  external_id: string | null
  public_description?: string | null
  avg_ticket?: string | null
  products_services?: string[] | null
  activation_status?: BusinessActivationStatus | null
  launch_phase?: BusinessLaunchPhase | null
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
  created_by_user_id?: string | null
  capture_offer_id?: string | null
  source: string | null
  tag?: string | null
  list_status?: BusinessContactStatus | null
  invited_at?: string | null
  joined_at?: string | null
  normalized_email?: string | null
  normalized_phone?: string | null
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
  claimed_at?: string | null
  next_action?: string | null
  next_action_due_date?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
}

export interface Stakeholder {
  id: string
  type: StakeholderType
  name: string
  city_id: string | null
  owner_user_id: string | null
  profile_id: string | null
  business_id: string | null
  cause_id: string | null
  organization_id: string | null
  status: EntityStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface StakeholderCode {
  id: string
  stakeholder_id: string
  referral_code: string
  connection_code: string
  join_url: string
  created_at: string
  updated_at: string
}

export interface MaterialTemplate {
  id: string
  name: string
  source_path: string | null
  template_type: string
  output_format: MaterialTemplateOutputFormat
  audience_tags: string[]
  stakeholder_types: StakeholderType[]
  library_folder: MaterialLibraryFolder
  qr_position_json: Record<string, unknown>
  is_active: boolean
  created_by: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface GeneratedMaterial {
  id: string
  stakeholder_id: string
  template_id: string
  material_id: string | null
  generated_file_url: string | null
  generated_file_name: string | null
  library_folder: MaterialLibraryFolder
  tags: string[]
  generation_status: GeneratedMaterialStatus
  generation_error: string | null
  generated_at: string | null
  updated_at: string
  metadata: Record<string, unknown> | null
}

export interface AdminTask {
  id: string
  stakeholder_id: string
  task_type: string
  title: string
  status: AdminTaskStatus
  payload_json: Record<string, unknown> | null
  due_at: string | null
  created_at: string
  updated_at: string
}

export interface BusinessReferral {
  id: string
  source_business_id: string
  created_by: string | null
  target_business_id?: string | null
  target_business_name: string
  target_city_id: string | null
  target_category: string | null
  target_contact_id?: string | null
  target_contact_name: string | null
  target_contact_email: string | null
  target_contact_phone: string | null
  channel: 'sms' | 'email' | 'link_share' | 'other'
  message_snapshot: string | null
  status: BusinessReferralStatus
  notes: string | null
  converted_business_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CityAccessRequest {
  id: string
  requester_id: string
  requested_city_name: string
  requested_city_id: string | null
  reason: string | null
  status: CityAccessRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface OutreachActivity {
  id: string
  type: OutreachType
  subject: string | null
  body: string | null
  entity_type: 'business' | 'cause' | 'contact'
  entity_id: string
  performed_by: string
  user_id?: string | null
  campaign_id: string | null
  outreach_script_id: string | null
  business_id: string | null
  cause_id: string | null
  city_id: string | null
  contact_id: string | null
  script_category: string | null
  script_type: string | null
  script_tier: OutreachScriptTier | null
  script_channel: OutreachScriptChannel | null
  outreach_status: OutreachScriptStatus | null
  business_category: string | null
  generated_script_content: string | null
  edited_script_content: string | null
  log_notes: string | null
  linked_material_id: string | null
  linked_qr_code_id: string | null
  linked_qr_collection_id: string | null
  outcome: string | null
  next_step: string | null
  next_step_date: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface OutreachScript {
  id: string
  business_id: string
  cause_id: string | null
  campaign_id: string | null
  city_id: string | null
  contact_id: string | null
  created_by: string
  script_category: string
  script_type: string
  script_tier: OutreachScriptTier
  channel: OutreachScriptChannel
  status: OutreachScriptStatus
  business_category: string | null
  generated_content: string
  final_content: string
  was_edited: boolean
  notes: string | null
  copy_count: number
  copied_at: string | null
  sent_at: string | null
  delivered_at: string | null
  replied_at: string | null
  linked_material_id: string | null
  linked_qr_code_id: string | null
  linked_qr_collection_id: string | null
  personalization: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
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
  target_subtypes?: UserRoleSubtype[]
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
