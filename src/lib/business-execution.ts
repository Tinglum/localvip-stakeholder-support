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

export function getBusinessNextActions(input: {
  business: Business
  steps: BusinessExecutionStepSummary[]
  codes: StakeholderCode | null
  generatedMaterials: GeneratedMaterial[]
  qrCodes: QrCode[]
  offers: Offer[]
  joinedCount: number
  openTaskCount: number
}) {
  const actions: string[] = []
  const nextStep = input.steps.find((step) => step.state === 'active')
  const captureOffer = resolveBusinessOffer(input.business, input.offers, 'capture')
  const cashbackOffer = resolveBusinessOffer(input.business, input.offers, 'cashback')

  if (nextStep) {
    actions.push(nextStep.blocker || `Complete ${nextStep.label.toLowerCase()}.`)
  }

  if (!input.codes?.referral_code || !input.codes?.connection_code) {
    actions.push('Add referral and connection codes so QR and materials can be generated.')
  }

  if (input.generatedMaterials.filter((item) => item.generation_status === 'generated').length === 0) {
    actions.push('Generate the first materials so launch assets are ready.')
  }

  if (input.qrCodes.length === 0) {
    actions.push('Create or link a QR code for customer capture.')
  }

  if (!captureOffer.headline?.trim()) {
    actions.push('Set the customer capture offer customers see before launch.')
  }

  if (typeof cashbackOffer.cashback_percent !== 'number' || cashbackOffer.cashback_percent < 5 || cashbackOffer.cashback_percent > 25) {
    actions.push('Set the LocalVIP cashback percentage so launch can move forward.')
  }

  if (input.joinedCount < 100) {
    actions.push(`Grow the 100-list. ${input.joinedCount} customers are joined so far.`)
  }

  if (input.openTaskCount > 0) {
    actions.push(`Work the ${input.openTaskCount} open task${input.openTaskCount === 1 ? '' : 's'} blocking launch progress.`)
  }

  return Array.from(new Set(actions)).slice(0, 5)
}
