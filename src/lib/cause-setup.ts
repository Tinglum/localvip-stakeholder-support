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

/**
 * The four photo slots, in the order they are collected. The names are the
 * webapp's own `Campaign.assets` slot names, so one upload set feeds both the
 * landing page and the 60-second cause video (which has four image beats).
 *
 * `crowd` is the original single "cover photo": existing causes keep whatever
 * they already uploaded and are never asked to redo it.
 *
 * Only `crowd` is required to finish setup and go live — registering is pitched
 * as "about a minute". All four are required to PUBLISH, so a page or a video
 * never ships as four game photos that sell a team instead of a community.
 */
export type CausePhotoSlot = 'crowd' | 'team' | 'people' | 'community'

export interface CausePhotoPrompt {
  slot: CausePhotoSlot
  label: string
  /** One line telling the user what this specific photo is for. */
  description: string
  /** Required to finish setup and go live (as opposed to only to publish). */
  requiredForGoLive: boolean
}

export const CAUSE_PHOTO_PROMPTS: CausePhotoPrompt[] = [
  {
    slot: 'crowd',
    label: 'Supporters together',
    description: 'A crowd, a stand, a game. A local business owner should look at this and see their customers.',
    requiredForGoLive: true,
  },
  {
    slot: 'team',
    label: 'Who you are funding',
    description: 'The team, squad, class or group the money goes to.',
    requiredForGoLive: false,
  },
  {
    slot: 'people',
    label: 'Families and volunteers',
    description: 'People, not sport. If every photo is game day, your page sells a team instead of a community.',
    requiredForGoLive: false,
  },
  {
    slot: 'community',
    label: 'Your wider community',
    description: 'A main street, a fundraiser, a local business. Where your supporters actually live and shop.',
    requiredForGoLive: false,
  },
]

export const CAUSE_BRAND_STEPS: CauseSetupStep[] = [
  { key: 'images', track: 'brand', label: 'Logo & photos', description: 'Your logo and four photos of your real community. One photo gets you live; all four are needed before you can publish.' },
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
  /** One entry per photo slot; `crowd` carries the old single cover photo. */
  photoUrls: Record<CausePhotoSlot, string>
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
    // Go-live threshold: logo plus the one `crowd` photo. The other three are
    // prompted for here but only gate publishing (see missingCausePhotos).
    case 'images': return filled(s.logoUrl) && filled(s.photoUrls.crowd)
    case 'colors': return s.colorsConfirmed
    case 'materials': return s.generatedCount > 0
    case 'landing': return s.landingPublished
    default: return false
  }
}

/**
 * The photo slots still empty. Publishing the landing page (and so the printed
 * flyers and the shared link) is blocked while this is non-empty; go-live is
 * not. Keep this the single source of truth for "which photos are missing".
 */
export function missingCausePhotos(s: CauseSetupSignals): CausePhotoPrompt[] {
  return CAUSE_PHOTO_PROMPTS.filter((prompt) => !filled(s.photoUrls[prompt.slot]))
}

/** True once all four photos are in, i.e. the page is publishable. */
export function hasAllCausePhotos(s: CauseSetupSignals) {
  return missingCausePhotos(s).length === 0
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
