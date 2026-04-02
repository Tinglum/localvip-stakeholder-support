import { resolveBusinessOffer } from '@/lib/offers'
import type {
  Business,
  GeneratedMaterial,
  OnboardingStage,
  OnboardingStep,
  Offer,
  QrCode,
  StakeholderCode,
} from '@/lib/types/database'

export type BusinessExecutionStepKey =
  | 'initial_connection'
  | 'owner_conversation'
  | 'materials_qr'
  | 'launch_decision'

export type BusinessExecutionStepState = 'locked' | 'active' | 'completed'

export interface BusinessExecutionStepSummary {
  key: BusinessExecutionStepKey
  label: string
  description: string | null
  state: BusinessExecutionStepState
  readyToComplete: boolean
  blocker: string | null
  step: OnboardingStep
}

const DEFAULT_STEP_KEYS: BusinessExecutionStepKey[] = [
  'initial_connection',
  'owner_conversation',
  'materials_qr',
  'launch_decision',
]

export function getBusinessExecutionStepKey(step: OnboardingStep, index: number): BusinessExecutionStepKey {
  const explicit = typeof step.metadata?.step_key === 'string' ? step.metadata.step_key : null
  if (explicit === 'initial_connection' || explicit === 'owner_conversation' || explicit === 'materials_qr' || explicit === 'launch_decision') {
    return explicit
  }

  const normalizedTitle = (step.title || '').toLowerCase()
  if (normalizedTitle.includes('initial')) return 'initial_connection'
  if (normalizedTitle.includes('owner')) return 'owner_conversation'
  if (normalizedTitle.includes('material') || normalizedTitle.includes('qr')) return 'materials_qr'
  if (normalizedTitle.includes('launch')) return 'launch_decision'
  return DEFAULT_STEP_KEYS[index] || 'launch_decision'
}

export function computeBusinessExecutionSteps(input: {
  business: Business
  steps: OnboardingStep[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  offers: Offer[]
  outreachCount: number
}) {
  const orderedSteps = [...input.steps].sort((left, right) => left.sort_order - right.sort_order)
  const captureOffer = resolveBusinessOffer(input.business, input.offers, 'capture')
  const cashbackOffer = resolveBusinessOffer(input.business, input.offers, 'cashback')
  const generatedCount = input.generatedMaterials.filter((item) => item.generation_status === 'generated' && !!item.generated_file_url).length
  const qrReady = Boolean(input.business.linked_qr_code_id || input.qrCodes.length > 0)

  return orderedSteps.map<BusinessExecutionStepSummary>((step, index) => {
    const key = getBusinessExecutionStepKey(step, index)
    const previousSteps = orderedSteps.slice(0, index)
    const previousComplete = previousSteps.every((item) => item.is_completed)

    let blocker: string | null = null
    switch (key) {
      case 'initial_connection':
        if (!input.business.city_id || !(input.business.email || input.business.phone || input.business.website)) {
          blocker = 'Add a city and at least one contact path before completing this step.'
        }
        break
      case 'owner_conversation':
        if (input.outreachCount === 0) {
          blocker = 'Log at least one outreach or owner conversation first.'
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
      case 'launch_decision':
        if (!captureOffer.headline?.trim()) {
          blocker = 'Set the 100-list capture offer first.'
        } else if (typeof cashbackOffer.cashback_percent !== 'number' || cashbackOffer.cashback_percent < 5 || cashbackOffer.cashback_percent > 25) {
          blocker = 'Set a valid cashback offer first.'
        }
        break
      default:
        break
    }

    const state: BusinessExecutionStepState = step.is_completed
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

export function computeBusinessStageFromSteps(steps: OnboardingStep[], business: Business): OnboardingStage {
  if (business.launch_phase === 'live' || business.activation_status === 'active') {
    return 'live'
  }

  const completed = steps.filter((step) => step.is_completed).length
  if (completed === 0) return 'lead'
  if (completed === 1) return 'contacted'
  if (completed === 2) return 'interested'
  if (completed === 3) return 'in_progress'
  return 'onboarded'
}

export interface BusinessNextAction {
  text: string
  tab: string
}

/** Map a business lifecycle step key to the tab that resolves the blocker. */
export function getTabForBusinessStepKey(key: string): string {
  switch (key) {
    case 'initial_connection': return 'overview'
    case 'owner_conversation': return 'outreach'
    case 'materials_qr': return 'codes'
    case 'launch_decision': return 'offers'
    default: return 'overview'
  }
}

export function getBusinessNextActions(input: {
  business: Business
  steps: BusinessExecutionStepSummary[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  offers: Offer[]
  joinedCount: number
  openTaskCount: number
}): BusinessNextAction[] {
  const actions: BusinessNextAction[] = []
  const seen = new Set<string>()
  const nextStep = input.steps.find((step) => step.state === 'active')
  const captureOffer = resolveBusinessOffer(input.business, input.offers, 'capture')
  const cashbackOffer = resolveBusinessOffer(input.business, input.offers, 'cashback')

  function add(text: string, tab: string) {
    if (!seen.has(text)) {
      seen.add(text)
      actions.push({ text, tab })
    }
  }

  if (nextStep) {
    add(
      nextStep.blocker || `Complete ${nextStep.label.toLowerCase()}.`,
      getTabForBusinessStepKey(nextStep.key),
    )
  }

  if (!input.codes?.referral_code || !input.codes?.connection_code) {
    add('Add referral and connection codes so QR and materials can be generated.', 'codes')
  }

  if (input.generatedMaterials.filter((item) => item.generation_status === 'generated').length === 0) {
    add('Generate the first materials so launch assets are ready.', 'codes')
  }

  if (input.qrCodes.length === 0) {
    add('Create or link a QR code for customer capture.', 'codes')
  }

  if (!captureOffer.headline?.trim()) {
    add('Set the customer capture offer customers see before launch.', 'offers')
  }

  if (typeof cashbackOffer.cashback_percent !== 'number' || cashbackOffer.cashback_percent < 5 || cashbackOffer.cashback_percent > 25) {
    add('Set the LocalVIP cashback percentage so launch can move forward.', 'offers')
  }

  if (input.joinedCount < 100) {
    add(`Grow the 100-list. ${input.joinedCount} customers are joined so far.`, 'overview')
  }

  if (input.openTaskCount > 0) {
    add(`Work the ${input.openTaskCount} open task${input.openTaskCount === 1 ? '' : 's'} blocking launch progress.`, 'tasks')
  }

  return actions.slice(0, 5)
}

// ─── 20-point onboarding checklist (each item = 5%) ────────

export interface OnboardingChecklistItem {
  id: string
  label: string
  met: boolean
  href: string
  tab: string
}

export interface OnboardingChecklist {
  items: OnboardingChecklistItem[]
  completedCount: number
  totalCount: number
  percent: number
}

export function computeBusinessOnboardingChecklist(input: {
  business: Business
  steps: OnboardingStep[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  offers: Offer[]
  outreachCount: number
  completedTaskCount: number
  hasOwner: boolean
  hasCampaign: boolean
  hasLinkedCause: boolean
  hasLogo: boolean
  hasCoverPhoto: boolean
}): OnboardingChecklist {
  const base = `/crm/businesses/${input.business.id}`
  const captureOffer = resolveBusinessOffer(input.business, input.offers, 'capture')
  const cashbackOffer = resolveBusinessOffer(input.business, input.offers, 'cashback')
  const generatedCount = input.generatedMaterials.filter(
    (m) => m.generation_status === 'generated' && !!m.generated_file_url,
  ).length
  const qrReady = Boolean(input.business.linked_qr_code_id || input.qrCodes.length > 0)
  const stepsComplete = input.steps.filter((s) => s.is_completed).length

  const items: OnboardingChecklistItem[] = [
    { id: 'name', label: 'Business name set', met: !!input.business.name?.trim(), href: base, tab: 'overview' },
    { id: 'category', label: 'Category assigned', met: !!input.business.category, href: base, tab: 'overview' },
    { id: 'city', label: 'City assigned', met: !!input.business.city_id, href: base, tab: 'overview' },
    { id: 'contact', label: 'Email or phone added', met: !!(input.business.email || input.business.phone), href: base, tab: 'overview' },
    { id: 'website', label: 'Website added', met: !!input.business.website, href: base, tab: 'overview' },
    { id: 'owner', label: 'Owner assigned', met: input.hasOwner, href: base, tab: 'overview' },
    { id: 'campaign', label: 'Campaign linked', met: input.hasCampaign, href: base, tab: 'overview' },
    { id: 'cause', label: 'Cause or school linked', met: input.hasLinkedCause, href: base, tab: 'overview' },
    { id: 'first_outreach', label: 'First outreach logged', met: input.outreachCount >= 1, href: base, tab: 'outreach' },
    { id: 'owner_convo', label: 'Owner conversation (3+ touches)', met: input.outreachCount >= 3, href: base, tab: 'outreach' },
    { id: 'referral_code', label: 'Referral code saved', met: !!input.codes?.referral_code, href: base, tab: 'codes' },
    { id: 'connection_code', label: 'Connection code saved', met: !!input.codes?.connection_code, href: base, tab: 'codes' },
    { id: 'qr', label: 'QR code generated', met: qrReady, href: base, tab: 'codes' },
    { id: 'materials', label: 'Materials generated', met: generatedCount > 0, href: base, tab: 'codes' },
    { id: 'capture_offer', label: 'Customer capture offer set', met: !!captureOffer.headline?.trim(), href: base, tab: 'offers' },
    { id: 'cashback', label: 'Cashback percentage configured', met: typeof cashbackOffer.cashback_percent === 'number' && cashbackOffer.cashback_percent >= 5 && cashbackOffer.cashback_percent <= 25, href: base, tab: 'offers' },
    { id: 'logo', label: 'Logo uploaded', met: input.hasLogo, href: base, tab: 'codes' },
    { id: 'cover', label: 'Cover photo uploaded', met: input.hasCoverPhoto, href: base, tab: 'codes' },
    { id: 'task_done', label: 'At least one task completed', met: input.completedTaskCount > 0, href: base, tab: 'tasks' },
    { id: 'all_steps', label: 'All onboarding steps completed', met: stepsComplete >= 4, href: base, tab: 'overview' },
  ]

  const completedCount = items.filter((item) => item.met).length
  return {
    items,
    completedCount,
    totalCount: 20,
    percent: completedCount * 5,
  }
}
