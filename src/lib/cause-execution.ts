import type {
  Cause,
  GeneratedMaterial,
  OnboardingStage,
  OnboardingStep,
  QrCode,
  StakeholderCode,
} from '@/lib/types/database'

// ─── Step keys ──────────────────────────────────────────────

export type CauseExecutionStepKey =
  | 'initial_connection'
  | 'leader_conversation'
  | 'materials_qr'
  | 'activation_decision'

export type CauseExecutionStepState = 'locked' | 'active' | 'completed'

export interface CauseExecutionStepSummary {
  key: CauseExecutionStepKey
  label: string
  description: string | null
  state: CauseExecutionStepState
  readyToComplete: boolean
  blocker: string | null
  step: OnboardingStep
}

const DEFAULT_STEP_KEYS: CauseExecutionStepKey[] = [
  'initial_connection',
  'leader_conversation',
  'materials_qr',
  'activation_decision',
]

export function getCauseExecutionStepKey(step: OnboardingStep, index: number): CauseExecutionStepKey {
  const explicit = typeof step.metadata?.step_key === 'string' ? step.metadata.step_key : null
  if (
    explicit === 'initial_connection' ||
    explicit === 'leader_conversation' ||
    explicit === 'materials_qr' ||
    explicit === 'activation_decision'
  ) {
    return explicit
  }

  const normalizedTitle = (step.title || '').toLowerCase()
  if (normalizedTitle.includes('initial')) return 'initial_connection'
  if (normalizedTitle.includes('leader')) return 'leader_conversation'
  if (normalizedTitle.includes('material') || normalizedTitle.includes('qr')) return 'materials_qr'
  if (normalizedTitle.includes('activation') || normalizedTitle.includes('launch')) return 'activation_decision'
  return DEFAULT_STEP_KEYS[index] || 'activation_decision'
}

// ─── Compute execution steps ────────────────────────────────

export function computeCauseExecutionSteps(input: {
  cause: Cause
  steps: OnboardingStep[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  outreachCount: number
  linkedBusinessCount: number
}) {
  const orderedSteps = [...input.steps].sort((left, right) => left.sort_order - right.sort_order)
  const generatedCount = input.generatedMaterials.filter(
    (item) => item.generation_status === 'generated' && !!item.generated_file_url,
  ).length
  const qrReady = input.qrCodes.length > 0

  return orderedSteps.map<CauseExecutionStepSummary>((step, index) => {
    const key = getCauseExecutionStepKey(step, index)
    const previousSteps = orderedSteps.slice(0, index)
    const previousComplete = previousSteps.every((item) => item.is_completed)

    let blocker: string | null = null
    switch (key) {
      case 'initial_connection':
        if (!input.cause.city_id || !(input.cause.email || input.cause.phone || input.cause.website)) {
          blocker = 'Add a city and at least one contact path before completing this step.'
        }
        break
      case 'leader_conversation':
        if (input.outreachCount === 0) {
          blocker = 'Log at least one outreach or leadership conversation first.'
        }
        break
      case 'materials_qr':
        if (!input.codes?.referral_code || !input.codes?.connection_code) {
          blocker = 'Save the referral code and connection code first.'
        } else if (!qrReady) {
          blocker = 'Generate or link a QR code first.'
        } else if (generatedCount === 0) {
          blocker = 'Generate materials first.'
        }
        break
      case 'activation_decision':
        if (input.linkedBusinessCount === 0) {
          blocker = 'Get at least one business linked before activating.'
        }
        break
      default:
        break
    }

    const state: CauseExecutionStepState = step.is_completed
      ? 'completed'
      : previousComplete
        ? 'active'
        : 'locked'

    return {
      key,
      label: step.title,
      description: step.description,
      state,
      readyToComplete: state === 'active' && !blocker,
      blocker,
      step,
    }
  })
}

// ─── Derive stage from step completion ──────────────────────

export function computeCauseStageFromSteps(steps: OnboardingStep[], cause: Cause): OnboardingStage {
  if (cause.stage === 'live') return 'live'

  const completed = steps.filter((step) => step.is_completed).length
  if (completed === 0) return 'lead'
  if (completed === 1) return 'contacted'
  if (completed === 2) return 'interested'
  if (completed === 3) return 'in_progress'
  return 'onboarded'
}

// ─── Readiness score ────────────────────────────────────────

export interface CauseReadinessScore {
  score: number
  total: number
  percent: number
  checks: Array<{ label: string; met: boolean }>
}

export function computeCauseReadiness(input: {
  cause: Cause
  steps: OnboardingStep[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  outreachCount: number
  linkedBusinessCount: number
}): CauseReadinessScore {
  const isSchool = input.cause.type === 'school'
  const checks: Array<{ label: string; met: boolean }> = [
    { label: 'Profile complete', met: !!(input.cause.city_id && (input.cause.email || input.cause.phone)) },
    { label: 'Codes entered', met: !!(input.codes?.referral_code && input.codes?.connection_code) },
    { label: 'Materials generated', met: input.generatedMaterials.filter((m) => m.generation_status === 'generated').length > 0 },
    { label: 'QR assets ready', met: input.qrCodes.length > 0 },
    { label: isSchool ? 'First business linked' : 'First business linked', met: input.linkedBusinessCount > 0 },
    { label: 'Outreach started', met: input.outreachCount > 0 },
    { label: isSchool ? 'Leadership engaged' : 'Leadership engaged', met: input.outreachCount >= 3 },
    { label: isSchool ? 'Community activation started' : 'Community activation started', met: input.linkedBusinessCount >= 2 },
  ]

  const met = checks.filter((c) => c.met).length
  return {
    score: met,
    total: checks.length,
    percent: Math.round((met / checks.length) * 100),
    checks,
  }
}

// ─── Next best actions ──────────────────────────────────────

export interface CauseNextAction {
  text: string
  tab: string
}

/** Map a lifecycle step key to the tab that resolves the blocker. */
export function getTabForStepKey(key: string): string {
  switch (key) {
    case 'initial_connection': return 'mission'
    case 'leader_conversation': return 'activity'
    case 'materials_qr': return 'codes'
    case 'activation_decision': return 'businesses'
    default: return 'mission'
  }
}

/** Map a readiness checklist label to the tab where the user can fix it. */
export function getTabForReadinessCheck(label: string): string {
  switch (label) {
    case 'Profile complete': return 'mission'
    case 'Codes entered': return 'codes'
    case 'Materials generated': return 'codes'
    case 'QR assets ready': return 'codes'
    case 'First business linked': return 'businesses'
    case 'Outreach started': return 'activity'
    case 'Leadership engaged': return 'activity'
    case 'Community activation started': return 'businesses'
    default: return 'mission'
  }
}

export function getCauseNextActions(input: {
  cause: Cause
  steps: CauseExecutionStepSummary[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  outreachCount: number
  linkedBusinessCount: number
  openTaskCount: number
}): CauseNextAction[] {
  const actions: CauseNextAction[] = []
  const seen = new Set<string>()
  const isSchool = input.cause.type === 'school'
  const nextStep = input.steps.find((step) => step.state === 'active')

  function add(text: string, tab: string) {
    if (!seen.has(text)) {
      seen.add(text)
      actions.push({ text, tab })
    }
  }

  if (nextStep) {
    add(
      nextStep.blocker || `Complete "${nextStep.label.toLowerCase()}" to move forward.`,
      getTabForStepKey(nextStep.key),
    )
  }

  if (!input.cause.city_id || !(input.cause.email || input.cause.phone || input.cause.website)) {
    add('Complete your profile with city and contact information.', 'mission')
  }

  if (!input.codes?.referral_code || !input.codes?.connection_code) {
    add('Add referral and connection codes so QR and materials can be generated.', 'codes')
  }

  if (input.generatedMaterials.filter((item) => item.generation_status === 'generated').length === 0) {
    add(isSchool
      ? 'Generate your school materials so you can share with parents and businesses.'
      : 'Generate your cause materials so you can share with supporters and businesses.', 'codes')
  }

  if (input.qrCodes.length === 0) {
    add('Create a QR code so supporters can join directly.', 'codes')
  }

  if (input.linkedBusinessCount === 0) {
    add(isSchool
      ? 'Add your first business prospect. This is the foundation of your school\'s fundraising.'
      : 'Add your first business prospect. This is how your cause starts generating real support.', 'businesses')
  }

  if (input.outreachCount === 0) {
    add(isSchool
      ? 'Log your first outreach to track parent and leadership conversations.'
      : 'Log your first outreach to track supporter and leadership conversations.', 'activity')
  }

  if (input.openTaskCount > 0) {
    add(`Work on ${input.openTaskCount} open task${input.openTaskCount === 1 ? '' : 's'}.`, 'tasks')
  }

  if (input.linkedBusinessCount >= 1 && input.linkedBusinessCount < 3) {
    add(isSchool
      ? 'Get to 3 businesses to build real momentum for your school.'
      : 'Get to 3 businesses to build real momentum for your cause.', 'businesses')
  }

  return actions.slice(0, 5)
}

// ─── 20-point onboarding checklist (each item = 5%) ────────

export interface CauseChecklistItem {
  id: string
  label: string
  met: boolean
  href: string
  tab: string
}

export interface CauseOnboardingChecklist {
  items: CauseChecklistItem[]
  completedCount: number
  totalCount: number
  percent: number
}

export function computeCauseOnboardingChecklist(input: {
  cause: Cause
  steps: OnboardingStep[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  outreachCount: number
  linkedBusinessCount: number
  completedTaskCount: number
  hasOwner: boolean
  hasCampaign: boolean
  hasJoinUrl: boolean
}): CauseOnboardingChecklist {
  const base = `/crm/causes/${input.cause.id}`
  const generatedCount = input.generatedMaterials.filter(
    (m) => m.generation_status === 'generated' && !!m.generated_file_url,
  ).length
  const qrReady = input.qrCodes.length > 0
  const stepsComplete = input.steps.filter((s) => s.is_completed).length

  const items: CauseChecklistItem[] = [
    { id: 'name', label: 'Organization name set', met: !!input.cause.name?.trim(), href: base, tab: 'mission' },
    { id: 'type', label: 'Organization type assigned', met: !!input.cause.type, href: base, tab: 'mission' },
    { id: 'city', label: 'City assigned', met: !!input.cause.city_id, href: base, tab: 'mission' },
    { id: 'contact', label: 'Email or phone added', met: !!(input.cause.email || input.cause.phone), href: base, tab: 'mission' },
    { id: 'website', label: 'Website added', met: !!input.cause.website, href: base, tab: 'mission' },
    { id: 'owner', label: 'Owner assigned', met: input.hasOwner, href: base, tab: 'mission' },
    { id: 'campaign', label: 'Campaign linked', met: input.hasCampaign, href: base, tab: 'mission' },
    { id: 'first_business', label: 'First business linked', met: input.linkedBusinessCount >= 1, href: base, tab: 'businesses' },
    { id: 'first_outreach', label: 'First outreach logged', met: input.outreachCount >= 1, href: base, tab: 'activity' },
    { id: 'leader_convo', label: 'Leadership conversation (3+ touches)', met: input.outreachCount >= 3, href: base, tab: 'activity' },
    { id: 'referral_code', label: 'Referral code saved', met: !!input.codes?.referral_code, href: base, tab: 'codes' },
    { id: 'connection_code', label: 'Connection code saved', met: !!input.codes?.connection_code, href: base, tab: 'codes' },
    { id: 'qr', label: 'QR code generated', met: qrReady, href: base, tab: 'codes' },
    { id: 'materials', label: 'Materials generated', met: generatedCount > 0, href: base, tab: 'codes' },
    { id: 'join_url', label: 'Join URL configured', met: input.hasJoinUrl, href: base, tab: 'codes' },
    { id: 'second_business', label: 'Second business linked', met: input.linkedBusinessCount >= 2, href: base, tab: 'businesses' },
    { id: 'third_business', label: 'Third business linked', met: input.linkedBusinessCount >= 3, href: base, tab: 'businesses' },
    { id: 'task_done', label: 'At least one task completed', met: input.completedTaskCount > 0, href: base, tab: 'tasks' },
    { id: 'community_active', label: 'Community activation started', met: input.linkedBusinessCount >= 2 && input.outreachCount >= 3, href: base, tab: 'businesses' },
    { id: 'all_steps', label: 'All onboarding steps completed', met: stepsComplete >= 4, href: base, tab: 'mission' },
  ]

  const completedCount = items.filter((item) => item.met).length
  return {
    items,
    completedCount,
    totalCount: 20,
    percent: completedCount * 5,
  }
}
