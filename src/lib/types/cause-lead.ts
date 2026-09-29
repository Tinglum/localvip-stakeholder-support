/**
 * A cause that submitted the public sign-up form at my.localvip.com/home/causes.
 *
 * Mirrors the backend's CauseLead projection (CauseLeadController.GetLeads).
 * A lead is NOT a cause: it lives in its own table so that an anonymous public
 * form can never write into Accounts. Approving one is what registers the real
 * NonProfit account — nothing exists until then.
 */
export interface CauseLead {
  id: number
  /** Landing-page slug the form was submitted from, e.g. 'OlatheWest'. */
  campaign: string | null
  organizationName: string | null
  /** One of ORGANIZATION_TYPE_LABELS below; lower-cased by the backend. */
  organizationType: string | null
  website: string | null
  contactName: string | null
  contactTitle: string | null
  email: string | null
  phone: string | null
  /**
   * Usually null. The public form makes a street address optional, but the
   * registration path the approval runs through requires one, so the reviewer
   * supplies it at approval time.
   */
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null
  /** One of SUPPORTER_COUNT_LABELS below, or null when not answered. */
  supporterCount: string | null
  /** Free text — what the cause is raising money for. The reason to read a lead. */
  notes: string | null
  /** Referral code carried in by the link, as submitted. */
  refCode: string | null
  /** Null when the code did not resolve to a user, or no code was present. */
  sponsorUserId: number | null
  sponsorName: string | null
  status: 'pending' | 'approved' | 'declined'
  approvedAccountId: number | null
  submittedAt: string | null
  createdDate: string
}

export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
  school: 'School',
  pto: 'PTO / PTA',
  booster: 'Booster Club',
  faith: 'Faith Community',
  nonprofit: 'Nonprofit',
  community: 'Community Group',
  other: 'Other',
}

export const SUPPORTER_COUNT_LABELS: Record<string, string> = {
  'under-100': 'Under 100',
  '100-500': '100 – 500',
  '500-2000': '500 – 2,000',
  'over-2000': 'Over 2,000',
}

/** Corrections a reviewer may apply while approving. Mirrors ApproveRequest. */
export interface CauseLeadApproveInput {
  address1?: string
  address2?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  category?: string
  sponsorUserId?: number | null
  sendInvite?: boolean
}

export function formatLeadLocation(lead: CauseLead) {
  return [lead.city, lead.state, lead.zipCode].filter(Boolean).join(', ')
}

export function formatLeadAddress(lead: CauseLead) {
  return [lead.address1, lead.address2, lead.city, lead.state, lead.zipCode, lead.country]
    .filter(Boolean)
    .join(', ')
}
