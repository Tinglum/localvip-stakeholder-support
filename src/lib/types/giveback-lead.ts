/**
 * A business that scanned a school Giveback Day flyer and submitted the public
 * landing-page form. Mirrors the backend's GivebackLead projection.
 *
 * A lead is NOT a business: it lives in its own table and creates nothing until
 * an operator approves it, at which point the backend registers the Account and
 * attaches it to `sponsorUserId` — whoever shared the flyer.
 */
export interface GivebackLead {
  id: number
  /** Landing-page slug, e.g. 'OlatheWest'. */
  campaign: string | null
  businessName: string
  contactName: string
  email: string
  phone: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null
  businessType: number | null
  preferredDay: string | null
  notes: string | null
  /** Referral code from the flyer's QR, as submitted. */
  refCode: string | null
  /** Null when the code did not resolve; approval then requires picking a sponsor. */
  sponsorUserId: number | null
  sponsorName: string | null
  status: 'pending' | 'approved' | 'declined'
  approvedBusinessAccountId: number | null
  createdDate: string
}
