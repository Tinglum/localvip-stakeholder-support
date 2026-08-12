/**
 * The three codes a business can hand a customer, and the one place their names
 * are defined.
 *
 * These are genuinely different products and were being described in overlapping
 * language - "customer capture", "capture offer", "100-list", "network
 * referral", "referral link", "join link" - with TWO of them routinely called
 * "referral". A business could not tell which QR did what.
 *
 * Every surface must take its wording from here. Two rules do the real work:
 *
 *   "Referral" means LocalVIP, and only LocalVIP. The Boomerang list refers
 *   nobody to anything.
 *
 *   "Customers" and "list" mean Boomerang, and only Boomerang. A LocalVIP
 *   referral produces members, not list entries.
 *
 * "Customer capture" is retired as user-facing wording: it describes what the
 * system does rather than what the business gets, and it reads close enough to
 * "customer referral" to be mistaken for the other thing.
 *
 * Stored identifiers (business_capture, hundred_list_interest) are deliberately
 * left alone - they are unambiguous in code, and renaming them is a migration
 * with no user-visible benefit. The confusion was only ever in the labels.
 */

/** Backend QR purpose values. Storage-level, never shown to anyone. */
export type EngagementCodeKind =
  | 'business_capture'
  | 'business_network_referral'
  | 'business_custom'

export interface EngagementCodeCopy {
  /** Short label for a button, option or tab. */
  label: string
  /** What the customer who scans it ends up doing. One sentence, plain. */
  outcome: string
  /** What the business gets out of it. */
  benefit: string
  /** Used where a QR needs naming in a list. */
  qrLabel: string
  /** Used where the link itself is shown or copied. */
  linkLabel: string
}

export const ENGAGEMENT_CODES: Record<EngagementCodeKind, EngagementCodeCopy> = {
  business_capture: {
    label: 'Boomerang list',
    outcome: 'Customers join your own list so you can promote to them directly.',
    benefit: 'Builds a list of your customers that belongs to you.',
    qrLabel: 'Boomerang list QR',
    linkLabel: 'Boomerang list link',
  },
  business_network_referral: {
    label: 'LocalVIP referral',
    outcome: 'People join LocalVIP through you, and you get the credit.',
    benefit: 'Earns you referral credit on everything they spend.',
    qrLabel: 'LocalVIP referral QR',
    linkLabel: 'LocalVIP referral link',
  },
  business_custom: {
    label: 'Custom QR',
    outcome: 'Sends people to a link you chose.',
    benefit: 'Points anywhere you need — a menu, a booking page, a form.',
    qrLabel: 'Custom QR',
    linkLabel: 'Custom link',
  },
}

/** Recorded during onboarding when a business is asked about the Boomerang list. */
export type BoomerangInterest = 'interested' | 'not_now' | null | undefined

/**
 * Whether Boomerang surfaces may be shown to THIS business.
 *
 * Only an explicit "interested" opens it. Both "not_now" and never-asked stay
 * closed: showing the feature to a business that has not agreed to it is the
 * behaviour this replaces, and an unanswered question is not a yes.
 *
 * Admin surfaces are exempt by design - an operator needs to see that a business
 * declined, otherwise "no Boomerang assets" looks like a bug.
 */
export function isBoomerangEnabled(interest: BoomerangInterest): boolean {
  return interest === 'interested'
}

/** Why Boomerang is hidden, for an operator looking at a business that has none. */
export function describeBoomerangState(interest: BoomerangInterest): string {
  if (interest === 'interested') return 'Boomerang list is on for this business.'
  if (interest === 'not_now') return 'This business declined the Boomerang list, so none of it is shown to them.'
  return 'This business has not been asked about the Boomerang list yet, so none of it is shown to them.'
}
