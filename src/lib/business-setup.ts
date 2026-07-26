/**
 * BUSINESS SETUP - single source of truth.
 *
 * This checklist contains only the requirements a business must finish before
 * requesting a live review. Growth work such as building the 100 list, inviting
 * customers, and sharing QR codes belongs elsewhere in the portal.
 */

import { getBusinessPortalData } from '@/lib/business-portal'
import type { Business, Contact, Offer } from '@/lib/types/database'

export type BusinessSetupStepKey =
  | 'profile'
  | 'branding'
  | 'capture'
  | 'cashback'
  | 'stripe'
  | 'activate'

export interface BusinessSetupStep {
  key: BusinessSetupStepKey
  label: string
  description: string
  why: string
  time: string
}

export const BUSINESS_SETUP_STEPS: BusinessSetupStep[] = [
  {
    key: 'profile',
    label: 'Business Profile',
    description: 'Tell us the basics customers need to understand your business.',
    why: 'A clear profile helps customers quickly understand what you offer.',
    time: '5 minutes',
  },
  {
    key: 'branding',
    label: 'Branding',
    description: 'Add a logo and cover image for your customer-facing pages.',
    why: 'Your logo and cover are what people recognise on your LocalVIP page.',
    time: '5 minutes',
  },
  {
    key: 'capture',
    label: '100-List Offer',
    description: 'Create the pre-launch offer used to collect your first 100 customers.',
    why: 'A simple, specific offer is what makes people say yes on the spot.',
    time: '5 minutes',
  },
  {
    key: 'cashback',
    label: 'Cashback & Cause',
    description: 'Set your live cashback and choose the cause your business supports.',
    why: 'This defines the customer reward and community impact attached to each purchase.',
    time: '3 minutes',
  },
  {
    key: 'stripe',
    label: 'Stripe Payments',
    description: 'Connect Stripe so LocalVIP can securely send customer payments to you.',
    why: 'A verified Stripe account is required before your business can receive LocalVIP payments.',
    time: '5 to 10 minutes',
  },
  {
    key: 'activate',
    label: 'Go Live',
    description: 'Review your setup and submit it for LocalVIP go-live approval.',
    why: 'LocalVIP performs one final check before customers can use your deals.',
    time: 'A few minutes',
  },
]

export const BUSINESS_SETUP_CONFIG_STEPS = BUSINESS_SETUP_STEPS

export interface BusinessSetupSignals {
  name: string
  description: string
  logoUrl: string | null
  coverUrl: string | null
  captureHeadline: string
  captureDescription: string
  captureValue: string
  cashbackPercent: number
  cashbackChosen: boolean
  supportedCauseId: string | null
  stripeConnected: boolean
  liveReviewSubmitted: boolean
}

export interface BusinessSetupStepState extends BusinessSetupStep {
  complete: boolean
}

export interface BusinessSetupState {
  steps: BusinessSetupStepState[]
  configSteps: BusinessSetupStepState[]
  completedCount: number
  totalSteps: number
  ratio: number
  isComplete: boolean
  readyToActivate: boolean
  nextStep: BusinessSetupStepState | null
}

function isFilled(value: string | null | undefined) {
  return !!value && !!value.trim()
}

export function isBusinessSetupStepComplete(key: BusinessSetupStepKey, signals: BusinessSetupSignals): boolean {
  switch (key) {
    case 'profile':
      return isFilled(signals.name) && isFilled(signals.description)
    case 'branding':
      return !!signals.logoUrl && !!signals.coverUrl
    case 'capture':
      return isFilled(signals.captureHeadline) && isFilled(signals.captureDescription) && isFilled(signals.captureValue)
    case 'cashback':
      return (
        signals.cashbackPercent >= 5
        && signals.cashbackPercent <= 25
        && signals.cashbackChosen
        && !!signals.supportedCauseId
      )
    case 'stripe':
      return signals.stripeConnected
    case 'activate':
      return hasCompletedLiveReviewRequirements(signals) && signals.liveReviewSubmitted
    default:
      return false
  }
}

function hasCompletedLiveReviewRequirements(signals: BusinessSetupSignals) {
  return (
    isBusinessSetupStepComplete('profile', signals)
    && isBusinessSetupStepComplete('branding', signals)
    && isBusinessSetupStepComplete('capture', signals)
    && isBusinessSetupStepComplete('cashback', signals)
    && isBusinessSetupStepComplete('stripe', signals)
  )
}

export function getBusinessSetupState(signals: BusinessSetupSignals): BusinessSetupState {
  const steps = BUSINESS_SETUP_STEPS.map((step) => ({
    ...step,
    complete: isBusinessSetupStepComplete(step.key, signals),
  }))
  const completedCount = steps.filter((step) => step.complete).length

  return {
    steps,
    configSteps: steps,
    completedCount,
    totalSteps: steps.length,
    ratio: completedCount / steps.length,
    isComplete: completedCount === steps.length,
    readyToActivate: hasCompletedLiveReviewRequirements(signals),
    nextStep: steps.find((step) => !step.complete) || null,
  }
}

/** Saved-record signals used by navigation, the dashboard, and the wizard. */
export function getBusinessSetupSignals(input: {
  business: Business | null
  offers: Offer[]
  contacts: Contact[]
}): BusinessSetupSignals {
  const { business, offers } = input

  if (!business) {
    return {
      name: '',
      description: '',
      logoUrl: null,
      coverUrl: null,
      captureHeadline: '',
      captureDescription: '',
      captureValue: '',
      cashbackPercent: 0,
      cashbackChosen: false,
      supportedCauseId: null,
      stripeConnected: false,
      liveReviewSubmitted: false,
    }
  }

  const portal = getBusinessPortalData(business)
  const capture = offers.find((offer) => offer.offer_type === 'capture') || null
  const cashback = offers.find((offer) => offer.offer_type === 'cashback') || null
  const savedCashbackPercent =
    typeof cashback?.cashback_percent === 'number'
      ? cashback.cashback_percent
      : typeof portal.cashback_percent === 'number'
        ? portal.cashback_percent
        : 0
  const status = String(business.status || '')

  return {
    name: business.name || '',
    description: business.public_description || portal.description || '',
    logoUrl: business.logo_url || portal.logo_url || null,
    coverUrl: business.cover_photo_url || portal.cover_photo_url || null,
    captureHeadline: capture?.headline || portal.capture_offer_title || portal.offer_title || '',
    captureDescription: capture?.description || portal.capture_offer_description || portal.offer_description || '',
    captureValue: capture?.value_label || portal.capture_offer_value || portal.offer_value || '',
    cashbackPercent: savedCashbackPercent,
    cashbackChosen: !!cashback || typeof portal.cashback_percent === 'number',
    supportedCauseId: business.linked_cause_id || null,
    stripeConnected: business.stripe_onboarding_complete === true,
    liveReviewSubmitted: status === 'pending_live_review' || status === 'live' || business.stage === 'live',
  }
}
