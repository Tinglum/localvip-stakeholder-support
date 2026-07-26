/**
 * BUSINESS SETUP — single source of truth
 * ───────────────────────────────────────
 * Every setup task a business owner has to finish lives here: the step list, the
 * per-step completion rule, the completed count, and whether setup is done.
 *
 * Two callers, one rule set:
 *   - `/portal/setup` (the wizard) evaluates DRAFT signals from its own inputs so
 *     completion updates as the owner types.
 *   - Everything else (nav gating, dashboard summary) evaluates SAVED signals
 *     built from the business record, its offers, and its contacts.
 */

import { getBusinessJoinCaptureData } from '@/lib/business-join'
import { getBusinessPortalData, getContactListStatus } from '@/lib/business-portal'
import type { Business, Contact, Offer } from '@/lib/types/database'

export type BusinessSetupStepKey =
  | 'profile'
  | 'branding'
  | 'capture'
  | 'cashback'
  | 'list'
  | 'invite'
  | 'qr'
  | 'activate'

/**
 * `config` steps are edited inside the wizard itself. `action` steps are done on
 * another page (the 100 list) and are linked out to from the wizard.
 */
export type BusinessSetupStepKind = 'config' | 'action'

export interface BusinessSetupStep {
  key: BusinessSetupStepKey
  kind: BusinessSetupStepKind
  label: string
  description: string
  /** Plain-language reason, shown to owners who need the "why". */
  why: string
  time: string
  /** Where an `action` step is completed. Config steps stay in the wizard. */
  href?: string
  ctaLabel?: string
}

/** The invite target that counts the "invite people you know" step as done. */
export const BUSINESS_SETUP_INVITE_TARGET = 10

export const BUSINESS_SETUP_STEPS: BusinessSetupStep[] = [
  {
    key: 'profile',
    kind: 'config',
    label: 'Business Profile',
    description: 'Tell us the basics customers need to understand your business.',
    why: 'A clear profile helps customers quickly understand what you offer.',
    time: '5 minutes',
  },
  {
    key: 'branding',
    kind: 'config',
    label: 'Branding',
    description: 'Add a logo and cover image for your business-facing pages.',
    why: 'Your logo and cover are what people recognise on your join page and QR.',
    time: '5 minutes',
  },
  {
    key: 'capture',
    kind: 'config',
    label: '100-List Offer',
    description: 'Create the pre-launch offer used only to collect your first 100 customers.',
    why: 'A simple, specific offer is what makes people say yes on the spot.',
    time: '5 minutes',
  },
  {
    key: 'cashback',
    kind: 'config',
    label: 'LocalVIP Cashback',
    description: 'Set the live cashback customers will receive through LocalVIP.',
    why: 'This is the ongoing reward that brings customers back after launch.',
    time: '3 minutes',
  },
  {
    key: 'list',
    kind: 'action',
    label: 'Start your 100 list',
    description: 'Add the first people who already know your business.',
    why: 'This is how you build your first 100 supporters without cold outreach.',
    time: '5 to 10 minutes',
    href: '/portal/clients',
    ctaLabel: 'Open my 100 list',
  },
  {
    key: 'invite',
    kind: 'action',
    label: 'Invite people you already know',
    description: `Mark people as invited as you text, call, or talk to them. ${BUSINESS_SETUP_INVITE_TARGET} invites completes this step.`,
    why: 'Simple follow-up is what turns your list into real joins.',
    time: '10 minutes',
    href: '/portal/clients',
    ctaLabel: 'Start inviting',
  },
  {
    key: 'qr',
    kind: 'action',
    label: 'Share your join QR code',
    description: 'Put your QR where customers naturally pause, and ask them to scan it.',
    why: 'A visible QR code makes it easy for customers to join on the spot.',
    time: '2 minutes',
    href: '/portal/clients',
    ctaLabel: 'Open QR tools',
  },
  {
    key: 'activate',
    kind: 'config',
    label: 'Activate',
    description: 'Review your setup and submit it for LocalVIP go-live approval.',
    why: 'This is the point where your setup turns into steady, repeatable growth.',
    time: 'A few minutes',
  },
]

export const BUSINESS_SETUP_CONFIG_STEPS = BUSINESS_SETUP_STEPS.filter((step) => step.kind === 'config')
export const BUSINESS_SETUP_ACTION_STEPS = BUSINESS_SETUP_STEPS.filter((step) => step.kind === 'action')

/**
 * Everything the completion rules need. The wizard fills this from its live
 * inputs; every other caller fills it from saved records.
 */
export interface BusinessSetupSignals {
  name: string
  description: string
  logoUrl: string | null
  coverUrl: string | null
  captureHeadline: string
  captureDescription: string
  captureValue: string
  cashbackPercent: number
  /** The 10% default is a suggestion — this is true once a rate was really chosen. */
  cashbackChosen: boolean
  supportedCauseId: string | null
  contactsCount: number
  invitedCount: number
  joinReady: boolean
}

export interface BusinessSetupStepState extends BusinessSetupStep {
  complete: boolean
}

export interface BusinessSetupState {
  steps: BusinessSetupStepState[]
  configSteps: BusinessSetupStepState[]
  actionSteps: BusinessSetupStepState[]
  completedCount: number
  totalSteps: number
  /** Progress across the whole checklist, 0 to 1. */
  ratio: number
  /** True once every step — config and action — is finished. */
  isComplete: boolean
  /** True once the four editable steps are filled in and go-live can be submitted. */
  readyToActivate: boolean
  /** The first unfinished step, or null when there is nothing left. */
  nextStep: BusinessSetupStepState | null
}

function isFilled(value: string | null | undefined) {
  return !!value && !!value.trim()
}

export function isBusinessSetupStepComplete(key: BusinessSetupStepKey, signals: BusinessSetupSignals): boolean {
  switch (key) {
    // The two customer-facing details every business page needs today.
    case 'profile':
      return isFilled(signals.name) && isFilled(signals.description)
    case 'branding':
      return !!signals.logoUrl && !!signals.coverUrl
    // The capture offer isn't ready until headline, description and short value
    // label are all written.
    case 'capture':
      return isFilled(signals.captureHeadline) && isFilled(signals.captureDescription) && isFilled(signals.captureValue)
    case 'cashback':
      return (
        signals.cashbackPercent >= 5
        && signals.cashbackPercent <= 25
        && signals.cashbackChosen
        && !!signals.supportedCauseId
      )
    case 'list':
      return signals.contactsCount > 0
    case 'invite':
      return signals.invitedCount >= BUSINESS_SETUP_INVITE_TARGET
    case 'qr':
      return signals.joinReady
    // Activation is unlocked by the four editable steps. It cannot depend on
    // launch_phase, which QA does not persist.
    case 'activate':
      return (
        isBusinessSetupStepComplete('profile', signals)
        && isBusinessSetupStepComplete('branding', signals)
        && isBusinessSetupStepComplete('capture', signals)
        && isBusinessSetupStepComplete('cashback', signals)
      )
    default:
      return false
  }
}

export function getBusinessSetupState(signals: BusinessSetupSignals): BusinessSetupState {
  const steps: BusinessSetupStepState[] = BUSINESS_SETUP_STEPS.map((step) => ({
    ...step,
    complete: isBusinessSetupStepComplete(step.key, signals),
  }))

  const completedCount = steps.filter((step) => step.complete).length
  const readyToActivate = isBusinessSetupStepComplete('activate', signals)

  return {
    steps,
    configSteps: steps.filter((step) => step.kind === 'config'),
    actionSteps: steps.filter((step) => step.kind === 'action'),
    completedCount,
    totalSteps: steps.length,
    ratio: completedCount / steps.length,
    isComplete: completedCount === steps.length,
    readyToActivate,
    nextStep: steps.find((step) => !step.complete) || null,
  }
}

/** Saved-record signals — what the nav, the dashboard, and the "all set" state read. */
export function getBusinessSetupSignals(input: {
  business: Business | null
  offers: Offer[]
  contacts: Contact[]
}): BusinessSetupSignals {
  const { business, offers, contacts } = input

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
      contactsCount: 0,
      invitedCount: 0,
      joinReady: false,
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
  const joinCapture = getBusinessJoinCaptureData(business)

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
    contactsCount: contacts.length,
    invitedCount: contacts.filter((contact) => getContactListStatus(contact) !== 'added').length,
    joinReady: !!(joinCapture.join_url || joinCapture.qr_code_id),
  }
}
