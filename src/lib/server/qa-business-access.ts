import type { Profile } from '@/lib/types/database'
import type { QaBusinessDetail, QaBusinessListItem } from '@/lib/crm-api'
import type { StakeholderShell } from '@/lib/stakeholder-access'

function normalizeEmail(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return trimmed || null
}

function getEmailDomain(value: string | null | undefined) {
  const email = normalizeEmail(value)
  if (!email) return null
  const [, domain] = email.split('@')
  return domain || null
}

export function canAccessQaBusinessRecord(
  shell: StakeholderShell,
  profile: Profile,
  business: QaBusinessListItem | QaBusinessDetail,
) {
  if (shell !== 'business') return true

  const userEmail = normalizeEmail(profile.email)
  const ownerEmail = normalizeEmail(business.ownerEmail)
  if (!userEmail || !ownerEmail) return false
  if (userEmail === ownerEmail) return true

  const userDomain = getEmailDomain(userEmail)
  const ownerDomain = getEmailDomain(ownerEmail)
  return !!userDomain && !!ownerDomain && userDomain === ownerDomain
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
      case 'primaryUserId':
      case 'businessHours':
      case 'socialLinks':
        assign(key, value)
        break
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
      case 'primary_user_id':
        assign('primaryUserId', value)
        break
      case 'category':
        assign('category', value)
        break
      case 'avgTicket':
      case 'avg_ticket':
        assign('avgTicket', value)
        break
      case 'productsServices':
      case 'products_services':
        assign('productsServices', Array.isArray(value) ? value.join(', ') : value)
        break
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
      case 'owner_id':
      case 'owner_user_id':
      case 'source':
      case 'source_detail':
      case 'city_id':
      case 'brand':
      case 'external_id':
      case 'website':
      case 'address':
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
