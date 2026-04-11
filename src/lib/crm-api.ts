import type {
  AdminTask,
  Business,
  Campaign,
  Cause,
  City,
  Contact,
  EntityStatus,
  GeneratedMaterial,
  Material,
  Note,
  OnboardingFlow,
  OnboardingStage,
  OnboardingStep,
  Offer,
  OutreachActivity,
  Profile,
  QrCode,
  Stakeholder,
  StakeholderAssignment,
  StakeholderCode,
  Task,
} from '@/lib/types/database'

export interface QaDashboardAccountSummary {
  id: number
  name: string
  headline: string | null
  ownerName: string | null
  ownerEmail: string | null
  city: string | null
  state: string | null
  country: string | null
  createdDate: string
  active: boolean
}

export interface QaDashboardAccountDetail extends QaDashboardAccountSummary {
  description: string | null
  ownerPhone: string | null
  address1: string | null
  address2: string | null
  zipCode: string | null
  fullAddress: string | null
  imageUrl: string | null
  marketing: number | null
  txFee: number | null
  salesTax: number | null
  taxId: string | null
  timeZone: string | null
  hasStripeOnboarding?: boolean | null
}

export type QaBusinessListItem = QaDashboardAccountSummary

export interface QaBusinessDetail extends QaDashboardAccountDetail {
  hasStripeOnboarding: boolean
}

export type QaCauseListItem = QaDashboardAccountSummary
export type QaCauseDetail = QaDashboardAccountDetail

export type CrmRecordOrigin = 'local' | 'qa' | 'hybrid'
export type CrmBusinessOrigin = CrmRecordOrigin
export type CrmCauseOrigin = CrmRecordOrigin

export interface QaAccountFields {
  qa_account_id?: number | null
  qa_account_type?: number | null
  qa_business_type?: number | null
  headline?: string | null
  description?: string | null
  owner_name?: string | null
  owner_email?: string | null
  owner_phone?: string | null
  address1?: string | null
  address2?: string | null
  city_name?: string | null
  state?: string | null
  country?: string | null
  zip_code?: string | null
  full_address?: string | null
  latitude?: number | null
  longitude?: number | null
  distance_meter?: number | null
  distance_kilometer?: number | null
  distance_feet?: number | null
  distance_mile?: number | null
  active?: boolean | null
  image_url?: string | null
  sales_tax?: number | null
  tax_id?: string | null
  marketing?: number | null
  tx_fee?: number | null
  time_zone?: string | null
  twilio_number?: string | null
  twilio_welcome_message?: string | null
  is_deleted?: boolean | null
  stripe_onboarding_complete?: boolean | null
}

export interface CrmBusiness extends Business, QaAccountFields {}
export interface CrmCause extends Cause, QaAccountFields {}

export interface CrmBusinessListItem {
  rowId: string
  detailHref: string
  localBusinessId: string | null
  qaBusinessId: number | null
  origin: CrmBusinessOrigin
  name: string
  headline: string | null
  ownerName: string | null
  ownerEmail: string | null
  city: string | null
  owner_name: string | null
  owner_email: string | null
  city_name: string | null
  state: string | null
  country: string | null
  active: boolean | null
  stage: OnboardingStage | null
  status: EntityStatus | null
  category: string | null
  source: string | null
  updatedAt: string | null
  createdAt: string | null
  duplicateOf: string | null
}

export interface CrmBusinessesResponse {
  items: CrmBusinessListItem[]
  qaError: string | null
}

export interface CrmBusinessDetailResponse {
  business: CrmBusiness
  localBusinessId: string | null
  qaBusinessId: number | null
  origin: CrmBusinessOrigin
  qaBusiness: QaBusinessDetail | null
  qaError: string | null
  readOnly: boolean
}

export interface CrmBusinessLocalStateResponse {
  businessId: string
  profiles: Profile[]
  cities: City[]
  causes: Cause[]
  campaigns: Campaign[]
  qrCodes: QrCode[]
  materials: Material[]
  stakeholders: Stakeholder[]
  generatedMaterials: GeneratedMaterial[]
  assignments: StakeholderAssignment[]
  outreach: OutreachActivity[]
  tasks: Task[]
  notes: Note[]
  flows: OnboardingFlow[]
  steps: OnboardingStep[]
  offers: Offer[]
  contacts: Contact[]
  adminTasks: AdminTask[]
  stakeholderCodes: StakeholderCode[]
}

export interface CrmCauseListItem {
  rowId: string
  detailHref: string
  localCauseId: string | null
  qaCauseId: number | null
  origin: CrmCauseOrigin
  name: string
  type: Cause['type'] | null
  headline: string | null
  ownerName: string | null
  ownerEmail: string | null
  city: string | null
  owner_name: string | null
  owner_email: string | null
  city_name: string | null
  state: string | null
  country: string | null
  active: boolean | null
  stage: OnboardingStage | null
  status: EntityStatus | null
  brand: Cause['brand'] | null
  source: string | null
  updatedAt: string | null
  createdAt: string | null
  duplicateOf: string | null
}

export interface CrmCausesResponse {
  items: CrmCauseListItem[]
  qaError: string | null
}

export interface CrmCauseDetailResponse {
  cause: CrmCause
  localCauseId: string | null
  qaCauseId: number | null
  origin: CrmCauseOrigin
  qaCause: QaCauseDetail | null
  qaError: string | null
  readOnly: boolean
}
