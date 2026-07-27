import type { Profile } from '@/lib/types/database'
import type { QaBusinessDetail, QaBusinessListItem } from '@/lib/crm-api'
import type { StakeholderShell } from '@/lib/stakeholder-access'

function normalizeEmail(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return trimmed || null
}

function getQaUserId(profile: Profile) {
  const metadata = profile.metadata as Record<string, unknown> | null
  const claims = metadata?.qa_claims && typeof metadata.qa_claims === 'object'
    ? metadata.qa_claims as Record<string, unknown>
    : null
  const candidate = metadata?.qa_subject ?? metadata?.qa_user_id ?? claims?.sub
  if (typeof candidate !== 'string' && typeof candidate !== 'number') return null
  const parsed = Number(candidate)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function numericId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export function canAccessQaBusinessRecord(
  shell: StakeholderShell,
  profile: Profile,
  business: QaBusinessListItem | QaBusinessDetail,
) {
  if (shell !== 'business') return true

  const userEmail = normalizeEmail(profile.email)
  const ownerEmail = normalizeEmail(business.ownerEmail)
  if (userEmail && ownerEmail && userEmail === ownerEmail) return true

  const userQaId = getQaUserId(profile)
  const ownerUserId = business.ownerUserId
    ?? (business as QaBusinessListItem & { primaryUserId?: number | null }).primaryUserId
  return userQaId !== null
    && ownerUserId !== null
    && ownerUserId !== undefined
    && userQaId === ownerUserId
}

export function filterQaBusinessesForAccess(
  shell: StakeholderShell,
  profile: Profile,
  businesses: QaBusinessListItem[],
) {
  if (shell !== 'business') return businesses
  return businesses.filter((business) => canAccessQaBusinessRecord(shell, profile, business))
}

export function normalizeQaBusinessSetupPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {}
  const unsupportedFields: string[] = []

  const assign = (key: string, value: unknown) => {
    if (value === undefined) return
    payload[key] = value
  }

  for (const [key, value] of Object.entries(body)) {
    switch (key) {
      case 'name':
      case 'headline':
      case 'ownerName':
      case 'ownerEmail':
      case 'ownerPhone':
      case 'address1':
      case 'address2':
      case 'city':
      case 'state':
      case 'zipCode':
      case 'country':
      case 'businessHours':
      case 'socialLinks':
        assign(key, value)
        break
      case 'primaryUserId': {
        const primaryUserId = numericId(value)
        if (primaryUserId !== null) assign('primaryUserId', primaryUserId)
        else unsupportedFields.push(key)
        break
      }
      case 'email':
        assign('ownerEmail', value)
        break
      case 'phone':
        assign('ownerPhone', value)
        break
      case 'public_description':
      case 'description':
        assign('description', value)
        break
      case 'business_hours':
        assign('businessHours', value)
        break
      case 'social_links':
        assign('socialLinks', value)
        break
      case 'owner_name':
        assign('ownerName', value)
        break
      case 'owner_email':
        assign('ownerEmail', value)
        break
      case 'owner_phone':
        assign('ownerPhone', value)
        break
      case 'zip_code':
        assign('zipCode', value)
        break
      case 'zip':
        assign('zipCode', value)
        break
      case 'address':
        assign('address1', value)
        break
      case 'primary_user_id': {
        const primaryUserId = numericId(value)
        if (primaryUserId !== null) assign('primaryUserId', primaryUserId)
        else unsupportedFields.push(key)
        break
      }
      case 'owner_id':
      case 'owner_user_id': {
        const ownerUserId = numericId(value)
        if (ownerUserId !== null) assign('primaryUserId', ownerUserId)
        else unsupportedFields.push(key)
        break
      }
      case 'category':
        assign('category', value)
        break
      case 'businessType':
      case 'business_type': {
        if (value === null || value === undefined || value === '') break
        const businessType = Number(value)
        if (Number.isInteger(businessType) && businessType >= 1 && businessType <= 6) {
          assign('businessType', businessType)
        } else {
          unsupportedFields.push(key)
        }
        break
      }
      case 'avgTicket':
      case 'avg_ticket':
        assign('avgTicket', value)
        break
      case 'productsServices':
      case 'products_services':
        assign('productsServices', Array.isArray(value) ? value.join(', ') : value)
        break
      case 'hundredListInterest':
      case 'hundred_list_interest':
        assign('hundredListInterest', value)
        break
      case 'hundredListInterestRecordedAt':
      case 'hundred_list_interest_recorded_at':
        assign('hundredListInterestRecordedAt', value)
        break
      case 'hundredListActivationStatus':
      case 'hundred_list_activation_status':
        assign('hundredListActivationStatus', value)
        break
      case 'hundredListSetupStartedAt':
      case 'hundred_list_setup_started_at':
        assign('hundredListSetupStartedAt', value)
        break
      case 'hundredListSetupStartedBy':
      case 'hundred_list_setup_started_by': {
        const userId = numericId(value)
        if (userId !== null) assign('hundredListSetupStartedBy', userId)
        break
      }
      case 'hundredListActivatedAt':
      case 'hundred_list_activated_at':
        assign('hundredListActivatedAt', value)
        break
      case 'hundredListActivatedBy':
      case 'hundred_list_activated_by': {
        const userId = numericId(value)
        if (userId !== null) assign('hundredListActivatedBy', userId)
        break
      }
      case 'metadata':
      case 'stage':
      case 'launch_phase':
      case 'activation_status':
      case 'linked_cause_id':
      case 'linked_material_id':
      case 'linked_qr_code_id':
      case 'linked_qr_collection_id':
      case 'campaign_id':
      case 'duplicate_of':
      case 'status':
      case 'source':
      case 'source_detail':
      case 'city_id':
      case 'brand':
      case 'external_id':
      case 'marketing':
      case 'txFee':
      case 'tx_fee':
      case 'salesTax':
      case 'sales_tax':
      case 'taxId':
      case 'tax_id':
      case 'timeZone':
      case 'time_zone':
      case 'logoUrl':
      case 'logo_url':
      case 'coverPhotoUrl':
      case 'cover_photo_url':
        unsupportedFields.push(key)
        break
      case 'website':
        // QA accepts SocialLinks writes but does not return SocialLinks from
        // business detail. A blind website write could erase existing links.
        unsupportedFields.push(key)
        break
      default:
        unsupportedFields.push(key)
        break
    }
  }

  return {
    payload,
    unsupportedFields,
  }
}
