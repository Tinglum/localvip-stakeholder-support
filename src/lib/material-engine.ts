import type {
  MaterialLibraryFolder,
  StakeholderType,
  UserRole,
} from '@/lib/types/database'
import { slugify } from '@/lib/utils'

export const MATERIAL_LIBRARY_FOLDERS: Array<{
  value: MaterialLibraryFolder
  label: string
  description: string
}> = [
  {
    value: 'share_with_customers',
    label: 'Share with Customers',
    description: 'QR posters, in-store flyers, and table cards.',
  },
  {
    value: 'share_with_businesses',
    label: 'Share with Businesses',
    description: 'Partnership invites and B2B one-pagers.',
  },
  {
    value: 'share_with_schools',
    label: 'Share with Schools',
    description: 'Outreach materials and school-facing explainers.',
  },
  {
    value: 'share_with_parents',
    label: 'Share with Parents',
    description: 'Simple explanation and signup flyers for families.',
  },
  {
    value: 'share_with_pta',
    label: 'Share with PTA',
    description: 'Structured pitch materials for PTA and school leaders.',
  },
]

export function getMaterialLibraryFolderMeta(folder: MaterialLibraryFolder) {
  return MATERIAL_LIBRARY_FOLDERS.find((item) => item.value === folder) || MATERIAL_LIBRARY_FOLDERS[0]
}

export function getMaterialEngineBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  if (configured) return configured
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return 'https://localvip.com'
}

export function getStakeholderJoinPath(type: StakeholderType, connectionCode: string) {
  const code = normalizeStakeholderCode(connectionCode) || 'localvip'
  if (type === 'school' || type === 'cause' || type === 'community') {
    return `/support/${code}`
  }
  return `/join/${code}`
}

export function buildStakeholderJoinUrl(type: StakeholderType, connectionCode: string, baseUrl = getMaterialEngineBaseUrl()) {
  return `${baseUrl}${getStakeholderJoinPath(type, connectionCode)}`
}

export function buildStakeholderRedirectUrl(referralCode: string, baseUrl = getMaterialEngineBaseUrl()) {
  return `${baseUrl}/r/${normalizeStakeholderCode(referralCode) || 'localvip'}`
}

export function getQrPurposeForStakeholderType(type: StakeholderType) {
  if (type === 'business') return 'business_capture'
  if (type === 'school' || type === 'cause' || type === 'community') return 'community_supporter'
  if (type === 'influencer') return 'influencer_referral'
  return 'stakeholder_join'
}

export function normalizeStakeholderCode(value: string) {
  return slugify(value).slice(0, 64)
}

export function getTargetRolesForStakeholderType(type: StakeholderType): UserRole[] {
  if (type === 'business') return ['business']
  if (type === 'school' || type === 'cause' || type === 'community') return ['community']
  if (type === 'launch_partner') return ['launch_partner']
  if (type === 'influencer') return ['influencer']
  return ['field']
}

export function getMaterialCategoryForFolder(folder: MaterialLibraryFolder) {
  switch (folder) {
    case 'share_with_customers':
      return 'customer_capture'
    case 'share_with_businesses':
      return 'business_to_business'
    case 'share_with_schools':
      return 'field_outreach'
    case 'share_with_parents':
    case 'share_with_pta':
      return 'community_mobilization'
    default:
      return 'general'
  }
}

export function getAudienceLabel(tags: string[]) {
  if (tags.includes('customers')) return 'Customers'
  if (tags.includes('businesses')) return 'Businesses'
  if (tags.includes('schools')) return 'Schools'
  if (tags.includes('parents')) return 'Parents'
  if (tags.includes('pta')) return 'PTA'
  return 'Audience'
}

export function fillTemplateText(template: string | null | undefined, values: Record<string, string | null | undefined>) {
  const source = template || ''
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return values[key] || ''
  }).replace(/\n{3,}/g, '\n\n').trim()
}

export function toDisplayUrl(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.host}${parsed.pathname}`
  } catch {
    return url.replace(/^https?:\/\//, '')
  }
}

export function sanitizeFilenamePart(value: string) {
  return slugify(value).slice(0, 60) || 'material'
}
