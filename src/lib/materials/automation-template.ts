import { getMaterialCustomTags } from '@/lib/materials/material-targeting'
import { getQrPlacements, hasQrPlacements } from '@/lib/materials/qr-placement'
import type {
  Material,
  MaterialLibraryFolder,
  MaterialTemplateOutputFormat,
  StakeholderType,
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
  stakeholderTypes: ['business'],
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

export function getMaterialAutomationTemplateConfig(material: Material | Pick<Material, 'metadata' | 'is_template'> | null | undefined): MaterialAutomationTemplateConfig {
  const metadata = getMetadata(material)
  const raw = metadata.automation_template
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}

  const stakeholderTypes = parseStringList(source.stakeholder_types)
    .filter((type): type is StakeholderType => AUTOMATION_TEMPLATE_STAKEHOLDER_TYPES.includes(type as StakeholderType))

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
  const metadata = {
    ...getMetadata(material),
    automation_template: {
      enabled: config.enabled,
      is_active: config.isActive,
      stakeholder_types: config.stakeholderTypes,
      audience_tags: config.audienceTags,
      library_folder: config.libraryFolder,
      qr_zone_count: getQrPlacements(material.metadata as Record<string, unknown> | null).length,
    },
  }

  return metadata
}
