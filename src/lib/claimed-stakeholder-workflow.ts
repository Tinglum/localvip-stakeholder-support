// STUB - Claimed stakeholder workflow has been removed
export const EMPTY_WORKFLOW = null as any

export type ClaimedEntityType = 'business' | 'cause'
export type WorkflowStageOption = { value: string; label: string }

export function getWorkflowStatus() {
  return null
}

export function parseWorkflowAssignmentMetadata(...args: any[]) {
  return null
}

export function toAssignmentPatch(...args: any[]): any {
  return {}
}

export function getAccessibleEntitySummary(...args: any[]) {
  return ''
}

export function getUrgencyVariant(...args: any[]) {
  return 'default' as const
}

export function formatDueLabel(...args: any[]) {
  return ''
}

export function getWorkflowStageOptions(...args: any[]): WorkflowStageOption[] {
  return []
}

export function buildCauseQueueState(...args: any[]): any {
  return { items: [], urgency: 'on_track' as any, nextActionDueDate: '', blockedReason: null, waitingOn: null, workflowLabel: '', nextAction: '', urgencyLabel: '' }
}

export function buildBusinessQueueState(...args: any[]): any {
  return { items: [], urgency: 'on_track' as any, nextActionDueDate: '', blockedReason: null, waitingOn: null, workflowLabel: '', nextAction: '', urgencyLabel: '' }
}

export function getLaunchPhaseLabel(...args: any[]) {
  return ''
}

export function getAccessibleCityIds(...args: any[]) {
  return [] as string[]
}

export function isEntityVisibleInCityScope(...args: any[]) {
  return false
}
