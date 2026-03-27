import type {
  Business,
  Cause,
  EntityStatus,
  OnboardingStage,
  OutreachActivity,
  Profile,
  StakeholderAssignment,
  Task,
} from '@/lib/types/database'
import { formatDateTime } from '@/lib/utils'
import { getBusinessPortalData } from '@/lib/business-portal'

export type ClaimedEntityType = 'business' | 'cause'
export type WorkflowUrgency = 'blocked' | 'overdue' | 'today' | 'upcoming' | 'on_track'

export interface WorkflowStageOption {
  value: string
  label: string
  description: string
  entityStage: OnboardingStage
}

export interface WorkflowAssignmentMetadata {
  workflow_stage?: string
  blocked_reason?: string
  waiting_on?: string
  last_activity_at?: string
  last_activity_label?: string
  claim_context?: string
  claimed_by_role?: string
}

export interface QueueEntityState {
  workflowStage: string
  workflowLabel: string
  workflowDescription: string
  entityStage: OnboardingStage
  nextAction: string
  nextActionDueDate: string | null
  blockedReason: string | null
  waitingOn: string | null
  urgency: WorkflowUrgency
  urgencyLabel: string
  lastActivityAt: string | null
  lastActivityLabel: string
}

export const BUSINESS_WORKFLOW_STAGES: WorkflowStageOption[] = [
  { value: 'claimed', label: 'Claimed', description: 'This business is now yours to move forward.', entityStage: 'lead' },
  { value: 'first_outreach_sent', label: 'First outreach sent', description: 'The first local intro has gone out.', entityStage: 'contacted' },
  { value: 'contact_made', label: 'Contact made', description: 'You have an active contact or conversation started.', entityStage: 'contacted' },
  { value: 'interested', label: 'Interested', description: 'They are open to learning more.', entityStage: 'interested' },
  { value: 'profile_setup_needed', label: 'Profile setup needed', description: 'Business details still need to be completed.', entityStage: 'in_progress' },
  { value: 'capture_offer_setup', label: '100-list offer setup', description: 'Their customer capture offer is still missing.', entityStage: 'in_progress' },
  { value: 'cashback_offer_setup', label: 'Cashback setup', description: 'Their live LocalVIP cashback still needs to be confirmed.', entityStage: 'in_progress' },
  { value: 'awaiting_assets', label: 'Awaiting assets', description: 'Logo, cover photo, QR, or materials are still missing.', entityStage: 'in_progress' },
  { value: 'ready_to_go_live', label: 'Ready to go live', description: 'Everything is nearly ready for activation.', entityStage: 'onboarded' },
  { value: 'live', label: 'Live', description: 'The business is activated and now needs performance follow-through.', entityStage: 'live' },
]

export const CAUSE_WORKFLOW_STAGES: WorkflowStageOption[] = [
  { value: 'claimed', label: 'Claimed', description: 'This school or cause is now in your queue.', entityStage: 'lead' },
  { value: 'intro_made', label: 'Intro made', description: 'The first intro has been made.', entityStage: 'contacted' },
  { value: 'meeting_needed', label: 'Meeting needed', description: 'A real meeting still needs to happen.', entityStage: 'contacted' },
  { value: 'interested', label: 'Interested', description: 'They want to keep moving.', entityStage: 'interested' },
  { value: 'materials_shared', label: 'Materials shared', description: 'They have school-facing or cause-facing materials.', entityStage: 'in_progress' },
  { value: 'parent_pta_outreach_started', label: 'Parent / PTA outreach started', description: 'Community mobilization has started.', entityStage: 'in_progress' },
  { value: 'business_connections_needed', label: 'Business connections needed', description: 'They still need more participating businesses.', entityStage: 'in_progress' },
  { value: 'ready_to_activate', label: 'Ready to activate', description: 'They are ready for the final activation step.', entityStage: 'onboarded' },
  { value: 'live', label: 'Live', description: 'This school or cause is active and growing.', entityStage: 'live' },
]

export function getWorkflowStageOptions(entityType: ClaimedEntityType) {
  return entityType === 'business' ? BUSINESS_WORKFLOW_STAGES : CAUSE_WORKFLOW_STAGES
}

function getStageOption(entityType: ClaimedEntityType, value: string) {
  return getWorkflowStageOptions(entityType).find((stage) => stage.value === value) || getWorkflowStageOptions(entityType)[0]
}

export function parseWorkflowAssignmentMetadata(assignment: StakeholderAssignment | null | undefined): WorkflowAssignmentMetadata {
  if (!assignment?.metadata || typeof assignment.metadata !== 'object') return {}
  return assignment.metadata as WorkflowAssignmentMetadata
}

function dateOnlyValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

export function getAccessibleCityIds(profile: Profile, cityAssignments: StakeholderAssignment[]) {
  const ids = new Set<string>()
  if (profile.city_id) ids.add(profile.city_id)

  for (const assignment of cityAssignments) {
    if (assignment.status === 'active') ids.add(assignment.entity_id)
  }

  return [...ids]
}

export function getDefaultNextAction(entityType: ClaimedEntityType, workflowStage: string) {
  if (entityType === 'business') {
    switch (workflowStage) {
      case 'first_outreach_sent':
        return 'Follow up on the first outreach and try to get a quick reply.'
      case 'contact_made':
        return 'Book a short walkthrough and confirm who owns setup on their side.'
      case 'interested':
        return 'Move them into profile and offer setup while the interest is warm.'
      case 'profile_setup_needed':
        return 'Finish the profile details, average spend, and core products.'
      case 'capture_offer_setup':
        return 'Help them set the pre-launch 100-list capture offer.'
      case 'cashback_offer_setup':
        return 'Confirm the LocalVIP cashback percentage and live positioning.'
      case 'awaiting_assets':
        return 'Collect the missing logo, photo, QR, or materials needed to activate.'
      case 'ready_to_go_live':
        return 'Confirm final activation steps and make sure QR-driven capture is ready.'
      case 'live':
        return 'Track 100-list progress, watch capture momentum, and invite another business.'
      default:
        return 'Send the first local intro and log the outreach.'
    }
  }

  switch (workflowStage) {
    case 'intro_made':
      return 'Lock in the follow-up and get a real conversation on the calendar.'
    case 'meeting_needed':
      return 'Schedule the meeting and bring the right school or cause materials.'
    case 'interested':
      return 'Share the right parent, PTA, or school-facing materials.'
    case 'materials_shared':
      return 'Confirm who will share the materials and where they will circulate.'
    case 'parent_pta_outreach_started':
      return 'Keep parent or PTA outreach moving and confirm who is mobilizing.'
    case 'business_connections_needed':
      return 'Find more local businesses that can support this school or cause.'
    case 'ready_to_activate':
      return 'Confirm QR materials, supporter flow, and launch timing.'
    case 'live':
      return 'Track supporter growth and refresh outreach materials as needed.'
    default:
      return 'Send the first intro and explain the local value clearly.'
  }
}

function hasBusinessBranding(business: Business) {
  const portal = getBusinessPortalData(business)
  return !!(portal.logo_url || portal.cover_photo_url)
}

function hasBusinessCaptureOffer(business: Business) {
  const portal = getBusinessPortalData(business)
  return !!(portal.capture_offer_title || portal.offer_title || portal.capture_offer_value || portal.offer_value)
}

function hasBusinessCashback(business: Business) {
  const portal = getBusinessPortalData(business)
  return !!(portal.cashback_percent || portal.cashback_offer_title || portal.cashback_offer_value)
}

function hasBusinessProfile(business: Business) {
  const portal = getBusinessPortalData(business)
  return !!(business.name && business.category && (business.public_description || portal.description || portal.tagline))
}

export function deriveBusinessWorkflowStage(business: Business, contactsCount: number, assignment?: StakeholderAssignment | null) {
  const metadata = parseWorkflowAssignmentMetadata(assignment)
  if (metadata.workflow_stage) return metadata.workflow_stage

  const launchPhase = business.launch_phase

  if (business.stage === 'live' || launchPhase === 'live') return 'live'
  if (launchPhase === 'ready_to_go_live' || business.stage === 'onboarded' || contactsCount >= 100) return 'ready_to_go_live'
  if (business.stage === 'interested') return 'interested'
  if (business.stage === 'contacted') return 'contact_made'
  if (business.stage === 'lead') return 'claimed'
  if (!hasBusinessProfile(business)) return 'profile_setup_needed'
  if (!hasBusinessCaptureOffer(business)) return 'capture_offer_setup'
  if (!hasBusinessCashback(business)) return 'cashback_offer_setup'
  if (!hasBusinessBranding(business) || !business.linked_qr_code_id || !business.linked_material_id) return 'awaiting_assets'
  if (launchPhase === 'capturing_100' || business.stage === 'in_progress') return 'cashback_offer_setup'
  return 'claimed'
}

export function deriveCauseWorkflowStage(cause: Cause, assignment?: StakeholderAssignment | null) {
  const metadata = parseWorkflowAssignmentMetadata(assignment)
  if (metadata.workflow_stage) return metadata.workflow_stage

  if (cause.stage === 'live') return 'live'
  if (cause.stage === 'onboarded') return 'ready_to_activate'
  if (cause.stage === 'interested') return 'interested'
  if (cause.stage === 'contacted') return 'intro_made'

  const causeMetadata = (cause.metadata || {}) as Record<string, unknown>
  if (causeMetadata.business_connections_needed === true) return 'business_connections_needed'
  if (causeMetadata.parent_outreach_started === true) return 'parent_pta_outreach_started'
  if (causeMetadata.materials_shared === true) return 'materials_shared'
  if (cause.stage === 'in_progress') return 'meeting_needed'
  return 'claimed'
}

function resolveUrgency(blockedReason: string | null, dueDate: string | null): { urgency: WorkflowUrgency; label: string } {
  if (blockedReason) return { urgency: 'blocked', label: 'Blocked' }
  if (!dueDate) return { urgency: 'on_track', label: 'On track' }

  const now = new Date()
  const due = new Date(dueDate)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  if (due.getTime() < startOfToday.getTime()) {
    return { urgency: 'overdue', label: 'Overdue' }
  }
  if (due.getTime() < startOfTomorrow.getTime()) {
    return { urgency: 'today', label: 'Due today' }
  }
  return { urgency: 'upcoming', label: 'Upcoming' }
}

export function buildBusinessQueueState(params: {
  business: Business
  assignment?: StakeholderAssignment | null
  contactsCount: number
  tasks?: Task[]
  outreach?: OutreachActivity[]
}) {
  const assignment = params.assignment || null
  const metadata = parseWorkflowAssignmentMetadata(assignment)
  const workflowStage = deriveBusinessWorkflowStage(params.business, params.contactsCount, assignment)
  const option = getStageOption('business', workflowStage)
  const nextAction = assignment?.next_action || getDefaultNextAction('business', workflowStage)
  const nextActionDueDate = assignment?.next_action_due_date || null
  const blockedReason =
    metadata.blocked_reason
    || (!params.business.linked_qr_code_id && workflowStage === 'awaiting_assets' ? 'QR setup is still missing.' : null)
    || (!params.business.linked_material_id && workflowStage === 'awaiting_assets' ? 'Stakeholder materials are not ready yet.' : null)
    || null
  const lastActivityAt =
    metadata.last_activity_at
    || [...(params.tasks || []).map((task) => task.updated_at), ...(params.outreach || []).map((item) => item.created_at)]
      .filter(Boolean)
      .sort()
      .at(-1)
    || null
  const urgency = resolveUrgency(blockedReason, nextActionDueDate)

  return {
    workflowStage,
    workflowLabel: option.label,
    workflowDescription: option.description,
    entityStage: option.entityStage,
    nextAction,
    nextActionDueDate,
    blockedReason,
    waitingOn: metadata.waiting_on || null,
    urgency: urgency.urgency,
    urgencyLabel: urgency.label,
    lastActivityAt,
    lastActivityLabel: metadata.last_activity_label || (lastActivityAt ? `Last touch ${formatDateTime(lastActivityAt)}` : 'No activity logged yet'),
  } satisfies QueueEntityState
}

export function buildCauseQueueState(params: {
  cause: Cause
  assignment?: StakeholderAssignment | null
  tasks?: Task[]
  outreach?: OutreachActivity[]
}) {
  const assignment = params.assignment || null
  const metadata = parseWorkflowAssignmentMetadata(assignment)
  const workflowStage = deriveCauseWorkflowStage(params.cause, assignment)
  const option = getStageOption('cause', workflowStage)
  const nextAction = assignment?.next_action || getDefaultNextAction('cause', workflowStage)
  const nextActionDueDate = assignment?.next_action_due_date || null
  const blockedReason = metadata.blocked_reason || null
  const lastActivityAt =
    metadata.last_activity_at
    || [...(params.tasks || []).map((task) => task.updated_at), ...(params.outreach || []).map((item) => item.created_at)]
      .filter(Boolean)
      .sort()
      .at(-1)
    || null
  const urgency = resolveUrgency(blockedReason, nextActionDueDate)

  return {
    workflowStage,
    workflowLabel: option.label,
    workflowDescription: option.description,
    entityStage: option.entityStage,
    nextAction,
    nextActionDueDate,
    blockedReason,
    waitingOn: metadata.waiting_on || null,
    urgency: urgency.urgency,
    urgencyLabel: urgency.label,
    lastActivityAt,
    lastActivityLabel: metadata.last_activity_label || (lastActivityAt ? `Last touch ${formatDateTime(lastActivityAt)}` : 'No activity logged yet'),
  } satisfies QueueEntityState
}

export function toAssignmentPatch(entityType: ClaimedEntityType, values: {
  workflowStage: string
  nextAction: string
  nextActionDueDate: string
  blockedReason: string
  waitingOn: string
  claimContext?: string
  claimedByRole?: string
}) {
  const option = getStageOption(entityType, values.workflowStage)
  const metadata: WorkflowAssignmentMetadata = {
    workflow_stage: values.workflowStage,
    blocked_reason: values.blockedReason.trim() || undefined,
    waiting_on: values.waitingOn.trim() || undefined,
    claim_context: values.claimContext?.trim() || undefined,
    claimed_by_role: values.claimedByRole?.trim() || undefined,
  }

  return {
    role: 'claim_owner',
    status: 'active' as EntityStatus,
    claimed_at: new Date().toISOString(),
    next_action: values.nextAction.trim() || getDefaultNextAction(entityType, values.workflowStage),
    next_action_due_date: values.nextActionDueDate ? new Date(`${values.nextActionDueDate}T12:00:00`).toISOString() : null,
    metadata,
    entityStage: option.entityStage,
  }
}

export function getUrgencyVariant(urgency: WorkflowUrgency): 'default' | 'info' | 'warning' | 'success' | 'danger' {
  switch (urgency) {
    case 'blocked':
    case 'overdue':
      return 'danger'
    case 'today':
      return 'warning'
    case 'upcoming':
      return 'info'
    default:
      return 'success'
  }
}

export function getAccessibleEntitySummary(profile: Profile, entityType: ClaimedEntityType) {
  return profile.role === 'launch_partner'
    ? `You can work across every ${entityType === 'business' ? 'business' : 'school or cause'} in your approved cities.`
    : `You can claim and work the ${entityType === 'business' ? 'businesses' : 'schools and causes'} inside your approved city footprint.`
}

export function isEntityVisibleInCityScope(cityId: string | null | undefined, accessibleCityIds: string[]) {
  if (!cityId) return false
  return accessibleCityIds.includes(cityId)
}

export function getLaunchPhaseLabel(phase: string | null | undefined) {
  switch (phase) {
    case 'capturing_100':
      return 'Capturing first 100'
    case 'ready_to_go_live':
      return 'Ready to go live'
    case 'live':
      return 'Live'
    default:
      return 'Setup'
  }
}

export function formatDueLabel(value: string | null | undefined) {
  if (!value) return 'No due date'
  return dateOnlyValue(value)
}
