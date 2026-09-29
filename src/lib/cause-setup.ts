/**
 * Cause (school / PTA / booster / nonprofit) self-serve setup, in two tracks:
 *
 *  1. ACCOUNT: what the cause must finish before LocalVIP reviews it for go-live.
 *     No payout, bank or tax steps: early rounds are paid by check, and those
 *     details are collected when the first check is due, not here.
 *  2. BRAND & MATERIALS: what makes it ready to promote: logo, photos, colours,
 *     QR, flyers, landing page. Recommended, and not required for go-live.
 *
 * Go-live mirrors businesses: the cause submits (CRM status
 * `pending_live_review`) and LocalVIP staff approve it (stage `live`).
 */

export type CauseSetupTrack = 'account' | 'brand'
export type CauseAccountStepKey = 'profile' | 'contact' | 'golive'
export type CauseBrandStepKey = 'images' | 'colors' | 'materials' | 'landing'
export type CauseSetupStepKey = CauseAccountStepKey | CauseBrandStepKey

export interface CauseSetupStep {
  key: CauseSetupStepKey
  track: CauseSetupTrack
  label: string
  description: string
}

export const CAUSE_ACCOUNT_STEPS: CauseSetupStep[] = [
  { key: 'profile', track: 'account', label: 'Organization profile', description: 'Your name, what kind of organization you are, and one line about your mission.' },
  { key: 'contact', track: 'account', label: 'Location & contact', description: 'Where you are and how supporters and LocalVIP can reach you.' },
  { key: 'golive', track: 'account', label: 'Go live', description: 'Send your account to LocalVIP for a final check before supporters can choose you.' },
]

export const CAUSE_BRAND_STEPS: CauseSetupStep[] = [
  { key: 'images', track: 'brand', label: 'Logo & cover photo', description: 'Your logo and one wide photo of your real community.' },
  { key: 'colors', track: 'brand', label: 'Brand colors', description: 'The colors your flyers and landing page use, pulled from your logo if you do not have set colors.' },
  { key: 'materials', track: 'brand', label: 'Flyers & materials', description: 'Print-ready flyers for families and local businesses, in your colors.' },
  { key: 'landing', track: 'brand', label: 'Landing page', description: 'Your own page that explains LocalVIP to your families and businesses.' },
]

export const CAUSE_ORGANIZATION_TYPES = ['School', 'PTA / PTO', 'Booster club', 'Nonprofit', 'Church', 'Community group'] as const

export interface CauseSetupSignals {
  name: string
  category: string
  headline: string
  city: string
  email: string
  phone: string
  referralCode: string
  crmStage: string
  crmStatus: string
  logoUrl: string
  coverUrl: string
  colorsConfirmed: boolean
  qrCount: number
  generatedCount: number
  landingPublished: boolean
}

const filled = (value: string | null | undefined) => !!value && !!value.trim()

export function isCauseLive(signals: CauseSetupSignals) {
  return signals.crmStage.toLowerCase() === 'live'
}

export function isCauseAwaitingReview(signals: CauseSetupSignals) {
  return !isCauseLive(signals) && signals.crmStatus === 'pending_live_review'
}

export function isCauseSetupStepComplete(key: CauseSetupStepKey, s: CauseSetupSignals): boolean {
  switch (key) {
    case 'profile': return filled(s.name) && filled(s.category) && filled(s.headline)
    case 'contact': return filled(s.city) && (filled(s.phone) || filled(s.email))
    case 'golive': return isCauseLive(s)
    case 'images': return filled(s.logoUrl) && filled(s.coverUrl)
    case 'colors': return s.colorsConfirmed
    case 'materials': return s.generatedCount > 0
    case 'landing': return s.landingPublished
    default: return false
  }
}

/** Everything the go-live review needs, i.e. every account step before "Go live". */
export function canSubmitCauseForReview(s: CauseSetupSignals) {
  return CAUSE_ACCOUNT_STEPS
    .filter((step) => step.key !== 'golive')
    .every((step) => isCauseSetupStepComplete(step.key, s))
}

export function getCauseSetupProgress(s: CauseSetupSignals) {
  const account = CAUSE_ACCOUNT_STEPS.map((step) => ({ ...step, complete: isCauseSetupStepComplete(step.key, s) }))
  const brand = CAUSE_BRAND_STEPS.map((step) => ({ ...step, complete: isCauseSetupStepComplete(step.key, s) }))
  const accountDone = account.filter((step) => step.complete).length
  const brandDone = brand.filter((step) => step.complete).length
  return {
    account,
    brand,
    accountDone,
    brandDone,
    accountTotal: account.length,
    brandTotal: brand.length,
    allDone: accountDone === account.length && brandDone === brand.length,
    nextStep: [...account, ...brand].find((step) => !step.complete) || null,
  }
}
