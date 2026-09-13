import type { Material, UserRole, UserRoleSubtype } from '@/lib/types/database'

export type MaterialAudience = 'customers' | 'businesses' | 'schools' | 'causes' | 'team' | 'everyone'
export type MaterialPurpose =
  | 'learn'
  | 'join'
  | 'invite_customers'
  | 'recruit_businesses'
  | 'recruit_causes'
  | 'promote_offer'
  | 'promote_give_back_day'
  | 'payments_rewards'
  | 'onboarding'
  | 'training'
export type MaterialAvailabilityMode = 'everywhere' | 'cities' | 'campaigns' | 'causes' | 'businesses' | 'internal'
export type MaterialDelivery = 'ready' | 'customizable' | 'automatic'

export interface MaterialClassification {
  audiences: MaterialAudience[]
  purpose: MaterialPurpose | ''
  availability: { mode: MaterialAvailabilityMode; entityIds: string[] }
  delivery: MaterialDelivery
}

export const MATERIAL_AUDIENCES: { value: MaterialAudience; label: string; help: string }[] = [
  { value: 'customers', label: 'Customers and families', help: 'People who shop locally and support causes' },
  { value: 'businesses', label: 'Businesses', help: 'Business owners and their teams' },
  { value: 'schools', label: 'Schools', help: 'School leaders and school communities' },
  { value: 'causes', label: 'Causes and nonprofits', help: 'Cause leaders, clubs, and nonprofits' },
  { value: 'team', label: 'LocalVIP team', help: 'Internal staff and approved field teams' },
  { value: 'everyone', label: 'Everyone', help: 'All eligible LocalVIP accounts' },
]

export const MATERIAL_PURPOSES: { value: MaterialPurpose; label: string }[] = [
  { value: 'learn', label: 'Learn about LocalVIP' },
  { value: 'join', label: 'Join LocalVIP' },
  { value: 'invite_customers', label: 'Invite customers and supporters' },
  { value: 'recruit_businesses', label: 'Recruit businesses' },
  { value: 'recruit_causes', label: 'Recruit schools or causes' },
  { value: 'promote_offer', label: 'Promote an offer' },
  { value: 'promote_give_back_day', label: 'Promote a Give Back Day' },
  { value: 'payments_rewards', label: 'Explain payments and rewards' },
  { value: 'onboarding', label: 'Complete onboarding' },
  { value: 'training', label: 'Training and internal support' },
]

export const MATERIAL_AVAILABILITY: { value: MaterialAvailabilityMode; label: string }[] = [
  { value: 'everywhere', label: 'Available everywhere' },
  { value: 'cities', label: 'Selected cities' },
  { value: 'campaigns', label: 'Selected campaigns' },
  { value: 'causes', label: 'Selected schools or causes' },
  { value: 'businesses', label: 'Selected businesses' },
  { value: 'internal', label: 'Internal only' },
]

export const MATERIAL_DELIVERIES: { value: MaterialDelivery; label: string; help: string }[] = [
  { value: 'ready', label: 'Ready to use', help: 'People can open, download, or share the finished file.' },
  { value: 'customizable', label: 'Offer for customization', help: 'Eligible people can create their own version when they need it.' },
  { value: 'automatic', label: 'Automatically create it', help: 'Create a personalized version for every matching account.' },
]

const PURPOSE_TO_LEGACY: Record<MaterialPurpose, string> = {
  learn: 'general', join: 'general', invite_customers: 'customer_capture', recruit_businesses: 'partner_outreach',
  recruit_causes: 'cause_onboarding', promote_offer: 'business_to_consumer', promote_give_back_day: 'community_mobilization',
  payments_rewards: 'general', onboarding: 'business_onboarding', training: 'internal_training',
}

export function classificationToLegacy(classification: MaterialClassification) {
  const audiences = classification.audiences.includes('everyone') ? [] : classification.audiences
  const roles = new Set<UserRole>()
  if (audiences.includes('customers') || audiences.includes('schools') || audiences.includes('causes')) roles.add('community')
  if (audiences.includes('businesses')) roles.add('business')
  if (audiences.includes('team')) roles.add('admin')
  const subtypes: Exclude<UserRoleSubtype, null>[] = []
  // A customer audience combined with school or cause cannot be represented by
  // legacy subtype gating. Keep the broad community role and let canonical rules
  // provide the exact match.
  if (!audiences.includes('customers')) {
    if (audiences.includes('schools')) subtypes.push('school')
    if (audiences.includes('causes')) subtypes.push('cause')
  }
  return {
    target_roles: [...roles],
    target_subtypes: subtypes,
    use_case: classification.purpose ? PURPOSE_TO_LEGACY[classification.purpose] : null,
  }
}

export function withMaterialClassification(metadata: Material['metadata'], classification: MaterialClassification) {
  return { ...((metadata as Record<string, unknown> | null) || {}), material_classification: classification }
}

export function classificationToStorageFields(classification: MaterialClassification) {
  const ids = classification.availability.entityIds.map(Number).filter(Number.isFinite)
  const requiredFields = classification.delivery === 'automatic'
    ? ['logo', 'qr_code', ...(classification.purpose === 'promote_offer' || classification.purpose === 'promote_give_back_day' ? ['active_offer'] : [])]
    : []
  return {
    audiences_json: JSON.stringify(classification.audiences),
    primary_purpose: classification.purpose || null,
    secondary_purpose: null,
    availability_mode: classification.availability.mode === 'everywhere' ? 'global' : classification.availability.mode,
    availability_json: JSON.stringify({
      cityIds: classification.availability.mode === 'cities' ? ids : [],
      campaignIds: classification.availability.mode === 'campaigns' ? ids : [],
      causeIds: classification.availability.mode === 'causes' ? ids : [],
      businessIds: classification.availability.mode === 'businesses' ? ids : [],
      requiredFields,
    }),
    delivery_mode: classification.delivery,
    search_tags_json: '[]',
  }
}

export function getMaterialClassification(material: Material): MaterialClassification {
  const stored = ((material.metadata as Record<string, unknown> | null)?.material_classification || null) as MaterialClassification | null
  if (stored?.audiences?.length && stored.availability?.mode && stored.delivery) return stored
  const audiences = new Set<MaterialAudience>()
  if (!material.target_roles?.length) audiences.add('everyone')
  if (material.target_roles?.some((role) => role === 'business')) audiences.add('businesses')
  if (material.target_roles?.some((role) => role === 'admin' || role === 'super_admin' || role === 'internal_admin')) audiences.add('team')
  if (material.target_roles?.some((role) => role === 'community')) {
    if (material.target_subtypes?.includes('school')) audiences.add('schools')
    if (material.target_subtypes?.includes('cause')) audiences.add('causes')
    if (!material.target_subtypes?.length) audiences.add('customers')
  }
  return {
    audiences: audiences.size ? [...audiences] : ['everyone'],
    purpose: '',
    availability: material.campaign_id
      ? { mode: 'campaigns', entityIds: [material.campaign_id] }
      : material.city_id ? { mode: 'cities', entityIds: [material.city_id] } : { mode: 'everywhere', entityIds: [] },
    delivery: material.is_template ? 'customizable' : 'ready',
  }
}
