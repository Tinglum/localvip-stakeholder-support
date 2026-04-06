import type { Business, EntityStatus, OnboardingStage } from '@/lib/types/database'

export interface QaBusinessListItem {
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

export interface QaBusinessDetail extends QaBusinessListItem {
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
  hasStripeOnboarding: boolean
}

export type CrmBusinessOrigin = 'local' | 'qa' | 'hybrid'

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
  business: Business
  localBusinessId: string | null
  qaBusinessId: number | null
  origin: CrmBusinessOrigin
  qaBusiness: QaBusinessDetail | null
  qaError: string | null
  readOnly: boolean
}
