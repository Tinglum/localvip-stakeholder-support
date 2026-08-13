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

/**
 * Which role each subtype belongs to. Subtype values are unique across shells
 * (super/internal are Admin, intern/volunteer are Field, school/cause are
 * Community), so a flat reverse map is exact.
 *
 * This is the fact the old flat subtype row hid: a subtype is not a free-floating
 * audience, it belongs to exactly one role.
 */
const SUBTYPE_TO_ROLE = Object.entries(STAKEHOLDER_SUBTYPE_OPTIONS).reduce(
  (map, [shell, options]) => {
    options.forEach((option) => { map[option.value] = shell as UserRole })
    return map
  },
  {} as Record<string, UserRole>,
)

/** The subtype chips a role owns. Empty for Business, Launch Partner, Influencer. */
export function getSubtypeOptionsForVisibilityRole(role: UserRole) {
  return STAKEHOLDER_SUBTYPE_OPTIONS[role as keyof typeof STAKEHOLDER_SUBTYPE_OPTIONS] || []
}

/** The selected subtypes that narrow this particular role. */
export function getSelectedSubtypesForRole(
  role: UserRole,
  subtypeTags: Array<UserRoleSubtype>,
) {
  return subtypeTags.filter((subtype) => !!subtype && SUBTYPE_TO_ROLE[subtype] === role)
}

/**
 * Selected subtypes whose owning role is NOT selected. These do nothing at all -
 * the role check rejects those viewers before subtype is ever considered - so
 * they are worth saying out loud rather than leaving as a silent no-op.
 */
export function getInertSubtypeTags(
  roleTags: UserRole[],
  subtypeTags: Array<UserRoleSubtype>,
) {
  return subtypeTags.filter((subtype) => {
    if (!subtype) return false
    const owner = SUBTYPE_TO_ROLE[subtype]
    return !!owner && !roleTags.includes(owner)
  }) as Array<Exclude<UserRoleSubtype, null>>
}

/** Display label for a subtype value. */
export function getSubtypeLabel(subtype: Exclude<UserRoleSubtype, null>) {
  return SUBTYPE_LABELS[subtype] || subtype
}

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

  ;(material.target_roles || []).forEach((role) => {
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
  const shellRole = access.shell === 'consumer' ? 'community' : access.shell

  // Materials are not gated by a stakeholder level: an untargeted material is
  // available to everyone (this is how auto-generated business/cause materials
  // surface, since they carry no role targeting).
  if (targetRoles.length === 0) return true

  const roleMatches = targetRoles.includes(shellRole) || targetRoles.includes(normalizeMaterialRole(profile.role))
  if (!roleMatches) return false

  // Subtypes narrow the role they BELONG TO, and only that role.
  //
  // They used to be one flat AND filter applied to everyone who passed the role
  // check, which meant tagging Admin+Super also hid the material from every
  // Business user — Business has no subtype at all, so `!!access.subtype` was
  // false and the material vanished. Selecting a role and then any subtype chip
  // silently cancelled that role out. Now a role with no subtype chips of its
  // own is simply not narrowed.
  const matchedRole = targetRoles.includes(shellRole) ? shellRole : normalizeMaterialRole(profile.role)
  const narrowing = getSelectedSubtypesForRole(matchedRole, material.target_subtypes || [])
  if (narrowing.length === 0) return true

  return !!access.subtype && narrowing.includes(access.subtype)
}
