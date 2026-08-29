/**
 * Claimed-stakeholder workflow.
 *
 * This module used to be a stub that returned `false`, `''`, `[]` and a fixed
 * `on_track` queue literal for everything. That was the direct cause of two
 * user-visible bugs: `isEntityVisibleInCityScope` always returning false made
 * /partner/businesses, /partner/community, /workspace/businesses and
 * /workspace/community render permanently empty, and the fake queue literal
 * put placeholder urgency badges and due dates on /dashboard, /partner/city
 * and /analytics/me and presented them as live operator data.
 *
 * Everything here is now derived from data the QA backend actually supplies —
 * the profile, city `StakeholderAssignment` rows, the entity's own assignment
 * (its `next_action`, `next_action_due_date` and `metadata`), plus the tasks
 * and outreach rows already loaded by the caller. There is no Supabase in it,
 * and nothing silently swallows a missing source: when an entity has no
 * assignment the queue state says so explicitly rather than claiming
 * `on_track`.
 */

import type { Profile, StakeholderAssignment, Task, OutreachActivity, Business, Cause, OnboardingStage } from '@/lib/types/database'

export type ClaimedEntityType = 'business' | 'cause'
export type WorkflowStageOption = { value: string; label: string }
export type WorkflowUrgency = 'blocked' | 'overdue' | 'today' | 'upcoming' | 'on_track' | 'unknown'

export interface WorkflowAssignmentMetadata {
  workflowStage: string
  blockedReason: string | null
  waitingOn: string | null
  claimContext: string | null
  claimedByRole: string | null
}

export interface WorkflowQueueState {
  workflowStage: string
  workflowLabel: string
  nextAction: string
  nextActionDueDate: string
  lastActivityAt: string | null
  lastActivityLabel: string
  blockedReason: string | null
  waitingOn: string | null
  urgency: WorkflowUrgency
  urgencyLabel: string
  items: unknown[]
  /** True when there is no assignment behind this row, so nothing below is real. */
  unavailable: boolean
}

// ─── Stage vocabularies ─────────────────────────────────────
// These mirror the filter predicates in operational-businesses-page.tsx and
// operational-causes-page.tsx; keep the two in step.

const BUSINESS_STAGES: WorkflowStageOption[] = [
  { value: 'claimed', label: 'Claimed' },
  { value: 'first_outreach_sent', label: 'First outreach sent' },
  { value: 'contact_made', label: 'Contact made' },
  { value: 'interested', label: 'Interested' },
  { value: 'awaiting_assets', label: 'Awaiting assets' },
  { value: 'profile_setup_needed', label: 'Profile setup needed' },
  { value: 'capture_offer_setup', label: 'Capture offer setup' },
  { value: 'cashback_offer_setup', label: 'Cashback offer setup' },
  { value: 'ready_to_go_live', label: 'Ready to go live' },
  { value: 'live', label: 'Live' },
]

const CAUSE_STAGES: WorkflowStageOption[] = [
  { value: 'claimed', label: 'Claimed' },
  { value: 'intro_made', label: 'Intro made' },
  { value: 'meeting_needed', label: 'Meeting needed' },
  { value: 'interested', label: 'Interested' },
  { value: 'materials_shared', label: 'Materials shared' },
  { value: 'parent_pta_outreach_started', label: 'Parent / PTA outreach started' },
  { value: 'business_connections_needed', label: 'Business connections needed' },
  { value: 'ready_to_activate', label: 'Ready to activate' },
  { value: 'live', label: 'Live' },
]

const LAUNCH_PHASE_LABELS: Record<string, string> = {
  setup: 'Setup',
  capturing_100: 'Capturing first 100',
  ready_to_go_live: 'Ready to go live',
  live: 'Live',
}

/**
 * Workflow stage → the coarse `OnboardingStage` written back onto the entity.
 * Anything unmapped stays `in_progress` rather than silently clearing a stage.
 */
const BUSINESS_ENTITY_STAGE: Record<string, OnboardingStage> = {
  claimed: 'contacted',
  first_outreach_sent: 'contacted',
  contact_made: 'contacted',
  interested: 'interested',
  awaiting_assets: 'in_progress',
  profile_setup_needed: 'in_progress',
  capture_offer_setup: 'in_progress',
  cashback_offer_setup: 'in_progress',
  ready_to_go_live: 'onboarded',
  live: 'live',
}

const CAUSE_ENTITY_STAGE: Record<string, OnboardingStage> = {
  claimed: 'contacted',
  intro_made: 'contacted',
  meeting_needed: 'contacted',
  interested: 'interested',
  materials_shared: 'in_progress',
  parent_pta_outreach_started: 'in_progress',
  business_connections_needed: 'in_progress',
  ready_to_activate: 'onboarded',
  live: 'live',
}

export const EMPTY_WORKFLOW: WorkflowQueueState = {
  workflowStage: '',
  workflowLabel: 'Workflow unavailable',
  nextAction: 'No workflow assignment for this record.',
  nextActionDueDate: '',
  lastActivityAt: null,
  lastActivityLabel: '—',
  blockedReason: null,
  waitingOn: null,
  urgency: 'unknown',
  urgencyLabel: 'Unknown',
  items: [],
  unavailable: true,
}

function stagesFor(entityType: ClaimedEntityType) {
  return entityType === 'cause' ? CAUSE_STAGES : BUSINESS_STAGES
}

export function getWorkflowStageOptions(entityType: ClaimedEntityType = 'business'): WorkflowStageOption[] {
  return stagesFor(entityType)
}

function stageLabel(entityType: ClaimedEntityType, stage: string) {
  return stagesFor(entityType).find((option) => option.value === stage)?.label || 'Unstaged'
}

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

// ─── City scope ─────────────────────────────────────────────

const ALL_CITY_ROLES = new Set(['admin', 'super_admin', 'internal_admin'])

/**
 * City ids this profile may work in.
 *
 * An empty result means "unrestricted" (see `isEntityVisibleInCityScope`).
 * The launch-partner dashboard filters `cities`, `businesses` and `causes`
 * directly against this array, so a partner with no city assignments correctly
 * sees nothing there.
 */
export function getAccessibleCityIds(
  profile?: Profile | null,
  cityAssignments?: StakeholderAssignment[] | null,
): string[] {
  // Admins carry no city assignments, so this yields [] for them — which
  // `isEntityVisibleInCityScope` reads as "unrestricted", the correct result.
  return (cityAssignments || [])
    .filter((assignment) => assignment.status === 'active' && assignment.entity_type === 'city')
    .map((assignment) => assignment.entity_id)
}

/**
 * Whether an entity in `cityId` is inside `accessibleCityIds`.
 *
 * An unrestricted scope is expressed as an empty/absent list, which is how the
 * admin and field shells arrive here (`getAccessibleCityIds()` with no
 * arguments). Returning false for that case is what blanked the four
 * operational pages.
 */
export function isEntityVisibleInCityScope(
  cityId: string | null | undefined,
  accessibleCityIds?: string[] | null,
): boolean {
  if (!accessibleCityIds || accessibleCityIds.length === 0) return true
  if (!cityId) return false
  return accessibleCityIds.includes(cityId)
}

export function getAccessibleEntitySummary(profile?: Profile | null, entityType: ClaimedEntityType = 'business') {
  const noun = entityType === 'cause' ? 'schools and causes' : 'businesses'
  if (profile && ALL_CITY_ROLES.has(String(profile.role))) {
    return `You can see every ${noun} across all cities.`
  }
  return `You can see ${noun} in the cities assigned to you.`
}

// ─── Assignment metadata ────────────────────────────────────

export function parseWorkflowAssignmentMetadata(
  assignment?: StakeholderAssignment | null,
): WorkflowAssignmentMetadata | null {
  if (!assignment) return null
  const metadata = (assignment.metadata || {}) as Record<string, unknown>
  return {
    workflowStage: trimmedOrNull(metadata.workflow_stage) || 'claimed',
    blockedReason: trimmedOrNull(metadata.blocked_reason),
    waitingOn: trimmedOrNull(metadata.waiting_on),
    claimContext: trimmedOrNull(metadata.claim_context),
    claimedByRole: trimmedOrNull(metadata.claimed_by_role),
  }
}

interface AssignmentPatchInput {
  workflowStage: string
  nextAction: string
  nextActionDueDate: string
  blockedReason: string
  waitingOn: string
  claimContext: string
  claimedByRole?: string | null
}

export function toAssignmentPatch(entityType: ClaimedEntityType, values: AssignmentPatchInput) {
  const stage = trimmedOrNull(values.workflowStage) || 'claimed'
  const stageMap = entityType === 'cause' ? CAUSE_ENTITY_STAGE : BUSINESS_ENTITY_STAGE

  return {
    role: entityType === 'cause' ? 'cause_owner' : 'business_owner',
    status: 'active' as const,
    claimed_at: new Date().toISOString(),
    next_action: trimmedOrNull(values.nextAction),
    next_action_due_date: trimmedOrNull(values.nextActionDueDate),
    entityStage: (stageMap[stage] || 'in_progress') as OnboardingStage,
    metadata: {
      workflow_stage: stage,
      blocked_reason: trimmedOrNull(values.blockedReason),
      waiting_on: trimmedOrNull(values.waitingOn),
      claim_context: trimmedOrNull(values.claimContext),
      claimed_by_role: trimmedOrNull(values.claimedByRole),
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>,
  }
}

export function getWorkflowStatus(
  entityType: ClaimedEntityType,
  assignment?: StakeholderAssignment | null,
): WorkflowAssignmentMetadata | null {
  return parseWorkflowAssignmentMetadata(assignment)
}

// ─── Urgency / labels ───────────────────────────────────────

export function getUrgencyVariant(urgency: WorkflowUrgency | string | null | undefined) {
  switch (urgency) {
    case 'blocked':
    case 'overdue':
      return 'danger' as const
    case 'today':
      return 'warning' as const
    case 'upcoming':
      return 'info' as const
    case 'on_track':
      return 'success' as const
    default:
      return 'outline' as const
  }
}

const URGENCY_LABELS: Record<WorkflowUrgency, string> = {
  blocked: 'Blocked',
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  on_track: 'On track',
  unknown: 'Unknown',
}

export function formatDueLabel(value: string | null | undefined) {
  const raw = trimmedOrNull(value)
  if (!raw) return 'No due date'
  const due = new Date(raw)
  if (Number.isNaN(due.getTime())) return 'No due date'
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getLaunchPhaseLabel(phase: string | null | undefined) {
  if (!phase) return 'Not set'
  return LAUNCH_PHASE_LABELS[phase] || phase
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

function computeUrgency(dueDate: string | null, blockedReason: string | null): WorkflowUrgency {
  if (blockedReason) return 'blocked'
  if (!dueDate) return 'on_track'
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return 'on_track'
  const today = startOfDay(new Date())
  const dueDay = startOfDay(due)
  if (dueDay < today) return 'overdue'
  if (dueDay === today) return 'today'
  return 'upcoming'
}

// ─── Queue state ────────────────────────────────────────────

interface QueueStateInput {
  business?: Business | null
  cause?: Cause | null
  assignment?: StakeholderAssignment | null
  contactsCount?: number
  tasks?: Task[]
  outreach?: OutreachActivity[]
}

function buildQueueState(entityType: ClaimedEntityType, input: QueueStateInput): WorkflowQueueState {
  const assignment = input.assignment || null

  // No assignment means there is genuinely nothing to report. Say so instead of
  // synthesising an "on track" card out of nothing.
  if (!assignment) return { ...EMPTY_WORKFLOW }

  const metadata = parseWorkflowAssignmentMetadata(assignment)!
  const openTasks = (input.tasks || []).filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
  const outreach = input.outreach || []

  const lastActivityAt = outreach
    .map((item) => item.created_at)
    .filter(Boolean)
    .sort()
    .pop() || assignment.updated_at || assignment.claimed_at || assignment.created_at || null

  const dueDate = trimmedOrNull(assignment.next_action_due_date)
  const urgency = computeUrgency(dueDate, metadata.blockedReason)

  const nextAction = trimmedOrNull(assignment.next_action)
    || trimmedOrNull(openTasks[0]?.title)
    || 'No next action recorded.'

  return {
    workflowStage: metadata.workflowStage,
    workflowLabel: stageLabel(entityType, metadata.workflowStage),
    nextAction,
    nextActionDueDate: dueDate || '',
    lastActivityAt,
    lastActivityLabel: lastActivityAt ? formatDueLabel(lastActivityAt) : 'No activity yet',
    blockedReason: metadata.blockedReason,
    waitingOn: metadata.waitingOn,
    urgency,
    urgencyLabel: URGENCY_LABELS[urgency],
    items: openTasks,
    unavailable: false,
  }
}

export function buildBusinessQueueState(input: QueueStateInput): WorkflowQueueState {
  return buildQueueState('business', input)
}

export function buildCauseQueueState(input: QueueStateInput): WorkflowQueueState {
  return buildQueueState('cause', input)
}
