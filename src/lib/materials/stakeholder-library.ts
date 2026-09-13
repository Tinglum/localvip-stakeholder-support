import { materialMatchesTargeting } from '@/lib/materials/material-targeting'
import { getMaterialClassification, type MaterialAudience, type MaterialDelivery } from '@/lib/materials/material-classification'
import { getStakeholderAccess } from '@/lib/stakeholder-access'
import type { Material, Profile } from '@/lib/types/database'
import type { StakeholderShell } from '@/lib/stakeholder-access'

export interface StakeholderMaterialCopy {
  pageTitle: string
  pageDescription: string
  madeTitle: string
  madeDescription: string
  customizeTitle: string
  customizeDescription: string
  resourceTitle: string
  resourceDescription: string
  savedTitle: string
  savedDescription: string
  emptyTitle: string
  emptyDescription: string
}

const COPY: Record<StakeholderShell, StakeholderMaterialCopy> = {
  admin: {
    pageTitle: 'My Materials', pageDescription: 'Files assigned to you and files you have created.',
    madeTitle: 'Made for you', madeDescription: 'Files generated for your account.',
    customizeTitle: 'Customize a template', customizeDescription: 'Choose a design and create your own version.',
    resourceTitle: 'Resource library', resourceDescription: 'Approved files ready to use.',
    savedTitle: 'Saved and recent', savedDescription: 'Your uploads and previously created files.',
    emptyTitle: 'No materials yet', emptyDescription: 'Published materials that match your access will appear here.',
  },
  business: {
    pageTitle: 'Materials', pageDescription: 'Everything you need to invite customers, promote offers, and support your cause.',
    madeTitle: 'Made for your business', madeDescription: 'Files already personalized with your business details, links, and QR codes.',
    customizeTitle: 'Customize a template', customizeDescription: 'Choose an approved design and make it fit your next promotion.',
    resourceTitle: 'Business resource library', resourceDescription: 'General guides and finished files ready to download or share.',
    savedTitle: 'Saved and recent', savedDescription: 'Materials you created or used recently.',
    emptyTitle: 'Your business materials are being prepared', emptyDescription: 'Complete your business profile and offer to unlock personalized materials.',
  },
  community: {
    pageTitle: 'Campaign Materials', pageDescription: 'Recruit supporters, invite businesses, and launch your community campaign.',
    madeTitle: 'Made for your school or cause', madeDescription: 'Files personalized with your name, branding, links, and QR codes.',
    customizeTitle: 'Create campaign materials', customizeDescription: 'Choose an approved template and create a version for your community.',
    resourceTitle: 'Campaign resource library', resourceDescription: 'General supporter, business, and launch materials ready to use.',
    savedTitle: 'Saved and recent', savedDescription: 'Your previously created campaign materials.',
    emptyTitle: 'Your campaign kit is not ready yet', emptyDescription: 'Add your logo, campaign details, and QR code to prepare your first materials.',
  },
  consumer: {
    pageTitle: 'Share LocalVIP', pageDescription: 'Simple ways to invite people and businesses to support your community.',
    madeTitle: 'My links and images', madeDescription: 'Sharing resources connected to your account and chosen cause.',
    customizeTitle: 'Create something to share', customizeDescription: 'Choose a design and make a shareable version.',
    resourceTitle: 'Helpful resources', resourceDescription: 'Approved guides and images you can use right away.',
    savedTitle: 'Saved and recent', savedDescription: 'Things you created or shared recently.',
    emptyTitle: 'Choose a cause to start sharing', emptyDescription: 'Once you choose a cause, your personal links and sharing resources will appear here.',
  },
  field: {
    pageTitle: 'My Outreach Kit', pageDescription: 'Approved materials for today\'s business and community outreach.',
    madeTitle: 'Ready for your assignments', madeDescription: 'Materials prepared for your current outreach work.',
    customizeTitle: 'Prepare outreach materials', customizeDescription: 'Customize an approved template before you contact someone.',
    resourceTitle: 'Training and outreach library', resourceDescription: 'Scripts, flyers, and guides approved for field use.',
    savedTitle: 'Saved and recent', savedDescription: 'Materials you have prepared or used recently.',
    emptyTitle: 'No outreach materials are assigned yet', emptyDescription: 'Materials will appear when a city, campaign, or outreach task is assigned to you.',
  },
  launch_partner: {
    pageTitle: 'Outreach Materials', pageDescription: 'Launch and grow your assigned cities and campaigns.',
    madeTitle: 'Made for your campaign', madeDescription: 'Materials prepared for your assigned city and campaign.',
    customizeTitle: 'Prepare campaign materials', customizeDescription: 'Customize an approved design for local outreach.',
    resourceTitle: 'Launch resource library', resourceDescription: 'Approved business, school, cause, and follow-up materials.',
    savedTitle: 'Saved and recent', savedDescription: 'Materials you prepared or used recently.',
    emptyTitle: 'No campaign materials are assigned yet', emptyDescription: 'Your materials will appear when a city or campaign is assigned to you.',
  },
  influencer: {
    pageTitle: 'Share and Grow', pageDescription: 'Use approved content and your links to introduce more people to LocalVIP.',
    madeTitle: 'My sharing resources', madeDescription: 'Materials connected to your personal referral links.',
    customizeTitle: 'Create something to share', customizeDescription: 'Choose a design and prepare it for your audience.',
    resourceTitle: 'Content library', resourceDescription: 'Approved social content, invitations, and campaign resources.',
    savedTitle: 'Saved and recent', savedDescription: 'Content you created or used recently.',
    emptyTitle: 'Your sharing kit is being prepared', emptyDescription: 'Approved content will appear here when it is available for your campaigns.',
  },
}

function metadata(material: Material) {
  return (material.metadata || {}) as Record<string, unknown>
}

export function getStakeholderMaterialCopy(shell: StakeholderShell) {
  return COPY[shell]
}

export function getMaterialDelivery(material: Material): MaterialDelivery {
  const classification = getMaterialClassification(material)
  if (classification.delivery) return classification.delivery
  const meta = metadata(material)
  const configured = String(meta.delivery_method || meta.delivery || '').toLowerCase()
  if (configured === 'automatic' || configured === 'auto') return 'automatic'
  if (configured === 'customizable' || configured === 'self_service' || configured === 'selfserve') return 'customizable'
  if (configured === 'ready' || configured === 'ready_to_use') return 'ready'

  const tiers = Array.isArray(meta.tiers) ? meta.tiers.map(String) : []
  if (tiers.includes('auto')) return 'automatic'
  if (material.is_template || tiers.includes('selfserve')) return 'customizable'
  return 'ready'
}

export function materialIsAvailableToProfile(
  material: Material,
  profile: Profile,
  accountContext?: { causeAccountId?: string | null; businessAccountId?: string | null },
) {
  if (material.status !== 'active') return false
  const classification = getMaterialClassification(material)
  const access = getStakeholderAccess(profile)
  const audienceByShell: Record<StakeholderShell, MaterialAudience[]> = {
    admin: ['team'], business: ['businesses'], consumer: ['customers'], field: ['team'],
    launch_partner: ['team'], community: access.subtype === 'school' ? ['schools'] : ['causes'], influencer: ['customers'],
  }
  if (!classification.audiences.includes('everyone') && !audienceByShell[access.shell].some(item => classification.audiences.includes(item))) return false
  // Legacy role checks remain as a compatibility guard for records that have
  // not yet been migrated to the canonical classification.
  if (!(metadata(material).material_classification) && !materialMatchesTargeting(material, profile)) return false

  const profileMeta = (profile.metadata || {}) as Record<string, unknown>
  const campaignId = String(profileMeta.campaign_id || profileMeta.campaignId || '')
  const entityIds = classification.availability.entityIds.map(String)
  if (classification.availability.mode === 'internal' && access.shell !== 'admin' && access.shell !== 'field' && access.shell !== 'launch_partner') return false
  if (classification.availability.mode === 'cities' && !entityIds.includes(String(profile.city_id || ''))) return false
  if (classification.availability.mode === 'campaigns' && !entityIds.includes(campaignId)) return false
  if (classification.availability.mode === 'causes'
    && !entityIds.some(id => id === String(accountContext?.causeAccountId || '') || id === String(profile.organization_id || ''))) return false
  if (classification.availability.mode === 'businesses'
    && !entityIds.some(id => id === String(accountContext?.businessAccountId || '') || id === String(profile.business_id || ''))) return false
  return true
}

export function explainMaterialAvailability(material: Material, profile: Profile) {
  const delivery = getMaterialDelivery(material)
  const classification = getMaterialClassification(material)
  const audience = material.target_roles?.length ? 'your account type' : 'all LocalVIP members'
  if (classification.availability.mode === 'campaigns') return `Available because you are part of the selected campaign. ${delivery === 'automatic' ? 'This version was prepared for your account.' : ''}`.trim()
  if (classification.availability.mode === 'cities') return `Available in your city for ${audience}.`
  if (delivery === 'automatic') return 'Prepared for your account using an approved LocalVIP template.'
  if (delivery === 'customizable') return `Available for ${audience} to customize.`
  return `Available to ${audience}.`
}
