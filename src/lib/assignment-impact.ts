import type { StakeholderAssignment, UserRole } from '@/lib/types/database'

/**
 * Whether a role can actually reach the surfaces that consume assignments.
 *
 * Assignments (city, campaign, cause, business) are read by the field-outreach
 * dashboard, the launch-partner dashboard and the operational business/cause
 * queues. Those live in the `field` and `launch_partner` shells - see
 * getStakeholderShell - so a person outside those shells still HAS their
 * assignments in the database but has no page that uses them.
 *
 * That makes a track change quietly destructive: demote an Intern to Normal and
 * their role becomes `community`, every city they own stops scoping anything,
 * and nothing on screen says so. The assignment rows survive, which is worse
 * than deleting them - the CRM still shows the person as the owner of work they
 * can no longer see.
 */
const SHELLS_THAT_USE_ASSIGNMENTS = new Set<UserRole>([
  'field',
  'intern',
  'volunteer',
  'launch_partner',
  'business_onboarding',
  // Admins see every queue regardless of assignment.
  'admin',
  'super_admin',
  'internal_admin',
])

export function roleUsesAssignments(role: UserRole): boolean {
  return SHELLS_THAT_USE_ASSIGNMENTS.has(role)
}

export interface AssignmentImpact {
  /** True when the move strands assignments the person already holds. */
  losesAccess: boolean
  total: number
  /** Counts per entity type, for naming what is actually at stake. */
  byType: Record<string, number>
  summary: string
}

/**
 * What a track change costs this person.
 *
 * Only reports a loss when they hold assignments AND the destination role
 * cannot reach them. Moving between two assignment-using roles (Intern to
 * Volunteer, both `field`) keeps everything, so it stays silent rather than
 * training people to click through warnings.
 */
export function describeAssignmentImpact(
  assignments: StakeholderAssignment[],
  currentRole: UserRole,
  nextRole: UserRole,
): AssignmentImpact {
  const byType: Record<string, number> = {}
  for (const a of assignments) {
    byType[a.entity_type] = (byType[a.entity_type] || 0) + 1
  }
  const total = assignments.length

  const losesAccess =
    total > 0 && roleUsesAssignments(currentRole) && !roleUsesAssignments(nextRole)

  const PLURAL: Record<string, string> = {
    city: 'cities',
    campaign: 'campaigns',
    cause: 'causes',
    business: 'businesses',
  }
  const parts = Object.entries(byType)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => `${n} ${n === 1 ? type : PLURAL[type] || `${type}s`}`)

  return {
    losesAccess,
    total,
    byType,
    summary: parts.join(', '),
  }
}
