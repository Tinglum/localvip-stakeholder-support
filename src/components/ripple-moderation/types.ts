// Shape of the Ripple moderation queue as served by the QA backend
// (`/api/dashboard/v1/Ripple/moderation`) and proxied through
// `/api/admin/ripple/moderation`.

export interface RippleModerationReport {
  id: string
  reasonCode: string | null
  details: string | null
  anonymous: boolean
  createdAtUtc: string | null
}

export interface RippleModerationItem {
  recommendationId: string
  businessAccountId: string | null
  businessName: string | null
  preview: string | null
  tagLine: string | null
  standoutCode: string | null
  otherText: string | null
  displayName: string | null
  rating: number | null
  moderationStatus: string | null
  reportCount: number | null
  createdAtUtc: string | null
  reports: RippleModerationReport[] | null
}

export interface RippleModerationResponse {
  items: RippleModerationItem[]
  total: number
}

export type ModerationAction = 'clear' | 'withhold' | 'revoke'
