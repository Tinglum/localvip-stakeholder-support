/**
 * Display-name resolution, shared by every path that sets Profile.full_name.
 *
 * Some QA accounts were created through Swagger and kept its placeholder defaults,
 * so firstName/lastName come back as the literal "string" — the shared admin login
 * rendered as "string string" across the UI.
 *
 * This lives in its own module because there is more than one place that builds a
 * display name (the session profile, and the View As override), and fixing only one
 * of them leaves the bug visible through the other.
 */

/**
 * Is this the shared super-admin identity?
 *
 * IMPORTANT: do not test `role === 'super_admin'`. mapQaRole never returns that for
 * a QA session — a SysAdmin maps to `{ role: 'admin', roleSubtype: 'super' }` (see
 * qa-auth.ts). 'super_admin' exists in the UserRole union and the ROLES map, which
 * makes the wrong check look right; it silently fails for every real admin.
 *
 * Internal admins (`subtype: 'internal'`) are deliberately excluded: they are not
 * the shared login this identity handling exists for.
 */
export function isSuperAdminRole(
  role: string | null | undefined,
  subtype: string | null | undefined,
): boolean {
  if (role === 'super_admin') return true
  return role === 'admin' && subtype === 'super'
}

const PLACEHOLDER_NAME_PARTS = new Set(['string', 'str', 'null', 'undefined', 'n/a', '-'])

export function isPlaceholderNamePart(value: string | null | undefined): boolean {
  if (!value) return true
  return PLACEHOLDER_NAME_PARTS.has(value.trim().toLowerCase())
}

/**
 * Join first/last into a display name, dropping placeholder parts.
 * Returns null when nothing usable remains, so callers choose their own fallback.
 */
export function joinRealName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const parts = [firstName, lastName].filter(
    (part): part is string => !isPlaceholderNamePart(part),
  )
  const joined = parts.join(' ').trim()
  return joined || null
}

/**
 * Best display name for a user, given whatever identifiers are available.
 * `isSuperAdmin` names the shared admin account rather than showing a placeholder;
 * individual attribution for it comes from the operator picker.
 */
export function resolveUserDisplayName(input: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  existing?: string | null
  isSuperAdmin?: boolean
}): string {
  const fromParts = joinRealName(input.firstName, input.lastName)
  if (fromParts) return fromParts

  if (input.isSuperAdmin) return 'SuperAdmin'

  if (input.existing && !isPlaceholderNamePart(input.existing)) return input.existing

  const local = input.email?.split('@')[0]
  if (local && !isPlaceholderNamePart(local)) return local

  return 'LocalVIP User'
}
