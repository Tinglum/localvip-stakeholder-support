import { getMaterialCustomTags } from '@/lib/materials/material-targeting'
import { getQrPlacements, hasQrPlacements } from '@/lib/materials/qr-placement'
import type {
  Material,
  MaterialLibraryFolder,
  MaterialTemplateOutputFormat,
  StakeholderType,
  UserRole,
  UserRoleSubtype,
} from '@/lib/types/database'

export const AUTOMATION_TEMPLATE_STAKEHOLDER_TYPES: StakeholderType[] = [
  'business',
  'school',
  'cause',
  'community',
  'launch_partner',
  'field',
  'influencer',
]

export interface MaterialAutomationTemplateConfig {
  enabled: boolean
  isActive: boolean
  stakeholderTypes: StakeholderType[]
  audienceTags: string[]
  libraryFolder: MaterialLibraryFolder
}

const DEFAULT_TEMPLATE_CONFIG: MaterialAutomationTemplateConfig = {
  enabled: false,
  isActive: true,
  stakeholderTypes: [],
  audienceTags: [],
  libraryFolder: 'share_with_customers',
}

function getMetadata(material: Pick<Material, 'metadata'> | null | undefined) {
  return ((material?.metadata as Record<string, unknown> | null) || {})
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }

  return [] as string[]
}

function uniqueStakeholderTypes(values: Array<StakeholderType | null | undefined>) {
  return values.filter((value): value is StakeholderType => !!value)
    .filter((value, index, array) => array.indexOf(value) === index)
}

function mapRoleToStakeholderTypes(role: UserRole): StakeholderType[] {
  switch (role) {
    case 'business':
      return ['business']
    case 'community':
    case 'school_leader':
    case 'cause_leader':
      return ['community']
    case 'launch_partner':
    case 'business_onboarding':
      return ['launch_partner']
    case 'field':
    case 'intern':
    case 'volunteer':
      return ['field']
    case 'influencer':
    case 'affiliate':
      return ['influencer']
    default:
      return []
  }
}

function mapSubtypeToStakeholderTypes(subtype: Exclude<UserRoleSubtype, null>): StakeholderType[] {
  switch (subtype) {
    case 'school':
      return ['school', 'community']
    case 'cause':
      return ['cause', 'community']
    case 'intern':
    case 'volunteer':
      return ['field']
    default:
      return []
  }
}

function mapTagToStakeholderTypes(tag: string): StakeholderType[] {
  const normalized = tag.trim().toLowerCase()
  if (!normalized) return []
  if (['business', 'businesses', 'b2b'].includes(normalized)) return ['business']
  if (['school', 'schools', 'pta'].includes(normalized)) return ['school', 'community']
  if (['cause', 'causes', 'nonprofit', 'non-profit', 'church'].includes(normalized)) return ['cause', 'community']
  if (['community', 'parents', 'parent'].includes(normalized)) return ['community']
  if (['launch_partner', 'launch partner', 'partners'].includes(normalized)) return ['launch_partner']
  if (['field', 'intern', 'volunteer', 'outreach'].includes(normalized)) return ['field']
  if (['influencer', 'referral'].includes(normalized)) return ['influencer']
  return []
}

export function deriveMaterialAutomationStakeholderTypes(
  material: Pick<Material, 'target_roles' | 'target_subtypes' | 'metadata' | 'is_template'> | null | undefined,
) {
  if (!material) return [] as StakeholderType[]

  const metadata = getMetadata(material)
  const customTags = Array.from(new Set([
    ...getMaterialCustomTags(material as Material),
    ...parseStringList((metadata.automation_template as Record<string, unknown> | undefined)?.audience_tags),
  ]))

  const derivedFromRoles = (material.target_roles || []).flatMap((role) => mapRoleToStakeholderTypes(role))
  const derivedFromSubtypes = (material.target_subtypes || [])
    .filter((subtype): subtype is Exclude<UserRoleSubtype, null> => !!subtype)
    .flatMap((subtype) => mapSubtypeToStakeholderTypes(subtype))
  const derivedFromTags = customTags.flatMap((tag) => mapTagToStakeholderTypes(tag))

  return uniqueStakeholderTypes([
    ...derivedFromRoles,
    ...derivedFromSubtypes,
    ...derivedFromTags,
  ])
}

export function getMaterialAutomationTemplateConfig(material: Material | Pick<Material, 'metadata' | 'is_template'> | null | undefined): MaterialAutomationTemplateConfig {
  const metadata = getMetadata(material)
  const raw = metadata.automation_template
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}

  const explicitStakeholderTypes = parseStringList(source.stakeholder_types)
    .filter((type): type is StakeholderType => AUTOMATION_TEMPLATE_STAKEHOLDER_TYPES.includes(type as StakeholderType))
  const derivedStakeholderTypes = deriveMaterialAutomationStakeholderTypes(material as Material)
  const stakeholderTypes = explicitStakeholderTypes.length > 0
    ? explicitStakeholderTypes
    : derivedStakeholderTypes

  const audienceTags = parseStringList(source.audience_tags)
  const libraryFolder = typeof source.library_folder === 'string'
    ? source.library_folder as MaterialLibraryFolder
    : DEFAULT_TEMPLATE_CONFIG.libraryFolder

  return {
    enabled: Boolean(source.enabled ?? material?.is_template ?? false),
    isActive: source.is_active === false ? false : true,
    stakeholderTypes: stakeholderTypes.length > 0 ? stakeholderTypes : [...DEFAULT_TEMPLATE_CONFIG.stakeholderTypes],
    audienceTags,
    libraryFolder,
  }
}

export function materialSupportsAutomationTemplate(material: Material | null | undefined) {
  if (!material?.file_url) return false
  return hasQrPlacements(material.metadata as Record<string, unknown> | null)
}

export function getMaterialAutomationTemplateOutputFormat(material: Material): MaterialTemplateOutputFormat {
  if (material.mime_type === 'application/pdf') return 'pdf'
  return 'png'
}

export function getMaterialAutomationAudienceTags(material: Material) {
  const config = getMaterialAutomationTemplateConfig(material)
  if (config.audienceTags.length > 0) return config.audienceTags
  return getMaterialCustomTags(material)
}

export function withUpdatedMaterialAutomationTemplate(
  material: Material,
  config: MaterialAutomationTemplateConfig,
) {
  const derivedStakeholderTypes = deriveMaterialAutomationStakeholderTypes(material)
  const stakeholderTypes = config.stakeholderTypes.length > 0
    ? config.stakeholderTypes
    : derivedStakeholderTypes
  const metadata = {
    ...getMetadata(material),
    automation_template: {
      enabled: config.enabled,
      is_active: config.isActive,
      stakeholder_types: stakeholderTypes,
      audience_tags: config.audienceTags,
      library_folder: config.libraryFolder,
      qr_zone_count: getQrPlacements(material.metadata as Record<string, unknown> | null).length,
    },
  }

  return metadata
}
