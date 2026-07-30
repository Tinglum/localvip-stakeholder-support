import { humanizeStripeRequirement } from '@/lib/stripe-onboarding'

/**
 * Payment readiness across every business, as reported by the QA
 * StripeConnect readiness-report endpoint.
 *
 * A business that is not ready is hidden from the consumer webapp entirely —
 * the feed filters on "can accept Stripe payments". So `notReadyCount` is a
 * count of businesses no customer can currently see.
 */
export interface StripeReadinessBusiness {
  accountId: number
  businessName: string
  ownerEmail: string | null
  stripeAccountId: string | null
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  disabledReason: string | null
  currentlyDue: string[]
  blockReason: string | null
  isReady: boolean
}

export interface StripeReadinessReport {
  unavailable?: boolean
  checkedOn: string | null
  totalBusinesses: number
  readyCount: number
  notReadyCount: number
  businesses: StripeReadinessBusiness[]
}

/**
 * The single quiet shape every failure path resolves to. `unavailable` is the
 * only signal the UI has that the numbers are absent rather than perfect —
 * a zeroed report must never be rendered as an all-clear.
 */
export const STRIPE_READINESS_UNAVAILABLE: StripeReadinessReport = {
  unavailable: true,
  checkedOn: null,
  totalBusinesses: 0,
  readyCount: 0,
  notReadyCount: 0,
  businesses: [],
}

/** Worst first. The consumer impact is identical, the fix effort is not. */
export type StripeBlockKind =
  | 'no_account'
  | 'charges_disabled'
  | 'details_missing'
  | 'requirements_due'
  | 'payouts_disabled'
  | 'other'

const BLOCK_RANK: Record<StripeBlockKind, number> = {
  no_account: 0,
  charges_disabled: 1,
  details_missing: 2,
  requirements_due: 3,
  payouts_disabled: 4,
  other: 5,
}

const BLOCK_LABEL: Record<StripeBlockKind, string> = {
  no_account: 'No Stripe account',
  charges_disabled: 'Charges disabled',
  details_missing: 'Details not submitted',
  requirements_due: 'Requirements due',
  payouts_disabled: 'Payouts disabled',
  other: 'Not payment ready',
}

export function classifyStripeBlock(business: StripeReadinessBusiness): StripeBlockKind {
  if (!business.stripeAccountId) return 'no_account'
  if (!business.chargesEnabled) return 'charges_disabled'
  if (!business.detailsSubmitted) return 'details_missing'
  if (business.currentlyDue.length > 0) return 'requirements_due'
  if (!business.payoutsEnabled) return 'payouts_disabled'
  return 'other'
}

export function stripeBlockLabel(kind: StripeBlockKind) {
  return BLOCK_LABEL[kind]
}

/**
 * The human sentence under the business name. Prefers whatever the backend
 * said (`blockReason`, then Stripe's own `disabledReason`) and only falls back
 * to a derived description when neither is present.
 */
export function stripeBlockDetail(business: StripeReadinessBusiness, kind: StripeBlockKind) {
  if (business.blockReason) return business.blockReason
  if (business.disabledReason) return business.disabledReason

  switch (kind) {
    case 'no_account':
      return 'Stripe onboarding has never been started for this business.'
    case 'charges_disabled':
      return 'Stripe has disabled charges on this account.'
    case 'details_missing':
      return 'Stripe onboarding was started but never submitted.'
    case 'requirements_due':
      return `Stripe is waiting on: ${Array.from(
        new Set(business.currentlyDue.map(humanizeStripeRequirement)),
      ).join(', ')}.`
    case 'payouts_disabled':
      return 'Payouts are disabled, so money cannot reach the business.'
    default:
      return 'Stripe has not cleared this business to accept payments.'
  }
}

/** Most urgent first, then alphabetical so the list order is stable between polls. */
export function sortByUrgency(businesses: StripeReadinessBusiness[]) {
  return [...businesses].sort((a, b) => {
    const rank = BLOCK_RANK[classifyStripeBlock(a)] - BLOCK_RANK[classifyStripeBlock(b)]
    if (rank !== 0) return rank
    return a.businessName.localeCompare(b.businessName)
  })
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeBusiness(value: unknown): StripeReadinessBusiness | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const accountId = asNumber(record.accountId)
  if (accountId === null) return null

  return {
    accountId,
    businessName: asString(record.businessName) || `Business #${accountId}`,
    ownerEmail: asString(record.ownerEmail),
    stripeAccountId: asString(record.stripeAccountId),
    detailsSubmitted: record.detailsSubmitted === true,
    chargesEnabled: record.chargesEnabled === true,
    payoutsEnabled: record.payoutsEnabled === true,
    disabledReason: asString(record.disabledReason),
    currentlyDue: asStringList(record.currentlyDue),
    blockReason: asString(record.blockReason),
    isReady: record.isReady === true,
  }
}

/**
 * Returns null when the payload is not recognisably a readiness report, so the
 * caller can fall back to the unavailable shape rather than inventing zeroes.
 */
export function normalizeStripeReadinessReport(value: unknown): StripeReadinessReport | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.businesses)) return null

  const businesses = record.businesses
    .map(normalizeBusiness)
    .filter((entry): entry is StripeReadinessBusiness => entry !== null)

  const notReady = businesses.filter((entry) => !entry.isReady)

  return {
    checkedOn: asString(record.checkedOn),
    totalBusinesses: asNumber(record.totalBusinesses) ?? businesses.length,
    readyCount: asNumber(record.readyCount) ?? businesses.length - notReady.length,
    // Trust the served list over the served count: the list is what we render.
    notReadyCount: notReady.length || asNumber(record.notReadyCount) || 0,
    businesses,
  }
}
