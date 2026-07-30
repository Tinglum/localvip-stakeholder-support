export type StripeOnboardingStatusName = 'not_started' | 'incomplete' | 'restricted' | 'complete'

export interface StripeOnboardingRequirements {
  currentlyDue: string[]
  eventuallyDue: string[]
  pastDue: string[]
}

export interface StripeOnboardingStatus {
  businessId?: number | null
  businessName?: string | null
  ownerEmail?: string | null
  hasStripeAccount: boolean
  onboardingStarted: boolean
  stripeAccountId?: string | null
  status: StripeOnboardingStatusName
  isOnboardingComplete: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  disabledReason?: string | null
  requirements: StripeOnboardingRequirements
  nextAction?: string | null
  onboardingUrl?: string | null
  canAcceptPayments: boolean
  canReceivePayouts: boolean
  checkedAtUtc?: string | null
}

const STATUS_NAMES = new Set<StripeOnboardingStatusName>(['not_started', 'incomplete', 'restricted', 'complete'])

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function parseStripeOnboardingStatus(value: unknown): StripeOnboardingStatus | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const requirements = record.requirements && typeof record.requirements === 'object'
    ? record.requirements as Record<string, unknown>
    : {}
  const rawStatus = asString(record.status)
  if (!rawStatus || !STATUS_NAMES.has(rawStatus as StripeOnboardingStatusName)) return null
  const status = rawStatus as StripeOnboardingStatusName

  return {
    businessId: typeof record.businessId === 'number' ? record.businessId : null,
    businessName: asString(record.businessName),
    ownerEmail: asString(record.ownerEmail),
    hasStripeAccount: record.hasStripeAccount === true,
    onboardingStarted: record.onboardingStarted === true || record.detailsSubmitted === true,
    stripeAccountId: asString(record.stripeAccountId),
    status,
    isOnboardingComplete: status === 'complete',
    detailsSubmitted: record.detailsSubmitted === true,
    chargesEnabled: record.chargesEnabled === true,
    payoutsEnabled: record.payoutsEnabled === true,
    disabledReason: asString(record.disabledReason),
    requirements: {
      currentlyDue: asStringList(requirements.currentlyDue),
      eventuallyDue: asStringList(requirements.eventuallyDue),
      pastDue: asStringList(requirements.pastDue),
    },
    nextAction: asString(record.nextAction),
    onboardingUrl: asString(record.onboardingUrl),
    canAcceptPayments: record.canAcceptPayments === true,
    canReceivePayouts: record.canReceivePayouts === true,
    checkedAtUtc: asString(record.checkedAtUtc),
  }
}

export function stripeStatusLabel(status: StripeOnboardingStatusName) {
  switch (status) {
    case 'complete': return 'Ready for payments'
    case 'restricted': return 'Action required'
    case 'incomplete': return 'Onboarding incomplete'
    default: return 'Not started'
  }
}

export function humanizeStripeRequirement(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === 'external_account') return 'Payout bank account'
  if (normalized === 'business_profile.url') return 'Business website'
  if (normalized === 'business_profile.product_description') return 'Business description'
  if (normalized.startsWith('business_profile.')) return 'Business profile information'
  if (normalized === 'company.name') return 'Registered company name'
  if (normalized.startsWith('company.')) return 'Company information'
  if (normalized === 'representative.phone') return 'Representative phone number'
  if (normalized === 'representative.email') return 'Representative email address'
  if (normalized.startsWith('representative.')) return 'Business representative details'
  if (/^person_[^.]+\.verification\./.test(normalized) || normalized.startsWith('individual.verification.')) {
    return 'Identity verification information'
  }
  if (normalized.startsWith('tos_acceptance.')) return 'Stripe terms acceptance'
  return 'Additional Stripe information'
}

export function stripeRequirementLabels(status: StripeOnboardingStatus) {
  return Array.from(new Set(
    [...status.requirements.pastDue, ...status.requirements.currentlyDue].map(humanizeStripeRequirement),
  ))
}

export function stripeStatusSummary(status: StripeOnboardingStatus) {
  if (status.status === 'complete') return 'Stripe has confirmed that this business can accept payments and receive payouts.'
  if (status.status === 'restricted') return status.disabledReason || 'Stripe has restricted this account until the requested information is provided.'
  if (status.status === 'not_started') return 'The business has not started Stripe onboarding yet.'
  return 'Stripe onboarding is in progress and still needs information before payments can be accepted.'
}
