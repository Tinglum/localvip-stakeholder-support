// STUB - Claimed stakeholder workflow has been removed
export const EMPTY_WORKFLOW = null as any

export type ClaimedEntityType = 'business' | 'cause'
export type WorkflowStageOption = { value: string; label: string }

export function getWorkflowStatus() {
  return null
}

export function parseWorkflowAssignmentMetadata() {
  return null
}

export function toAssignmentPatch() {
  return {}
}

export function getAccessibleEntitySummary() {
  return ''
}

export function getUrgencyVariant() {
  return 'default' as const
}

export function formatDueLabel() {
  return ''
}

export function getWorkflowStageOptions(): WorkflowStageOption[] {
  return []
}

export function buildCauseQueueState() {
  return { items: [] }
}

export function buildBusinessQueueState() {
  return { items: [] }
}

export function getLaunchPhaseLabel() {
  return ''
}

export function getAccessibleCityIds() {
  return [] as string[]
}

export function isEntityVisibleInCityScope() {
  return false
}
