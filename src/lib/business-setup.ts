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
    label: 'Build Your 100 List',
    description: 'Tell us if you want LocalVIP to help build your first customer audience.',
    why: 'Starting with an audience gives your launch momentum from day one.',
    time: '1 minute',
  },
  {
    key: 'cashback',
    label: 'LocalVIP Deal',
    description: 'Choose the cashback percentage and schedule when your deal is available.',
    why: 'Your deal brings customers in during the days and times when you want more business.',
    time: '3 to 5 minutes',
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
  category: string
  description: string
  logoUrl: string | null
  coverUrl: string | null
  captureHeadline: string
  captureDescription: string
  captureValue: string
  hundredListInterest: 'interested' | 'not_now' | null
  dealConfigured: boolean
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
      return isFilled(signals.name) && isFilled(signals.category) && isFilled(signals.description)
    case 'branding':
      return !!signals.logoUrl && !!signals.coverUrl
    case 'capture':
      return signals.hundredListInterest === 'interested' || signals.hundredListInterest === 'not_now'
    case 'cashback':
      return signals.dealConfigured
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
  deals?: Array<{
    cash_back: number
    start_date: string | null
    end_date: string | null
  }>
}): BusinessSetupSignals {
  const { business, offers, deals = [] } = input

  if (!business) {
    return {
      name: '',
      category: '',
      description: '',
      logoUrl: null,
      coverUrl: null,
      captureHeadline: '',
      captureDescription: '',
      captureValue: '',
      hundredListInterest: null,
      dealConfigured: false,
      stripeConnected: false,
      liveReviewSubmitted: false,
    }
  }

  const portal = getBusinessPortalData(business)
  const capture = offers.find((offer) => offer.offer_type === 'capture') || null
  const status = String(business.status || '')
  const dealConfigured = deals.some((deal) => {
    const cashback = Number(deal.cash_back)
    if (!Number.isFinite(cashback) || cashback < 1 || cashback > 36) return false
    if (!deal.start_date || !deal.end_date) return false
    const start = new Date(deal.start_date)
    const end = new Date(deal.end_date)
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start
  })

  return {
    name: business.name || '',
    category: business.category || '',
    description: business.public_description || portal.description || '',
    logoUrl: business.logo_url || portal.logo_url || null,
    coverUrl: business.cover_photo_url || portal.cover_photo_url || null,
    captureHeadline: capture?.headline || portal.capture_offer_title || portal.offer_title || '',
    captureDescription: capture?.description || portal.capture_offer_description || portal.offer_description || '',
    captureValue: capture?.value_label || portal.capture_offer_value || portal.offer_value || '',
    hundredListInterest:
      portal.hundred_list_interest === 'interested' || portal.hundred_list_interest === 'not_now'
        ? portal.hundred_list_interest
        : capture
          ? 'interested'
          : null,
    dealConfigured,
    stripeConnected: business.stripe_onboarding_complete === true,
    liveReviewSubmitted: status === 'pending_live_review' || status === 'live' || business.stage === 'live',
  }
}
