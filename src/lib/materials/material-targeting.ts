import {
  CANONICAL_STAKEHOLDER_ROLES,
  STAKEHOLDER_SUBTYPE_OPTIONS,
  getStakeholderAccess,
} from '@/lib/stakeholder-access'
import type {
  Material,
  Profile,
  UserRole,
  UserRoleSubtype,
} from '@/lib/types/database'

const LEGACY_ROLE_TO_CANONICAL: Partial<Record<UserRole, UserRole>> = {
  super_admin: 'admin',
  internal_admin: 'admin',
  school_leader: 'community',
  cause_leader: 'community',
  business_onboarding: 'launch_partner',
  volunteer: 'field',
  intern: 'field',
  affiliate: 'influencer',
}

const SUBTYPE_LABELS: Record<Exclude<UserRoleSubtype, null>, string> = {
  super: 'Super',
  internal: 'Internal',
  intern: 'Intern',
  volunteer: 'Volunteer',
  school: 'School',
  cause: 'Cause',
}

export const MATERIAL_VISIBILITY_ROLE_OPTIONS = CANONICAL_STAKEHOLDER_ROLES.map((role) => ({
  value: role.value,
  label: role.label,
}))

export const MATERIAL_VISIBILITY_SUBTYPE_OPTIONS = Object.values(STAKEHOLDER_SUBTYPE_OPTIONS)
  .flat()
  .filter((option, index, array) => array.findIndex((item) => item.value === option.value) === index)

function normalizeMaterialRole(role: UserRole) {
  return LEGACY_ROLE_TO_CANONICAL[role] || role
}

function getMetadata(material: Material) {
  return ((material.metadata as Record<string, unknown> | null) || {})
}

export function getMaterialCustomTags(material: Material) {
  const metadata = getMetadata(material)
  const rawTags = metadata.material_tags || metadata.audience_tags

  if (Array.isArray(rawTags)) {
    return rawTags
      .map((tag) => `${tag}`.trim())
      .filter(Boolean)
  }

  if (typeof rawTags === 'string') {
    return rawTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  return []
}

export function withUpdatedMaterialCustomTags(
  material: Material,
  tags: string[],
) {
  const metadata = { ...getMetadata(material) }
  const cleaned = tags.map((tag) => tag.trim()).filter(Boolean)

  if (cleaned.length > 0) {
    metadata.material_tags = cleaned
    metadata.audience_tags = cleaned
  } else {
    delete metadata.material_tags
    delete metadata.audience_tags
  }

  return metadata
}

export function getMaterialVisibilityRoleLabels(material: Material) {
  const seen = new Set<string>()
  const labels: string[] = []

  material.target_roles.forEach((role) => {
    const canonical = normalizeMaterialRole(role)
    if (seen.has(canonical)) return
    seen.add(canonical)
    labels.push(
      MATERIAL_VISIBILITY_ROLE_OPTIONS.find((option) => option.value === canonical)?.label
      || canonical
    )
  })

  return labels
}

export function getMaterialVisibilitySubtypeLabels(material: Material) {
  return (material.target_subtypes || [])
    .filter((subtype): subtype is Exclude<UserRoleSubtype, null> => !!subtype)
    .map((subtype) => SUBTYPE_LABELS[subtype] || subtype)
}

export function materialMatchesTargeting(material: Material, profile: Profile) {
  const access = getStakeholderAccess(profile)
  const targetRoles = (material.target_roles || []).map(normalizeMaterialRole)

  if (targetRoles.length === 0) return false

  const roleMatches = targetRoles.includes(access.shell) || targetRoles.includes(normalizeMaterialRole(profile.role))
  if (!roleMatches) return false

  const targetSubtypes = (material.target_subtypes || []).filter(Boolean)
  if (targetSubtypes.length === 0) return true

  return !!access.subtype && targetSubtypes.includes(access.subtype)
}
